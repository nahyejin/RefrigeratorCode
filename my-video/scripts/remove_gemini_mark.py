"""Gemini(Veo) 영상 우하단의 반투명 ✦ 표식 제거 — 자르거나 크기를 바꾸지 않고 그 자리만 복원한다.

    PYTHONUTF8=1 python scripts/remove_gemini_mark.py in.mp4 out.mp4 [--roi X Y W H]

원리: 표식은 매 프레임 같은 자리·같은 모양으로 얹힌 반투명 흰 도장(O = (1-a)·B + a·255, a≈0.5)이다.
720x1280 훅 클립 22개 모두 별 중심이 약 (x600, y1160) 이고 모양이 같아서, 4번 클립에서 시간 표준편차로 뽑아 둔 별 모양
(scripts/gemini_star_mask.png, ROI 80x80 기준)을 그대로 쓴다.
  1) 프레임마다 「별 안쪽 평균 / 바로 바깥 띠 평균」으로 채널별 투명도 a 를 구하되, 클립 전체에서 구한 값(a_g) 근처로 묶는다
     (밝은 배경에선 O-B 가 거의 0 이라 프레임별 추정이 흔들리기 때문)
  2) B = (O - a·255) / (1-a) 로 되돌리고, 가장자리 띠는 주변 인페인트와 섞어 정리
오디오는 원본 그대로 복사(AAC 가 아니면 AAC 로 변환). 프레임 수·길이는 원본과 같다.
표식이 없는 클립(예: 424x720 재인코딩본)에 돌리면 오히려 얼룩이 생기니, 먼저 우하단을 눈으로 확인할 것.
"""
import argparse
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

WHITE = 255.0
FORCE = False
MASK_PATH = Path(__file__).with_name("gemini_star_mask.png")


def probe(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
         "-of", "csv=p=0", str(path)], text=True).strip().split(",")
    w, h = int(out[0]), int(out[1])
    n, d = out[2].split("/")
    return w, h, float(n) / float(d)


def audio_codec(path):
    out = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_name",
                                   "-of", "csv=p=0", str(path)], text=True).strip()
    return out or None


def read_frames(path, w, h):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(path), "-fps_mode", "passthrough", "-f", "rawvideo",
                          "-pix_fmt", "bgr24", "-"], stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        b = p.stdout.read(size)
        if len(b) < size:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()


def rings(core):
    inner = cv2.erode(core, np.ones((5, 5), np.uint8)) > 0
    ring = (cv2.dilate(core, np.ones((15, 15), np.uint8)) - cv2.dilate(core, np.ones((9, 9), np.uint8))) > 0
    return inner, ring


def measure(rois, core):
    """프레임별 (안쪽 평균 O, 배경 추정 평균 B) 채널별 → (T,3),(T,3)

    B 는 바깥 띠 평균이 아니라 「별 자리를 주변에서 인페인트로 메운 그림의 안쪽 평균」을 쓴다. 바깥 띠 평균은 별이 밝기 경계(옷깃·
    탁자 모서리)에 걸칠 때 크게 틀려서, 되돌린 뒤 별 모양 얼룩이 남았다.
    """
    inner, _ = rings(core)
    hole = cv2.dilate(core, np.ones((13, 13), np.uint8))
    o = np.stack([r[inner].mean(axis=0) for r in rois]).astype(np.float32)
    b = np.stack([cv2.inpaint(r, hole, 5, cv2.INPAINT_TELEA)[inner].mean(axis=0) for r in rois]).astype(np.float32)
    return o, b


def alphas(o, b):
    """클립 전체 투명도 a_g(가중 최소제곱)와 프레임·채널별 a_t(a_g±0.06 로 묶음, 이동평균).

    투명도는 클립마다 다르다(4번 원본 0.53, 나머지 0.25~0.5 — 2026-10-12 22개 측정). 표식이 없는 클립은 별 안쪽이 바깥 띠보다
    밝아지지 않으므로(중앙값 +8 미만) 종료 코드 3 으로 알리고 아무것도 쓰지 않는다.
    """
    lift = float(np.median((o - b).mean(axis=1)))
    if lift < 8 and not FORCE:
        print(f"NO_STAR 별 안쪽이 바깥보다 밝지 않다(+{lift:.1f}) — 표식이 없는 클립으로 보고 건너뜀", file=sys.stderr)
        sys.exit(3)
    d = WHITE - b
    raw = float((((o - b) * d).sum()) / (d * d).sum())
    a_g = float(np.clip(raw, 0.18, 0.65))
    a_t = np.where(d > 60, (o - b) / np.maximum(d, 1), a_g)
    a_t = np.clip(a_t, a_g - 0.06, a_g + 0.06)
    k = 9
    pad = np.pad(a_t, ((k // 2, k // 2), (0, 0)), mode="edge")
    a_t = np.stack([pad[i:i + k].mean(axis=0) for i in range(len(a_t))])
    return a_g, a_t


def restore(frame_roi, core, a_c):
    f = frame_roi.astype(np.float32)
    am = cv2.GaussianBlur(core.astype(np.float32), (0, 0), 0.8)[..., None] * a_c.reshape(1, 1, 3)
    inv = np.clip((f - am * WHITE) / (1 - am), 0, 255)
    inv = cv2.bilateralFilter(inv.astype(np.uint8), 5, 20, 3).astype(np.float32)  # 되돌리며 커진 노이즈만 살짝 정리
    # 가장자리 띠(안티앨리어싱·옅은 번짐)는 주변을 인페인트로 메워 덮는다
    ring_hard = cv2.dilate(core, np.ones((11, 11), np.uint8)) - cv2.erode(core, np.ones((5, 5), np.uint8))
    inp = cv2.inpaint(frame_roi, cv2.dilate(core, np.ones((13, 13), np.uint8)), 5, cv2.INPAINT_TELEA).astype(np.float32)
    ring = cv2.GaussianBlur(ring_hard.astype(np.float32), (0, 0), 1.2)[..., None].clip(0, 1)
    out = inv * (1 - ring) + inp * ring
    area = cv2.dilate(core, np.ones((15, 15), np.uint8))[..., None] > 0
    return np.clip(np.where(area, out, f), 0, 255).astype(np.uint8)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("dst")
    ap.add_argument("--roi", type=int, nargs=4, default=[560, 1120, 80, 80], metavar=("X", "Y", "W", "H"),
                    help="별 마스크가 놓이는 80x80 상자(720x1280 기준 기본값)")
    ap.add_argument("--crf", default="12")
    ap.add_argument("--force", action="store_true")
    a_ = ap.parse_args()
    global FORCE
    FORCE = a_.force
    w, h, fps = probe(a_.src)
    core = (cv2.imread(str(MASK_PATH), cv2.IMREAD_GRAYSCALE) > 127).astype(np.uint8)
    assert core.shape == (a_.roi[3], a_.roi[2]), "별 마스크 크기와 ROI 가 다르다"
    frames = [f.copy() for f in read_frames(a_.src, w, h)]
    x, y, rw, rh = a_.roi  # 22개 클립 모두 마스크 윤곽이 별과 정확히 겹침을 눈으로 확인(정렬 탐색은 오히려 어긋나서 뺌)
    o, b = measure([f[y:y + rh, x:x + rw] for f in frames], core)
    a_g, a_t = alphas(o, b)
    print(f"frames={len(frames)} a_g={a_g:.2f} a_t range {a_t.min():.2f}~{a_t.max():.2f} bg_mean={b.mean():.0f}", file=sys.stderr)
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
         "-i", str(a_.src), "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "slow", "-crf", a_.crf,
         "-pix_fmt", "yuv420p", "-c:a", ("copy" if audio_codec(a_.src) == "aac" else "aac"), str(a_.dst)], stdin=subprocess.PIPE)
    for f, a_c in zip(frames, a_t):
        g = f.copy()
        g[y:y + rh, x:x + rw] = restore(f[y:y + rh, x:x + rw], core, a_c)
        enc.stdin.write(g.tobytes())
    enc.stdin.close()
    enc.wait()


if __name__ == "__main__":
    main()
