# -*- coding: utf-8 -*-
"""영상 확인용 콘택트 시트: contact_v2.py <영상> <출력.png> [간격초=1] [시작초=0] [끝초] [가로칸=10] [폭=180]
각 칸 아래에 시각(초)을 적는다."""
import os, subprocess, sys, tempfile
from PIL import Image, ImageDraw, ImageFont

src, out = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
start = float(sys.argv[4]) if len(sys.argv) > 4 else 0.0
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", src], capture_output=True, text=True).stdout.strip())
end = float(sys.argv[5]) if len(sys.argv) > 5 and sys.argv[5] != "-" else dur
cols = int(sys.argv[6]) if len(sys.argv) > 6 else 10
w = int(sys.argv[7]) if len(sys.argv) > 7 else 180
tmp = tempfile.mkdtemp()
times = []
t = start
while t < end - 0.05:
    times.append(round(t, 2))
    t += step
tiles = []
for i, t in enumerate(times):
    p = os.path.join(tmp, f"{i}.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", src, "-frames:v", "1", "-vf", f"scale={w}:-1", p])
    if os.path.exists(p):
        tiles.append((t, Image.open(p).convert("RGB")))
if not tiles:
    sys.exit("no frames")
h = tiles[0][1].height
rows = (len(tiles) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * (h + 22)), "white")
d = ImageDraw.Draw(sheet)
try:
    f = ImageFont.truetype("C:/Windows/Fonts/malgun.ttf", 14)
except Exception:
    f = None
for i, (t, im) in enumerate(tiles):
    x, y = (i % cols) * w, (i // cols) * (h + 22)
    sheet.paste(im, (x, y))
    d.text((x + 4, y + h + 3), f"{t:.1f}s", fill="red", font=f)
sheet.save(out)
print(out, len(tiles), "frames", f"{dur:.2f}s")
