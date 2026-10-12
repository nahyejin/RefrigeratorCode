"""릴스 배경음악 24곡을 직접 합성한다(저작권 걱정 없는 자체 제작) — 「grocery vlog」 느낌: 밝고 가벼운 어쿠스틱/우쿨렐레 팝.

    PYTHONUTF8=1 python scripts/make_bgm.py <번호 0~23> <길이(초)> <out.wav>

번호마다 조(key)·빠르기·코드 진행·악기(우쿨렐레/기타/마림바/휘슬)·리듬·멜로디가 달라서 24곡이 서로 다르게 들린다.
소리는 가산합성(배음 여러 개에 지수 감쇠)으로 만든 뜯는 악기 + 필터 잡음 셰이커·핑거스냅 + 부드러운 킥, 마지막에 가벼운 리버브.
(2026-10-12 사용자 요청: 인스타에서 음악을 입히면 영상 속 음성이 안 들리니 배경음을 영상에 직접 약하게 깔아 달라 — 곡은 「grocery vlog」 스타일)
"""
import sys
import numpy as np
import wave

SR = 44100
rng_global = np.random.default_rng

NOTE = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "Bb": 10}
MAJOR = [0, 2, 4, 5, 7, 9, 11]


def hz(semi_from_c4):
    return 261.6256 * 2 ** (semi_from_c4 / 12.0)


def deg(root, degree, octave=0):
    """장음계 도(1~7)의 C4 기준 반음 수"""
    d = degree - 1
    return NOTE[root] + MAJOR[d % 7] + 12 * (d // 7 + octave)


# 코드 진행(음계 도): I V vi IV 같은 대중적인 밝은 진행들
PROGS = [
    [1, 5, 6, 4], [1, 6, 4, 5], [1, 4, 6, 5], [4, 1, 5, 6], [1, 5, 4, 5], [6, 4, 1, 5],
    [1, 3, 4, 5], [1, 4, 5, 4], [4, 5, 3, 6], [1, 6, 2, 5], [1, 5, 6, 3], [2, 5, 1, 6],
]
TRIAD = {1: (0, 4, 7), 2: (0, 3, 7), 3: (0, 3, 7), 4: (0, 4, 7), 5: (0, 4, 7), 6: (0, 3, 7), 7: (0, 3, 6)}


def env_pluck(n, decay):
    t = np.arange(n) / SR
    return np.exp(-t * decay)


def tone(f, dur, kind, vel=1.0):
    """뜯는 악기 한 음. kind: uke / guitar / marimba / whistle / bass"""
    n = int(SR * dur)
    t = np.arange(n) / SR
    if kind == "marimba":
        parts = [(1, 1.0, 7.0), (4.0, 0.35, 16.0), (9.8, 0.12, 30.0)]
    elif kind == "whistle":
        vib = 1 + 0.004 * np.sin(2 * np.pi * 5.2 * t)
        y = np.sin(2 * np.pi * f * t * vib) * (1 - np.exp(-t * 40)) * np.exp(-t * 2.2)
        return y * 0.5 * vel
    elif kind == "bass":
        parts = [(1, 1.0, 4.5), (2, 0.35, 7.0), (3, 0.12, 11.0)]
    elif kind == "guitar":
        parts = [(k, 1.0 / k ** 1.15, 3.2 + 1.9 * k) for k in range(1, 9)]
    else:  # uke — 밝고 짧게
        parts = [(k, 1.0 / k ** 1.3, 4.5 + 2.4 * k) for k in range(1, 7)]
    y = np.zeros(n)
    for k, a, d in parts:
        y += a * np.sin(2 * np.pi * f * k * t) * np.exp(-t * d)
    y *= (1 - np.exp(-t * 600))  # 어택 클릭 방지
    return y * vel * 0.5


def noise_burst(dur, lo, decay, seed):
    n = int(SR * dur)
    r = np.random.default_rng(seed).standard_normal(n)
    # 간단한 고역통과: 이전 샘플과의 차분을 여러 번
    for _ in range(lo):
        r = np.diff(r, prepend=0)
    t = np.arange(n) / SR
    return r * np.exp(-t * decay)


def kick(dur=0.22):
    n = int(SR * dur)
    t = np.arange(n) / SR
    f = 55 + 70 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t * 14) * 0.9


def add(buf, sig, pos, gain=1.0, pan=0.0):
    i = int(pos * SR)
    if i >= buf.shape[0]:
        return
    j = min(buf.shape[0], i + len(sig))
    seg = sig[: j - i] * gain
    buf[i:j, 0] += seg * (1 - max(0, pan))
    buf[i:j, 1] += seg * (1 + min(0, pan))


def reverb(x, wet=0.16, seed=7):
    n = int(SR * 1.1)
    ir = np.random.default_rng(seed).standard_normal(n) * np.exp(-np.arange(n) / SR * 4.2)
    ir[0] = 0
    out = np.zeros_like(x)
    L = len(x) + n
    nfft = 1 << (L - 1).bit_length()
    IR = np.fft.rfft(ir, nfft)
    for c in range(2):
        out[:, c] = np.fft.irfft(np.fft.rfft(x[:, c], nfft) * IR, nfft)[: len(x)]
    return x + wet * out * (np.abs(x).max() / (np.abs(out).max() + 1e-9))


def make(idx, dur):
    rg = np.random.default_rng(1000 + idx * 17)
    root = ["C", "G", "D", "F", "A", "E", "Bb", "C", "G", "F", "D", "A"][idx % 12]
    bpm = [100, 108, 96, 112, 104, 118, 92, 110, 100, 114, 98, 106][(idx * 5) % 12] + (idx // 12) * 4
    prog = PROGS[(idx * 7 + idx // 4) % len(PROGS)]
    chord_inst = ["uke", "guitar", "uke", "guitar"][(idx // 2) % 4]
    lead = ["marimba", "whistle", "marimba", "guitar", "whistle", "marimba"][idx % 6]
    groove = idx % 4
    drums = ["shaker+snap", "kick+clap", "shaker+snap", "brush", "kick+clap", "shaker"][idx % 6]
    beat = 60.0 / bpm
    bar = 4 * beat
    total = dur + 1.0
    buf = np.zeros((int(total * SR) + SR, 2))
    # 멜로디 시드: 곡마다 다른 5음계 패턴
    penta = [1, 2, 3, 5, 6, 8, 9]
    n_bars = int(total / bar) + 1
    lead_seed = rg.integers(0, 1 << 30)
    lrg = np.random.default_rng(lead_seed)
    motif = [lrg.choice(penta) for _ in range(8)]
    for b in range(n_bars):
        t0 = b * bar
        ch = prog[b % 4]
        sec = (b // 8) % 3  # 0: 도입(멜로디 없음), 1: A, 2: B
        root_c = deg(root, ch, -1)
        triad = [root_c + x for x in TRIAD[ch]]
        # 베이스
        for k in (0, 2):
            if b % 8 >= 1 or sec > 0:
                add(buf, tone(hz(root_c - 12), beat * 1.6, "bass"), t0 + k * beat, 0.55, 0)
        # 코드 스트럼(그루브 4종)
        patterns = [
            [(0, 1), (1.5, .7), (2, .9), (3.5, .7)],
            [(0, 1), (1, .6), (2, .9), (2.5, .6), (3.5, .7)],
            [(0, 1), (0.5, .5), (1.5, .8), (2, .9), (3, .6)],
            [(0, 1), (1.5, .8), (2.5, .7), (3, .8)],
        ]
        for off, v in patterns[groove]:
            tt = t0 + off * beat
            for s, semi in enumerate(triad + [triad[0] + 12]):
                add(buf, tone(hz(semi), beat * 1.1, chord_inst, v * (0.9 - 0.05 * s)), tt + s * 0.011, 0.5, -0.25 + 0.1 * s)
        # 멜로디
        if sec > 0 and b % 2 == 0:
            for k in range(4):
                step = motif[(b * 4 // 2 + k) % len(motif)] if sec == 1 else motif[(k * 2 + b) % len(motif)]
                semi = deg(root, step, 1)
                add(buf, tone(hz(semi), beat * 1.3, lead, 0.9), t0 + (k * 2 if sec == 1 else k * 1.0 + 0.5) * beat * 0.5 + (0 if sec == 1 else 0), 0.55, 0.3)
        # 드럼
        for q in range(8):
            tt = t0 + q * beat / 2
            if drums in ("shaker+snap", "shaker", "kick+clap", "brush"):
                g = 0.09 if q % 2 else 0.05
                add(buf, noise_burst(0.07, 1, 55, int(b * 8 + q + idx)), tt, g, 0.35 if q % 2 else -0.2)
            if drums in ("kick+clap",) and q in (0, 4):
                add(buf, kick(), tt, 0.5, 0)
            if drums == "kick+clap" and q in (2, 6):
                add(buf, noise_burst(0.10, 1, 38, 99 + q), tt, 0.16, 0.1)
            if drums == "shaker+snap" and q in (2, 6) and (sec > 0 or b % 8 >= 4):
                add(buf, noise_burst(0.05, 1, 90, 55 + q), tt, 0.16, 0.2)
            if drums == "brush" and q in (2, 6):
                add(buf, noise_burst(0.16, 1, 22, 33 + q), tt, 0.12, -0.1)
    buf = reverb(buf)
    buf = buf[: int(total * SR)]
    # 가장자리 페이드, 피크 정규화
    buf *= 0.85 / (np.abs(buf).max() + 1e-9)
    return buf, dict(root=root, bpm=bpm, prog=prog, chord=chord_inst, lead=lead, drums=drums)


def save(path, buf):
    pcm = (np.clip(buf, -1, 1) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())


if __name__ == "__main__":
    idx, dur, out = int(sys.argv[1]), float(sys.argv[2]), sys.argv[3]
    buf, info = make(idx, dur)
    save(out, buf)
    print(info)
