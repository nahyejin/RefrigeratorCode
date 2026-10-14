"""릴스 배경음악 v2 — 16곡을 장르부터 따로 만든다(자체 합성, 저작권 걱정 없음).

    PYTHONUTF8=1 python scripts/make_bgm2.py <번호 0~15> <길이(초)> <out.wav>

v1(make_bgm.py)은 한 틀에서 조·빠르기·코드만 바꿔서 24곡이 다 같은 곡처럼 들렸다(2026-10-13 사용자 지적).
v2 는 곡마다 장르·악기 편성·반주 패턴·베이스 라인·드럼 그루브·멜로디 리듬이 전부 다르다.
「grocery vlog」 로 검색하면 나올 법한 밝고 가벼운 곡들이다.
  0~7  (2벌): 우쿨렐레 팝, 로파이, 보사노바, 휘파람 포크, 스윙 재즈, 펑크, 오르골 왈츠, 칼림바
  8~15 (3벌): 밴조 컨트리, 피아노 팝, 인디 팝, 스카, 스틸팬 트로피컬, 아코디언 카페, 시티팝, 칩튠

소리: 현은 Karplus-Strong(뜯는 현 물리 모형), 건반·타악기는 배음 합성, 신스는 배음별 필터, 드럼은 걸러낸 잡음.
곡 구성: 인트로 → A → B → A → 브레이크 → B → A … (A·B 멜로디는 한 번 만들어 되풀이 → 귀에 남게)
파트별 크기는 렌더 후 목표 비율로 자동으로 맞춘다(멜로디 1 : 반주 0.75 : 베이스 0.7 : 드럼 0.65).
"""
import sys
import wave
from functools import lru_cache

import numpy as np

SR = 44100
MAJ = [0, 2, 4, 5, 7, 9, 11]
QUAL = {"": (0, 4, 7), "m": (0, 3, 7), "7": (0, 4, 7, 10), "maj7": (0, 4, 7, 11), "m7": (0, 3, 7, 10),
        "sus4": (0, 5, 7), "add9": (0, 4, 7, 14), "6": (0, 4, 7, 9), "m9": (0, 3, 7, 10, 14), "9": (0, 4, 7, 10, 14)}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12.0)


def fft_filter(x, lo=None, hi=None, order=2):
    n = len(x)
    nfft = 1 << max(1, (n - 1).bit_length())
    f = np.fft.rfftfreq(nfft, 1 / SR)
    h = np.ones_like(f)
    if hi:
        h /= np.sqrt(1 + (f / hi) ** (2 * order))
    if lo:
        h /= np.sqrt(1 + (lo / np.maximum(f, 1e-3)) ** (2 * order))
    return np.fft.irfft(np.fft.rfft(x, nfft) * h, nfft)[:n]


def env(n, a=0.003, d=1e9, s=1.0, gate=None, r=0.05):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / a) if a > 0 else np.ones(n)
    e = e * (s + (1 - s) * np.exp(-np.maximum(0, t - a) / d))
    if gate is not None:
        e = e * np.where(t > gate, np.exp(-(t - gate) / r), 1.0)
    return e


def _norm(y):
    return y / (np.abs(y).max() + 1e-9)


# ───────────────────────── 악기 ─────────────────────────

def ks(f, n, t60, bright, seed, pick=0.12):
    """Karplus-Strong 뜯는 현. 정확한 음높이를 위해 살짝 다른 표본율로 돌린 뒤 되돌린다."""
    a = 0.5 + 0.45 * bright
    P = max(2, int(SR / f))
    sre = f * (P + (1 - a))
    g = 10 ** (-3.0 / (t60 * f))
    rng = np.random.default_rng(seed)
    ex = rng.uniform(-1, 1, P)
    for _ in range(int(round((1 - bright) * 4))):
        ex = 0.5 * (ex + np.roll(ex, 1))
    if pick:
        ex = ex - np.roll(ex, max(1, int(P * pick)))
    ex -= ex.mean()
    blocks = (int(n * sre / SR) + P + 2) // P + 1
    y = np.empty(blocks * P)
    y[:P] = ex
    prev, last = ex, 0.0
    sh = np.empty(P)
    for i in range(1, blocks):
        sh[0] = last
        sh[1:] = prev[:-1]
        new = g * (a * prev + (1 - a) * sh)
        last = prev[-1]
        y[i * P:(i + 1) * P] = new
        prev = new
    return np.interp(np.arange(n) * sre / SR, np.arange(len(y)), y)


def pluck(t60, bright, tail, lp=None, pick=0.12, pop=0.0):
    def f(m, gate, var):
        n = int((gate + tail) * SR)
        y = ks(hz(m), n, t60, bright, var * 31 + m, pick)
        if pop:
            t = np.arange(n) / SR
            y = y / (np.abs(y).max() + 1e-9) + pop * np.sin(2 * np.pi * hz(m) * 6 * t) * np.exp(-t * 60)
        y *= env(n, a=0.001, gate=gate, r=tail / 5)
        if lp:
            y = fft_filter(y, hi=lp)
        return _norm(y)
    return f


def partials(plist, tail, a=0.002, ring=None, trem=None, click=0.0):
    def f(m, gate, var):
        if ring:
            gate = max(gate, ring)
        fr = hz(m)
        n = int((gate + tail) * SR)
        t = np.arange(n) / SR
        y = np.zeros(n)
        for ratio, amp, dec in plist:
            if fr * ratio < 17000:
                y += amp * np.sin(2 * np.pi * fr * ratio * t) * np.exp(-t * dec)
        if trem:
            y *= 1 - trem[1] * (0.5 + 0.5 * np.sin(2 * np.pi * trem[0] * t))
        if click:
            c = np.random.default_rng(var).standard_normal(min(n, 400)) * np.exp(-np.arange(min(n, 400)) / 60)
            y[:len(c)] += click * fft_filter(c, lo=2000)
        y *= env(n, a=a, gate=gate, r=tail / 5)
        return _norm(y)
    return f


def harm(kind="saw", cut0=3000, cut1=1500, tau=0.2, a=0.01, d=1e9, s=1.0, tail=0.15, detune=0.0,
         vib=(0, 0), vib_delay=0.2, voices=1, maxk=40, scoop=0.0, breath=0.0):
    """배음을 하나씩 쌓고 배음마다 필터를 건다(시간에 따라 열리고 닫히는 필터)."""
    def f(m, gate, var):
        fr = hz(m)
        n = int((gate + tail) * SR)
        t = np.arange(n) / SR
        vib_amt = vib[1] * np.clip((t - vib_delay) / 0.3, 0, 1)
        cut = cut1 + (cut0 - cut1) * np.exp(-t / tau)
        out = np.zeros(n)
        for v in range(voices):
            cents = detune * (v - (voices - 1) / 2)
            fv = fr * 2 ** (cents / 1200)
            inst = fv * (1 + vib_amt * np.sin(2 * np.pi * vib[0] * t + v))
            if scoop:
                inst = inst * (1 - scoop * np.exp(-t / 0.04))
            ph = 2 * np.pi * np.cumsum(inst) / SR + v * 1.3
            K = max(1, min(maxk, int(15000 / fv)))
            for k in range(1, K + 1):
                if kind == "saw":
                    amp = 1.0 / k
                elif kind == "square":
                    amp = 1.0 / k if k % 2 else 0.0
                elif kind == "pulse25":
                    amp = abs(np.sin(np.pi * k * 0.25)) / k
                elif kind == "tri":
                    amp = (1.0 / k ** 2) * (1 if k % 4 == 1 else -1) if k % 2 else 0.0
                else:  # sine-ish
                    amp = {1: 1.0, 2: 0.25, 3: 0.07}.get(k, 0.0)
                if amp == 0.0:
                    continue
                out += amp * np.sin(k * ph) / np.sqrt(1 + (k * fv / cut) ** 4)
        if breath:
            b = np.random.default_rng(var + m).standard_normal(n)
            out = out / (np.abs(out).max() + 1e-9) + breath * fft_filter(b, lo=1500, hi=6000)
        out *= env(n, a=a, d=d, s=s, gate=gate, r=tail / 5)
        return _norm(out)
    return f


def epiano(m, gate, var):
    fr = hz(m)
    tail = 0.5
    n = int((gate + tail) * SR)
    t = np.arange(n) / SR
    idx = 1.6 * np.exp(-t * 3.5) + 0.2
    y = np.sin(2 * np.pi * fr * t + idx * np.sin(2 * np.pi * fr * t)) * np.exp(-t * 1.1)
    if fr * 14 < 17000:
        y += 0.12 * np.sin(2 * np.pi * fr * 14 * t) * np.exp(-t * 25)
    y *= 1 - 0.15 * (0.5 + 0.5 * np.sin(2 * np.pi * 4.8 * t))
    y *= env(n, a=0.002, gate=gate, r=tail / 5)
    return _norm(y)


def piano_fn(bright):
    def f(m, gate, var):
        fr = hz(m)
        tail = 0.35
        n = int((gate + tail) * SR)
        t = np.arange(n) / SR
        y = np.zeros(n)
        K = max(1, min(12, int(15000 / fr)))
        for k in range(1, K + 1):
            fk = fr * k * np.sqrt(1 + 0.0002 * k * k)
            amp = 1.0 / k ** (1.15 if bright else 2.0)
            dec = (0.6 + 0.45 * k) * (1.0 if bright else 1.4)
            y += amp * (0.7 * np.exp(-t * dec) + 0.3 * np.exp(-t * dec * 0.2)) * np.sin(2 * np.pi * fk * t)
        h = np.random.default_rng(var).standard_normal(min(n, 300)) * np.exp(-np.arange(min(n, 300)) / 50)
        y[:len(h)] += 0.04 * fft_filter(h, hi=3000)
        y *= env(n, a=0.001, gate=gate, r=0.07)
        if not bright:
            y = fft_filter(y, hi=2500)
        return _norm(y)
    return f


def organ(m, gate, var):
    fr = hz(m)
    tail = 0.08
    n = int((gate + tail) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for ratio, amp in [(0.5, 0.5), (1, 1), (2, 0.6), (3, 0.35), (4, 0.2), (6, 0.1)]:
        y += amp * np.sin(2 * np.pi * fr * ratio * t)
    y *= 1 - 0.2 * (0.5 + 0.5 * np.sin(2 * np.pi * 6.2 * t))
    y *= env(n, a=0.005, gate=gate, r=0.015)
    return _norm(y)


def upright(m, gate, var):
    fr = hz(m)
    tail = 0.1
    n = int((gate + tail) * SR)
    t = np.arange(n) / SR
    y = np.zeros(n)
    for k, amp, dec in [(1, 1, 2.2), (2, 0.45, 3.5), (3, 0.18, 5), (4, 0.07, 7)]:
        y += amp * np.sin(2 * np.pi * fr * k * t) * np.exp(-t * dec)
    th = np.random.default_rng(var).standard_normal(min(n, 700)) * np.exp(-np.arange(min(n, 700)) / 150)
    y[:len(th)] += 0.15 * fft_filter(th, hi=400)
    y *= env(n, a=0.004, gate=gate, r=0.03)
    return _norm(y)


def sub(m, gate, var):
    fr = hz(m)
    n = int((gate + 0.1) * SR)
    t = np.arange(n) / SR
    y = np.sin(2 * np.pi * fr * t) + 0.3 * np.sin(4 * np.pi * fr * t)
    y *= env(n, a=0.01, d=1.5, s=0.6, gate=gate, r=0.03)
    return _norm(y)


def flute_fn(h2, h3, breath, vib):
    def f(m, gate, var):
        fr = hz(m)
        tail = 0.12
        n = int((gate + tail) * SR)
        t = np.arange(n) / SR
        va = vib * np.clip((t - 0.25) / 0.3, 0, 1)
        ph = 2 * np.pi * np.cumsum(fr * (1 + va * np.sin(2 * np.pi * 5.0 * t))) / SR
        y = np.sin(ph) + h2 * np.sin(2 * ph) + h3 * np.sin(3 * ph)
        b = fft_filter(np.random.default_rng(var + m).standard_normal(n), lo=1500, hi=6000)
        y = y / (np.abs(y).max() + 1e-9) + breath * b / (np.abs(b).max() + 1e-9)
        y *= env(n, a=0.05, gate=gate, r=0.03)
        return _norm(y)
    return f


INST = {
    "uke": pluck(0.9, 0.65, 0.25),
    "nylon": pluck(1.6, 0.35, 0.4),
    "steel": pluck(2.0, 0.75, 0.4),
    "banjo": pluck(0.5, 0.85, 0.2, pick=0.08, lp=7000),
    "mandolin": pluck(0.6, 0.75, 0.15, lp=7000),
    "muted": pluck(0.15, 0.5, 0.08, lp=2500),
    "pizz": pluck(0.35, 0.3, 0.15, lp=3000),
    "ebass": pluck(1.2, 0.25, 0.1, lp=1800),
    "slap": pluck(0.9, 0.85, 0.08, lp=5000, pop=0.5),
    "glock": partials([(1, 1, 2.2), (2.76, 0.45, 6), (5.4, 0.22, 11), (8.93, 0.08, 18)], 0.8, a=0.001, ring=0.6),
    "musicbox": partials([(1, 1, 2.5), (2.0, 0.12, 5), (5.95, 0.3, 10), (9.5, 0.06, 18)], 1.0, a=0.001, ring=1.0),
    "kalimba": partials([(1, 1, 3.5), (5.4, 0.35, 22), (11.8, 0.1, 40)], 0.8, a=0.001, ring=0.8, click=0.3),
    "vibes": partials([(1, 1, 1.0), (4, 0.25, 3.5), (10, 0.04, 8)], 0.6, trem=(5.5, 0.3)),
    "marimba": partials([(1, 1, 6), (4, 0.3, 14), (9.8, 0.1, 28)], 0.5, a=0.001, ring=0.5),
    "steelpan": partials([(1, 1, 1.6), (2, 0.55, 2.2), (3, 0.22, 3.2), (4.01, 0.12, 4.5), (5.02, 0.05, 6)], 0.5, a=0.004),
    "triangle": partials([(1, 1, 1.5), (2.7, 0.5, 2), (5.1, 0.3, 3)], 1.0, a=0.001, ring=1.0),
    "epiano": epiano,
    "piano": piano_fn(True),
    "felt": piano_fn(False),
    "organ": organ,
    "upright": upright,
    "sub": sub,
    "flute": flute_fn(0.25, 0.07, 0.06, 0.006),
    "ocarina": flute_fn(0.0, 0.05, 0.03, 0.004),
    "whistle": harm("sine", 9000, 9000, a=0.03, tail=0.1, vib=(5.5, 0.008), vib_delay=0.1, scoop=0.03),
    "harmonica": harm("pulse25", 2500, 1800, a=0.03, tail=0.08, vib=(5, 0.01), scoop=0.02, maxk=25),
    "accordion": harm("saw", 2500, 2500, a=0.03, tail=0.08, voices=2, detune=14, maxk=20),
    "trumpet": harm("saw", 500, 2800, tau=0.05, a=0.02, d=0.8, s=0.7, tail=0.08, vib=(5.5, 0.006), maxk=30),
    "brass": harm("saw", 600, 3500, tau=0.05, a=0.015, d=0.5, s=0.6, tail=0.06, voices=2, detune=10, maxk=30),
    "sawlead": harm("saw", 4000, 2200, tau=0.3, a=0.01, d=0.6, s=0.8, tail=0.15, voices=2, detune=8, vib=(5.2, 0.005), maxk=30),
    "pad": harm("saw", 1400, 1400, a=0.35, tail=0.6, voices=3, detune=12, maxk=24),
    "strings": harm("saw", 2200, 2200, a=0.25, tail=0.5, voices=3, detune=9, vib=(5, 0.004), maxk=24),
    "pluck": harm("saw", 5000, 500, tau=0.08, a=0.002, d=0.25, s=0.0, tail=0.15, voices=2, detune=10, maxk=30),
    "clav": harm("pulse25", 6000, 1500, tau=0.06, a=0.001, d=0.18, s=0.2, tail=0.05, maxk=30),
    "square": harm("square", 6000, 6000, a=0.002, d=0.3, s=0.7, tail=0.04, maxk=15),
    "softsquare": harm("pulse25", 3500, 3500, a=0.01, s=0.8, d=0.5, tail=0.1, vib=(5.5, 0.004), maxk=25),
    "chiparp": harm("pulse25", 7000, 7000, a=0.001, d=0.12, s=0.3, tail=0.03, maxk=15),
    "tribass": harm("tri", 8000, 8000, a=0.002, tail=0.03, maxk=15),
    "synthbass": harm("saw", 1800, 500, tau=0.12, a=0.003, d=0.5, s=0.6, tail=0.05, maxk=30),
}


@lru_cache(maxsize=4096)
def note(inst, m, gate, var):
    y = INST[inst](m, gate, var)
    y.setflags(write=False)
    return y


# ───────────────────────── 드럼 ─────────────────────────

def _noise(n, seed):
    return np.random.default_rng(seed).standard_normal(n)


def _drum(name, v):
    if name == "triangle":
        return note("triangle", 100, 0.05, v)
    n = int(SR * {"ride": 1.2, "ohat": 0.4, "kick": 0.35, "brush": 0.25}.get(name, 0.25))
    t = np.arange(n) / SR
    z = _noise(n, 500 + v * 7 + len(name))
    if name in ("kick", "kick_soft", "kick_chip"):
        f0, f1, dk = {"kick": (52, 90, 9), "kick_soft": (50, 45, 12), "kick_chip": (60, 300, 18)}[name]
        fr = f0 + f1 * np.exp(-t * (30 if name != "kick_chip" else 40))
        y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * dk)
        if name == "kick":
            y[:200] += 0.3 * fft_filter(z[:200], lo=1500) * np.exp(-np.arange(200) / 40)
        return _norm(y if name != "kick_soft" else fft_filter(y, hi=900))
    if name in ("snare", "snare_lofi"):
        y = 0.5 * np.sin(2 * np.pi * 185 * t) * np.exp(-t * 20) + fft_filter(z, lo=1200, hi=8000) * np.exp(-t * 16)
        return _norm(y if name == "snare" else fft_filter(y, hi=3500))
    if name in ("snare_chip", "hat_chip"):
        zq = np.repeat(np.sign(z[::4]), 4)[:n]
        y = zq * np.exp(-t * (18 if name == "snare_chip" else 45))
        return _norm(y if name == "snare_chip" else fft_filter(y, lo=5000))
    if name == "clap":
        e = np.zeros(n)
        for k, off in enumerate((0, 0.011, 0.022)):
            i = int(off * SR)
            e[i:] += np.exp(-(t[i:] - off) * (140 if k < 2 else 22))
        return _norm(fft_filter(z, lo=900, hi=5000) * e)
    if name == "rim":
        y = 0.5 * np.sin(2 * np.pi * 1700 * t) * np.exp(-t * 90) + np.sin(2 * np.pi * 420 * t) * np.exp(-t * 60)
        return _norm(y + 0.3 * fft_filter(z, lo=2000) * np.exp(-t * 120))
    if name == "hat":
        return _norm(fft_filter(z, lo=7000) * np.exp(-t * 45))
    if name == "ohat":
        return _norm(fft_filter(z, lo=6000) * np.exp(-t * 7))
    if name == "shaker":
        return _norm(fft_filter(z, lo=4000, hi=11000) * env(n, a=0.012, d=0.03, s=0))
    if name == "tamb":
        y = fft_filter(z, lo=6000) * env(n, a=0.002, d=0.08, s=0)
        for k in range(5):
            y += 0.3 * np.sin(2 * np.pi * (6000 + 900 * k + 37 * v) * t) * np.exp(-t * 25)
        return _norm(y)
    if name == "brush":
        return _norm(fft_filter(z, lo=1000, hi=7000) * env(n, a=0.03, d=0.09, s=0))
    if name == "ride":
        y = sum(np.sin(2 * np.pi * 420 * r * t) for r in (1, 1.48, 2.13, 2.76, 3.41)) * 0.2
        y = (y + 0.5 * fft_filter(z, lo=5000)) * np.exp(-t * 3)
        return _norm(fft_filter(y, lo=2500, hi=8000))
    if name == "snap":
        return _norm(fft_filter(z, lo=1500, hi=4500) * np.exp(-t * 70))
    if name in ("conga", "bongo"):
        f0, f1, dk = (195, 15, 10) if name == "conga" else (360, 25, 16)
        fr = f0 + f1 * np.exp(-t * 30)
        y = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * dk)
        return _norm(y + 0.2 * fft_filter(z, lo=1500, hi=6000) * np.exp(-t * 80))
    raise KeyError(name)


@lru_cache(maxsize=512)
def drum(name, v):
    y = _drum(name, v % 4)
    y.setflags(write=False)
    return y


def vinyl(n, seed):
    rng = np.random.default_rng(seed)
    y = fft_filter(rng.standard_normal(n), lo=500, hi=4000) * 0.15
    for p in rng.integers(0, n - 200, size=int(n / SR * 9)):
        y[p:p + 60] += rng.uniform(-1, 1) * np.exp(-np.arange(60) / 10)
    return y


# ───────────────────────── 곡 설계 ─────────────────────────

H8 = [(i * 0.5, 0.9 if i % 2 == 0 else 0.6) for i in range(8)]
H16 = [(i * 0.25, (1, 0.45, 0.7, 0.45)[i % 4]) for i in range(16)]
OFF = [(i + 0.5, 0.9) for i in range(4)]
FOUR = [(i, 1.0) for i in range(4)]
BACK = [(1, 1.0), (3, 1.0)]
ONE3 = [(0, 1.0), (2, 0.85)]

# comps: (악기, 반주 패턴, 패닝, 음역 중심)   bass: (악기, 패턴)   lead: (악기, 리듬 성격, 음역 중심)
# lead2: (악기, 음역 중심) — B 와 브레이크에서 길게 받쳐 주는 두 번째 선율
# drums: (소리, 패턴, 크기, 패닝, 언제: all=늘 / main=A·B / B=B 만)
SONGS = [
    dict(name="우쿨렐레 장보기", key=0, bpm=116, meter=4, swing=0.5,
         A=["1", "5", "6:m", "4"], B=["4", "1", "5", "6:m", "4", "1", "2:m", "5"],
         comps=[("uke", "strum8", -0.2, 64)], bass=("upright", "bouncy"),
         lead=("glock", "bouncy", 79), lead2=("whistle", 76),
         drums=[("kick", ONE3, 0.9, 0, "main"), ("clap", BACK, 0.6, 0.1, "main"),
                ("shaker", H16, 0.35, 0.35, "all"), ("snap", BACK, 0.4, -0.3, "all")],
         fill="snap", verb=0.18),
    dict(name="로파이 부엌", key=5, bpm=80, meter=4, swing=0.6,
         A=["1:maj7", "6:m7", "2:m7", "5:7"], B=["4:maj7", "3:m7", "6:m7", "2:m7", "4:maj7", "3:m7", "2:m7", "5:sus4"],
         comps=[("epiano", "lofi", 0.0, 62)], bass=("sub", "lofi"),
         lead=("felt", "lyrical", 74), lead2=("kalimba", 79),
         drums=[("kick_soft", [(0, 1), (1.5, 0.6), (2.5, 0.85)], 1.0, 0, "main"),
                ("snare_lofi", BACK, 0.6, 0.05, "main"), ("hat", H8, 0.25, 0.3, "all")],
         fill=None, verb=0.22, lp=6000, vinyl=True),
    dict(name="보사노바 바구니", key=2, bpm=132, meter=4, swing=0.5,
         A=["1:maj7", "1:maj7", "2:m7", "5:7"], B=["4:maj7", "4:m7", "3:m7", "6:7", "2:m7", "5:7", "1:maj7", "1:6"],
         comps=[("nylon", "bossa", -0.15, 60)], bass=("upright", "bossa"),
         lead=("flute", "lyrical", 76), lead2=("vibes", 72),
         drums=[("rim", [(0, 0.8), (1.5, 0.8), (3, 0.8), (5, 0.8), (6.5, 0.8)], 0.45, 0.2, "all"),
                ("shaker", H8, 0.3, -0.3, "all"), ("kick_soft", [(0, 0.8), (1.5, 0.4), (2, 0.8), (3.5, 0.4)], 0.7, 0, "main")],
         fill=None, verb=0.2),
    dict(name="휘파람 산책", key=7, bpm=120, meter=4, swing=0.5,
         A=["1", "4", "6:m", "5"], B=["4", "5", "1", "6:m", "4", "5", "1", "1"],
         comps=[("steel", "folk8", -0.25, 60)], bass=("ebass", "quarters"),
         lead=("whistle", "bouncy", 79), lead2=("piano", 72),
         drums=[("kick_soft", FOUR, 0.8, 0, "main"), ("clap", BACK, 0.5, 0.1, "main"), ("tamb", OFF, 0.35, 0.35, "all")],
         fill="clap", verb=0.14),
    dict(name="스윙 재즈 카트", key=10, bpm=140, meter=4, swing=0.66,
         A=["2:m7", "5:7", "1:maj7", "6:7"], B=["3:m7", "6:7", "2:m7", "5:7", "4:maj7", "4:m7", "3:m7", "6:7"],
         comps=[("piano", "shell", 0.15, 62)], bass=("upright", "walking"),
         lead=("vibes", "swingy", 77), lead2=None,
         drums=[("ride", [(0, 0.8), (1, 1), (1.5, 0.6), (2, 0.8), (3, 1), (3.5, 0.6)], 0.4, 0.3, "all"),
                ("brush", BACK, 0.5, -0.1, "main"), ("hat", BACK, 0.2, 0.3, "main"), ("kick_soft", [(0, 0.5)], 0.4, 0, "main")],
         fill=None, verb=0.2),
    dict(name="펑키 냉장고", key=4, bpm=104, meter=4, swing=0.5, swing16=0.55,
         A=["1:7", "1:7", "4:7", "4:7"], B=["2:m7", "5:7", "1:7", "6:m7", "2:m7", "5:7", "4:7", "4:7"],
         comps=[("clav", "clav16", 0.2, 64), ("muted", "skank", -0.35, 55)], bass=("slap", "funk16"),
         lead=("brass", "riff", 72), lead2=None,
         drums=[("kick", [(0, 1), (0.75, 0.7), (2.5, 0.9)], 0.9, 0, "main"),
                ("snare", [(1, 1), (1.75, 0.25), (3, 1), (3.25, 0.25)], 0.6, 0.05, "main"),
                ("hat", H16, 0.25, 0.3, "all"), ("ohat", [(3.5, 0.7)], 0.25, 0.3, "main")],
         fill="snare", verb=0.12),
    dict(name="오르골 왈츠", key=9, bpm=150, meter=3, swing=0.5,
         A=["1", "5", "1", "4"], B=["4", "1", "2:m", "5", "6:m", "3:m", "4", "5"],
         comps=[("pizz", "waltz", 0.2, 57)], bass=("pizz", "waltz"),
         lead=("musicbox", "lyrical", 81), lead2=("flute", 74),
         drums=[("triangle", [(0, 0.7)], 0.25, 0.3, "main"), ("shaker", [(1, 0.6), (2, 0.6)], 0.3, -0.3, "all"),
                ("kick_soft", [(0, 0.5)], 0.5, 0, "main")],
         fill=None, verb=0.26),
    dict(name="칼림바 바람", key=3, bpm=96, meter=4, swing=0.5,
         A=["1:add9", "5", "6:m7", "4:add9"], B=["4:maj7", "5:sus4", "3:m7", "6:m7"],
         comps=[("kalimba", "arp8", 0.25, 70), ("pad", "pad", -0.2, 60)], bass=("sub", "sustain2"),
         lead=("ocarina", "lyrical", 75), lead2=("glock", 84),
         drums=[("bongo", [(0.5, 0.7), (1.75, 0.6), (2.5, 0.8), (3.5, 0.6)], 0.45, 0.3, "all"),
                ("conga", [(0, 0.9), (1.5, 0.6), (2, 0.8), (3, 0.7)], 0.5, -0.25, "main"),
                ("shaker", H8, 0.25, 0.1, "all"), ("kick_soft", [(0, 0.7), (2.5, 0.6)], 0.7, 0, "main")],
         fill=None, verb=0.22),
    # ── 3벌 ──
    dict(name="밴조 피크닉", key=9, bpm=124, meter=4, swing=0.5,
         A=["1", "4", "1", "5"], B=["4", "4", "1", "1", "2", "5", "1", "1"],
         comps=[("banjo", "roll", 0.3, 67), ("steel", "boomchick", -0.3, 57)], bass=("upright", "root_fifth"),
         lead=("harmonica", "bouncy", 72), lead2=None,
         drums=[("kick_soft", ONE3, 0.7, 0, "main"),
                ("brush", [(i * 0.5, 1.0 if i in (2, 6) else 0.45) for i in range(8)], 0.5, 0.1, "all")],
         fill=None, verb=0.12),
    dict(name="반짝 피아노 팝", key=2, bpm=94, meter=4, swing=0.5,
         A=["4", "5", "3:m", "6:m"], B=["4", "5", "6:m", "1", "4", "5", "3:7", "6:m"],
         comps=[("piano", "block8", 0.0, 62)], bass=("ebass", "pop"),
         lead=("piano", "lyrical", 79), lead2=("strings", 74),
         drums=[("kick", [(0, 1), (1.5, 0.6), (2.5, 0.8)], 0.85, 0, "main"),
                ("snap", BACK, 0.5, 0.2, "all"), ("hat", H8, 0.2, -0.3, "main")],
         fill="snap", verb=0.2),
    dict(name="인디 팝 그루브", key=5, bpm=124, meter=4, swing=0.5,
         A=["6:m", "4", "1", "5"], B=["4", "5", "6:m", "6:m", "4", "5", "1", "1"],
         comps=[("muted", "muted8", -0.3, 52), ("pluck", "arp16", 0.3, 72)], bass=("synthbass", "eighths"),
         lead=("softsquare", "bouncy", 77), lead2=None,
         drums=[("kick", FOUR, 0.9, 0, "main"), ("clap", BACK, 0.55, 0, "main"),
                ("ohat", OFF, 0.25, 0.25, "main"), ("hat", H16, 0.15, -0.25, "all")],
         fill="snare", verb=0.14),
    dict(name="스카 햇살", key=7, bpm=144, meter=4, swing=0.5,
         A=["1", "6:m", "2:m", "5"], B=["4", "5", "3:m", "6:m", "2:m", "5", "1", "1"],
         comps=[("organ", "skank", 0.25, 62), ("muted", "skank", -0.3, 67)], bass=("ebass", "walking"),
         lead=("trumpet", "bouncy", 74), lead2=None,
         drums=[("kick", ONE3, 0.8, 0, "main"), ("snare", BACK, 0.55, 0.05, "main"), ("hat", H8, 0.25, 0.3, "all")],
         fill="snare", verb=0.12),
    dict(name="스틸팬 트로피컬", key=9, bpm=110, meter=4, swing=0.5,
         A=["4", "1", "5", "6:m"], B=["2:m", "5", "1", "4", "2:m", "5", "1", "1"],
         comps=[("pad", "pad", -0.2, 62), ("marimba", "offstab", 0.25, 69)], bass=("synthbass", "offbeat"),
         lead=("steelpan", "bouncy", 76), lead2=None,
         drums=[("kick", FOUR, 0.85, 0, "main"), ("clap", BACK, 0.5, 0, "main"), ("shaker", H16, 0.3, 0.3, "all"),
                ("bongo", [(0.75, 0.6), (2.75, 0.6), (3.5, 0.5)], 0.35, -0.3, "main")],
         fill=None, verb=0.2),
    dict(name="아코디언 카페", key=0, bpm=112, meter=4, swing=0.5,
         A=["1", "6:m", "2:m", "5:7"], B=["4", "1", "5:7", "1", "4", "1", "5:7", "1"],
         comps=[("mandolin", "tremolo", 0.3, 67), ("accordion", "boomchick", -0.2, 60)], bass=("upright", "root_fifth"),
         lead=("accordion", "lyrical", 74), lead2=None,
         drums=[("brush", H8, 0.4, 0.1, "all"), ("kick_soft", ONE3, 0.5, 0, "main")],
         fill=None, verb=0.2),
    dict(name="시티팝 드라이브", key=8, bpm=106, meter=4, swing=0.5,
         A=["4:maj7", "5:7", "3:m7", "6:m7"], B=["2:m7", "5:7", "1:maj7", "6:m7", "2:m7", "3:7", "6:m7", "5:sus4"],
         comps=[("epiano", "citypop", 0.2, 64), ("strings", "pad", -0.25, 60)], bass=("slap", "citypop"),
         lead=("sawlead", "lyrical", 76), lead2=None,
         drums=[("kick", [(0, 1), (1.75, 0.6), (2.5, 0.9)], 0.9, 0, "main"), ("snare", BACK, 0.6, 0.05, "main"),
                ("hat", H16, 0.22, 0.3, "all"), ("tamb", OFF, 0.2, -0.3, "B")],
         fill="snare", verb=0.2),
    dict(name="포켓 칩튠", key=10, bpm=130, meter=4, swing=0.5,
         A=["1", "6:m", "4", "5"], B=["6:m", "4", "1", "5", "6:m", "4", "5", "5"],
         comps=[("chiparp", "chiparp", 0.2, 70)], bass=("tribass", "octave8"),
         lead=("square", "bouncy", 82), lead2=None,
         drums=[("kick_chip", [(0, 1), (2, 0.8), (2.5, 0.6)], 0.8, 0, "main"),
                ("snare_chip", BACK, 0.5, 0, "main"), ("hat_chip", H8, 0.25, 0.2, "all")],
         fill="snare_chip", verb=0.06, comp_level=0.5),
]

# v3(2026-10-14): 사용자 「16곡이 너무 비장하다」(특히 엄마·찜닭·우유 편) → 전부 밝고 장난스럽게.
# 원칙: 장조로 시작하는 밝은 진행만 / 패드·스트링·신스 리드처럼 길게 끄는 소리 빼기 / 짧게 끊는 악기
# (우쿨렐레·피치카토·글로켄·마림바·휘파람) / 셔플 리듬 / 멜로디도 짧게(skippy) / 울림 줄이기.
# lead2 에 세 번째 값 "answer" 를 주면 B 마디 끝에 짧게 두 번 대답한다.
SHUF = [(0, 1.0), (0.5, 0.55), (1, 0.8), (1.5, 0.55), (2, 1.0), (2.5, 0.55), (3, 0.8), (3.5, 0.55)]
SONGS3 = [
    dict(name="우쿨렐레 깡총", key=0, bpm=118, meter=4, swing=0.62,
         A=["1", "4", "5", "1"], B=["4", "1", "5", "1", "4", "1", "2:m", "5"],
         comps=[("uke", "strum8", -0.2, 64)], bass=("upright", "bouncy"),
         lead=("glock", "skippy", 79), lead2=("whistle", 76, "answer"),
         drums=[("kick_soft", ONE3, 0.8, 0, "main"), ("clap", BACK, 0.55, 0.1, "main"), ("shaker", SHUF, 0.35, 0.3, "all")],
         fill="clap", verb=0.12),
    dict(name="피치카토 살금살금", key=5, bpm=112, meter=4, swing=0.5,
         A=["1", "2:m", "5", "1"], B=["4", "5", "1", "1", "4", "5", "2:m", "5"],
         comps=[("pizz", "boomchick", 0.15, 60)], bass=("pizz", "root_fifth"),
         lead=("marimba", "skippy", 77), lead2=("glock", 84, "answer"),
         drums=[("rim", OFF, 0.4, 0.25, "all"), ("kick_soft", ONE3, 0.7, 0, "main"), ("snap", BACK, 0.35, -0.2, "main")],
         fill=None, verb=0.1),
    dict(name="오르골 장보기", key=7, bpm=120, meter=4, swing=0.6,
         A=["1", "4", "1", "5"], B=["4", "5", "1", "1", "4", "5", "1", "5"],
         comps=[("uke", "stab8", -0.2, 62)], bass=("upright", "root_fifth"),
         lead=("musicbox", "skippy", 81), lead2=None,
         drums=[("snap", BACK, 0.45, 0.2, "all"), ("shaker", SHUF, 0.3, -0.3, "all"), ("kick_soft", ONE3, 0.6, 0, "main")],
         fill=None, verb=0.14),
    dict(name="휘파람 장바구니", key=2, bpm=116, meter=4, swing=0.5,
         A=["1", "5", "4", "5"], B=["4", "1", "5", "1", "4", "1", "5", "5"],
         comps=[("steel", "folk8", -0.25, 60)], bass=("ebass", "quarters"),
         lead=("whistle", "skippy", 81), lead2=("glock", 84, "answer"),
         drums=[("kick_soft", FOUR, 0.7, 0, "main"), ("clap", BACK, 0.5, 0.1, "main"), ("tamb", OFF, 0.35, 0.35, "all")],
         fill="clap", verb=0.12),
    dict(name="마림바 소풍", key=9, bpm=112, meter=4, swing=0.5,
         A=["1", "4", "5", "4"], B=["2:m", "5", "1", "4", "2:m", "5", "1", "1"],
         comps=[("marimba", "arp8", 0.25, 69), ("nylon", "skank", -0.25, 62)], bass=("upright", "bouncy"),
         lead=("ocarina", "skippy", 79), lead2=None,
         drums=[("bongo", [(0.5, 0.7), (1.75, 0.6), (2.5, 0.8), (3.5, 0.6)], 0.45, 0.3, "all"),
                ("shaker", H8, 0.3, -0.2, "all"), ("kick_soft", ONE3, 0.6, 0, "main")],
         fill=None, verb=0.12),
    dict(name="밴조 깡충", key=7, bpm=128, meter=4, swing=0.5,
         A=["1", "4", "1", "5"], B=["4", "4", "1", "1", "2", "5", "1", "1"],
         comps=[("banjo", "roll", 0.3, 67), ("steel", "boomchick", -0.3, 57)], bass=("upright", "root_fifth"),
         lead=("whistle", "skippy", 79), lead2=None,
         drums=[("kick_soft", ONE3, 0.6, 0, "main"),
                ("brush", [(i * 0.5, 1.0 if i in (2, 6) else 0.45) for i in range(8)], 0.45, 0.1, "all")],
         fill=None, verb=0.1),
    dict(name="칼림바 콩콩", key=4, bpm=104, meter=4, swing=0.6,
         A=["1", "5", "4", "1"], B=["4", "1", "4", "5"],
         comps=[("kalimba", "arp8", 0.25, 72), ("uke", "stab8", -0.25, 62)], bass=("upright", "pop"),
         lead=("marimba", "skippy", 76), lead2=None,
         drums=[("snap", BACK, 0.45, 0.2, "all"), ("shaker", SHUF, 0.3, -0.25, "all"),
                ("kick_soft", [(0, 1), (2.5, 0.6)], 0.6, 0, "main")],
         fill=None, verb=0.14),
    dict(name="만화 행진", key=10, bpm=128, meter=4, swing=0.5,
         A=["1", "4", "5", "1"], B=["4", "1", "2:m", "5", "4", "1", "5", "1"],
         comps=[("pizz", "stab8", 0.2, 58)], bass=("pizz", "octave8"),
         lead=("piano", "skippy", 79), lead2=("glock", 86, "answer"),
         drums=[("tamb", OFF, 0.35, 0.3, "all"), ("snare_lofi", BACK, 0.4, 0, "main"), ("kick_soft", ONE3, 0.7, 0, "main")],
         fill="snare_lofi", verb=0.1),
    # ── 3벌 ──
    dict(name="통통 일렉피아노", key=5, bpm=104, meter=4, swing=0.62,
         A=["1", "4", "2:m", "5"], B=["4", "5", "1", "1", "4", "5", "1", "5"],
         comps=[("epiano", "stab8", 0.0, 62)], bass=("upright", "bouncy"),
         lead=("piano", "skippy", 79), lead2=("glock", 84, "answer"),
         drums=[("snap", BACK, 0.45, 0.2, "all"), ("hat", SHUF, 0.25, -0.25, "main"),
                ("kick_soft", [(0, 1), (2.5, 0.7)], 0.7, 0, "main")],
         fill="snap", verb=0.14),
    dict(name="신나는 클라브", key=4, bpm=110, meter=4, swing=0.5,
         A=["1", "4", "1", "5"], B=["4", "5", "1", "1", "4", "5", "2:m", "5"],
         comps=[("clav", "clav16", 0.2, 64), ("muted", "skank", -0.35, 55)], bass=("slap", "pop"),
         lead=("softsquare", "riff", 76), lead2=None,
         drums=[("kick", [(0, 1), (2.5, 0.8)], 0.75, 0, "main"), ("snare", BACK, 0.45, 0.05, "main"), ("hat", H16, 0.25, 0.3, "all")],
         fill="snare", verb=0.08),
    dict(name="스틸팬 바캉스", key=0, bpm=116, meter=4, swing=0.5,
         A=["1", "1", "4", "5"], B=["4", "5", "1", "6:m", "4", "5", "1", "1"],
         comps=[("uke", "strum8", -0.2, 64)], bass=("upright", "pop"),
         lead=("steelpan", "skippy", 79), lead2=None,
         drums=[("kick_soft", ONE3, 0.6, 0, "main"), ("clap", BACK, 0.45, 0, "main"), ("shaker", H16, 0.3, 0.3, "all"),
                ("bongo", [(0.75, 0.6), (2.75, 0.6), (3.5, 0.5)], 0.35, -0.3, "main")],
         fill=None, verb=0.12),
    dict(name="아코디언 쿵짝", key=2, bpm=126, meter=4, swing=0.5,
         A=["1", "5:7", "5:7", "1"], B=["4", "1", "5:7", "1", "4", "1", "5:7", "1"],
         comps=[("accordion", "boomchick", -0.2, 60)], bass=("upright", "root_fifth"),
         lead=("accordion", "skippy", 74), lead2=("glock", 86, "answer"),
         drums=[("kick_soft", ONE3, 0.5, 0, "main"), ("tamb", BACK, 0.35, 0.3, "all")],
         fill=None, verb=0.1),
    dict(name="포켓 칩튠", key=7, bpm=136, meter=4, swing=0.5,
         A=["1", "4", "1", "5"], B=["4", "5", "1", "1", "4", "5", "1", "5"],
         comps=[("chiparp", "chiparp", 0.2, 70)], bass=("tribass", "octave8"),
         lead=("square", "skippy", 84), lead2=None,
         drums=[("kick_chip", [(0, 1), (2, 0.8)], 0.7, 0, "main"),
                ("snare_chip", BACK, 0.45, 0, "main"), ("hat_chip", H8, 0.25, 0.2, "all")],
         fill="snare_chip", verb=0.04, comp_level=0.45),
    dict(name="래그타임 피아노", key=0, bpm=112, meter=4, swing=0.62,
         A=["1", "4", "5", "1"], B=["4", "4", "1", "1", "2", "2", "5", "5"],
         comps=[("piano", "boomchick", 0.1, 60)], bass=("upright", "root_fifth"),
         lead=("piano", "skippy", 79), lead2=("whistle", 81, "answer"),
         drums=[("brush", BACK, 0.4, 0.1, "all"), ("kick_soft", ONE3, 0.5, 0, "main")],
         fill=None, verb=0.1),
    dict(name="비브라폰 셔플", key=3, bpm=120, meter=4, swing=0.6,
         A=["1", "4", "1", "5"], B=["4", "4", "1", "1", "2", "5", "1", "1"],
         comps=[("uke", "stab8", -0.2, 62)], bass=("upright", "bouncy"),
         lead=("vibes", "skippy", 79), lead2=("glock", 86, "answer"),
         drums=[("snap", BACK, 0.45, 0.2, "all"), ("shaker", SHUF, 0.3, -0.3, "all"), ("kick_soft", ONE3, 0.5, 0, "main")],
         fill=None, verb=0.12),
    dict(name="리코더 동요", key=9, bpm=116, meter=4, swing=0.5,
         A=["1", "5", "4", "1"], B=["4", "1", "5", "1", "4", "1", "5", "5"],
         comps=[("pizz", "boomchick", 0.15, 60), ("glock", "arp8", -0.3, 81)], bass=("pizz", "root_fifth"),
         lead=("ocarina", "skippy", 76), lead2=None,
         drums=[("triangle", [(0, 0.7)], 0.2, 0.3, "main"), ("shaker", H8, 0.3, -0.3, "all"), ("kick_soft", ONE3, 0.5, 0, "main")],
         fill=None, verb=0.12, comp_level=0.6),
]

# 쇳소리·잡음 계열 타악기는 귀를 피곤하게 해서 한 번 더 줄인다(밝기 점검 후 2026-10-13)
BRIGHT = {"hat": 0.6, "ohat": 0.6, "shaker": 0.65, "tamb": 0.6, "ride": 0.2, "hat_chip": 0.6, "brush": 0.8}

LEVEL = {"lead": 1.0, "comp": 0.75, "bass": 0.7, "drums": 0.55, "lead2": 0.45, "fx": 0.12}
SEND = {"lead": 0.3, "comp": 0.35, "bass": 0.0, "drums": 0.12, "lead2": 0.5, "fx": 0.0}

STYLE = {
    "bouncy": dict(L=[0.5, 1, 1.5], w=[0.55, 0.35, 0.10], rest=0.12, legato=0.75),
    "lyrical": dict(L=[1, 1.5, 2, 0.5], w=[0.35, 0.2, 0.2, 0.25], rest=0.10, legato=0.95),
    "swingy": dict(L=[0.5, 1, 1.5], w=[0.55, 0.3, 0.15], rest=0.18, legato=0.8),
    "riff": dict(L=[0.25, 0.5, 0.75, 1], w=[0.3, 0.4, 0.15, 0.15], rest=0.22, legato=0.6),
    "skippy": dict(L=[0.5, 1, 1.5], w=[0.6, 0.3, 0.1], rest=0.15, legato=0.5),  # 깡총깡총 짧게 끊는 멜로디
}


def parse(sym):
    d, _, q = sym.partition(":")
    return int(d), q


def chord_pcs(key, sym, drop_root=False):
    d, q = parse(sym)
    root = (key + MAJ[d - 1]) % 12
    pcs = [(root + i) % 12 for i in QUAL[q]]
    if drop_root and len(pcs) > 3:
        pcs = pcs[1:]
    return root, pcs


def voicing(key, sym, center, n_notes=4, drop_root=False):
    _, pcs = chord_pcs(key, sym, drop_root)
    notes = sorted({center + ((pc - center + 6) % 12) - 6 for pc in pcs})
    while len(notes) < n_notes:
        notes.append(notes[len(notes) - len(pcs)] + 12 if len(notes) >= len(pcs) else notes[0] + 12)
    return notes


def bass_root(pc):
    return 36 + (pc - 36) % 12


def chord_tones_diatonic(sym):
    d, q = parse(sym)
    r = d - 1
    altered = ((q in ("", "add9", "6") and d not in (1, 4, 5)) or (q in ("7", "9") and d != 5)
               or (q in ("m", "m7", "m9") and d not in (2, 3, 6)))
    if q == "sus4":
        return {r % 7, (r + 3) % 7, (r + 4) % 7}
    if altered:
        return {r % 7, (r + 4) % 7}
    return {r % 7, (r + 2) % 7, (r + 4) % 7}


def nearest_tone(s, tones):
    for k in (0, -1, 1, -2, 2, -3, 3):
        if (s + k) % 7 in tones:
            return s + k
    return s


def gen_rhythm(rng, style, beats, start=0.0):
    st = STYLE[style]
    out, pos = [], start
    while pos < beats - 1e-6:
        L = min(float(rng.choice(st["L"], p=st["w"])), beats - pos)
        if out and rng.random() < st["rest"]:
            pos += L
            continue
        out.append((pos, L))
        pos += L
    return out


def phrase(rng, song, chords, center):
    """8마디 멜로디: 동기(1-2) → 화음 따라 옮긴 동기(3-4) → 동기 반복(5-6) → 마침(7-8)."""
    meter, key = song["meter"], song["key"]
    style = song["lead"][1]
    base = center - ((center - key) % 12)
    cell = 2 * meter
    lo, hi = -3, 9

    def midi(s):
        return base + MAJ[s % 7] + 12 * (s // 7)

    def strong(p, L):
        q = p % meter
        return abs(q) < 1e-6 or (meter == 4 and abs(q - 2) < 1e-6) or L >= 1.5

    r1 = gen_rhythm(rng, style, cell, start=0.5 if rng.random() < 0.25 else 0.0)
    while len(r1) < 4:
        r1 = gen_rhythm(rng, style, cell)
    # 동기 음높이
    s = int(rng.choice([2, 4]))
    seed = []
    for i, (p, L) in enumerate(r1):
        up = i < len(r1) / 2
        steps = np.array([-2, -1, 0, 1, 2, 3, -3])
        w = np.array([0.12, 0.28, 0.08, 0.28, 0.12, 0.06, 0.06])
        w = w * np.where(steps > 0, 1.6 if up else 0.7, np.where(steps < 0, 0.7 if up else 1.6, 1.0))
        if i:
            s = s + int(rng.choice(steps, p=w / w.sum()))
        s = int(np.clip(s, lo, hi))
        bar = int(p // meter)
        if strong(p, L):
            s = nearest_tone(s, chord_tones_diatonic(chords[bar]))
        seed.append(s)

    def place(rhythm, pitches, bar0):
        res = []
        for (p, L), s in zip(rhythm, pitches):
            bar = bar0 + int(p // meter)
            s = int(np.clip(s, lo, hi))
            if strong(p, L):
                s = nearest_tone(s, chord_tones_diatonic(chords[bar]))
            res.append((bar, p % meter, L, s))
        return res

    d0, d2 = parse(chords[0])[0], parse(chords[2])[0]
    shift = (d2 - d0 + 3) % 7 - 3
    notes = place(r1, seed, 0) + place(r1, [x + shift for x in seed], 2) + place(r1, seed, 4)
    # 마침: 한 마디 리듬 + 다음 마디 첫 박에 긴 음
    rc = gen_rhythm(rng, style, meter)
    s = seed[-1]
    cad = []
    target = nearest_tone(0 if 0 in chord_tones_diatonic(chords[7]) else 2, chord_tones_diatonic(chords[7]))
    for i, (p, L) in enumerate(rc):
        s = s + int(np.sign(target - s)) * int(rng.choice([1, 1, 2])) if s != target else s + int(rng.choice([-1, 1]))
        cad.append((6, p, L, s))
    cad.append((7, 0.0, meter * 0.75, target))
    notes += [(b, p, L, nearest_tone(int(np.clip(x, lo, hi)), chord_tones_diatonic(chords[b])) if p % 1 == 0 else int(np.clip(x, lo, hi)))
              for b, p, L, x in cad]
    bars = [[] for _ in range(8)]
    for b, p, L, x in notes:
        vel = (1.0 if abs(p % meter) < 1e-6 else 0.82) * (1 + rng.normal(0, 0.05))
        bars[b].append((p, L, midi(x), vel))
    return bars


# 반주: (박 위치, 화음 안 몇 번째 음들 또는 None=전부, 길이(박), 세기, 줄 퉁기는 방향)
def comp_events(pat, notes, meter, bar_i):
    ev = []
    if pat == "strum8":
        for p, v, d, L in [(0, 1, "D", 1), (1, 0.9, "D", 0.5), (1.5, 0.6, "U", 0.5), (2.5, 0.6, "U", 0.5), (3, 0.85, "D", 0.5), (3.5, 0.6, "U", 0.5)]:
            ev.append((p, notes if d == "D" else notes[-3:], L, v, d))
    elif pat == "folk8":
        for i in range(8):
            ev.append((i * 0.5, notes if i % 2 == 0 else notes[-3:], 0.5, 1.0 if i % 2 == 0 else 0.55, "D" if i % 2 == 0 else "U"))
    elif pat == "bossa":
        pos = [(0, 0.9), (1.5, 0.8), (3, 0.85)] if bar_i % 2 == 0 else [(0.5, 0.8), (2, 0.85), (3.5, 0.7)]
        for p, v in pos:
            ev.append((p, notes, 1.0, v, "B"))
    elif pat == "lofi":
        ev += [(0, notes, 2.5, 1.0, "R"), (3, notes[1:], 1.0, 0.55, "R")]
    elif pat == "skank":
        ev += [(i + 0.5, notes[-3:], 0.3, 0.9, "B") for i in range(meter)]
    elif pat == "waltz":
        ev += [(1, notes[-3:], 0.6, 0.7, "B"), (2, notes[-3:], 0.6, 0.6, "B")]
    elif pat == "arp8":
        seq = [0, 1, 2, 3, 2, 1, 2, 3]
        ev += [(i * 0.5, [notes[seq[i] % len(notes)]], 1.5, 0.9 if i % 2 == 0 else 0.7, "B") for i in range(8)]
    elif pat == "arp16":
        ev += [(i * 0.25, [notes[(i % 4) % len(notes)]], 0.5, 0.9 if i % 4 == 0 else 0.6, "B") for i in range(16)]
    elif pat == "block8":
        ev += [(i * 0.5, notes, 0.45, (1, 0.6, 0.8, 0.6)[i % 4], "B") for i in range(8)]
    elif pat == "clav16":
        for p, v in [(0, 1), (0.75, 0.7), (1.5, 0.8), (2.25, 0.6), (2.5, 0.8), (3.5, 0.9)]:
            ev.append((p, notes[-3:], 0.2, v, "B"))
    elif pat == "pad":
        ev.append((0, notes, meter * 0.98, 0.8, "B"))
    elif pat == "boomchick":
        ev += [(1, notes[-3:], 0.4, 0.8, "B"), (3, notes[-3:], 0.4, 0.75, "B")]
    elif pat == "roll":
        seq = [0, 1, 2, 0, 1, 2, 0, 2]
        top = notes[-3:]
        ev += [(i * 0.5, [top[seq[i]]], 1.5, 0.9 if i in (0, 3, 6) else 0.65, "B") for i in range(8)]
    elif pat == "tremolo":
        for i in range(meter * 4):
            ev.append((i * 0.25, notes[-2:], 0.3, 0.45 + 0.3 * np.sin(np.pi * (i % 8) / 8), "B"))
    elif pat == "muted8":
        r = notes[0]
        ev += [(i * 0.5, [r, r + 7, r + 12], 0.3, 1.0 if i % 2 == 0 else 0.7, "B") for i in range(8)]
    elif pat == "chiparp":
        seq = [0, 1, 2, 3, 2, 1, 2, 1]
        ev += [(i * 0.25, [notes[seq[i % 8] % len(notes)]], 0.22, 0.8, "B") for i in range(16)]
    elif pat == "shell":
        pos = [(0, 0.7, 1), (1.5, 0.8, 0.5), (3, 0.6, 0.5)] if bar_i % 2 == 0 else [(0.5, 0.7, 0.5), (2, 0.8, 1), (3.5, 0.6, 0.5)]
        ev += [(p, notes, L, v, "B") for p, v, L in pos]
    elif pat == "citypop":
        ev += [(p, notes, L, v, "B") for p, v, L in [(0, 0.9, 1.5), (1.75, 0.7, 0.25), (2.5, 0.8, 1), (3.5, 0.6, 0.5)]]
    elif pat == "stab8":  # 화음을 짧게 톡톡
        ev += [(p, notes[-3:], L, v, "B") for p, v, L in [(0, 1, 0.25), (1, 0.8, 0.25), (1.5, 0.6, 0.2), (2, 0.9, 0.25), (3, 0.8, 0.25), (3.5, 0.6, 0.2)]]
    elif pat == "offstab":
        ev += [(p, notes[-3:], 0.4, v, "B") for p, v in [(0.5, 0.8), (1.5, 0.7), (2.5, 0.8), (3.25, 0.55), (3.5, 0.7)]]
    else:
        raise KeyError(pat)
    return ev


def bass_events(pat, key, sym, next_sym, meter, bar_i):
    rpc, pcs = chord_pcs(key, sym)
    r = bass_root(rpc)
    third = r + (QUAL[parse(sym)[1]][1] if len(QUAL[parse(sym)[1]]) > 1 else 4)
    fifth = r + 7 if r + 7 <= 50 else r - 5
    o = r + 12
    pick = {"r": r, "5": fifth, "o": o}
    pats = {
        "bouncy": [(0, "r", 1, 1), (1.5, "r", 0.5, 0.7), (2, "5", 1, 0.9), (3, "o", 0.5, 0.7), (3.5, "5", 0.5, 0.7)],
        "lofi": [(0, "r", 1.5, 1), (2.5, "r", 0.5, 0.7), (3, "5", 1, 0.8)],
        "bossa": [(0, "r", 1.5, 1), (1.5, "5", 0.5, 0.7), (2, "5", 1.5, 0.9), (3.5, "r", 0.5, 0.7)],
        "quarters": [(0, "r", 1, 1), (1, "r", 1, 0.7), (2, "5", 1, 0.9), (3, "r", 1, 0.7)],
        "funk16": [(0, "r", 0.5, 1), (0.75, "o", 0.2, 0.8), (1.5, "r", 0.25, 0.7), (2.5, "r", 0.25, 0.9),
                   (2.75, "o", 0.2, 0.7), (3.25, "5", 0.25, 0.7), (3.5, "r", 0.4, 0.8)],
        "waltz": [(0, "r" if bar_i % 2 == 0 else "5", 1, 1)],
        "pop": [(0, "r", 1, 1), (1.5, "r", 0.5, 0.7), (2, "r", 1, 0.9), (3.5, "5", 0.5, 0.7)],
        "eighths": [(i * 0.5, "r", 0.45, 1 if i % 2 == 0 else 0.75) for i in range(8)],
        "octave8": [(i * 0.5, "r" if i % 2 == 0 else "o", 0.4, 1 if i % 2 == 0 else 0.8) for i in range(8)],
        "root_fifth": [(0, "r", 0.9, 1), (2, "5", 0.9, 0.9)],
        "offbeat": [(i + 0.5, "r", 0.4, 1) for i in range(4)],
        "sustain2": [(0, "r", 2.5, 1), (2.5, "5", 1.5, 0.7)],
        "citypop": [(0, "r", 0.5, 1), (0.75, "r", 0.25, 0.6), (1.5, "o", 0.25, 0.8), (2, "r", 0.5, 0.9),
                    (2.75, "5", 0.25, 0.6), (3, "o", 0.25, 0.7), (3.5, "r", 0.4, 0.8)],
    }
    if pat == "walking":
        nr = bass_root(chord_pcs(key, next_sym)[0])
        tone3 = fifth if fifth > r else r + 7
        if abs(nr - tone3) > 6:
            nr += 12 if nr < tone3 else -12
        appr = nr - 1 if nr > tone3 else nr + 1
        return [(0, r, 1, 1), (1, third, 1, 0.8), (2, tone3, 1, 0.85), (3, appr, 1, 0.8)]
    return [(p, pick[w], L, v) for p, w, L, v in pats[pat]]


def swing_pos(p, sw, sw16):
    b = np.floor(p + 1e-9)
    fr = p - b
    if abs(fr - 0.5) < 1e-6:
        fr = sw
    elif abs(fr - 0.25) < 1e-6:
        fr = 0.25 + (sw16 - 0.5) * 0.5
    elif abs(fr - 0.75) < 1e-6:
        fr = (sw if sw != 0.5 else 0.5) + 0.25 + (sw16 - 0.5) * 0.5
    return b + fr


def active_rms(x):
    mono = x.mean(axis=1)
    fr = 2205
    m = len(mono) // fr * fr
    e = (mono[:m].reshape(-1, fr) ** 2).mean(axis=1)
    if e.max() <= 0:
        return 0.0
    act = e > e.max() * 1e-3
    return float(np.sqrt(e[act].mean()))


def reverb(x, seconds, seed):
    n = int(SR * seconds)
    out = np.zeros_like(x)
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    for c in range(2):
        ir = np.random.default_rng(seed + c).standard_normal(n) * np.exp(-np.arange(n) / SR * 6.9 / seconds)
        ir[: int(0.015 * SR)] = 0
        ir = fft_filter(ir, hi=5000)
        ir /= np.sqrt((ir ** 2).sum())
        out[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], nfft) * np.fft.rfft(ir, nfft), nfft)[: len(x)]
    return out


def make(idx, dur, songs=None):
    songs = songs or SONGS
    song = songs[idx % len(songs)]
    rng = np.random.default_rng(2026 + idx * 101)
    key, meter, bpm = song["key"], song["meter"], song["bpm"]
    sw, sw16 = song.get("swing", 0.5), song.get("swing16", 0.5)
    beat = 60.0 / bpm
    bar = meter * beat
    total = dur + 1.0
    n = int((total + 4) * SR)

    plan = [("intro", 4), ("A", 8), ("B", 8), ("A", 8), ("break", 4), ("B", 8), ("A", 8), ("outro", 4)]
    while sum(b for _, b in plan) * bar < total + bar:
        plan += [("B", 8), ("A", 8)]
    bars = []
    for sec, nb in plan:
        prog = song["B"] if sec in ("B", "break") else song["A"]
        for i in range(nb):
            bars.append(dict(sec=sec, i=i, nb=nb, chord=prog[i % len(prog)], t0=len(bars) * bar))
            if bars[-1]["t0"] > total:
                break
        if bars[-1]["t0"] > total:
            break
    for k, b in enumerate(bars):
        b["next"] = bars[k + 1]["chord"] if k + 1 < len(bars) else b["chord"]

    lead_inst, _, lead_c = song["lead"]
    melA = phrase(rng, song, [song["A"][i % len(song["A"])] for i in range(8)], lead_c)
    melB = phrase(rng, song, [song["B"][i % len(song["B"])] for i in range(8)], lead_c + 3)

    stems = {k: np.zeros((n, 2)) for k in LEVEL}

    def put(stem, sig, t, gain, pan):
        i = int(t * SR)
        if i < 0:
            sig, i = sig[-i:], 0
        j = min(n, i + len(sig))
        if j <= i:
            return
        seg = sig[: j - i] * gain
        stems[stem][i:j, 0] += seg * np.cos((pan + 1) * np.pi / 4)
        stems[stem][i:j, 1] += seg * np.sin((pan + 1) * np.pi / 4)

    def bt(t0, p):
        return t0 + swing_pos(p, sw, sw16) * beat

    hum = lambda s=0.004: rng.normal(0, s)
    prev2 = None
    for bi, b in enumerate(bars):
        sec, t0, sym = b["sec"], b["t0"], b["chord"]
        # 반주
        for ci, (inst, pat, pan, center) in enumerate(song["comps"]):
            notes = voicing(key, sym, center, drop_root=pat in ("shell", "clav16"))
            if pat == "muted8":
                notes = [bass_root(chord_pcs(key, sym)[0]) + 12] + notes
            last_bar = sec == "outro" and b["i"] == b["nb"] - 1
            evs = [(0, notes, meter * 1.5, 0.9, "D")] if last_bar else comp_events(pat, notes, meter, bi)
            for p, ns, L, v, d in evs:
                if p >= meter:
                    continue
                t = bt(t0, p) + hum() + (0.018 if pat == "lofi" else 0)
                order = list(ns) if d != "U" else list(ns)[::-1]
                spread = {"D": 0.012, "U": 0.009, "R": 0.02}.get(d, 0.003)
                for k, m in enumerate(order):
                    put("comp", note(inst, int(m), round(L * beat, 2), (bi + k) % 3), t + k * spread,
                        v * (0.85 + 0.15 * rng.random()) * (1 - 0.04 * k) * (1.0 if ci == 0 else 0.8), pan)
        # 베이스
        if sec in ("A", "B", "outro") or (sec == "break" and song["bass"][1] in ("sustain2", "lofi")):
            binst, bpat = song["bass"]
            evs = bass_events(bpat, key, sym, b["next"], meter, bi)
            if sec == "outro" and b["i"] == b["nb"] - 1:
                evs = [(0, bass_root(chord_pcs(key, sym)[0]), meter * 1.2, 1.0)]
            for p, m, L, v in evs:
                m = m + 12 if binst == "tribass" else m
                put("bass", note(binst, int(m), round(L * beat * 0.95, 2), bi % 3), bt(t0, p) + hum(0.003), v, 0.0)
        # 멜로디
        mel = None
        if sec == "A":
            mel = melA[b["i"] % 8]
        elif sec == "B":
            mel = melB[b["i"] % 8]
        elif sec == "outro":
            mel = melA[4 + b["i"] % 4]
        if mel:
            leg = STYLE[song["lead"][1]]["legato"]
            for p, L, m, v in mel:
                put("lead", note(lead_inst, int(m), round(L * beat * leg, 2), bi % 3), bt(t0, p) + hum(), v, 0.1)
        # 두 번째 선율(길게)
        if song["lead2"] and len(song["lead2"]) == 3 and sec == "B":
            # 대답하듯 마디 끝에 짧게 두 번(길게 끌면 비장해진다)
            inst2, c2, _ = song["lead2"]
            top = voicing(key, sym, c2, n_notes=3)
            for k, p in enumerate((meter - 1, meter - 0.5)):
                put("lead2", note(inst2, int(top[-1 - k]), round(0.4 * beat, 2), k), bt(t0, p) + hum(), 0.8, -0.3)
        elif song["lead2"] and sec in ("B", "break"):
            inst2, c2 = song["lead2"][:2]
            cands = voicing(key, sym, c2, n_notes=3)
            m2 = min(cands, key=lambda x: abs(x - (prev2 if prev2 else c2)))
            prev2 = m2
            put("lead2", note(inst2, int(m2), round(meter * beat * 0.95, 2), 0), t0 + hum(), 0.8, -0.3)
        # 드럼
        for name, pat, g, pan, mode in song["drums"]:
            on = mode == "all" or (mode == "main" and sec in ("A", "B")) or (mode == "B" and sec == "B")
            if sec == "outro" and b["i"] == b["nb"] - 1:
                on = on and name.startswith("kick")
            if not on:
                continue
            cyc = 2 if max(p for p, _ in pat) >= meter else 1
            for p, v in pat:
                if cyc == 2:
                    if int(p // meter) != bi % 2:
                        continue
                    p = p % meter
                put("drums", drum(name, int(rng.integers(0, 4))), bt(t0, p) + hum(0.003),
                    g * v * BRIGHT.get(name, 1.0) * (0.92 + 0.16 * rng.random()), pan)
        # 필인: 구간이 바뀌기 직전 마디
        if song.get("fill") and sec in ("intro", "A", "B") and b["i"] == b["nb"] - 1:
            for k, p in enumerate((meter - 1, meter - 0.5, meter - 0.25)):
                put("drums", drum(song["fill"], k), bt(t0, p), 0.35 + 0.15 * k, 0.1)

    if song.get("vinyl"):
        v = vinyl(n, idx)
        stems["fx"][:, 0] += v
        stems["fx"][:, 1] += np.roll(v, 300)

    level = dict(LEVEL)
    if song.get("comp_level"):
        level["comp"] = song["comp_level"]
    mix = np.zeros((n, 2))
    send = np.zeros((n, 2))
    for k, x in stems.items():
        r = active_rms(x)
        if r <= 0:
            continue
        x = x * (level[k] * 0.1 / r)
        if k == "drums":  # 드럼 묶음의 쇳소리 윗부분을 부드럽게
            x = np.stack([fft_filter(x[:, c], hi=9000, order=1) for c in range(2)], axis=1)
        mix += x
        send += x * SEND[k]
    mix += reverb(send, 1.2 + song["verb"] * 3, 77 + idx) * (song["verb"] / 0.2) * 0.9
    for c in range(2):
        mix[:, c] = fft_filter(mix[:, c], lo=35, hi=song.get("lp"))
    mix = mix[: int(total * SR)]
    rms = np.sqrt((mix ** 2).mean())
    mix *= 0.10 / (rms + 1e-9)
    mix = 0.92 * np.tanh(mix / 0.92)
    names = "C Db D Eb E F Gb G Ab A Bb B".split()
    return mix, dict(song=song["name"], key=names[key], bpm=bpm, meter=meter)


def save(path, buf):
    pcm = (np.clip(buf, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    i, d, out = int(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
    b, info = make(i, d)
    save(out, b)
    print(info)
