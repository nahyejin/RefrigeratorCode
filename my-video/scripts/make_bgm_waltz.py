"""따뜻한 피아노 왈츠 BGM(직접 합성, 저작권 없음) — 요리 릴스 2편(황태미역국, 가족·생신 분위기)용. 1편(기타 108BPM)과 다르게.

3/4 박자 120BPM, G 장조 G - D/F# - Em - C - Am - D - G - G, 로즈 피아노 같은 음색(사인+배음, 감쇠),
왼손 「쿵-짝-짝」, 오른손 멜로디(8마디 프레이즈 두 가지 번갈아), 아주 작은 글로켄 반짝임, 리버브.
    python scripts/make_bgm_waltz.py out.wav [초]
"""
import sys, wave
import numpy as np
SR = 44100
OUT = sys.argv[1]; DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 200.0
BPM = 120; BEAT = 60 / BPM; BAR = 3 * BEAT
rng = np.random.default_rng(11)
N = int(DUR * SR) + SR * 4
mix = np.zeros((N, 2))
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
def keys(m, dur, bright=1.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    env = np.exp(-t * (2.2 + m / 60)) * np.minimum(1, t / 0.004)
    tone = np.sin(2*np.pi*f*t) + 0.35*bright*np.sin(4*np.pi*f*t)*np.exp(-t*3) + 0.12*bright*np.sin(6*np.pi*f*t)*np.exp(-t*5)
    trem = 1 + 0.06*np.sin(2*np.pi*4.5*t)
    return tone * env * trem
def bell(m, dur):
    n = int(dur*SR); t = np.arange(n)/SR; f = hz(m)
    return (np.sin(2*np.pi*f*t) + 0.4*np.sin(2*np.pi*f*2.76*t)*np.exp(-t*6)) * np.exp(-t*3.5) * np.minimum(1, t/0.002)
def add(sig, t, g, pan=0.0):
    i = max(0, int(t*SR)); j = min(N, i+len(sig))
    if j <= i: return
    l, r = np.cos((pan+1)*np.pi/4), np.sin((pan+1)*np.pi/4)
    mix[i:j, 0] += sig[:j-i]*g*l; mix[i:j, 1] += sig[:j-i]*g*r
CH = [(43,[59,62,67]), (42,[57,62,66]), (40,[59,64,67]), (36,[60,64,67]), (45,[60,64,69]), (38,[57,62,66]), (43,[59,62,67]), (43,[59,62,67])]
MEL_A = [[74,None,71],[72,None,74],[71,None,67],[76,74,72],[72,None,69],[66,69,72],[71,None,None],[None,67,69]]
MEL_B = [[71,72,74],[76,None,74],[74,72,71],[72,None,76],[76,74,72],[74,None,72],[71,None,67],[67,None,None]]
cache = {}
def K(m, d, b=1.0):
    k = (m, d, b)
    if k not in cache: cache[k] = keys(m, d, b)
    return cache[k]
bars = int(DUR / BAR) + 1
for bar in range(bars):
    t0 = bar*BAR; root, ch = CH[bar % 8]
    add(K(root, 1.6, 0.6), t0, 0.32, -0.2)
    for b in (1, 2):
        for k, m in enumerate(ch):
            add(K(m, 0.9, 0.7), t0 + b*BEAT + k*0.008 + rng.normal(0, 0.004), 0.085, 0.15)
    if bar >= 4:
        mel = (MEL_A if (bar // 8) % 2 == 0 else MEL_B)[bar % 8]
        for k, m in enumerate(mel):
            if m is None: continue
            add(K(m + 12, 1.4, 1.0), t0 + k*BEAT + rng.normal(0, 0.006), 0.13, 0.25)
    if bar >= 8 and bar % 4 == 3:
        add(bell(ch[-1] + 24, 1.2), t0 + 2*BEAT, 0.05, 0.5)
ir_n = int(2.2*SR)
ir = rng.normal(0, 1, ir_n) * np.exp(-np.arange(ir_n)/(0.5*SR)); ir[0] = 0; ir /= np.sqrt((ir**2).sum())
L = 1 << int(np.ceil(np.log2(N + ir_n))); IR = np.fft.rfft(ir, L)
wet = np.stack([np.fft.irfft(np.fft.rfft(mix[:, c], L)*IR, L)[:N] for c in range(2)], 1)
out = (mix*0.85 + wet*0.3)[:int(DUR*SR)]
fi, fo = int(1.2*SR), int(3*SR)
out[:fi] *= np.linspace(0, 1, fi)[:, None]; out[-fo:] *= np.linspace(1, 0, fo)[:, None]
out = np.tanh(out/np.abs(out).max()*1.2)*0.85
with wave.open(OUT, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out*32767).astype(np.int16).tobytes())
print("wrote", OUT)
