"""영상에 배경음악을 약하게 깐다 — 영상 속 음성(배우 대사·음성 설명)이 나올 때는 음악이 자동으로 낮아진다(사이드체인).

    PYTHONUTF8=1 python scripts/add_bgm.py in.mp4 <곡 번호 0~23> out.mp4 [--gain 1.0] [--duck 12]

곡은 scripts/make_bgm.py 로 영상 길이에 맞춰 즉석 합성(24곡이 서로 다름). 영상 화면은 다시 인코딩하지 않는다(-c:v copy).
"""
import argparse, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
import make_bgm

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("idx", type=int); ap.add_argument("dst")
ap.add_argument("--gain", type=float, default=0.4)
ap.add_argument("--keep", help="합성한 곡을 이 경로에 남긴다")
a = ap.parse_args()
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.src], text=True))
buf, info = make_bgm.make(a.idx, dur)
wav = a.keep or os.path.join(tempfile.gettempdir(), f"bgm_{a.idx}_{os.getpid()}.wav")
make_bgm.save(wav, buf)
fade_out = max(0.0, dur - 4.0)
flt = (
    f"[1:a]volume={a.gain},afade=t=in:st=0:d=1.5,afade=t=out:st={fade_out:.2f}:d=4[m];"
    "[0:a]asplit=2[v1][v2];"
    "[m][v1]sidechaincompress=threshold=0.012:ratio=14:attack=15:release=500:makeup=1[md];"
    "[md][v2]amix=inputs=2:normalize=0:duration=first[a]"
)
subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", a.src, "-i", wav, "-filter_complex", flt, "-map", "0:v", "-map", "[a]",
                       "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", a.dst])
if not a.keep:
    os.remove(wav)
print(info)
