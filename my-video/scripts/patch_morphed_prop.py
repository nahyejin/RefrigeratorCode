"""제미나이(Veo) 클립에서 손대지 않았는데 모양이 바뀐 소품을, 바뀌기 직전 모습으로 덮어 되돌린다.

2026-10-08 5편(우유 냄새) v3 훅: 6.46s 에 위가 뾰족한 우유곽이 아무도 안 만졌는데 위가 평평하고 빨간 한글 라벨이 붙은
상자로 바뀌어 끝까지 감. → 바뀌기 직전 프레임(ref)의 우유곽 윗부분을 떼어, 바뀐 뒤 매 프레임 상자 몸통 위치를
템플릿 매칭으로 따라가며 그 위에 덮는다(손가락이 있는 아래쪽은 건드리지 않음).

    python scripts/patch_morphed_prop.py in.mp4 out_video_only.mp4 REF_FRAME FROM_FRAME "x0,y0,x1,y1" "tx0,ty0,tx1,ty1"
      REF_FRAME  바뀌기 직전 프레임(소품이 맞는 모습)
      FROM_FRAME 덮기 시작할 프레임(바뀌는 중간 프레임 포함)
      x0..y1     덮을 영역(ref 프레임 기준, 원본 픽셀)
      tx0..ty1   위치 추적용 템플릿 영역(FROM_FRAME+3 기준 — 바뀐 뒤 소품 몸통)
    소리는 ffmpeg 로 원본에서 되붙인다.
"""
import sys
import cv2
import numpy as np

src, dst = sys.argv[1], sys.argv[2]
ref_i, from_i = int(sys.argv[3]), int(sys.argv[4])
x0, y0, x1, y1 = (int(v) for v in sys.argv[5].split(","))
tx0, ty0, tx1, ty1 = (int(v) for v in sys.argv[6].split(","))

cap = cv2.VideoCapture(src)
fps = cap.get(cv2.CAP_PROP_FPS)
frames = []
while True:
    ok, f = cap.read()
    if not ok:
        break
    frames.append(f)
H, W = frames[0].shape[:2]

patch = frames[ref_i][y0:y1, x0:x1].astype(np.float32)
ph, pw = patch.shape[:2]
# 가장자리를 부드럽게 — 위·좌·우는 넓게, 아래(손가락 쪽)는 좁게 페더
mask = np.ones((ph, pw), np.float32)
fe = 10
for k in range(fe):
    a = (k + 1) / (fe + 1)
    mask[k, :] *= a
    mask[:, k] *= a
    mask[:, pw - 1 - k] *= a
for k in range(4):
    mask[ph - 1 - k, :] *= (k + 1) / 5
mask = mask[..., None]

t_i = from_i + 3
tpl = cv2.cvtColor(frames[t_i][ty0:ty1, tx0:tx1], cv2.COLOR_BGR2GRAY)
base = (tx0, ty0)
out = [f.copy() for f in frames]
prev = base
for i in range(from_i, len(frames)):
    g = cv2.cvtColor(frames[i], cv2.COLOR_BGR2GRAY)
    if i >= t_i - 1:
        sx0, sy0 = max(0, prev[0] - 30), max(0, prev[1] - 30)
        win = g[sy0:min(H, prev[1] + (ty1 - ty0) + 30), sx0:min(W, prev[0] + (tx1 - tx0) + 30)]
        r = cv2.matchTemplate(win, tpl, cv2.TM_CCOEFF_NORMED)
        _, score, _, (bx, by) = cv2.minMaxLoc(r)
        if score > 0.5:
            prev = (sx0 + bx, sy0 + by)
    dx, dy = prev[0] - base[0], prev[1] - base[1]
    X0, Y0 = x0 + dx, y0 + dy
    roi = out[i][Y0:Y0 + ph, X0:X0 + pw].astype(np.float32)
    out[i][Y0:Y0 + ph, X0:X0 + pw] = (roi * (1 - mask) + patch * mask).astype(np.uint8)
    if i % 12 == 0:
        print(f"frame {i} ({i / fps:.2f}s) offset {dx},{dy}")

vw = cv2.VideoWriter(dst, cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
for f in out:
    vw.write(f)
vw.release()
print("wrote", dst)
