"""영상에 배경음악을 약하게 깐다 — 영상 속 음성(배우 대사·음성 설명)이 나올 때는 음악이 자동으로 낮아진다(사이드체인).

    PYTHONUTF8=1 python scripts/add_bgm.py in.mp4 <곡 번호 0~23> out.mp4 [--gain 1.0] [--duck 12]

곡은 scripts/make_bgm.py(--engine 2 면 make_bgm2.py) 로 영상 길이에 맞춰 즉석 합성(24곡이 서로 다름). 영상 화면은 다시 인코딩하지 않는다(-c:v copy).

    PYTHONUTF8=1 python scripts/add_bgm.py in.mp4 0 out.mp4 --file public/bgm_lib/mixkit_okay_ska.mp3

--file: 받은 실제 곡(저작권 무료, public/bgm_lib)을 쓴다. 2026-11-01 사용자: 합성 곡은 다 비슷하다 → 모든 광고 영상은 실제 곡으로.
곡 크기는 loudnorm 으로 맞춘 뒤 gain 을 건다(합성 곡과 같은 크기). 영상보다 짧으면 반복. 곡 번호(idx)는 무시된다.
"""
import argparse, os, subprocess, sys, tempfile
sys.path.insert(0, os.path.dirname(__file__))
import make_bgm
import make_bgm2

ap = argparse.ArgumentParser()
ap.add_argument("src"); ap.add_argument("idx", type=int); ap.add_argument("dst")
ap.add_argument("--gain", type=float, default=0.42)
ap.add_argument("--engine", type=int, default=1, help="1=make_bgm(1벌), 2=make_bgm2(2·3벌, 곡마다 장르가 다름), 3=make_bgm2 의 밝은 곡(SONGS3, 2·3벌 최종)")
ap.add_argument("--file", help="합성 대신 이 음원 파일을 쓴다(public/bgm_lib)")
ap.add_argument("--offset", type=float, default=0.0, help="--file 곡의 이 초부터 쓴다(긴 전주 건너뛰기)")
ap.add_argument("--keep", help="합성한 곡을 이 경로에 남긴다")
ap.add_argument("--duck", type=float, default=0.16, help="말소리 구간에서 음악에 곱할 값(0.16 ≈ -16dB)")
ap.add_argument("--thr", type=float, default=0.025); ap.add_argument("--ratio", type=float, default=1.8); ap.add_argument("--rel", type=int, default=400)
ap.add_argument("--music-only", action="store_true", help="음악만(눌린 상태) 뽑아 크기 점검용으로 쓴다")
ap.add_argument("--start", type=float, default=0.0, help="이 초부터 음악을 켠다(그 전은 무음). 셀카형(형식 ③)은 「그 밖에도 이런 기능이 있어요」 시작 시각 — 사용자 요청 2026-10-24")
a = ap.parse_args()
LUFS = -17.6  # 받은 곡 크기 기준 — 합성 곡(엔진 3)과 같은 크기가 되게 실측으로 맞춤
dur = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", a.src], text=True))
wav = a.keep or os.path.join(tempfile.gettempdir(), f"bgm_{a.idx}_{os.getpid()}.wav")
if a.file:
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-stream_loop", "-1", "-ss", str(a.offset), "-i", a.file, "-t", f"{dur:.3f}",
                           "-af", f"loudnorm=I={LUFS}:TP=-1.5:LRA=11", "-ar", "48000", "-ac", "2", wav])
    info = {"file": os.path.basename(a.file), "offset": a.offset}
else:
    if a.engine == 3:
        buf, info = make_bgm2.make(a.idx, dur, songs=make_bgm2.SONGS3)
    else:
        buf, info = (make_bgm2 if a.engine == 2 else make_bgm).make(a.idx, dur)
    make_bgm.save(wav, buf)
fade_out = max(0.0, dur - 4.0)

# 말소리 구간 찾기 — 영상 소리(배우 대사·나레이션)에서 조용하지 않은 구간. 2026-11-01 사용자: 말할 때 음악이 안 줄어든다
# (사이드체인 압축은 제미나이 대사가 작아서(-33dB) 거의 안 걸렸다) → 그 구간만 음악을 확실히 낮춘다(앞 0.2s 미리, 뒤 0.4s 여유).
sd = subprocess.run(["ffmpeg", "-hide_banner", "-i", a.src, "-af", "silencedetect=noise=-38dB:d=0.35", "-f", "null", "-"],
                    capture_output=True, text=True).stderr
import re
marks = [(k, float(v)) for k, v in re.findall(r"silence_(start|end): ([0-9.]+)", sd)]
talk, cur = [], 0.0
for k, v in marks:
    if k == "start":
        if v - cur > 0.15: talk.append([max(0.0, cur - 0.2), v + 0.4])
    else:
        cur = v
if marks and marks[-1][0] == "end" and dur - cur > 0.15: talk.append([max(0.0, cur - 0.2), dur])
if not marks: talk.append([0.0, dur])
merged = []
for w in talk:
    if merged and w[0] - merged[-1][1] < 0.9: merged[-1][1] = max(merged[-1][1], w[1])
    else: merged.append(w)
R = 0.25  # 내려가고 올라가는 시간
win = "+".join(f"clip(min((t-{x0:.2f}+{R})/{R},({x1:.2f}+{R}-t)/{R}),0,1)" for x0, x1 in merged) or "0"
duck = f"volume='1-{1 - a.duck:.3f}*min(1,{win})':eval=frame"
head = (f"[1:a]volume={a.gain},volume=0:enable='lt(t,{a.start:.2f})',afade=t=in:st={a.start:.2f}:d=1.0" if a.start > 0
        else f"[1:a]volume={a.gain},afade=t=in:st=0:d=1.5")
flt = (
    f"{head},afade=t=out:st={fade_out:.2f}:d=4,{duck}[md];"
    "[md][0:a]amix=inputs=2:normalize=0:duration=first[a]"
)
flt_music = f"{head},afade=t=out:st={fade_out:.2f}:d=4,{duck}[md]"
if a.music_only:
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", a.src, "-i", wav, "-filter_complex", flt_music, "-map", "[md]", a.dst])
else:
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", a.src, "-i", wav, "-filter_complex", flt, "-map", "0:v", "-map", "[a]",
                           "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", a.dst])
if not a.keep:
    os.remove(wav)
print(info, '말소리 구간', len(merged), [(round(x0,1), round(x1,1)) for x0, x1 in merged][:6])
