# -*- coding: utf-8 -*-
"""연유쿠키(2026-11-11) 대사 구간만 다시 받아쓰기 — 단어 시각 포함, VAD·initial_prompt 없이.

initial_prompt 를 주면 그 문장이 그대로 받아써지는 일이 있어(113233 「쿠키 틀, 오븐, 친구들 줄 거야」) 자막용 대사는 여기 결과만 쓴다.
사용: python scripts/words_cookie_20261111.py  → public/cooking/연유쿠키_20261111/words.txt
"""
import os, sys, wave
import numpy as np
from faster_whisper import WhisperModel

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "cooking", "연유쿠키_20261111")
WIN = [  # (클립, 시작, 끝)
    ("091131", 12, 31.5), ("091241", 0, 15.7), ("092414", 0, 46), ("092505", 0, 15),
    ("102853", 110, 130), ("102853", 995, 1015),
    ("111525", 0, 10), ("111525", 60, 92), ("111525", 140, 170), ("111525", 568, 612), ("111525", 780, 802),
    ("111525", 892, 945), ("111525", 955, 1012),
    ("113233", 0, 6.4), ("113321", 0, 10.3), ("114328", 0, 6), ("123336", 0, 1.3),
    ("122506", 0, 82), ("122638", 0, 250), ("123341", 0, 17.5),
]
m = WhisperModel("deepdml/faster-whisper-large-v3-turbo-ct2", device="cpu", compute_type="int8", cpu_threads=16)
out = open(os.path.join(ROOT, "words.txt"), "w", encoding="utf-8")
for clip, a, b in WIN:
    with wave.open(os.path.join(ROOT, "work", clip + ".wav")) as w:
        sr = w.getframerate()
        w.setpos(int(a * sr))
        x = np.frombuffer(w.readframes(int((b - a) * sr)), dtype=np.int16).astype(np.float32) / 32768
    segs, _ = m.transcribe(x, language="ko", word_timestamps=True, vad_filter=False, beam_size=5,
                           condition_on_previous_text=False, no_speech_threshold=0.9)
    out.write(f"\n== {clip} {a}-{b}\n")
    for s in segs:
        ws = " ".join(f"{w.word.strip()}@{a + w.start:.2f}" for w in (s.words or []))
        out.write(f"{a + s.start:7.2f}-{a + s.end:7.2f} {s.text.strip()}\n    {ws}\n")
    out.flush()
    print(clip, a, flush=True)
