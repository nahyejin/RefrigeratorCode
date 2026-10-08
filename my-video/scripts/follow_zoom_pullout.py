"""한 장면 안에서 카메라 줌을 흉내 낸다 — 처음엔 한 사람을 따라가며 가까이, 대사가 넘어가는 순간 전체 화면으로 빠진다. 2026-10-09 8편(로비 배달) v3.

부부가 처음부터 빈 로비 문만 보고 서 있는 게 어색해서, 배달원이 들어와 인사할 때까지(0–2.9s)는 배달원을 따라가는 클로즈업,
아내 대사(3.2s, 음높이로 화자 구분) 직전 2.9–3.3s 에 부드럽게 전체 화면으로. KF = (프레임, 중심 x, 중심 y, 자를 폭).
    python scripts/follow_zoom_pullout.py in.mp4 out_video_only.mp4
"""
import cv2, numpy as np, sys
SRC, OUT = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(SRC); fps = cap.get(5); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(f)
H, W = fr[0].shape[:2]
# keyframes: frame -> (cx, cy, crop width); height = width*16/9. Follows the rider, then pulls out to full frame
KF = [(0, 350, 715, 300), (30, 328, 775, 330), (48, 322, 790, 380), (70, 330, 795, 400), (79, 360, 640, 720)]
def ease(t): return t * t * (3 - 2 * t)
def at(i):
    if i <= KF[0][0]: return KF[0][1:]
    for (a, *pa), (b, *pb) in zip(KF, KF[1:]):
        if a <= i <= b:
            t = (i - a) / (b - a)
            if b == 79: t = ease(t)          # smooth pull-out
            return tuple(np.array(pa) * (1 - t) + np.array(pb) * t)
    return KF[-1][1:]
out = cv2.VideoWriter(OUT, cv2.VideoWriter_fourcc(*'mp4v'), fps, (W, H))
for i, f in enumerate(fr):
    cx, cy, w = at(i)
    if w < W - 0.5:
        h = w * H / W
        cx = min(max(cx, w / 2), W - w / 2); cy = min(max(cy, h / 2), H - h / 2)
        s = W / w
        M = np.float32([[s, 0, -(cx - w / 2) * s], [0, s, -(cy - h / 2) * s]])
        g = cv2.warpAffine(f, M, (W, H), flags=cv2.INTER_LANCZOS4, borderMode=cv2.BORDER_REFLECT)
        if s > 1.3:  # light unsharp to offset the upscale softness
            bl = cv2.GaussianBlur(g, (0, 0), 1.6)
            g = cv2.addWeighted(g, 1.35, bl, -0.35, 0)
        f = g
    out.write(f)
out.release()
