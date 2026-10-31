"""캠핑 저녁 마림바 BGM(직접 합성, 저작권 없음) — 요리 릴스 3편(캠핑 새우 알리오올리오)용. 1편(기타 108BPM)·2편(피아노 왈츠)과 다르게.

4/4 박자 100BPM, D 장조 D - A - Bm - G (2마디씩 한 바퀴), 마림바 멜로디 + 부드러운 베이스 + 셰이커,
8마디 프레이즈 두 가지를 번갈아, 아주 작은 리버브.
    python scripts/make_bgm_camp.py out.wav [초]
"""
import sys, wave
import numpy as np
SR = 44100
OUT = sys.argv[1]; DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 200.0
BPM = 100; BEAT = 60 / BPM; BAR = 4 * BEAT
rng = np.random.default_rng(31)
N = int(DUR * SR) + SR * 4
mix = np.zeros((N, 2))
hz = lambda m: 440.0 * 2 ** ((m - 69) / 12)
def marimba(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    env = np.exp(-t * (5.5 + m / 40)) * np.minimum(1, t / 0.002)
    return (np.sin(2*np.pi*f*t) + 0.25*np.sin(2*np.pi*f*4*t)*np.exp(-t*18) + 0.08*np.sin(2*np.pi*f*10*t)*np.exp(-t*40)) * env
def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    env = np.exp(-t * 2.0) * np.minimum(1, t / 0.01)
    return (np.sin(2*np.pi*f*t) + 0.2*np.sin(4*np.pi*f*t)) * env
def shaker(dur=0.09):
    n = int(dur * SR); t = np.arange(n) / SR
    x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))
    return x * np.exp(-t * 45) * np.minimum(1, t / 0.006)
def add(sig, t, g, pan=0.0):
    i = max(0, int(t*SR)); j = min(N, i+len(sig))
    if j <= i: return
    l, r = np.cos((pan+1)*np.pi/4), np.sin((pan+1)*np.pi/4)
    mix[i:j, 0] += sig[:j-i]*g*l; mix[i:j, 1] += sig[:j-i]*g*r
# (베이스, 화음) — D, A, Bm, G 를 2마디씩
CH = [(38, [62, 66, 69]), (45, [61, 64, 69]), (47, [62, 66, 71]), (43, [62, 67, 71])]
# 멜로디: 마디당 8개(8분음표), None 은 쉼
MEL_A = [[74, None, 76, 78, None, 76, 74, None], [74, 76, 78, None, 81, None, 78, None],
         [76, None, 73, 76, None, 78, 76, None], [73, 76, 78, None, 76, None, 73, None],
         [78, None, 76, 74, None, 71, 74, None], [78, 79, 81, None, 78, None, 74, None],
         [79, None, 78, 76, None, 74, 71, None], [74, None, 76, None, 74, None, None, None]]
MEL_B = [[81, None, 78, None, 74, 76, 78, None], [81, 83, 81, None, 78, None, 76, None],
         [76, 78, 76, None, 73, None, 69, None], [73, None, 76, 78, 76, None, None, None],
         [71, None, 74, 78, None, 74, 71, None], [78, None, 81, None, 83, 81, 78, None],
         [79, 78, 76, None, 74, None, 79, None], [78, None, 76, None, 74, None, None, None]]
bars = int(DUR / BAR) + 1
for b in range(bars):
    t0 = b * BAR
    root, chord = CH[(b // 2) % 4]
    # 베이스: 1·3박, 3박은 5도 위
    add(bass(root, BEAT * 1.8), t0, 0.32)
    add(bass(root + 7, BEAT * 1.6), t0 + 2 * BEAT, 0.24)
    # 화음: 엇박(2·4박 앞의 8분) 마림바로 가볍게
    for k in (1.5, 3.5):
        for j, m in enumerate(chord):
            add(marimba(m - 12, BEAT), t0 + k * BEAT + j * 0.006, 0.10, pan=-0.3 + 0.3 * j)
    # 멜로디: 첫 4마디는 쉬고, 그다음 A·B 번갈아
    if b >= 2:
        mel = (MEL_A if ((b - 2) // 8) % 2 == 0 else MEL_B)[(b - 2) % 8]
        for k, m in enumerate(mel):
            if m is not None:
                add(marimba(m, BEAT), t0 + k * BEAT / 2, 0.24, pan=0.15)
    # 셰이커 16분, 강세는 8분 엇박
    for k in range(16):
        add(shaker(), t0 + k * BEAT / 4 + rng.uniform(-0.004, 0.004), 0.05 if k % 2 else 0.025, pan=0.4)
# 리버브(짧은 지연 몇 개)
out = mix.copy()
for d, g in ((0.031, 0.25), (0.053, 0.2), (0.089, 0.15), (0.143, 0.1)):
    s = int(d * SR); out[s:] += mix[:-s] * g
out = out[:int(DUR * SR)]
fade = int(1.5 * SR); out[-fade:] *= np.linspace(1, 0, fade)[:, None]
out /= np.abs(out).max() / 0.85
with wave.open(OUT, "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((out * 32767).astype(np.int16).tobytes())
print("ok", OUT, DUR)
