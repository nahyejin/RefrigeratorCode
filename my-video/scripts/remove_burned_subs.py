"""제미나이(Veo)가 화면에 박아 넣은 자막을 지운다(2026-10-08, 4편 냉장고 문 v3 훅에서 처음 사용).

    python scripts/remove_burned_subs.py in.mp4 out_video_only.mp4 "x0,y0,x1,y1" ["x0,y0,x1,y1" ...]
    ffmpeg -i out_video_only.mp4 -i in.mp4 -map 0:v -map 1:a -c:v libx264 -crf 16 -pix_fmt yuv420p -c:a copy out.mp4   # 소리 되붙이기

상자는 원본 픽셀 좌표로 넉넉하게. 배경이 움직이지 않는 자리(벽·선반·찬장)에 뜬 자막에만 깔끔하다 — 사람 얼굴·몸 위의 자막은 못 지운다.

자막마다 「뜨기 직전의 깨끗한 프레임」을 기준으로 잡고, 매 프레임 카메라 흔들림(아핀)을 배경으로 맞춘 뒤
자막 상자 안에서 기준과 달라진 픽셀(=글자·그림자)만 기준 배경으로 덮는다.
"""
import sys
import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
H, W = frames[0].shape[:2]
print("frames", len(frames), fps, W, H)

# (x0, y0, x1, y1) — 원본 픽셀 기준. 4편 예: "398,528,572,594" "396,596,484,650" "326,706,534,762"
BOXES = {f"box{i + 1}": tuple(int(v) for v in a.split(",")) for i, a in enumerate(sys.argv[3:])}


def white_count(f, box):
    x0, y0, x1, y1 = box
    roi = f[y0:y1, x0:x1].astype(np.int16)
    mx, mn = roi.max(2), roi.min(2)
    return int(((mn > 238) & (mx - mn < 18)).sum())


# 배경 맞추기용 마스크: 주방 벽·선반(사람·자막 제외)
roi_mask = np.zeros((H, W), np.uint8)
roi_mask[150:700, 340:610] = 255
for b in BOXES.values():
    x0, y0, x1, y1 = b
    roi_mask[y0 - 6:y1 + 6, x0 - 6:x1 + 6] = 0

gray = [cv2.GaussianBlur(cv2.cvtColor(f, cv2.COLOR_BGR2GRAY), (3, 3), 0) for f in frames]
out = [f.copy() for f in frames]

for name, box in BOXES.items():
    counts = [white_count(f, box) for f in frames]
    base = np.median(counts[: len(counts) // 2])
    start = next(i for i, c in enumerate(counts) if c > base + 60 and all(cc > base + 60 for cc in counts[i:i + 6]))
    # 글자가 서서히 나타나고 사라지는 프레임까지 덮도록 앞뒤로 4프레임씩 여유, 기준은 그보다 더 앞의 깨끗한 프레임
    ref_i = max(0, start - 6)
    # 자막이 중간에 사라지는 경우(4편 세로 「● 응」 7.62~8.29s) 그 뒤 프레임은 건드리지 않는다
    end = min(len(frames) - 1, max(i for i, c in enumerate(counts) if c > base + 60) + 4)
    start = max(ref_i + 1, start - 4)
    print(f"{name}: frames {start}~{end} ({start / fps:.2f}~{end / fps:.2f}s), ref {ref_i}, base {base}")
    x0, y0, x1, y1 = box
    ref = frames[ref_i]
    # 덮을 자리를 프레임마다 따로 잡으면 글자 그림자가 덮였다 안 덮였다 하며 「지지직」 깜빡인다(10-08 사용자 지적).
    # 자막은 화면에 고정돼 있으니, 모든 등장 프레임의 글자 자리(흰 획 + 테두리)를 합쳐 한 장의 고정 마스크로 덮는다.
    union = np.zeros((y1 - y0, x1 - x0), np.uint8)
    for i in range(start, end + 1):
        roi = frames[i][y0:y1, x0:x1].astype(np.int16)
        mx, mn = roi.max(2), roi.min(2)
        union |= ((mn > 225) & (mx - mn < 25)).astype(np.uint8)
    union = cv2.dilate(union * 255, np.ones((9, 9), np.uint8))
    static_m = cv2.GaussianBlur(union, (7, 7), 0).astype(np.float32)[..., None] / 255.0
    sift = cv2.SIFT_create(3000)
    feat_mask = np.full((H, W), 255, np.uint8)
    for b in BOXES.values():
        bx0, by0, bx1, by1 = b
        feat_mask[by0 - 8:by1 + 8, bx0 - 8:bx1 + 8] = 0
    kr, dr = sift.detectAndCompute(gray[ref_i], feat_mask)
    matcher = cv2.BFMatcher()
    Hm_prev = np.eye(3)
    for i in range(start - 1, min(end + 1, len(frames))):
        kc, dc = sift.detectAndCompute(gray[i], feat_mask)
        Hm = Hm_prev
        if dc is not None and len(kc) > 20:
            good = [m for m, n in matcher.knnMatch(dr, dc, k=2) if m.distance < 0.7 * n.distance]
            if len(good) > 25:
                pr = np.float32([kr[m.queryIdx].pt for m in good])
                pc = np.float32([kc[m.trainIdx].pt for m in good])
                Hc, inl = cv2.findHomography(pr, pc, cv2.RANSAC, 2.0)
                if Hc is not None and inl.sum() > 20:
                    Hm = Hc
        Hm_prev = Hm
        warped = cv2.warpPerspective(ref, Hm, (W, H), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        if i in (start, len(frames) - 1):
            d_all = np.abs(gray[i].astype(np.int16) - cv2.warpPerspective(gray[ref_i], Hm, (W, H)).astype(np.int16))
            print(f"   frame {i}: inliers ok, bg diff median {np.median(d_all[150:700, 340:610]):.1f}")
        cur = out[i]
        m = static_m
        patch = cur[y0:y1, x0:x1].astype(np.float32) * (1 - m) + warped[y0:y1, x0:x1].astype(np.float32) * m
        cur[y0:y1, x0:x1] = patch.astype(np.uint8)

vw = cv2.VideoWriter(dst, cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
for f in out:
    vw.write(f)
vw.release()
print("wrote", dst)
