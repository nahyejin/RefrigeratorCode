"""사람 몸·손 위에 박힌 제미나이 자막을 지운다(배경이 움직여 remove_burned_subs.py 를 못 쓸 때). 2026-10-09 6편 「엄마, 뭐 해 먹지?」 v3.

자막은 제자리에 고정이라 뜬 프레임들의 흰 글자 합집합을 마스크로(외곽선·그림자까지 넓힘) 매 프레임 inpaint(NS) + 약한 그레인.
    python scripts/remove_burned_subs_inpaint.py in.mp4 out_video_only.mp4   (자막 상자 X0..Y1 은 파일 위 상수)
"""
import cv2, numpy as np, sys
src, dst = sys.argv[1], sys.argv[2]
X0, Y0, X1, Y1 = 230, 866, 482, 918
cap = cv2.VideoCapture(src); fps = cap.get(5); fr = []
while True:
    ok, f = cap.read()
    if not ok: break
    fr.append(f)
H, W = fr[0].shape[:2]
# caption frames: white glyph pixels present in the box
def glyph(f):
    g = cv2.cvtColor(f[Y0:Y1, X0:X1], cv2.COLOR_BGR2GRAY)
    return (g > 225).astype(np.uint8)
on = [i for i, f in enumerate(fr) if glyph(f).sum() > 600]
s, e = min(on), max(on)
print("caption frames", s, e, s / fps, e / fps)
# union glyph mask over all caption frames (caption is static) -> stable mask, no flicker
u = np.zeros((Y1 - Y0, X1 - X0), np.float32)
for i in range(s, e + 1): u += glyph(fr[i])
mask = (u > (e - s + 1) * 0.5).astype(np.uint8)
# glyphs have a dark outline + soft drop shadow: grow the mask, closing gaps inside each letter group
mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((9, 9), np.uint8))
mask = cv2.dilate(mask, np.ones((11, 11), np.uint8))
full = np.zeros((H, W), np.uint8); full[Y0:Y1, X0:X1] = mask * 255
out = cv2.VideoWriter(dst, cv2.VideoWriter_fourcc(*'mp4v'), fps, (W, H))
for i, f in enumerate(fr):
    if s - 1 <= i <= e + 1:
        f = cv2.inpaint(f, full, 6, cv2.INPAINT_NS)
        # add back a little grain so the filled area doesn't look smeared
        n = np.random.default_rng(i).normal(0, 2.0, f.shape).astype(np.float32)
        f = np.where(full[..., None] > 0, np.clip(f.astype(np.float32) + n, 0, 255), f).astype(np.uint8)
    out.write(f)
out.release()
