# -*- coding: utf-8 -*-
"""연유쿠키(2026-11-11) 원본 정리 — 작업본·받아쓰기·썸네일 시트.

원본: C:/Users/user/OneDrive/쿡매치_요리영상/20261111_*  (OneDrive 루트에 바로 올라옴)
결과: public/cooking/연유쿠키_20261111/
  raw/        원본 복사(git 제외)
  work/       <시각>.mp4  1080x1920 30fps H.264 + 원음 / 앱 녹화는 그대로 30fps
              <시각>.wav  16kHz 모노(받아쓰기용)
              sheet_<시각>.jpg  썸네일 시트(짧은 영상 1초, 긴 영상 5초 간격, 칸마다 시각)
  transcript.json / transcript.txt  Whisper(large-v3-turbo) 단어 시각 포함

사용: python scripts/prep_cookie_20261111.py [encode|sheet|asr|all]
"""
import json, os, shutil, subprocess, sys
from concurrent.futures import ThreadPoolExecutor

SRC = r"C:\Users\user\OneDrive\쿡매치_요리영상"
ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "cooking", "연유쿠키_20261111")
RAW, WORK = os.path.join(ROOT, "raw"), os.path.join(ROOT, "work")
os.makedirs(RAW, exist_ok=True)
os.makedirs(WORK, exist_ok=True)


def dur(p):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", p], capture_output=True, text=True).stdout.strip())


files = sorted(f for f in os.listdir(SRC) if f.startswith("20261111_"))
for fn in files:
    dst = os.path.join(RAW, fn)
    if not os.path.exists(dst) or os.path.getsize(dst) != os.path.getsize(os.path.join(SRC, fn)):
        shutil.copy2(os.path.join(SRC, fn), dst)
videos = [f for f in files if f.lower().endswith((".mov", ".mp4"))]
stem = lambda fn: fn.split("_")[1][:6]  # 091131


def is_app(fn):
    return fn.lower().endswith(".mp4")  # 화면 녹화(1206x2622 60fps)


def encode(fn):
    src, out = os.path.join(RAW, fn), os.path.join(WORK, stem(fn) + ".mp4")
    if not os.path.exists(out):
        vf = "fps=30" if is_app(fn) else "scale=1080:1920:flags=lanczos,setsar=1,fps=30"
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", vf, "-c:v", "libx264", "-crf", "20", "-preset", "veryfast", "-pix_fmt", "yuv420p"]
        cmd += ["-an"] if is_app(fn) else ["-map", "0:v:0", "-map", "0:a:0", "-c:a", "aac", "-b:a", "192k"]
        subprocess.run(cmd + ["-movflags", "+faststart", out], check=True)
    if not is_app(fn):
        wav = os.path.join(WORK, stem(fn) + ".wav")
        if not os.path.exists(wav):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-map", "0:a:0", "-ac", "1", "-ar", "16000", wav], check=True)
    return fn


def sheet(fn):
    src = os.path.join(WORK, stem(fn) + ".mp4")
    d = dur(src)
    step = 1 if d <= 40 else 2 if d <= 100 else 5
    n = int(d // step) + 1
    cols = 8
    rows = min(10, (n + cols - 1) // cols)
    per = cols * rows
    for page in range((n + per - 1) // per):
        out = os.path.join(WORK, f"sheet_{stem(fn)}_{page}.jpg")
        if os.path.exists(out):
            continue
        t0 = page * per * step
        vf = (f"fps=1/{step},scale=240:-2,drawtext=fontfile='C\\:/Windows/Fonts/arial.ttf':text='%{{eif\\:t+{t0}\\:d}}s':x=6:y=6:fontsize=26:fontcolor=yellow:box=1:boxcolor=black@0.6,"
              f"tile={cols}x{rows}")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t0), "-t", str(per * step), "-i", src, "-vf", vf, "-frames:v", "1", "-q:v", "4", out], check=True)


def asr():
    from faster_whisper import WhisperModel
    model = WhisperModel("deepdml/faster-whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8", cpu_threads=16)
    allres = {}
    for fn in videos:
        if is_app(fn):
            continue
        wav = os.path.join(WORK, stem(fn) + ".wav")
        import wave, numpy as np  # PyAV 버전이 faster-whisper 와 안 맞아 wav 를 직접 읽어 넘긴다
        with wave.open(wav) as w:
            audio = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0
        segs, _ = model.transcribe(audio, language="ko", word_timestamps=True, vad_filter=True, beam_size=5,
                                   initial_prompt="도아랑 연유쿠키 만들기. 반죽, 냉장고, 쿠키 틀, 오븐, 친구들 줄 거야.")
        rows = []
        for s in segs:
            rows.append({"start": round(s.start, 2), "end": round(s.end, 2), "text": s.text.strip(),
                         "words": [[round(w.start, 2), round(w.end, 2), w.word] for w in (s.words or [])]})
        allres[fn] = rows
        print(fn, len(rows), "segments", flush=True)
        with open(os.path.join(ROOT, "transcript.json"), "w", encoding="utf-8") as fp:
            json.dump(allres, fp, ensure_ascii=False, indent=1)
    with open(os.path.join(ROOT, "transcript.txt"), "w", encoding="utf-8") as fp:
        for fn, rows in allres.items():
            fp.write(f"\n=== {fn} ({stem(fn)})\n")
            for r in rows:
                fp.write(f"{r['start']:7.2f}-{r['end']:7.2f}  {r['text']}\n")


if __name__ == "__main__":
    what = sys.argv[1] if len(sys.argv) > 1 else "all"
    if what in ("encode", "all"):
        with ThreadPoolExecutor(4) as ex:
            for fn in ex.map(encode, videos):
                print("encoded", fn, flush=True)
    if what in ("sheet", "all"):
        with ThreadPoolExecutor(6) as ex:
            list(ex.map(sheet, videos))
        print("sheets done", flush=True)
    if what in ("asr", "all"):
        asr()
    # 사진: EXIF 회전 적용
    if what in ("photo", "all"):
        from PIL import Image, ImageOps
        for fn in files:
            if fn.lower().endswith((".jpg", ".png")):
                out = os.path.join(WORK, "p_" + fn.split("_")[1][:6] + ("_" + fn.split("_")[1][6:9] if fn.lower().endswith(".jpg") else "") + ".jpg")
                if not os.path.exists(out):
                    ImageOps.exif_transpose(Image.open(os.path.join(RAW, fn))).convert("RGB").save(out, quality=92)
        print("photos done", flush=True)
