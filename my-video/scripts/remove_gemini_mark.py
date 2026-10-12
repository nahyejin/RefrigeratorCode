"""Gemini(Veo) 영상 우하단의 반투명 ✦ 표식 제거 — 자르거나 크기를 바꾸지 않고 그 자리만 복원한다.

    PYTHONUTF8=1 python scripts/remove_gemini_mark.py in.mp4 out.mp4 [--roi X Y W H] [--debug-dir DIR]

원리: 표식은 매 프레임 같은 자리에 같은 모양으로 얹힌 반투명 도장(O = (1-a)·B + a·W)이라,
영상 전체에서 그 자리의 밝기 변화(표준편차)를 보면 배경이 움직여도 별 모양만 변화가 확 줄어든다.
  1) 표준편차 지도의 낮은 영역 = 별 위치
  2) 프레임마다 주변을 인페인트한 배경 추정과 비교해 픽셀별 투명도 a 를 시간 중앙값으로 구함(W=흰색 가정, a≈0.5)
  3) 프레임마다 B = (O - a·W) / (1-a) 로 되돌리고, 가장자리·잔여는 주변 인페인트와 섞어 정리
오디오는 원본 그대로 복사. 훅 클립은 모두 720x1280 이고 표식이 같은 자리(대략 x600,y1160)에 있다.
"""
import argparse
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np


def probe(path):
    out = subprocess.check_output(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height,r_frame_rate",
         "-of", "csv=p=0", str(path)], text=True).strip().split(",")
    w, h = int(out[0]), int(out[1])
    n, d = out[2].split("/")
    return w, h, float(n) / float(d)


def read_frames(path, w, h):
    p = subprocess.Popen(["ffmpeg", "-v", "error", "-i", str(path), "-fps_mode", "passthrough", "-f", "rawvideo", "-pix_fmt", "bgr24", "-"],
                         stdout=subprocess.PIPE)
    size = w * h * 3
    while True:
        b = p.stdout.read(size)
        if len(b) < size:
            break
        yield np.frombuffer(b, np.uint8).reshape(h, w, 3)
    p.wait()


WHITE = 255.0  # 모양 추정용 가정(투명도 지도)
# 별 색은 흰색(255) 가정. 투명도는 클립·배경 밝기에 따라 0.45~0.55 로 달라서(고정값을 쓰면 어두운 배경에서 얼룩이 남는다)
# 프레임마다 「별 안쪽 평균이 바로 바깥 띠 평균과 이어지도록」 채널별로 맞춘다(estimate_a).
STAR_BGR = np.array([255.0, 255.0, 255.0], np.float32)


def estimate(frames_roi):
    """프레임별 ROI 스택 → 픽셀별 투명도 지도 alpha(h,w)

    1) 시간 표준편차가 확 낮은 자리 = 대략의 별 위치(거친 마스크)
    2) 프레임마다 마스크 주변에서 배경을 인페인트로 메워 B̂ 를 만들고, (O-B̂)/(W-B̂) 를 시간 중앙값으로 모으면
       픽셀별 투명도가 나온다(배경이 움직이므로 중앙값이 질감 오차를 지워 준다).
    """
    P = np.stack(frames_roi)  # T,h,w,3 uint8
    std = P.astype(np.float32).std(axis=0).mean(axis=2)
    s = cv2.GaussianBlur(std, (0, 0), 0.8)
    s8 = np.clip(s / s.max() * 255, 0, 255).astype(np.uint8)
    thr, _ = cv2.threshold(s8, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    rough = (s8 < thr).astype(np.uint8)
    n, lab, stats, cen = cv2.connectedComponentsWithStats(rough)
    h, w = rough.shape
    best, bd = 0, 1e9
    for i in range(1, n):
        if stats[i, cv2.CC_STAT_AREA] < 150:
            continue
        d = (cen[i][0] - w / 2) ** 2 + (cen[i][1] - h / 2) ** 2
        if d < bd:
            best, bd = i, d
    rough = (lab == best).astype(np.uint8)
    dil = cv2.dilate(rough, np.ones((9, 9), np.uint8))
    ests = []
    for f in P:
        bh = cv2.inpaint(f, dil, 5, cv2.INPAINT_TELEA).astype(np.float32)
        o = f.astype(np.float32)
        ests.append(((o - bh) / np.maximum(WHITE - bh, 25)).mean(axis=2))
    alpha = np.clip(np.median(np.stack(ests), axis=0), 0, 0.8)
    alpha = cv2.GaussianBlur(alpha, (0, 0), 0.7)
    alpha[dil == 0] = 0
    return alpha, std


def star_core(alpha):
    return (alpha > 0.30).astype(np.uint8)


def frame_alpha(frame_roi, alpha):
    """프레임 하나의 채널별 투명도: 별 안쪽 평균 = (1-a)·(바깥 띠 평균) + a·255 를 만족하는 a"""
    core = star_core(alpha)
    inner = cv2.erode(core, np.ones((5, 5), np.uint8)) > 0
    ring = (cv2.dilate(core, np.ones((15, 15), np.uint8)) - cv2.dilate(core, np.ones((9, 9), np.uint8))) > 0
    f = frame_roi.astype(np.float32)
    o, b = f[inner].mean(axis=0), f[ring].mean(axis=0)
    return np.clip((o - b) / np.maximum(WHITE - b, 30), 0.30, 0.65)


def restore(frame_roi, alpha, a_c):
    f = frame_roi.astype(np.float32)
    core = star_core(alpha)
    am = cv2.GaussianBlur(core.astype(np.float32), (0, 0), 0.8)[..., None] * a_c.reshape(1, 1, 3)
    inv = np.clip((f - am * STAR_BGR) / (1 - am), 0, 255)
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
    ap.add_argument("--roi", type=int, nargs=4, default=[560, 1120, 80, 80], metavar=("X", "Y", "W", "H"))
    ap.add_argument("--debug-dir")
    ap.add_argument("--crf", default="12")
    a_ = ap.parse_args()
    w, h, fps = probe(a_.src)
    x, y, rw, rh = a_.roi
    frames = [f.copy() for f in read_frames(a_.src, w, h)]
    alpha, std = estimate([f[y:y + rh, x:x + rw] for f in frames])
    print(f"frames={len(frames)} star_px={int((alpha > 0.3).sum())}", file=sys.stderr)
    if a_.debug_dir:
        d = Path(a_.debug_dir)
        d.mkdir(parents=True, exist_ok=True)
        cv2.imwrite(str(d / "alpha.png"), cv2.resize((alpha / 0.8 * 255).astype(np.uint8), None, fx=6, fy=6, interpolation=cv2.INTER_NEAREST))
    enc = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
         "-i", str(a_.src), "-map", "0:v", "-map", "1:a?", "-c:v", "libx264", "-preset", "slow", "-crf", a_.crf,
         "-pix_fmt", "yuv420p", "-c:a", "copy", str(a_.dst)], stdin=subprocess.PIPE)
    ac = np.stack([frame_alpha(f[y:y + rh, x:x + rw], alpha) for f in frames])
    k = 9  # 프레임마다 흔들리지 않게 앞뒤 4프레임 이동평균
    pad = np.pad(ac, ((k // 2, k // 2), (0, 0)), mode="edge")
    ac = np.stack([pad[i:i + k].mean(axis=0) for i in range(len(ac))])
    print("alpha(BGR) mean", ac.mean(axis=0).round(2), "min", ac.min().round(2), "max", ac.max().round(2), file=sys.stderr)
    for f, a_c in zip(frames, ac):
        g = f.copy()
        g[y:y + rh, x:x + rw] = restore(f[y:y + rh, x:x + rw], alpha, a_c)
        enc.stdin.write(g.tobytes())
    enc.stdin.close()
    enc.wait()


if __name__ == "__main__":
    main()
