# -*- coding: utf-8 -*-
"""쿡매치 로고 개선 시안(A 맞춤 · B 냄비+✦ · C 타이포 쿡 · D 그릇+맞는 재료) 생성기 — 제안 전용.

    PYTHONIOENCODING=utf-8 python store/logo_proposals/make_logo_proposals.py

운영 자산(frontend/assets, ios/android 아이콘, store/icons 등)은 건드리지 않고
store/logo_proposals/ 안에만 쓴다. 외부 이미지·폰트 없이 Pillow 로 직접 그린다
(한글 글꼴은 store/make_store_assets.py 와 같은 NotoSansKR-VF).

시안마다 바탕 3종: yellow(노랑 꽉 찬 바탕) / ink(검정) / light(옅은 흰 바탕 — 당근식).
"""
import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
FONT_VF = "C:/Windows/Fonts/NotoSansKR-VF.ttf"

INK = (26, 26, 30)
BRAND = (255, 214, 0)
WHITE = (255, 255, 255)
LIGHT = (247, 247, 245)
SUB_Y = (82, 66, 0)          # 노랑 위 보조 글자
SUB_K = (205, 205, 212)      # 검정 위 보조 글자
SUB_L = (120, 120, 128)      # 옅은 바탕 위 보조 글자
SS = 4                       # 아이콘 슈퍼샘플 배율

# 바탕별 색 배정: main = 큰 덩어리, second = 짝 조각, cut = 뚫린 자리 색
PALS = {
    "yellow": dict(bg=BRAND, main=INK, second=WHITE, cut=BRAND),
    "ink": dict(bg=INK, main=BRAND, second=WHITE, cut=INK),
    "light": dict(bg=LIGHT, main=INK, second=BRAND, cut=BRAND),
}


# ---------------------------------------------------------------- 공통 도구
def font(size, weight=700):
    f = ImageFont.truetype(FONT_VF, int(size))
    try:
        f.set_variation_by_axes([weight])
    except Exception:  # noqa: BLE001
        pass
    return f


def squircle(size, ratio=0.2237):
    """iOS 가 씌우는 모서리 흉내(미리보기 전용 — 실제 파일은 모서리 없이 꽉 찬 정사각)."""
    k = 4
    m = Image.new("L", (size * k, size * k), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * k - 1, size * k - 1], radius=int(size * k * ratio), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def with_corners(icon, size):
    ic = icon.resize((size, size), Image.LANCZOS).convert("RGBA")
    ic.putalpha(squircle(size))
    return ic


def circle_mask_img(size):
    k = 4
    m = Image.new("L", (size * k, size * k), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * k - 1, size * k - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def new_mask(size=1024):
    return Image.new("L", (size * SS, size * SS), 0)


def P(v):
    return int(v * SS)


def rrect(m, box, r):
    ImageDraw.Draw(m).rounded_rectangle([P(box[0]), P(box[1]), P(box[2]), P(box[3])], radius=P(r), fill=255)


def circle(m, cx, cy, r):
    ImageDraw.Draw(m).ellipse([P(cx - r), P(cy - r), P(cx + r), P(cy + r)], fill=255)


def star_pts(cx, cy, R, p=0.70, n=240):
    """네 꼭짓점 별 ✦ (앱의 AI 표시와 같은 오목한 별)."""
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        c, s = math.cos(t), math.sin(t)
        e = 2 / p
        pts.append((cx + R * math.copysign(abs(c) ** e, c), cy + R * math.copysign(abs(s) ** e, s)))
    return pts


def star(m, cx, cy, R, p=0.70):
    ImageDraw.Draw(m).polygon([(P(x), P(y)) for x, y in star_pts(cx, cy, R, p)], fill=255)


def compose(bg, layers, size=1024):
    img = Image.new("RGB", (size * SS, size * SS), bg)
    for mask, color in layers:
        img.paste(Image.new("RGB", img.size, color), (0, 0), mask)
    return img.resize((size, size), Image.LANCZOS)


def round_mask(mask, radius):
    """볼록 모서리를 살짝 둥글게(블러→문턱값) — 굵은 모양·글자를 '다듬는' 용도."""
    return mask.filter(ImageFilter.GaussianBlur(radius)).point(lambda v: 255 if v > 118 else 0).filter(ImageFilter.GaussianBlur(0.8))


def text_mask(text, size, weight, tracking=0.0, rnd=0.0, ss=3):
    """(마스크, 베이스라인 y, 글자 폭, 왼쪽 여백) — 마스크 왼쪽 여백(pad)은 글자가 시작하기 전 빈 칸."""
    f = font(size * ss, weight)
    adv = [f.getlength(ch) + tracking * size * ss for ch in text]
    pad = int(size * ss * 0.5)
    w = int(sum(adv)) + 2 * pad
    h = int(size * ss * 2)
    base = int(size * ss * 1.4)
    m = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(m)
    x = pad
    for ch, a in zip(text, adv):
        d.text((x, base), ch, font=f, fill=255, anchor="ls")
        x += a
    if rnd:
        m = round_mask(m, rnd * size * ss)
    return m, base, int(sum(adv)), pad


# ---------------------------------------------------------------- 시안 A: 맞춤 조각
def layers_A(pal):
    """원 한 개(접시를 위에서 본 모양)를 퍼즐 이음으로 맞물린 두 조각으로 — 재료 조각 + 레시피 조각이 딱 맞는다."""
    cx = cy = 512
    R, gap = 318, 20
    left = new_mask()
    circle(left, cx, cy, R)
    cut = new_mask()
    ImageDraw.Draw(cut).rectangle([P(cx), 0, P(1024), P(1024)], fill=255)
    left = ImageChops.subtract(left, cut)
    knob = new_mask()
    rrect(knob, (cx - 4, cy - 40, cx + 64, cy + 40), 6)
    circle(knob, cx + 98, cy, 74)
    left = ImageChops.lighter(left, knob)
    right = new_mask()
    circle(right, cx, cy, R)
    keep = new_mask()
    ImageDraw.Draw(keep).rectangle([P(cx + gap), 0, P(1024), P(1024)], fill=255)
    right = ImageChops.multiply(right, keep)
    hole = new_mask()
    rrect(hole, (cx - 4, cy - 40 - gap, cx + 64, cy + 40 + gap), 6)
    circle(hole, cx + 98, cy, 74 + gap)
    right = ImageChops.subtract(right, hole)
    return [(left, pal["main"]), (right, pal["second"])]


# ---------------------------------------------------------------- 시안 B: 냄비 + ✦
def layers_B(pal):
    """굵은 냄비 실루엣, 몸통에 ✦ 를 뚫어 AI 반짝임을 절제해서. 뚜껑은 살짝 들려 있다."""
    oy = 6
    body = new_mask()
    rrect(body, (262, 470 + oy, 762, 790 + oy), 140)
    rrect(body, (262, 470 + oy, 762, 590 + oy), 26)
    rrect(body, (186, 540 + oy, 270, 596 + oy), 28)
    rrect(body, (754, 540 + oy, 838, 596 + oy), 28)
    lid = new_mask()
    rrect(lid, (282, 392 + oy, 742, 448 + oy), 28)
    rrect(lid, (462, 336 + oy, 562, 396 + oy), 26)
    lid = lid.rotate(5.5, resample=Image.BICUBIC, center=(P(282), P(420 + oy)))
    st = new_mask()
    star(st, 512, 636 + oy, 112, 0.70)
    return [(body, pal["main"]), (lid, pal["main"]), (st, pal["cut"])]


# ---------------------------------------------------------------- 시안 C: 타이포 심볼 「쿡」
def glyph_mask(ch, target_w, weight=900, rnd=0.012, canvas=1024):
    size = canvas * SS
    f = font(size * 0.9, weight)
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).text((size // 2, size // 2), ch, font=f, fill=255, anchor="mm")
    bb = m.getbbox()
    g = m.crop(bb)
    k = target_w * SS / g.width
    g = g.resize((int(g.width * k), int(g.height * k)), Image.LANCZOS)
    g = round_mask(g.convert("L"), rnd * g.width)
    out = Image.new("L", (size, size), 0)
    out.paste(g, ((size - g.width) // 2, (size - g.height) // 2))
    return out


def layers_C(pal):
    """「쿡」 한 글자를 가장 굵은 획으로 쓰고 모서리를 둥글게 다듬어 아이콘으로. 오른쪽 위에 ✦ 한 점."""
    g = glyph_mask("쿡", 590)
    g = ImageChops.offset(g, -P(14), P(26))
    st = new_mask()
    star(st, 790, 262, 70, 0.70)
    return [(g, pal["main"]), (st, pal["second"])]


# ---------------------------------------------------------------- 시안 D: 그릇 + 맞는 재료
def layers_D(pal, oy=0):
    """그릇(웃는 입 모양 반원) 윗면을 둥글게 파내고 둥근 재료 한 알이 빈틈없이 앉는다.
    하나의 덩어리(그릇)와 하나의 조각(재료) — 사이의 얇은 간격이 「딱 맞는다」."""
    r, gap, R = 182, 20, 332
    rim = 436 + oy                    # 그릇 윗선
    ccx, ccy = 512, rim + 6 + 0       # 재료 중심(윗선보다 살짝 아래 — 푹 앉는다)
    bowl = new_mask()
    circle(bowl, 512, rim, R)
    top = new_mask()
    ImageDraw.Draw(top).rectangle([0, 0, P(1024), P(rim)], fill=255)
    bowl = ImageChops.subtract(bowl, top)
    rrect(bowl, (396, rim + R - 40, 628, rim + R + 22), 22)  # 굽(작은 받침)
    sock = new_mask()
    circle(sock, ccx, ccy, r + gap)
    bowl = ImageChops.subtract(bowl, sock)
    bowl = round_mask(bowl, 5 * SS)
    ball = new_mask()
    circle(ball, ccx, ccy, r)
    return [(bowl, pal["main"]), (ball, pal["second"])]


LAYERS = {"A": layers_A, "B": layers_B, "C": layers_C, "D": layers_D}
NAMES = {"A": "맞춤 조각", "B": "냄비+반짝임", "C": "타이포 쿡", "D": "그릇 + 맞는 재료"}
_cache = {}


def icon(key, variant="yellow"):
    k = (key, variant)
    if k not in _cache:
        pal = PALS[variant]
        _cache[k] = compose(pal["bg"], LAYERS[key](pal))
    return _cache[k]


def symbol_rgba(key, variant="yellow", width=None):
    """배경 없는 심볼만(투명) — 확장 그래픽용."""
    pal = PALS[variant]
    ls = LAYERS[key](pal)
    size = 1024 * SS
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    for mask, color in ls:
        img.paste(Image.new("RGBA", img.size, color + (255,)), (0, 0), mask)
    bb = img.getbbox()
    img = img.crop(bb)
    if width:
        img = img.resize((width, int(img.height * width / img.width)), Image.LANCZOS)
    return img


# ---------------------------------------------------------------- 워드마크(가로형)
def wordmark(key, variant="yellow", ss=3):
    """쿡매치(둥글게 다듬은 굵은 한글 하나) + CookMatch(보조) 가로형. 변형 = yellow / ink / light 바탕."""
    pal = PALS[variant]
    bg = pal["bg"]
    ko_c = {"yellow": INK, "ink": BRAND, "light": INK}[variant]
    en_c = {"yellow": SUB_Y, "ink": SUB_K, "light": SUB_L}[variant]
    KO = 300
    ko, kb, kw, kp = text_mask("쿡매치", KO, 900, tracking=-0.02, rnd=0.012, ss=ss)
    en, eb, ew, ep = text_mask("CookMatch", 108, 600, tracking=0.035, ss=ss)
    W, H = 12000 * ss // 3, 1000 * ss
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base_y = int(560 * ss)
    x = int(80 * ss)

    def put(mask, color, gx, baseline, mb, pad):
        layer.paste(Image.new("RGBA", mask.size, color + (255,)), (int(gx - pad), int(baseline - mb)), mask)

    gap_en = 64 * ss
    if key == "C":  # 쿡 = 타일 안 글자 → 매치 → CookMatch
        tile = 262 * ss
        tm = Image.new("L", (tile, tile), 0)
        ImageDraw.Draw(tm).rounded_rectangle([0, 0, tile - 1, tile - 1], radius=int(tile * 0.26), fill=255)
        tcol, gcol = (BRAND, INK) if variant == "ink" else (INK, BRAND)
        ty = base_y - int(tile * 0.88)
        layer.paste(Image.new("RGBA", tm.size, tcol + (255,)), (x, ty), tm)
        g, gb, gw, gp = text_mask("쿡", 214, 900, rnd=0.012, ss=ss)
        gbb = g.getbbox()
        layer.paste(Image.new("RGBA", g.size, gcol + (255,)),
                    (x + (tile - (gbb[2] - gbb[0])) // 2 - gbb[0], ty + (tile - (gbb[3] - gbb[1])) // 2 - gbb[1]), g)
        x += tile + 24 * ss
        mt, mb_, mw, mp = text_mask("매치", KO, 900, tracking=-0.02, rnd=0.012, ss=ss)
        put(mt, ko_c, x, base_y, mb_, mp)
        x += mw
    else:
        put(ko, ko_c, x, base_y, kb, kp)
        if key == "B":  # 오른쪽 위 ✦ 한 점
            st = Image.new("L", layer.size, 0)
            ImageDraw.Draw(st).polygon(star_pts(x + kw + 30 * ss, base_y - 270 * ss, 54 * ss, 0.70), fill=255)
            layer.paste(Image.new("RGBA", st.size, ko_c + (255,)), (0, 0), st)
            x += 40 * ss
        x += kw
        if key == "A":  # 이음 돌기를 닮은 작은 점
            d = ImageDraw.Draw(layer)
            r = 17 * ss
            cx, cy = x + 52 * ss, base_y - 46 * ss
            d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=ko_c + (255,))
            x += 70 * ss
        if key == "D":  # ㅣ 위 동그라미(재료 한 알) — 심볼의 둥근 조각을 글자에 한 번만
            pass
    put(en, en_c, x + gap_en, base_y, eb, ep)
    bb = layer.getbbox()
    pad = 90 * ss
    crop = layer.crop(bb)
    out = Image.new("RGB", (crop.width + 2 * pad, crop.height + 2 * pad), bg)
    out.paste(crop, (pad, pad), crop)
    return out.resize((out.width // ss, out.height // ss), Image.LANCZOS)


# ---------------------------------------------------------------- 현재 로고
def current_icon():
    return Image.open(os.path.join(ROOT, "store", "icons", "appstore_icon_1024.png")).convert("RGB")


def current_wordmark(variant="yellow"):
    """앱 헤더에 실제 쓰는 워드마크(어두운 글자, 투명 배경)를 바탕 위에 올린 것."""
    wm = Image.open(os.path.join(ROOT, "frontend", "src", "assets", "냉털이 로고 white.png")).convert("RGBA")
    bg = PALS[variant]["bg"]
    if variant == "ink":
        a = wm.split()[3]
        wm = Image.merge("RGBA", (*[Image.new("L", wm.size, 235)] * 3, a))
    pad = 120
    out = Image.new("RGB", (wm.width + 2 * pad, wm.height + 2 * pad), bg)
    out.paste(wm, (pad, pad), wm)
    return out


# ---------------------------------------------------------------- 미리보기 도구
def fit_h(im, h):
    return im.resize((int(im.width * h / im.height), h), Image.LANCZOS)


def label(canvas, text, xy, size=30, fill=(40, 40, 44), weight=700, anchor="la"):
    ImageDraw.Draw(canvas).text(xy, text, font=font(size, weight), fill=fill, anchor=anchor)


def small_sheet(key):
    """X_small.png — 180·120·60·29·16px(밝은/어두운 바탕, 세 가지 바탕 버전) + 앱 헤더·스토어 첫 장 상단 크기."""
    W = 1500
    sheet = Image.new("RGBA", (W, 1010), (255, 255, 255, 255))
    d = ImageDraw.Draw(sheet)
    label(sheet, f"{key} — {NAMES[key]}  /  작은 크기 점검(실제 픽셀 그대로)", (40, 28), 34)
    sizes = [180, 120, 60, 29, 16]
    for row, (bgc, variant) in enumerate([((246, 246, 244), "yellow"), ((246, 246, 244), "light"), ((40, 40, 46), "ink")]):
        y0 = 90 + row * 200
        d.rectangle([30, y0, W - 30, y0 + 185], fill=bgc)
        x = 70
        for s in sizes:
            sheet.alpha_composite(with_corners(icon(key, variant), s), (x, y0 + (185 - s) // 2))
            x += s + 60
        c = icon(key, variant).resize((110, 110), Image.LANCZOS).convert("RGBA")
        c.putalpha(circle_mask_img(110))
        sheet.alpha_composite(c, (x + 30, y0 + 38))
        label(sheet, f"{variant} 바탕", (x + 200, y0 + 80), 22, (130, 130, 130) if row < 2 else (190, 190, 195), 600)
    y0 = 720
    wm = wordmark(key, "light")
    hdr = Image.new("RGBA", (420, 52), (255, 255, 255, 255))
    ImageDraw.Draw(hdr).line([0, 51, 420, 51], fill=(225, 225, 225), width=1)
    hdr.alpha_composite(with_corners(icon(key, "yellow"), 28), (14, 12))
    hdr.alpha_composite(fit_h(wm, 22).convert("RGBA"), (52, 15))
    sheet.alpha_composite(hdr, (40, y0 + 10))
    label(sheet, "앱 헤더 크기(1x, 로고 높이≈22px)", (40, y0 + 72), 18, (130, 130, 130), 500)
    strip = Image.new("RGBA", (880, 200), BRAND + (255,))
    strip.alpha_composite(with_corners(icon(key, "ink"), 120), (30, 40))
    strip.alpha_composite(fit_h(wordmark(key, "yellow"), 84).convert("RGBA"), (170, 58))
    sheet.alpha_composite(strip, (520, y0 - 20))
    label(sheet, "스토어 첫 장 상단(노랑)", (520, y0 + 190), 18, (130, 130, 130), 500)
    return sheet.convert("RGB")


# ---- 홈 화면 격자
APP_TILES = [
    ("메모", (255, 236, 160), "lines"), ("날씨", (110, 180, 255), "sun"), ("사진", (255, 255, 255), "flower"),
    ("지도", (150, 210, 150), "pin"), ("음악", (250, 90, 110), "note"), ("카메라", (60, 60, 66), "lens"),
    ("시계", (30, 30, 34), "clock"), ("메일", (80, 150, 255), "mail"), ("책", (255, 165, 70), "book"),
    ("건강", (255, 255, 255), "heart"), ("계산기", (255, 150, 40), "calc"), ("설정", (150, 155, 165), "gear"),
    ("은행", (60, 110, 230), "coin"), ("택시", (255, 205, 30), "car"), ("운동", (90, 205, 120), "run"),
    ("영화", (130, 80, 220), "play"), ("쇼핑", (255, 110, 120), "bag"), ("번역", (70, 190, 200), "chat"),
]


def generic_tile(size, bgc, shape):
    """실제 앱을 흉내 내지 않는 일반 타일."""
    s = size * 2
    t = Image.new("RGBA", (s, s), bgc + (255,))
    d = ImageDraw.Draw(t)
    fg = (255, 255, 255) if sum(bgc) < 600 else (70, 70, 80)
    cx = cy = s // 2
    if shape in ("sun", "lens", "clock", "coin"):
        d.ellipse([cx - s * .22, cy - s * .22, cx + s * .22, cy + s * .22], fill=fg)
    elif shape in ("lines", "book", "calc"):
        for i in range(3):
            d.rounded_rectangle([s * .24, s * (.3 + i * .14), s * .76, s * (.3 + i * .14) + s * .07], radius=s * .03, fill=fg)
    elif shape in ("heart", "flower", "pin", "note"):
        for dx, dy in [(-.1, -.06), (.1, -.06), (0, .08)]:
            d.ellipse([cx + s * dx - s * .13, cy + s * dy - s * .13, cx + s * dx + s * .13, cy + s * dy + s * .13], fill=fg)
    else:
        d.rounded_rectangle([s * .27, s * .27, s * .73, s * .73], radius=s * .1, fill=fg)
    t = t.resize((size, size), Image.LANCZOS)
    t.putalpha(squircle(size))
    return t


def home_screen(ic, w=780, h=1560, dark=False):
    scr = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    d = ImageDraw.Draw(scr)
    for y in range(h):
        t = y / h
        c = (int(70 + 90 * t), int(110 + 30 * t), int(190 - 30 * t)) if not dark else (int(30 + 20 * t), int(30 + 25 * t), int(60 + 40 * t))
        d.line([(0, y), (w, y)], fill=c + (255,))
    d.ellipse([-200, 900, 700, 1800], fill=(255, 150, 120, 60))
    icon_s, gapx = 132, 52
    x0 = (w - (4 * icon_s + 3 * gapx)) // 2
    y0 = 190
    slot = 6
    for i in range(20):
        r, c = divmod(i, 4)
        x, y = x0 + c * (icon_s + gapx), y0 + r * (icon_s + 96)
        if i == slot:
            scr.alpha_composite(with_corners(ic, icon_s), (x, y))
            lab = "쿡매치"
        else:
            nm, col, shp = APP_TILES[(i if i < slot else i - 1) % len(APP_TILES)]
            scr.alpha_composite(generic_tile(icon_s, col, shp), (x, y))
            lab = nm
        d.text((x + icon_s // 2, y + icon_s + 22), lab, font=font(24, 600), fill=(255, 255, 255, 235), anchor="mt")
    d.rounded_rectangle([34, h - 220, w - 34, h - 60], radius=56, fill=(255, 255, 255, 60))
    for c in range(4):
        nm, col, shp = APP_TILES[(c * 5 + 2) % len(APP_TILES)]
        scr.alpha_composite(generic_tile(icon_s, col, shp), (x0 + c * (icon_s + gapx), h - 206))
    frame = Image.new("RGBA", (w + 36, h + 36), (20, 20, 22, 255))
    fm = Image.new("L", frame.size, 0)
    ImageDraw.Draw(fm).rounded_rectangle([0, 0, frame.width - 1, frame.height - 1], radius=96, fill=255)
    sm = Image.new("L", scr.size, 0)
    ImageDraw.Draw(sm).rounded_rectangle([0, 0, w - 1, h - 1], radius=80, fill=255)
    frame.paste(scr, (18, 18), sm)
    frame.putalpha(fm)
    return frame


def sheet_home(variants, dark=False, scale=1.0):
    n = len(variants)
    ph = home_screen(variants[0][1], dark=dark)
    pw, phh = ph.size
    W = n * pw + (n + 1) * 50
    sheet = Image.new("RGB", (W, phh + 200), (238, 238, 236))
    for i, (lab, ic) in enumerate(variants):
        x = 50 + i * (pw + 50)
        s = home_screen(ic, dark=dark)
        sheet.paste(s.convert("RGB"), (x, 150), s.split()[3])
        label(sheet, lab, (x + pw // 2, 70), 52, (30, 30, 34), 800, "mm")
    if scale != 1.0:
        sheet = sheet.resize((int(sheet.width * scale), int(sheet.height * scale)), Image.LANCZOS)
    return sheet


# ---- 스토어 첫 장 상단 사용 예
def slide_top(ic, wm_img, band, lab, w=640, h=620):
    bgc = BRAND if band == "y" else INK
    head = INK if band == "y" else WHITE
    sub = SUB_Y if band == "y" else SUB_K
    s = Image.new("RGBA", (w, h), bgc + (255,))
    s.alpha_composite(with_corners(ic, 130), (46, 44))
    s.alpha_composite(fit_h(wm_img, 76).convert("RGBA"), (200, 70))
    d = ImageDraw.Draw(s)
    d.text((46, 250), "인기 레시피만", font=font(62, 900), fill=head)
    d.text((46, 330), "4만 개,", font=font(112, 900), fill=BRAND if band == "k" else INK)
    d.text((46, 470), "뭘 골라도 맛집", font=font(54, 900), fill=head)
    d.text((46, 548), "네이버·유튜브 레시피를 냉장고 재료로 바로", font=font(24, 600), fill=sub)
    d.text((18, 14), lab, font=font(18, 700), fill=sub)
    return s


# ---- 로고 모양의 확장(스토어 첫 장·릴스 끝장·위젯·빈 화면)
def extension_sheet(key):
    """로고의 둥근 조각 문법을 그래픽 자산으로 — 당근이 하트 도형을 쓰듯, 로고 모양 자체가 일러스트가 된다."""
    TOM, LEAF, ORG = (240, 72, 62), (62, 178, 108), (255, 138, 26)
    pw, ph = 464, 1007
    W = pw + 454 + 380 + 380 + 5 * 24
    sheet = Image.new("RGB", (W, ph + 90), (232, 232, 230))
    label(sheet, f"{key} {NAMES[key]} — 로고 모양을 그래픽으로 확장하면", (24, 26), 30, (30, 30, 34), 800)
    # 1) 스토어 첫 장
    s = Image.new("RGBA", (pw, ph), BRAND + (255,))
    d = ImageDraw.Draw(s)
    s.alpha_composite(with_corners(icon(key, "ink"), 62), (32, 36))
    s.alpha_composite(fit_h(wordmark(key, "yellow"), 36).convert("RGBA"), (106, 49))
    d.text((32, 140), "냉장고 속 재료,", font=font(46, 900), fill=INK)
    d.text((32, 200), "딱 맞는 요리로", font=font(46, 900), fill=INK)
    d.text((32, 276), "인기 레시피 4만 개에서 바로 찾아요", font=font(17, 600), fill=SUB_Y)
    # 떠다니는 둥근 재료 조각 + 큰 심볼이 아래로 잘려 들어옴
    for (cx, cy, r, col) in [(80, 450, 26, WHITE), (390, 400, 36, INK), (330, 520, 20, TOM), (150, 540, 30, LEAF), (420, 590, 22, WHITE)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
    sym = symbol_rgba(key, "yellow", 560)
    s.alpha_composite(sym, ((pw - sym.width) // 2 + 20, 620))
    sheet.paste(s.convert("RGB"), (24, 90))
    # 2) 릴스 끝장(검정)
    rw, rh = 454, 807
    r_ = Image.new("RGBA", (rw, rh), INK + (255,))
    d = ImageDraw.Draw(r_)
    sym = symbol_rgba(key, "ink", 230)
    r_.alpha_composite(sym, ((rw - sym.width) // 2, 250))
    wm = fit_h(wordmark(key, "ink"), 70).convert("RGBA")
    r_.alpha_composite(wm, ((rw - wm.width) // 2, 250 + sym.height + 36))
    d.text((rw // 2, 250 + sym.height + 150), "냉장고 재료로 바로 찾아요", font=font(22, 600), fill=SUB_K, anchor="mt")
    label(r_, "릴스 끝장", (16, 14), 16, SUB_K, 600)
    sheet.paste(r_.convert("RGB"), (24 + pw + 24, 90))
    # 3) 위젯(작은/큰) — 노랑
    x3 = 24 + pw + 24 + rw + 24
    wd = Image.new("RGBA", (380, 807), (210, 214, 224, 255))
    dd = ImageDraw.Draw(wd)
    tile = Image.new("RGBA", (340, 340), BRAND + (255,))
    td = ImageDraw.Draw(tile)
    td.text((26, 24), "오늘 뭐 먹지?", font=font(28, 900), fill=INK)
    td.text((26, 62), "내 재료 4/5 맞는 요리", font=font(17, 600), fill=SUB_Y)
    sym = symbol_rgba(key, "yellow", 190)
    tile.alpha_composite(sym, (130, 120))
    tm = Image.new("L", tile.size, 0)
    ImageDraw.Draw(tm).rounded_rectangle([0, 0, 339, 339], radius=64, fill=255)
    tile.putalpha(tm)
    wd.alpha_composite(tile, (20, 24))
    tile2 = Image.new("RGBA", (340, 340), INK + (255,))
    t2 = ImageDraw.Draw(tile2)
    t2.text((26, 24), "곧 상할 재료", font=font(28, 900), fill=BRAND)
    t2.text((26, 62), "두부 · 대파 · 애호박", font=font(17, 600), fill=SUB_K)
    sym = symbol_rgba(key, "ink", 190)
    tile2.alpha_composite(sym, (130, 120))
    tile2.putalpha(tm)
    wd.alpha_composite(tile2, (20, 384))
    label(wd, "위젯", (16, 4), 16, (90, 90, 100), 600)
    sheet.paste(wd.convert("RGB"), (x3, 90))
    # 4) 빈 화면 / 로딩
    x4 = x3 + 380 + 24
    ev = Image.new("RGBA", (380, 807), LIGHT + (255,))
    ed = ImageDraw.Draw(ev)
    sym = symbol_rgba(key, "light", 200)
    ev.alpha_composite(sym, ((380 - sym.width) // 2, 230))
    ed.text((190, 230 + sym.height + 44), "재료를 담으면", font=font(30, 900), fill=INK, anchor="mt")
    ed.text((190, 230 + sym.height + 86), "딱 맞는 레시피가 나와요", font=font(30, 900), fill=INK, anchor="mt")
    ed.rounded_rectangle([90, 230 + sym.height + 150, 290, 230 + sym.height + 204], radius=27, fill=BRAND)
    ed.text((190, 230 + sym.height + 177), "재료 담으러 가기", font=font(20, 800), fill=INK, anchor="mm")
    label(ev, "빈 화면", (16, 14), 16, SUB_L, 600)
    sheet.paste(ev.convert("RGB"), (x4, 90))
    return sheet


# ---------------------------------------------------------------- 메인
def build():
    out = HERE
    keys = "ABCD"
    wm = {}
    for k in keys:
        icon(k, "yellow").save(os.path.join(out, f"{k}_icon_1024.png"))
        icon(k, "ink").save(os.path.join(out, f"{k}_icon_reverse_1024.png"))
        icon(k, "light").save(os.path.join(out, f"{k}_icon_light_1024.png"))
        for v, suffix in (("yellow", ""), ("ink", "_reverse"), ("light", "_light")):
            wm[(k, v)] = wordmark(k, v)
            wm[(k, v)].save(os.path.join(out, f"{k}_wordmark{suffix}.png"))
        small_sheet(k).save(os.path.join(out, f"{k}_small.png"))
        print("done", k, flush=True)
    cur = current_icon()
    cwm = {v: current_wordmark(v) for v in PALS}

    # --- 비교표
    rows = [("현재", cur, cur, cur, cwm)] + [(f"{k} {NAMES[k]}", icon(k, "yellow"), icon(k, "ink"), icon(k, "light"),
                                              {v: wm[(k, v)] for v in PALS}) for k in keys]
    W, rowh = 2900, 440
    sheet = Image.new("RGB", (W, 150 + rowh * len(rows) + 30), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    label(sheet, "쿡매치 로고 — 현재 vs 시안 A·B·C·D (제안만, 적용 안 함)", (50, 36), 44, (20, 20, 24), 800)
    xs = [260, 580, 900, 1220, 1740, 2300]
    heads = ["노랑 바탕", "검정 바탕", "옅은(흰) 바탕", "실제 크기 120·60·29px", "워드마크(노랑)", "워드마크(옅은 바탕)"]
    for hx, ht in zip(xs, heads):
        label(sheet, ht, (hx, 108), 20, (110, 110, 118), 600)
    for r, (lab, ic_y, ic_k, ic_l, w) in enumerate(rows):
        y = 150 + r * rowh
        d.line([(40, y), (W - 40, y)], fill=(225, 225, 225), width=2)
        label(sheet, lab, (50, y + 170), 28, (20, 20, 24), 800)
        for hx, ic in zip(xs[:3], (ic_y, ic_k, ic_l)):
            if r == 0 and ic is not ic_y:
                label(sheet, "(현재는 노랑 한 벌뿐)", (hx, y + 180), 20, (150, 150, 156), 500)
                continue
            im = with_corners(ic, 280)
            if ic is ic_l:
                ImageDraw.Draw(sheet).rounded_rectangle([hx - 1, y + 59, hx + 280, y + 340], radius=63, outline=(228, 228, 226), width=2)
            sheet.paste(im.convert("RGB"), (hx, y + 60), im.split()[3])
        for rr, (bgc, srcs) in enumerate([((246, 246, 244), (ic_y, ic_l) if r else (ic_y,)), ((40, 40, 46), (ic_k,))]):
            d.rectangle([xs[3], y + 60 + rr * 150, xs[3] + 500, y + 60 + rr * 150 + 130], fill=bgc)
            x = xs[3] + 20
            for src in (srcs if rr == 0 else (ic_k,)):
                for s in (120, 60, 29):
                    if rr == 0 and src is ic_l and False:
                        continue
                    im = with_corners(src, s)
                    sheet.paste(im.convert("RGB"), (x, y + 60 + rr * 150 + (130 - s) // 2), im.split()[3])
                    x += s + 8
                x += 12
        sheet.paste(fit_h(w["yellow"], 130).convert("RGB"), (xs[4], y + 100))
        sheet.paste(fit_h(w["light"], 130).convert("RGB"), (xs[5], y + 100))
    sheet.save(os.path.join(out, "logo_비교.png"))

    # --- 홈 화면 (노랑 / 옅은 바탕 / 검정)
    sheet_home([("현재", cur)] + [(f"{k} {NAMES[k]}", icon(k, "yellow")) for k in keys], scale=0.62).save(os.path.join(out, "logo_홈화면.png"))
    sheet_home([("현재", cur)] + [(f"{k} (옅은 바탕)", icon(k, "light")) for k in keys], scale=0.62).save(os.path.join(out, "logo_홈화면_옅은바탕.png"))
    sheet_home([("현재 노랑", cur), ("D 노랑", icon("D", "yellow")), ("D 옅은 바탕", icon("D", "light")), ("D 검정", icon("D", "ink"))],
               scale=0.8).save(os.path.join(out, "logo_홈화면_바탕비교.png"))
    sheet_home([("현재 노랑", cur), ("D 노랑", icon("D", "yellow")), ("D 옅은 바탕", icon("D", "light")), ("D 검정", icon("D", "ink"))],
               dark=True, scale=0.8).save(os.path.join(out, "logo_홈화면_바탕비교_어두운배경.png"))

    # --- 스토어 첫 장 상단 사용 예
    tw, th = 640, 620
    # 노랑 장에는 검정 바탕 아이콘, 검정 장에는 노랑 바탕 아이콘(노랑 아이콘을 노랑 장에 올리면 타일이 사라진다)
    cols = [("현재", cur, cur, cwm["yellow"], cwm["ink"])] + \
           [(f"{k} {NAMES[k]}", icon(k, "ink"), icon(k, "yellow"), wm[(k, "yellow")], wm[(k, "ink")]) for k in keys]
    sheet = Image.new("RGB", (len(cols) * tw + (len(cols) + 1) * 20, 2 * th + 3 * 20), (230, 230, 228))
    for i, (lab, icy, ick, wy, wk) in enumerate(cols):
        t = slide_top(icy, wy, "y", lab + " · 노랑 장", tw, th)
        sheet.paste(t.convert("RGB"), (20 + i * (tw + 20), 20))
        t = slide_top(ick, wk, "k", lab + " · 검정 장", tw, th)
        sheet.paste(t.convert("RGB"), (20 + i * (tw + 20), 20 + th + 20))
    sheet.save(os.path.join(out, "logo_장_사용예.png"))

    # --- 확장 예시(D 추천 기준 + 비교용 A)
    for k in "DA":
        extension_sheet(k).save(os.path.join(out, f"logo_확장예시_{k}.png"))
    print("ok")


if __name__ == "__main__":
    build()
