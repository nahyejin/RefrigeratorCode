"""잔잔한 브이로그 BGM 을 직접 합성한다(저작권 걱정 없음). 2026-10-15 요리 릴스용.

Karplus-Strong 로 뜯는 기타 아르페지오 + 부드러운 베이스 + 아주 작은 셰이커, 84BPM,
코드 진행 C - G/B - Am - F (1·5·6·4), 4마디마다 멜로디 변주. 간단한 리버브(감쇠 노이즈 임펄스 FFT 합성곱).
    python scripts/make_vlog_bgm.py out.wav [초]
"""
import sys, wave
import numpy as np

SR = 44100
OUT = sys.argv[1]
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 150.0
BPM = 84
BEAT = 60 / BPM
rng = np.random.default_rng(7)
N = int(DUR * SR) + SR * 4
mix = np.zeros((N, 2), np.float64)

def hz(m): return 440.0 * 2 ** ((m - 69) / 12)

def pluck(freq, dur, bright=0.5):
    n = int(dur * SR); p = max(2, int(SR / freq))
    buf = rng.uniform(-1, 1, p)
    buf = np.convolve(buf, np.ones(3) / 3, 'same') * (0.6 + 0.4 * bright)
    out = np.empty(n); k = 0.996
    for i in range(n):
        out[i] = buf[i % p]
        buf[i % p] = k * 0.5 * (buf[i % p] + buf[(i + 1) % p])
    env = np.minimum(1, np.arange(n) / (0.004 * SR))
    return out * env

def add(sig, t, gain, pan=0.0):
    i = int(t * SR); j = min(N, i + len(sig))
    if i >= N: return
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:j, 0] += sig[:j - i] * gain * l
    mix[i:j, 1] += sig[:j - i] * gain * r

# chords as midi (guitar voicing) and bass roots
CH = [([48, 55, 60, 64, 67], 36), ([47, 55, 59, 62, 67], 35), ([45, 52, 57, 60, 64], 33), ([41, 48, 53, 57, 60], 29)]
PATTERN = [0, 2, 3, 4, 3, 2, 1, 3]  # 8분음표 아르페지오
MEL = [[76, None, 74, 72, None, 74, None, None], [74, None, 71, None, 72, 74, None, None],
       [72, None, 71, 69, None, 71, None, None], [69, None, 72, None, 74, None, 72, None]]
bars = int(DUR / (4 * BEAT)) + 1
cache = {}
def P(m, d, b=0.5):
    key = (m, round(d, 2), b)
    if key not in cache: cache[key] = pluck(hz(m), d, b)
    return cache[key]

for bar in range(bars):
    t0 = bar * 4 * BEAT
    notes, root = CH[bar % 4]
    for k, idx in enumerate(PATTERN):
        t = t0 + k * BEAT / 2 + rng.normal(0, 0.006)
        add(P(notes[idx], 2.2), t, 0.16 * (1.1 if k % 2 == 0 else 0.85), pan=-0.25 + 0.1 * idx)
    # bass: soft sine with decay
    for b in (0, 2):
        n = int(1.6 * SR); tt = np.arange(n) / SR
        bs = np.sin(2 * np.pi * hz(root) * tt) * np.exp(-tt * 2.2) * np.minimum(1, tt / 0.01)
        add(bs, t0 + b * BEAT, 0.20)
    # melody from bar 4, every phrase with variations; rest some bars for breathing
    if bar >= 4 and (bar // 4) % 3 != 2:
        mel = MEL[bar % 4]
        for k, m in enumerate(mel):
            if m is None: continue
            mm = m + (12 if (bar // 8) % 2 == 1 and k == 0 else 0)
            add(P(mm, 1.8, 0.8), t0 + k * BEAT / 2 + rng.normal(0, 0.008), 0.11, pan=0.3)
    # shaker (very soft) after intro
    if bar >= 2:
        for k in range(8):
            n = int(0.06 * SR)
            s = rng.normal(0, 1, n) * np.exp(-np.arange(n) / (0.012 * SR))
            s = np.diff(np.concatenate([[0], s]))  # 고역만
            add(s, t0 + k * BEAT / 2, 0.018 * (1.3 if k % 2 else 0.8), pan=0.4)

# reverb
ir_n = int(1.8 * SR)
ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n) / (0.45 * SR)); ir[0] = 0
ir /= np.sqrt((ir ** 2).sum())
L = 1 << int(np.ceil(np.log2(N + ir_n)))
IR = np.fft.rfft(ir, L)
wet = np.stack([np.fft.irfft(np.fft.rfft(mix[:, c], L) * IR, L)[:N] for c in range(2)], 1)
out = mix * 0.8 + wet * 0.28
out = out[: int(DUR * SR)]
# fades + normalize
fi, fo = int(1.5 * SR), int(3.0 * SR)
out[:fi] *= np.linspace(0, 1, fi)[:, None]; out[-fo:] *= np.linspace(1, 0, fo)[:, None]
out = np.tanh(out / np.abs(out).max() * 1.2) * 0.85
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print("wrote", OUT, DUR)
