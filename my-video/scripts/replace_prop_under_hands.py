"""5편(우유) v3 훅 — 건네받은 뒤 좁아지고 위가 바뀐 우유곽을, 바뀌기 전 프레임(REF)의 우유곽으로 통째 덮는다.

2026-10-08. 이전 patch_morphed_prop.py 는 윗부분만 덮어 몸통 폭이 달라진 게 남았다. REF 우유곽에서 손가락을 inpaint 로
지운 깨끗한 판을 만들고, 매 프레임 지금 손가락(피부색 HSV)만 위에 남긴다. 위치는 두 손을 템플릿 매칭으로 따라가 9프레임 이동평균으로 다듬는다
(처음엔 phaseCorrelate 로 매 프레임 따라갔다가 우유곽이 ±5px 씩 떨렸다 — 2026-10-08 사용자 지적).
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
# hands track: template match on both hands, then smooth -> no per-frame jitter
gray = lambda im: cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
tpl = gray(ref)[780:900, 170:400]
raw = []
for i in range(FROM, len(fr)):
    r = cv2.matchTemplate(gray(fr[i])[740:940, 130:440], tpl, cv2.TM_CCOEFF_NORMED)
    _, _, _, l = cv2.minMaxLoc(r)
    raw.append((l[0] - 40, l[1] - 40))
raw = np.array([(0.0, 0.0)] * 3 + raw, np.float32)  # anchor start at ref
k = 9
pad = np.pad(raw, ((k // 2, k // 2), (0, 0)), mode='edge')
sm = np.stack([np.convolve(pad[:, j], np.ones(k) / k, mode='valid') for j in range(2)], 1)[3:]
out = cv2.VideoWriter(OUT, cv2.VideoWriter_fourcc(*'mp4v'), fps, (W, H))
full = np.zeros((H, W, 3), np.float32); fmask = np.zeros((H, W), np.float32)
full[Y0:Y1, X0:X1] = patch; fmask[Y0:Y1, X0:X1] = feather
for i, f in enumerate(fr):
    if i >= FROM:
        dx, dy = sm[i - FROM]
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        wp = cv2.warpAffine(full, M, (W, H), flags=cv2.INTER_LINEAR)
        wm = cv2.warpAffine(fmask, M, (W, H), flags=cv2.INTER_LINEAR)
        m = wm * (1 - skin(f).astype(np.float32))
        m = cv2.GaussianBlur(m, (5, 5), 0)[..., None]
        f = (wp * m + f.astype(np.float32) * (1 - m)).astype(np.uint8)
    out.write(f)
out.release()
