"""5편(우유) v3 훅 — 건네받은 뒤 좁아지고 위가 바뀐 우유곽을, 바뀌기 전 프레임(REF)의 우유곽으로 통째 덮는다.

2026-10-08. 이전 patch_morphed_prop.py 는 윗부분만 덮어 몸통 폭이 달라진 게 남았다. REF 우유곽에서 손가락을 inpaint 로
지운 깨끗한 판을 만들고, 매 프레임 지금 손가락(피부색 HSV)만 위에 남긴다. 위치는 phaseCorrelate 로 따라간다.
    python scripts/replace_prop_under_hands.py in.mp4 out_video_only.mp4   (REF/FROM/영역은 파일 위 상수)
소리는 ffmpeg 로 원본에서 되붙인다.
"""
import cv2, numpy as np, sys
F, OUT = sys.argv[1], sys.argv[2]
REF, FROM = 150, 151
X0, Y0, X1, Y1 = 198, 672, 300, 920
cap = cv2.VideoCapture(F); fps = cap.get(5); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(f)
H, W = fr[0].shape[:2]

def skin(img):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    m = ((hsv[..., 0] < 22) & (hsv[..., 1] > 65) & (hsv[..., 2] < 215)).astype(np.uint8)
    m = cv2.morphologyEx(m, cv2.MORPH_OPEN, np.ones((3, 3), np.uint8))
    m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    return cv2.dilate(m, np.ones((5, 5), np.uint8))

ref = fr[REF]
rp = ref[Y0:Y1, X0:X1].copy()
rsk = cv2.dilate(skin(rp), np.ones((5, 5), np.uint8))
rp = cv2.inpaint(rp, rsk, 7, cv2.INPAINT_TELEA)  # fingers removed from the reference carton
cv2.imwrite("ref_clean.png", np.hstack([ref[Y0:Y1, X0:X1], rp]))
patch = rp.astype(np.float32)
ph, pw = patch.shape[:2]
feather = np.ones((ph, pw), np.float32); fe = 6
for k in range(fe):
    a = (k + 1) / (fe + 1)
    feather[k, :] *= a; feather[-1 - k, :] *= a; feather[:, k] *= a; feather[:, -1 - k] *= a
g = lambda im: cv2.cvtColor(im[600:980, 150:420], cv2.COLOR_BGR2GRAY).astype(np.float32)
gref = g(ref); win = cv2.createHanningWindow(gref.shape[::-1], cv2.CV_32F)
out = cv2.VideoWriter(OUT, cv2.VideoWriter_fourcc(*'mp4v'), fps, (W, H))
for i, f in enumerate(fr):
    if i >= FROM:
        (dx, dy), _ = cv2.phaseCorrelate(gref, g(f), win)
        x0, y0 = X0 + int(round(dx)), Y0 + int(round(dy))
        roi = f[y0:y0 + ph, x0:x0 + pw].astype(np.float32)
        m = feather * (1 - skin(f[y0:y0 + ph, x0:x0 + pw]).astype(np.float32))
        m = cv2.GaussianBlur(m, (5, 5), 0)[..., None]
        f = f.copy(); f[y0:y0 + ph, x0:x0 + pw] = (patch * m + roi * (1 - m)).astype(np.uint8)
    out.write(f)
out.release()
