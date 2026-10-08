"""제미나이 클립에서 카메라가 다가갈 때 접시 위 음식이 사라진 것을, 사라지기 전 프레임의 음식으로 다시 올린다. 2026-10-09 7편 「근데 이거 뭐야?」(찜닭) v3.

원본 160프레임 접시에서 음식(흰 접시가 아닌 픽셀)을 떼고, 169프레임부터 접시 테두리 타원(KF, 격자로 읽은 키프레임 사이 보간)에 맞춰
크기(접시 폭 비)·위치(접시 깊이 비, 앞 테두리에 안 걸리게 우물 안)·밝기(접시 흰색 비)·초점 흐림을 맞춰 얹는다.
    python scripts/restore_vanished_food.py in.mp4 out_video_only.mp4
"""
import cv2, numpy as np, sys
SRC, OUT = sys.argv[1], sys.argv[2]
cap = cv2.VideoCapture(SRC); fps = cap.get(5); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(f)
H, W = fr[0].shape[:2]
SF = 160
# source plate ellipse: white region (with food filled) near the plate
src = fr[SF]
hsv = cv2.cvtColor(src, cv2.COLOR_BGR2HSV)
roi = (slice(820, 940), slice(240, 520))
white = ((hsv[..., 1] < 50) & (hsv[..., 2] > 150)).astype(np.uint8)
m = np.zeros_like(white); m[roi] = white[roi]
m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((25, 25), np.uint8))
cs, _ = cv2.findContours(m, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_NONE)
c = max(cs, key=cv2.contourArea)
hull = cv2.convexHull(c)
(scx, scy), (sw, sh), sang = cv2.fitEllipse(hull)
if sw < sh: sw, sh = sh, sw
print("source plate", round(scx), round(scy), round(sw), round(sh))
# food = non-white pixels inside the plate ellipse (shrunk a little so the rim stays out)
inside = np.zeros((H, W), np.uint8)
cv2.ellipse(inside, ((scx, scy), (sw * 0.86, sh * 0.80), 0), 1, -1)
food = ((inside > 0) & ~((hsv[..., 1] < 45) & (hsv[..., 2] > 165))).astype(np.uint8)
food = cv2.morphologyEx(food, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
food = cv2.morphologyEx(food, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
ys, xs = np.nonzero(food)
x0, x1, y0, y1 = xs.min() - 6, xs.max() + 6, ys.min() - 6, ys.max() + 6
patch = src[y0:y1, x0:x1].astype(np.float32)
pm = cv2.GaussianBlur(food[y0:y1, x0:x1].astype(np.float32), (9, 9), 0)
fb = ys.max()  # food bottom (y) in source
print("food box", x0, y0, x1, y1)
# target plate ellipse keyframes (outer rim, read off grids): frame: (cx, cy, w, h)
KF = {169: (388, 912, 290, 96), 170: (390, 928, 324, 113), 172: (388, 960, 417, 146), 174: (382, 990, 510, 184),
      176: (373, 1011, 587, 218), 180: (369, 1040, 663, 251), 190: (369, 1050, 688, 257), 239: (370, 1054, 690, 258)}
ks = sorted(KF)
def ell(i):
    if i <= ks[0]: return KF[ks[0]]
    for a, b in zip(ks, ks[1:]):
        if a <= i <= b:
            t = (i - a) / (b - a); return tuple(np.array(KF[a]) * (1 - t) + np.array(KF[b]) * t)
    return KF[ks[-1]]
# white-balance ratio: plate white in source vs target
def plate_white(img, cx, cy, w, h):
    mm = np.zeros(img.shape[:2], np.uint8)
    cv2.ellipse(mm, ((cx, cy), (w * 0.95, h * 0.9), 0), 1, -1)
    cv2.ellipse(mm, ((cx, cy), (w * 0.75, h * 0.6), 0), 0, -1)
    return np.median(img[mm > 0].reshape(-1, 3), 0)
sw_src = plate_white(src, scx, scy, sw, sh)
out = cv2.VideoWriter(OUT, cv2.VideoWriter_fourcc(*'mp4v'), fps, (W, H))
for i, f in enumerate(fr):
    if i >= 169:
        cx, cy, w, h = ell(i)
        s = w / sw * 0.94; sy = h / sh
        gain = plate_white(f, cx, cy, w, h) / sw_src
        p = cv2.resize(patch * gain[None, None, :], None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
        mm = cv2.resize(pm, None, fx=s, fy=s, interpolation=cv2.INTER_LINEAR)
        blur = int(max(1, s * 1.2)) | 1
        p = cv2.GaussianBlur(p, (blur, blur), 0); mm = cv2.GaussianBlur(mm, (blur, blur), 0)
        # place: food bottom keeps its depth on the plate (scaled by plate depth), x by plate centre
        tx = cx + (x0 - scx) * s + (w / sw - s) * 0  # centred
        ty = cy + (fb - scy) * sy - (fb - y0) * s - 0.16 * h  # sit inside the well, clear of the front rim
        X, Y = int(round(tx)), int(round(ty))
        ph, pw = p.shape[:2]
        xa, ya, xb, yb = max(X, 0), max(Y, 0), min(X + pw, W), min(Y + ph, H)
        if xb > xa and yb > ya:
            pp = p[ya - Y:yb - Y, xa - X:xb - X]; ma = mm[ya - Y:yb - Y, xa - X:xb - X, None]
            reg = f[ya:yb, xa:xb].astype(np.float32)
            f = f.copy(); f[ya:yb, xa:xb] = np.clip(pp * ma + reg * (1 - ma), 0, 255).astype(np.uint8)
    out.write(f)
out.release()
