# -*- coding: utf-8 -*-
"""연유쿠키(2026-11-11) 대사마다 목소리 높이(F0)를 재서 도아 말인지 엄마 말인지 가른다.

사용자(2026-11-12): 엄마 말보다 아이 말 위주로. 받아쓰기만으로는 누가 했는지 모른다 → words.txt 의 구간마다
자기상관으로 F0 중앙값을 잰다. 어른 여성 ≈ 170~260Hz, 두세 살 아이 ≈ 300Hz 이상.
사용: python scripts/pitch_cookie_20261111.py  → public/cooking/연유쿠키_20261111/pitch.txt
"""
import os, re, sys, wave
import numpy as np

sys.stdout.reconfigure(encoding="utf-8")
ROOT = os.path.join(os.path.dirname(__file__), "..", "public", "cooking", "연유쿠키_20261111")
SR = 16000
_cache = {}


def audio(clip):
    if clip not in _cache:
        with wave.open(os.path.join(ROOT, "work", clip + ".wav")) as w:
            _cache[clip] = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return _cache[clip]


def f0(x):
    """40ms 창, 10ms 간격 자기상관 F0. 목소리(주기성 강함)인 창의 중앙값과 개수."""
    win, hop, out = int(0.04 * SR), int(0.01 * SR), []
    lo, hi = int(SR / 600), int(SR / 120)
    rms_all = np.sqrt(np.mean(x ** 2)) + 1e-9
    for i in range(0, len(x) - win, hop):
        s = x[i:i + win] - np.mean(x[i:i + win])
        if np.sqrt(np.mean(s ** 2)) < 0.5 * rms_all:
            continue
        ac = np.correlate(s, s, "full")[win - 1:]
        if ac[0] <= 0:
            continue
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] / ac[0] > 0.45:
            out.append(SR / lag)
    return (float(np.median(out)), len(out)) if out else (0.0, 0)


cur, lines = None, []
for ln in open(os.path.join(ROOT, "words.txt"), encoding="utf-8"):
    m = re.match(r"== (\S+) ", ln)
    if m:
        cur = m.group(1)
        continue
    m = re.match(r"\s*([\d.]+)-\s*([\d.]+) (.*)", ln)
    if m and cur:
        lines.append((cur, float(m.group(1)), float(m.group(2)), m.group(3).strip()))

with open(os.path.join(ROOT, "pitch.txt"), "w", encoding="utf-8") as fp:
    for clip, a, b, text in lines:
        x = audio(clip)[int(a * SR):int(b * SR)]
        hz, n = f0(x)
        who = "?" if n < 5 else ("아이" if hz >= 290 else "엄마" if hz < 260 else "?")
        row = f"{clip} {a:7.2f}-{b:7.2f} {hz:5.0f}Hz n={n:3d} {who:2s}  {text}"
        fp.write(row + "\n")
        print(row)
