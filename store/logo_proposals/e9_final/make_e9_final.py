# -*- coding: utf-8 -*-
"""E9 확정 → 정제안 E9a~h + 색 팔레트 탐색(14종) + 추천 팔레트 풀세트 — 제안 전용(운영 자산 변경 없음).

    PYTHONIOENCODING=utf-8 python store/logo_proposals/e9_final/make_e9_final.py [refine|palette|home|full|all]

E9 문법: 재료 > 받침 > 큰 잎, 캔버스 86% 채움(k=1.32). 형태는 고정하고 한 번에 한 축(정제 / 색)만 바꾼다.
결과는 e9_final/ 안에만 쓴다. 대비비율은 WCAG 상대 휘도 공식으로 계산한다.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
sys.path.insert(0, os.path.join(PARENT, "d3_variants"))
import make_family_system as F  # noqa: E402
from PIL import Image, ImageChops, ImageDraw  # noqa: E402

V, L, D = F.V, F.L, F.D
P, SS = L.P, L.SS
INK, BRAND, WHITE, LIGHT = F.INK, F.BRAND, F.WHITE, F.LIGHT
G2 = F.G2


# ---------------------------------------------------------------- 대비비율(WCAG)
def _lum(c):
    r = []
    for v in c:
        v /= 255
        r.append(v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4)
    return 0.2126 * r[0] + 0.7152 * r[1] + 0.0722 * r[2]


def cr(a, b):
    la, lb = _lum(a), _lum(b)
    if la < lb:
        la, lb = lb, la
    return (la + 0.05) / (lb + 0.05)


# ---------------------------------------------------------------- 형태(정제 파라미터)
BASE = dict(R=310, trunc=262, ball_r=172, rx=1.0, dx=0, gap=18, rim=470, rr=8, hi=False, hollow=False,
            leaves=[(52, 262, 132, 10, 12)])


def mono_hi(m, cx, cy, r):
    """재료 윗면 하이라이트 — 납작한 한 면(그라데이션 아님): 왼쪽 위의 비스듬한 타원."""
    h = L.new_mask()
    ImageDraw.Draw(h).ellipse([P(cx - 0.62 * r), P(cy - 0.74 * r), P(cx - 0.12 * r), P(cy - 0.46 * r)], fill=255)
    h = h.rotate(32, resample=Image.BICUBIC, center=(P(cx - 0.37 * r), P(cy - 0.6 * r)))
    return ImageChops.multiply(h, m)


def parts(p):
    R, trunc, rim, rr, gap = p["R"], p["trunc"], p["rim"], p["rr"], p["gap"]
    r = p["ball_r"]
    cx = 512 + p["dx"]
    cy = rim
    outer = D.bowl_mask(R, rim, trunc)
    if p["hollow"]:  # 검정 윤곽 받침(속이 빈 U자)
        inner = L.new_mask()
        L.circle(inner, 512, rim, R - 36)
        cut = L.new_mask()
        dd = ImageDraw.Draw(cut)
        dd.rectangle([0, 0, P(1024), P(rim + 36)], fill=255)
        dd.rectangle([0, P(rim + trunc - 36), P(1024), P(1024)], fill=255)
        bowl = ImageChops.subtract(outer, ImageChops.subtract(inner, cut))
    else:
        bowl = outer
    sock = L.new_mask()
    ImageDraw.Draw(sock).ellipse([P(cx - r * p["rx"] - gap), P(cy - r - gap), P(cx + r * p["rx"] + gap), P(cy + r + gap)], fill=255)
    bowl = ImageChops.subtract(bowl, sock)
    bowl = L.round_mask(bowl, rr * SS)
    ball = L.new_mask()
    ImageDraw.Draw(ball).ellipse([P(cx - r * p["rx"]), P(cy - r), P(cx + r * p["rx"]), P(cy + r)], fill=255)
    hi = mono_hi(ball, cx, cy, r) if p["hi"] else None
    leaves = []
    for ang, ln, wd, ldx, lgap in p["leaves"]:
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        bx, by = cx + ldx, cy - r - lgap
        leaves.append(D.lens(bx + ca * ln / 2, by - sa * ln / 2, ln, wd, ang))
    return bowl, ball, hi, leaves


def layers(p, pal):
    bowl, ball, hi, leaves = parts(p)
    ls = [(bowl, pal["bowl"], "bowl"), (ball, pal["ball"], "ball")]
    if hi is not None and pal.get("hi"):
        ls.append((hi, pal["hi"], "hi"))
    for lm in leaves:
        ls.append((lm, pal["leaf"], "leaf"))
    return ls


def render(p, pal, size=1024, k=1.32, bg=True):
    return F.place(layers(p, pal), k, bg=pal["bg"] if bg else None, size=size, ycenter=420).convert("RGB" if bg else "RGBA")


def sym(p, pal, size=1024, k=1.0):
    return F.place(layers(p, pal), k, bg=None, size=size, ycenter=420)


def leaf_area_px(p, px=29):
    ls = layers(p, dict(bowl=INK, ball=WHITE, leaf=G2, hi=None))
    ms = [m for m, c, t in ls if t == "leaf"]
    m = ms[0]
    for x in ms[1:]:
        m = ImageChops.lighter(m, x)
    k = 1.32
    h = m.histogram()
    area = sum(i * v for i, v in enumerate(h)) / 255 / (SS * SS) * k * k
    return area * (px / 1024) ** 2


# ---------------------------------------------------------------- 현재 팔레트(기준)
CUR = dict(bg=BRAND, bowl=INK, ball=WHITE, leaf=G2, hi=None)
KAKAO = (254, 229, 0)


def pal_of(**kw):
    d = dict(CUR)
    d.update(kw)
    return d


# ---------------------------------------------------------------- 정제안 E9a~h
REFINE = [
    ("E9a", "기준(E9)", {}, CUR),
    ("E9b", "잎 낮게 눕힘(38°) + 간격 24", dict(leaves=[(38, 282, 130, 14, 24)]), CUR),
    ("E9c", "잎 높게 세움(68°) + 갸름", dict(leaves=[(68, 272, 112, 6, 14)]), CUR),
    ("E9d", "받침 두껍게", dict(trunc=304, R=322), CUR),
    ("E9e", "받침 얇게", dict(trunc=236, R=300), CUR),
    ("E9f", "하이라이트 + 약한 비대칭", dict(rx=1.04, dx=8, hi=True, leaves=[(54, 262, 128, 14, 14)]), dict(CUR, ball=(255, 255, 255), hi=(255, 232, 140))),
    ("E9g", "E2 접목: 큰 잎 + 작은 잎", dict(leaves=[(50, 250, 124, 12, 12), (132, 152, 80, -8, 14)]), CUR),
    ("E9h", "E8 접목: 한 색 + 흰 하이라이트", dict(hi=True, leaves=[(52, 262, 132, 10, 12)]), dict(bg=BRAND, bowl=INK, ball=INK, leaf=INK, hi=WHITE)),
]


def refine():
    rows = REFINE
    rowh = 270
    W = 2250
    sheet = Image.new("RGB", (W, 130 + rowh * len(rows) + 20), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "E9 정제안 E9a~h — 형태만 바꿈(색은 현재 팔레트, h 는 한 색+하이라이트)", (40, 30), 38, (20, 20, 24), 800)
    heads = [("노랑 바탕", 330), ("검정 바탕", 590), ("옅은 바탕", 850), ("실제 크기 120·60·29px", 1130), ("29px 잎 면적", 1700)]
    for t, x in heads:
        L.label(sheet, t, (x, 96), 20, (110, 110, 118), 600)
    for r, (key, nm, p0, pal) in enumerate(rows):
        p = dict(BASE)
        p.update(p0)
        y = 130 + r * rowh
        d.line([(40, y), (W - 40, y)], fill=(225, 225, 225), width=2)
        L.label(sheet, key, (50, y + 80), 36, (20, 20, 24), 800)
        L.label(sheet, nm, (50, y + 135), 18, (110, 110, 118), 600)
        variants = [pal]
        if key == "E9h":
            variants = [pal, dict(bg=INK, bowl=BRAND, ball=BRAND, leaf=BRAND, hi=INK), dict(bg=LIGHT, bowl=INK, ball=INK, leaf=INK, hi=WHITE)]
        else:
            variants = [pal, dict(pal, bg=INK, bowl=BRAND), dict(pal, bg=LIGHT, ball=BRAND if pal["ball"] == WHITE else pal["ball"])]
        icons = []
        for (t, x), pv in zip(heads[:3], variants):
            im = render(p, pv, 210, 1.32)
            icons.append(im)
            t_ = L.with_corners(im, 210)
            if pv["bg"] == LIGHT:
                d.rounded_rectangle([x - 1, y + 29, x + 210, y + 240], radius=47, outline=(228, 228, 226), width=2)
            sheet.paste(t_.convert("RGB"), (x, y + 30), t_.split()[3])
        for bx, bgc, ic in ((1130, (246, 246, 244), icons[0]), (1130 + 270, (40, 40, 46), icons[1])):
            d.rectangle([bx, y + 40, bx + 260, y + 230], fill=bgc)
            xx = bx + 14
            for s in (120, 60, 29):
                big = render(p, variants[0] if bgc[0] > 200 else variants[1], 256, 1.32)
                t_ = L.with_corners(big, s)
                sheet.paste(t_.convert("RGB"), (xx, y + 40 + (190 - s) // 2), t_.split()[3])
                xx += s + 10
        L.label(sheet, f"{leaf_area_px(p):.1f} px²", (1700, y + 100), 30, (20, 20, 24), 800)
    sheet.save(os.path.join(HERE, "logo_E9_정제안비교.png"))
    for key, nm, p0, pal in rows:
        p = dict(BASE)
        p.update(p0)
        render(p, pal, 1024, 1.32).save(os.path.join(HERE, f"{key}_icon_1024.png"))
    print("refine done", flush=True)


# ---------------------------------------------------------------- 팔레트 14종
DKGREEN = (22, 84, 58)
PALETTES = [
    ("P1", "현재: 노랑 바탕 + 흰 재료 + 검정 받침 + 진초록 잎", dict(), BASE),
    ("P2", "노랑 바탕 + 빨강 재료 + 검정 받침 + 초록 잎", dict(ball=(238, 64, 58)), BASE),
    ("P3", "검정 바탕 + 노랑 재료 + 크림 받침 + 연초록 잎", dict(bg=INK, bowl=(240, 236, 224), ball=BRAND, leaf=(110, 200, 100)), BASE),
    ("P4", "크림 바탕 + 주황 재료 + 검정 받침 + 초록 잎", dict(bg=(255, 247, 228), ball=(255, 138, 26)), BASE),
    ("P5", "진초록 바탕 + 노랑 재료 + 크림 받침 + 연초록 잎", dict(bg=DKGREEN, bowl=(255, 244, 214), ball=BRAND, leaf=(150, 214, 110)), BASE),
    ("P6", "노랑 바탕 + 검정 한 색 실루엣 + 흰 하이라이트", dict(ball=INK, leaf=INK, hi=WHITE), dict(BASE, hi=True)),
    ("P7", "노랑 바탕 + 살구 재료 + 갈색 받침 + 올리브 잎", dict(ball=(255, 150, 122), bowl=(96, 58, 40), leaf=(110, 130, 40)), BASE),
    ("P8", "흰 바탕 + 노랑 재료 + 검정 윤곽 받침 + 초록 잎", dict(bg=WHITE, ball=BRAND), dict(BASE, hollow=True)),
    ("P9", "검정 바탕 + 빨강 재료 + 노랑 받침 + 초록 잎", dict(bg=INK, bowl=BRAND, ball=(238, 64, 58), leaf=(70, 190, 110)), BASE),
    ("P10", "노랑 바탕 + 검정 한 색(잎도 검정, 하이라이트 없음)", dict(ball=INK, leaf=INK), BASE),
    ("P11", "노랑 바탕 + 흰 재료 + 진초록 받침과 잎(검정 없음)", dict(bowl=DKGREEN, leaf=DKGREEN), BASE),
    ("P12", "검정 바탕 + 흰 재료 + 노랑 받침과 노랑 잎(초록 없음)", dict(bg=INK, bowl=BRAND, ball=WHITE, leaf=BRAND), BASE),
    ("P13", "노랑 바탕 + 빨강 재료 + 검정 받침과 검정 잎(초록 없음)", dict(ball=(238, 64, 58), leaf=INK), BASE),
    ("P14", "옅은 바탕 + 노랑 재료 + 검정 받침 + 진초록 잎", dict(bg=LIGHT, ball=BRAND), BASE),
    ("P15", "검정 바탕 + 노랑 재료(주인공) + 웜그레이 받침 + 초록 잎", dict(bg=INK, bowl=(196, 190, 176), ball=BRAND, leaf=(84, 200, 120)), BASE),
    ("P16", "노랑 바탕 + 검정 재료(주인공) + 흰 받침 + 초록 잎", dict(ball=INK, bowl=WHITE, leaf=G2), BASE),
    ("P17", "검정 바탕 + 노랑 재료 + 머스터드 받침(노랑 계열 한 가지) + 연초록 잎", dict(bg=INK, bowl=(176, 148, 0), ball=BRAND, leaf=(110, 200, 100)), BASE),
]

# 휴리스틱 표기(내 기억의 대표색 기준 — 실제 앱 아이콘과 대조 확인은 안 했다)
RISK = {
    "P1": ("△ 노랑+검정이라 카카오톡 노랑과 인상이 닮음", "낮음(흰 과일)"),
    "P2": ("△ 노랑+검정 + 빨강: 카카오·쿠팡·만개의레시피 빨강과 혼재", "높음(빨간 둥근 과일+잎)"),
    "P3": ("○ 검정 바탕 노랑 — 카카오와 구분됨", "낮음"),
    "P4": ("× 크림+주황은 당근과 겹침", "중간"),
    "P5": ("○ 진초록 바탕은 드묾(배달 앱 민트와는 다름)", "낮음"),
    "P6": ("△ 노랑+검정 = 카카오톡과 가장 닮음(말풍선과 모양만 다름)", "높음(검정 사과+잎+하이라이트)"),
    "P7": ("○ 갈색·살구는 드묾", "중간"),
    "P8": ("△ 흰 바탕+노랑 재료, 당근(흰 바탕+주황)과 구조가 비슷", "낮음"),
    "P9": ("○ 검정+빨강+노랑 3색은 드묾", "높음(빨간 둥근 과일+잎)"),
    "P10": ("△ 카카오와 닮음(모양만 다름)", "높음(검정 사과+잎)"),
    "P11": ("○ 노랑+진초록은 드묾", "낮음"),
    "P12": ("○ 검정 바탕 노랑", "낮음"),
    "P13": ("△ 빨강이 만개의레시피 등과 혼재", "높음(빨강 사과+검정 잎)"),
    "P14": ("△ 흰 바탕 노랑 재료", "낮음"),
    "P15": ("○ 검정 바탕+노랑 재료는 카카오(노랑 바탕)와 구분됨", "낮음"),
    "P16": ("△ 노랑+검정 = 카카오와 닮음", "높음(검정 사과+잎)"),
    "P17": ("○ 검정 바탕 노랑 계열", "낮음"),
}


def palette_rows():
    out = []
    for key, nm, kw, shape in PALETTES:
        pal = pal_of(**kw)
        p = dict(shape)
        ball_bg = cr(pal["ball"], pal["bg"])
        bowl_bg = cr(pal["bowl"], pal["bg"])
        leaf_bg = cr(pal["leaf"], pal["bg"])
        ball_bowl = cr(pal["ball"], pal["bowl"])
        brand = "○" if pal["bg"] in (BRAND, INK) else "△" if pal["bg"] in (LIGHT, WHITE, (255, 247, 228)) else "×"
        hero = "○" if ball_bg >= bowl_bg - 0.01 else "×"
        out.append(dict(key=key, nm=nm, pal=pal, p=p, ball_bg=ball_bg, bowl_bg=bowl_bg, leaf_bg=leaf_bg, ball_bowl=ball_bowl,
                        brand=brand, hero=hero, risk=RISK[key]))
    return out


def palette():
    rows = palette_rows()
    cols, tw, th = 5, 500, 720
    nrows = (len(rows) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * tw + (cols + 1) * 20, nrows * th + 160), (255, 255, 255))
    L.label(sheet, "E9 색 팔레트 17종 — 형태 고정, 색 조합만 교체 (대비비율은 WCAG, 3:1 이상 ○)", (20, 30), 38, (20, 20, 24), 800)
    L.label(sheet, "ball-bg = 재료(주인공)와 바탕 / bowl-bg = 받침과 바탕 / leaf-bg = 잎과 바탕. 주인공 위계: ball-bg ≥ bowl-bg 이면 ○", (20, 90), 22, (90, 90, 98), 600)
    csv = ["key,name,ball_bg,bowl_bg,leaf_bg,ball_bowl,hero,brand"]
    for i, r in enumerate(rows):
        c, rw = i % cols, i // cols
        x, y = 20 + c * (tw + 20), 140 + rw * th
        d = ImageDraw.Draw(sheet)
        d.rounded_rectangle([x, y, x + tw, y + th - 20], radius=24, fill=(247, 247, 245))
        big = render(r["p"], r["pal"], 360)
        t = L.with_corners(big, 360)
        sheet.paste(t.convert("RGB"), (x + 20, y + 20), t.split()[3])
        for j, s in enumerate((60, 29)):
            sm = L.with_corners(render(r["p"], r["pal"], 120), s)
            sheet.paste(sm.convert("RGB"), (x + 400 + 0, y + 40 + j * 100), sm.split()[3])
        L.label(sheet, r["key"], (x + 20, y + 395), 34, (20, 20, 24), 900)
        L.label(sheet, r["nm"], (x + 20, y + 440), 17, (60, 60, 66), 700)
        fl = lambda v: ("○" if v >= 3 else "△" if v >= 1.8 else "×")  # noqa: E731
        lines = [f"ball-bg {r['ball_bg']:.1f}:1 {fl(r['ball_bg'])}   bowl-bg {r['bowl_bg']:.1f}:1 {fl(r['bowl_bg'])}",
                 f"leaf-bg {r['leaf_bg']:.1f}:1 {fl(r['leaf_bg'])}   주인공 위계 {r['hero']}",
                 f"브랜드(노랑/검정) 일관성 {r['brand']}",
                 f"경쟁 겹침 {r['risk'][0]}",
                 f"애플 연상 위험: {r['risk'][1]}"]
        for k, ln in enumerate(lines):
            L.label(sheet, ln, (x + 20, y + 480 + k * 40), 17 if k < 3 else 15, (30, 30, 34), 600)
        csv.append(f"{r['key']},{r['nm']},{r['ball_bg']:.2f},{r['bowl_bg']:.2f},{r['leaf_bg']:.2f},{r['ball_bowl']:.2f},{r['hero']},{r['brand']}")
    sheet.save(os.path.join(HERE, "logo_E9_팔레트비교.png"))
    with open(os.path.join(HERE, "palette_metrics.csv"), "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(csv) + "\n")
    for r in rows:
        render(r["p"], r["pal"], 1024).save(os.path.join(HERE, f"{r['key']}_palette_1024.png"))
    print("palette done", flush=True)
    return rows


def home():
    rows = palette_rows()
    cols, rws = 5, 5
    icon_s, gx, gy = 150, 70, 110
    w = cols * icon_s + (cols + 1) * gx
    h = rws * (icon_s + gy) + 150
    out = []
    for dark in (False, True):
        scr = Image.new("RGBA", (w, h), (0, 0, 0, 255))
        d = ImageDraw.Draw(scr)
        for y in range(h):
            t = y / h
            c = (int(70 + 90 * t), int(110 + 30 * t), int(190 - 30 * t)) if not dark else (int(24 + 24 * t), int(26 + 26 * t), int(50 + 40 * t))
            d.line([(0, y), (w, y)], fill=c + (255,))
        d.ellipse([-200, h - 600, 900, h + 300], fill=(255, 150, 120, 60) if not dark else (80, 60, 120, 80))
        slots = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 23, 24, 3, 9]
        names = dict(zip(slots, rows))
        gi = 0
        for i in range(cols * rws):
            r_, c_ = divmod(i, cols)
            x, y = gx + c_ * (icon_s + gx), 70 + r_ * (icon_s + gy)
            if i in names:
                rw = names[i]
                scr.alpha_composite(L.with_corners(render(rw["p"], rw["pal"], 256), icon_s), (x, y))
                d.text((x + icon_s // 2, y + icon_s + 22), rw["key"], font=L.font(26, 800), fill=(255, 255, 255, 255), anchor="mt")
            else:
                nm, col, shp = L.APP_TILES[gi % len(L.APP_TILES)]
                gi += 1
                scr.alpha_composite(L.generic_tile(icon_s, col, shp), (x, y))
                d.text((x + icon_s // 2, y + icon_s + 22), nm, font=L.font(24, 600), fill=(255, 255, 255, 220), anchor="mt")
        out.append(scr.convert("RGB"))
    sheet = Image.new("RGB", (w * 2 + 60, h), (236, 236, 234))
    sheet.paste(out[0], (20, 0))
    sheet.paste(out[1], (w + 40, 0))
    sheet = sheet.resize((int(sheet.width * 0.62), int(sheet.height * 0.62)), Image.LANCZOS)
    sheet.save(os.path.join(HERE, "logo_E9_팔레트_홈화면.png"))
    print("home done", flush=True)


# ---------------------------------------------------------------- 풀세트(추천 팔레트)
FINAL_KEY = "P_FINAL"


def full(pal_main, pal_rev, pal_light, shape=BASE, tag="최종"):
    d = HERE
    os.makedirs(os.path.join(d, "fullset"), exist_ok=True)
    fd = os.path.join(d, "fullset")
    main = render(shape, pal_main, 1024)
    rev = render(shape, pal_rev, 1024)
    lig = render(shape, pal_light, 1024)
    main.save(os.path.join(fd, "app_icon_1024.png"))
    rev.save(os.path.join(fd, "app_icon_reverse_1024.png"))
    lig.save(os.path.join(fd, "app_icon_light_1024.png"))
    # 안드로이드 적응형 전경(투명, 안전영역 61% 안) + 배경
    s = sym(shape, pal_main, 1024, 1.0)
    bb = s.getbbox()
    cr_ = s.crop(bb)
    k = 0.58 * 1024 / max(cr_.size)
    cr_ = cr_.resize((int(cr_.width * k), int(cr_.height * k)), Image.LANCZOS)
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fg.alpha_composite(cr_, ((1024 - cr_.width) // 2, (1024 - cr_.height) // 2))
    fg.save(os.path.join(fd, "android_adaptive_foreground_1024.png"))
    Image.new("RGB", (1024, 1024), pal_main["bg"]).save(os.path.join(fd, "android_adaptive_background_1024.png"))
    # 알림 실루엣(흰 단색, 투명)
    mono = dict(bg=pal_main["bg"], bowl=WHITE, ball=WHITE, leaf=WHITE, hi=None)
    n = sym(shape, mono, 1024, 1.0)
    nb = n.getbbox()
    n = n.crop(nb)
    kk = 880 / max(n.size)
    n = n.resize((int(n.width * kk), int(n.height * kk)), Image.LANCZOS)
    nn = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    nn.alpha_composite(n, ((1024 - n.width) // 2, (1024 - n.height) // 2))
    nn.save(os.path.join(fd, "notification_silhouette_white_1024.png"))
    # 락업 3종
    wm_v = "ink" if pal_main["bg"] == INK else "yellow"
    sheet = Image.new("RGB", (1500, 1020), (255, 255, 255))
    L.label(sheet, f"락업 3종 — 가로형 · 세로형 · 아이콘 단독 ({tag})", (30, 20), 32, (20, 20, 24), 800)
    cases = [(INK, main, "ink"), (LIGHT, lig, "light"), (BRAND, main, "yellow")]
    for r_, (bgc, icn, wv) in enumerate(cases):
        y = 90 + r_ * 310
        sheet.paste(Image.new("RGB", (1440, 290), bgc), (30, y))
        wm = L.wordmark("E9", wv)
        ih = L.with_corners(icn, 150)
        sheet.paste(ih.convert("RGB"), (70, y + 70), ih.split()[3])
        sheet.paste(L.fit_h(wm, 90).convert("RGB"), (240, y + 100))
        cx = 780
        iv = L.with_corners(icn, 150)
        sheet.paste(iv.convert("RGB"), (cx - 75, y + 20), iv.split()[3])
        w3 = L.fit_h(wm, 70).convert("RGB")
        sheet.paste(w3, (cx - w3.width // 2, y + 185))
        i1 = L.with_corners(icn, 220)
        sheet.paste(i1.convert("RGB"), (1150, y + 35), i1.split()[3])
    sheet.save(os.path.join(fd, "lockups_3.png"))
    # 적응형 마스크 + 알림 실루엣 + 스토어 첫 장 상단 + 홈 화면
    ad = Image.new("RGB", (1500, 520), (240, 240, 238))
    L.label(ad, "안드로이드 적응형(전경 안전영역 58%) · 알림 실루엣", (24, 18), 26, (30, 30, 34), 800)
    bgimg = Image.new("RGBA", (1024, 1024), pal_main["bg"] + (255,))
    bgimg.alpha_composite(fg)
    vis = bgimg.crop((int(1024 * 18 / 108), int(1024 * 18 / 108), int(1024 * 90 / 108), int(1024 * 90 / 108)))
    x = 30
    for nm, mk in (("원형", "circle"), ("둥근 사각", "round"), ("스쿼클", "squircle")):
        s_ = 280
        v = vis.resize((s_, s_), Image.LANCZOS)
        mask = Image.new("L", (s_ * 4, s_ * 4), 0)
        dd = ImageDraw.Draw(mask)
        if mk == "circle":
            dd.ellipse([0, 0, s_ * 4 - 1, s_ * 4 - 1], fill=255)
        else:
            dd.rounded_rectangle([0, 0, s_ * 4 - 1, s_ * 4 - 1], radius=int(s_ * 4 * (0.3 if mk == "round" else 0.2237)), fill=255)
        v.putalpha(mask.resize((s_, s_), Image.LANCZOS))
        ad.paste(v.convert("RGB"), (x, 90), v.split()[3])
        L.label(ad, nm, (x, 390), 20, (110, 110, 118), 600)
        x += s_ + 30
    nbg = Image.new("RGBA", (280, 280), (48, 48, 54, 255))
    nbg.alpha_composite(nn.resize((200, 200), Image.LANCZOS), (40, 40))
    ad.paste(nbg.convert("RGB"), (x + 30, 90))
    L.label(ad, "알림(24dp 단색 흰 실루엣)", (x + 30, 390), 20, (110, 110, 118), 600)
    ad.save(os.path.join(fd, "adaptive_and_notification.png"))
    # 스토어 첫 장 상단
    tw, th = 640, 620
    both = Image.new("RGB", (2 * tw + 60, th + 40), (230, 230, 228))
    wm1 = L.wordmark("E9", "yellow")
    wm2 = L.wordmark("E9", "ink")
    t1 = L.slide_top(rev if pal_main["bg"] == BRAND else main, wm1, "y", f"{tag} · 노랑 장", tw, th)
    t2 = L.slide_top(main if pal_main["bg"] == BRAND else rev, wm2, "k", f"{tag} · 검정 장", tw, th)
    both.paste(t1.convert("RGB"), (20, 20))
    both.paste(t2.convert("RGB"), (tw + 40, 20))
    both.save(os.path.join(fd, "store_first_slide_top.png"))
    # 홈 화면
    items = [("기본", main), ("검정", rev), ("옅은 바탕", lig)]
    hs = [L.home_screen(ic, dark=False) for _, ic in items]
    pw, ph = hs[0].size
    sh2 = Image.new("RGB", (len(items) * pw + (len(items) + 1) * 50, ph + 200), (238, 238, 236))
    for i, ((nm, ic), h_) in enumerate(zip(items, hs)):
        xx = 50 + i * (pw + 50)
        sh2.paste(h_.convert("RGB"), (xx, 150), h_.split()[3])
        L.label(sh2, nm, (xx + pw // 2, 70), 52, (30, 30, 34), 800, "mm")
    sh2 = sh2.resize((int(sh2.width * 0.7), int(sh2.height * 0.7)), Image.LANCZOS)
    sh2.save(os.path.join(fd, "home_screen.png"))
    # E9 확장 예시(스토어 첫 장·릴스·위젯·빈 화면)
    print("fullset done", flush=True)


# 추천 팔레트(결과 보고 확정) — 아래 값은 run 후 README 와 함께 고정
def main():
    what = sys.argv[1:] or ["all"]
    if "all" in what or "refine" in what:
        refine()
    if "all" in what or "palette" in what:
        palette()
    if "all" in what or "home" in what:
        home()
    if "all" in what or "full" in what:
        shape = dict(BASE, leaves=[(50, 250, 124, 12, 12), (132, 152, 80, -8, 14)])
        pal_main = dict(bg=INK, bowl=(196, 190, 176), ball=BRAND, leaf=(84, 200, 120), hi=None)
        pal_rev = dict(bg=BRAND, bowl=INK, ball=WHITE, leaf=G2, hi=None)       # 검정 장 위에 올리는 노랑 타일(재료=흰)
        pal_light = dict(bg=LIGHT, bowl=INK, ball=BRAND, leaf=G2, hi=None)
        full(pal_main, pal_rev, pal_light, shape, tag="E9g + P15")


if __name__ == "__main__":
    main()
