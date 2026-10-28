"""형식 ③ 셀카형: 제미나이 클립 3개를 한 영상으로 잇고, TalkReels.tsx 에 붙일 말 자막 구절을 뽑는다.

    PYTHONUTF8=1 python scripts/join_talk_clips.py clip1.mp4 clip2.mp4 clip3.mp4 public/talkNN_presenter.mp4

하는 일(2026-10-24 첫 편 talk01 에서 정한 방식):
  · 클립 2·3 맨 앞 = 첨부한 출연자 사진과 같은 표정 → 말이 시작되기 0.12초 전까지 잘라 낸다(최소 0.08초).
  · 클립 1·2 끝 = 말이 끝나고 0.1초 뒤에서 자른다(군더더기 정적 제거). 클립 3 은 끝까지(뒤에 끝 화면이 붙는다).
  · 오른쪽 아래 제미나이 표식 지우기, 음성 클릭 잡음 정리(adeclick·afftdn·12kHz 저역통과).
  · 이어 붙인 뒤 Whisper(medium) 단어 시각으로 말 자막 구절(2~3어절, 1.3초 안팎)을 뽑아 TalkReels.tsx 의 phrases 형식으로 출력한다.
    오인식(「쿵매치」 등)은 손으로 고친다.
"""
import subprocess, sys, wave
import numpy as np

CLEAN = "adeclick=w=55:o=75:a=2:t=2,afftdn=nr=8:nf=-40,lowpass=f=12000"
WM = "delogo=x=570:y=1130:w=62:h=62"
# 클립마다 첫 0.4초는 표식이 움직이며 더 크게 나온다(REEL_FORMATS ③) — 원본 시각 기준으로 넓은 영역을 따로 지운다.
WM_START = "delogo=x=622:y=1186:w=92:h=90:enable='lt(t,0.45)'"
SR = 48000


def env(path):
    tmp = path + ".env.wav"
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", "-i", path, "-ac", "1", "-ar", str(SR), tmp])
    w = wave.open(tmp)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float)
    step = int(0.02 * SR)
    db = np.array([20 * np.log10(np.sqrt((x[i:i + step] ** 2).mean()) + 1) for i in range(0, len(x) - step, step)])
    return db, len(x) / SR


def speech_span(path, thr=50):
    db, dur = env(path)
    on = np.where(db > thr)[0]
    if len(on) == 0:
        return 0.0, dur, dur
    return on[0] * 0.02, (on[-1] + 1) * 0.02, dur


def main(c1, c2, c3, out):
    segs = []
    for i, c in enumerate((c1, c2, c3)):
        a, b, dur = speech_span(c)
        start = 0.0 if i == 0 else max(0.08, round(a - 0.12, 2))
        end = dur if i == 2 else min(dur, round(b + 0.1, 2))
        segs.append((start, end))
        print(f"clip{i + 1}: 말 {a:.2f}~{b:.2f}s → 사용 {start:.2f}~{end:.2f}s")
    parts, inputs = [], []
    for i, (c, (a, b)) in enumerate(zip((c1, c2, c3), segs)):
        inputs += ["-i", c]
        parts.append(f"[{i}:v]{WM_START},trim={a}:{b},setpts=PTS-STARTPTS,{WM},fps=24[v{i}];"
                     f"[{i}:a]atrim={a}:{b},asetpts=PTS-STARTPTS,aresample={SR},{CLEAN},afade=t=in:d=0.03[a{i}];")
    fc = "".join(parts) + "[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]"
    subprocess.check_call(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-map", "[v]", "-map", "[a]",
                           "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k", out])
    t1 = segs[0][1] - segs[0][0]
    t2 = t1 + segs[1][1] - segs[1][0]
    print(f"경계: T1={t1:.2f}  T2={t2:.2f}  전체={t2 + segs[2][1] - segs[2][0]:.2f}s")

    import whisper
    m = whisper.load_model("medium")
    words = [w for s in m.transcribe(out, language="ko", word_timestamps=True)["segments"] for w in s["words"]]
    print("\n// phrases — 오인식은 손으로 고칠 것")
    cur, start = [], None
    for w in words:
        if start is None:
            start = w["start"]
        cur.append(w["word"].strip())
        if len(cur) >= 3 or w["end"] - start > 1.3 or w["word"].strip().endswith((".", "?", "요")):
            print(f'    [{start:.2f}, {w["end"]:.2f}, "{" ".join(cur)}"],')
            cur, start = [], None
    if cur:
        print(f'    [{start:.2f}, {words[-1]["end"]:.2f}, "{" ".join(cur)}"],')


if __name__ == "__main__":
    main(*sys.argv[1:5])
