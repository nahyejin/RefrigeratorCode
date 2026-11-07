# -*- coding: utf-8 -*-
"""스토어 스크린샷 v3 — 「우리 스타일(노랑/검정 꽉 찬 배경) + v2 내용」 8장. v1·v2 코드·결과물은 그대로 둔다.

    python store/make_store_assets_v3.py            # store/screenshots_v3/{play,ios,ios_1206x2622}/ 에 8장씩 + store/upload_packages/v3_* (zip·미리보기·v2 비교)
    python store/make_store_assets_v3.py preview    # 한 장씩 빠르게 보려고 play 만

v2 에서 가져온 것: 8장의 구성·헤드라인·이야기 흐름, 아이콘 칩, AI 통합 장, 상태줄(9:41)을 그려 넣고 웹 상단 줄(로그인/회원가입)을 잘라 낸 폰 화면.
v1 에서 가져온 것: 노랑(#FFD600)/검정(#1A1A1E) 꽉 찬 배경을 번갈아, 큰 굵은 왼쪽 정렬 헤드라인, ✦AI 칩, 폰 화면 크게(아래가 잘림).
v3 에서 새로 한 것:
  · 첫 장: 남의 사진 콜라주를 버리고 **타이포 + 직접 그린 재료·조리도구 아이콘 타일**로 구성(저작권·심사 대응).
  · 앱 화면 속 레시피 썸네일은 전부 **흐리게**(캡처 시 `cap` 단계에서 처리), 네이버·유튜브 출처 로고도 가렸다.
  · 4번 사진 장: 영수증 사진만 쓴다(주문내역 캡처에는 쿠팡 로고·상품 사진이 있어 뺐다).
  · 5번 AI 통합 장: 쿡 픽·식단 짜기·쿡 코치를 검정 카드 세 줄로.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFilter

import make_store_assets as v1
import make_store_assets_v2 as v2
from make_store_assets import BRAND, BRAND_LIGHT, INK, STORE, font, rounded_mask, save_png

SRC = os.path.join(STORE, "sources")
SIZES = v1.SIZES
CREAM = (255, 244, 190)
WHITE = (255, 255, 255)
ORANGE = (255, 138, 26)
RED = (240, 72, 62)
GREEN = (62, 178, 108)
SUB_Y = (82, 66, 0)  # 노랑 배경 위 보조 글자색

# 번호 = 올리는 순서. band: y 노랑, k 검정(번갈아). cut: 캡처 위에서 잘라 낼 css px.
SLIDES = [
    dict(key="brand", kind="brand", band="y"),
    dict(key="match", src="list_top_v3.png", cut=56, icon="fridge", ai=False, band="k",
         headline="내 냉장고 재료로\n만들 수 있는 요리 찾기"),
    dict(key="substitute", src="substitute_card_v3.png", cut=120, icon="swap", ai=False, band="y",
         headline="재료가 없으면\n대체 재료까지 알려줘요"),
    dict(key="photo", src="photo_receipt_v2.png", cut=140, icon="camera", ai=True, kind="photo", band="k",
         headline="사진 한 장으로\n재료 등록 끝"),
    dict(key="ai", src="chat_v3.png", cut=140, icon="chat", ai=True, kind="ai", band="y",
         headline="물어보면 레시피부터\n식단까지 척척"),
    dict(key="cook", src="cook_v3.png", cut=222, icon="speaker", ai=False, band="k",
         headline="손 안 대고\n귀로 듣는 요리"),
    dict(key="expiry", src="expiry_v3.png", cut=150, cut_short=270, icon="timer", ai=False, band="y",
         headline="곧 상할 재료부터\n먼저 알려드려요"),
    dict(key="family", src="family_v3.png", cut=56, icon="users", ai=False, band="k",
         headline="가족과 함께 쓰고\n아낀 돈도 한눈에"),
]

AI_ROWS = [  # 쿡 픽 → 식단 짜기 → 쿡 코치 (고르고 → 짜고 → 요리 중 묻고)
    ("chat", "쿡 픽", "오늘 뭐 먹을지 골라 줘요"),
    ("calendar", "식단 짜기", "일주일 식단을 짜 줘요"),
    ("pot", "쿡 코치", "요리하다 막히면 답해 줘요"),
]

PAD = 0.075  # 왼쪽 여백(W 비율)


def sparkle(draw, cx, cy, r, fill):
    k = r * 0.3
    draw.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill=fill)


def bg_image(W, H, band):
    if band == "k":
        return Image.new("RGB", (W, H), INK)
    img = Image.new("RGB", (W, H), BRAND)
    dp = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        dp.line([(0, y), (W, y)], fill=tuple(int(BRAND_LIGHT[i] + (BRAND[i] - BRAND_LIGHT[i]) * t) for i in range(3)))
    return img


# ---------------------------------------------------------------------------
# 머리말: [아이콘 원] [✦AI 알약] + 헤드라인
# ---------------------------------------------------------------------------
def headline_size(W):
    """모든 장이 같은 크기를 쓰도록 가장 긴 줄 기준으로 한 번만 정한다."""
    f_max = int(W * 0.098)
    size = f_max
    d = ImageDraw.Draw(Image.new("RGB", (10, 10)))
    for s in SLIDES:
        if "headline" not in s:
            continue
        for t in s["headline"].split("\n"):
            while d.textlength(t, font=font(size, 900)) > W * (1 - PAD - 0.07) and size > 20:
                size -= 1
    return size


def ai_pill(img, x, y_mid, h, band):
    """✦AI 알약. 반환: 오른쪽 끝 x."""
    d = ImageDraw.Draw(img)
    bg, fg = (BRAND, INK) if band == "k" else (INK, BRAND)
    f = font(int(h * 0.5), 900)
    tw = d.textlength("AI", font=f)
    w = h * 0.5 + h * 0.34 + h * 0.18 + tw + h * 0.42
    d.rounded_rectangle([x, y_mid - h / 2, x + w, y_mid + h / 2], radius=h / 2, fill=bg)
    sparkle(d, x + h * 0.52, y_mid, h * 0.2, fg)
    d.text((x + h * 0.52 + h * 0.2 + h * 0.15, y_mid + 1), "AI", font=f, fill=fg, anchor="lm")
    return x + w


def header(img, slide, W, hsize):
    d = ImageDraw.Draw(img)
    band = slide["band"]
    pad = int(W * PAD)
    D = int(W * 0.105)
    y0 = int(W * 0.075)
    dbg, ifg = (BRAND, INK) if band == "k" else (INK, BRAND)
    disc = Image.new("RGBA", (D * 4, D * 4), (0, 0, 0, 0))
    ImageDraw.Draw(disc).ellipse([0, 0, D * 4 - 1, D * 4 - 1], fill=dbg + (255,))
    disc = disc.resize((D, D), Image.LANCZOS)
    ic = v2.draw_icon(slide["icon"], int(D * 0.58), color=ifg)
    disc.alpha_composite(ic, ((D - ic.width) // 2, (D - ic.height) // 2))
    img.paste(disc, (pad, y0), disc)
    if slide["ai"]:
        ai_pill(img, pad + D + int(W * 0.025), y0 + D / 2, int(W * 0.068), band)
    y = y0 + D + int(W * 0.04)
    f = font(hsize, 900)
    col = WHITE if band == "k" else INK
    for t in slide["headline"].split("\n"):
        d.text((pad, y), t, font=f, fill=col)
        y += int(hsize * 1.26)
    return y + int(W * 0.045)


# ---------------------------------------------------------------------------
# AI 통합 장의 세 줄 카드
# ---------------------------------------------------------------------------
def ai_cards(img, W, y, band):
    d = ImageDraw.Draw(img)
    pad = int(W * PAD)
    ch = int(W * 0.118)
    gap = int(W * 0.022)
    cbg, cname, cdesc, cdisc, cic = ((INK, WHITE, (190, 190, 198), BRAND, INK) if band == "y"
                                      else ((38, 38, 44), WHITE, (170, 170, 178), BRAND, INK))
    fn = font(int(W * 0.04), 900)
    fd = font(int(W * 0.0325), 500)
    for name, title, desc in AI_ROWS:
        d.rounded_rectangle([pad, y, W - pad, y + ch], radius=int(ch * 0.3), fill=cbg)
        dd = int(ch * 0.68)
        disc = Image.new("RGBA", (dd * 4, dd * 4), (0, 0, 0, 0))
        ImageDraw.Draw(disc).ellipse([0, 0, dd * 4 - 1, dd * 4 - 1], fill=cdisc + (255,))
        disc = disc.resize((dd, dd), Image.LANCZOS)
        g = v2.draw_icon(name, int(dd * 0.58), color=cic)
        disc.alpha_composite(g, ((dd - g.width) // 2, (dd - g.height) // 2))
        img.paste(disc, (pad + int(ch * 0.16), y + (ch - dd) // 2), disc)
        tx = pad + int(ch * 0.16) + dd + int(W * 0.03)
        d.text((tx, y + ch * 0.36), title, font=fn, fill=cname, anchor="lm")
        d.text((tx, y + ch * 0.69), desc, font=fd, fill=cdesc, anchor="lm")
        y += ch + gap
    return y + int(W * 0.015)


# ---------------------------------------------------------------------------
# 폰 화면
# ---------------------------------------------------------------------------
def paste_phone(img, screen, px0, y, pw, radius, band):
    H = img.height
    avail = H - y
    if screen.height + 4 <= avail:  # 다 들어가면 아래 모서리도 둥글게 닫는다(드물다)
        shot, bottom, mh = screen, y + screen.height, screen.height - 1
    else:
        shot = screen.crop((0, 0, pw, avail + radius))
        bottom, mh = H + radius, shot.height + radius
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, mh], radius=radius, fill=255)
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([px0, y + int(pw * 0.012), px0 + pw, bottom], radius=radius, fill=(0, 0, 0, 150 if band == "k" else 105))
    sh = sh.filter(ImageFilter.GaussianBlur(int(pw * 0.028)))
    img.paste(sh, (0, 0), sh)
    img.paste(shot, (px0, y), mask)
    if band == "k":
        ImageDraw.Draw(img).rounded_rectangle([px0, y, px0 + pw - 1, bottom - 1], radius=radius, outline=(66, 66, 72), width=max(2, img.width // 380))
    return bottom


def receipt_card(img, W, phone_y, pw):
    """영수증 사진(직접 찍은 것) 한 장을 폰 화면 위쪽 흐린 영역에 기울여 얹는다. 쿠팡 주문내역 캡처는 상표·상품 사진 때문에 뺐다."""
    css = pw / 430.0
    dim_mid = phone_y + int((48 + 108) * css)
    v2.paste_card(img, os.path.join(SRC, "camera_receipt.png"), (0, 706, 1206, 1400), int(W * 0.60), W // 2, dim_mid, -4)


def render_phone_slide(slide, W, H, hsize):
    band = slide["band"]
    img = bg_image(W, H, band)
    slide2 = dict(slide, _short=H / W <= 2.0)  # 9:16(플레이)은 세로가 짧아 cut_short 가 있으면 그것을 쓴다
    kind = slide.get("kind")
    # 세로로 긴 캔버스에서 화면이 짧아 머리말과 폰 사이가 너무 벌어지면 폰을 조금 키운다(0.86W → 최대 0.92W).
    for ratio in (0.86, 0.88, 0.90, 0.92):
        pw = int(W * ratio)
        px0 = (W - pw) // 2
        screen, _ = v2.build_screen(slide2, pw)
        radius = int(pw * 0.075)
        probe0 = Image.new("RGB", (W, H))
        y_e = header(probe0, slide, W, hsize)
        if kind == "ai":
            y_e = ai_cards(probe0, W, y_e, band)
        if (H + int(radius * 0.6) - screen.height) - y_e <= int(W * 0.09):
            break

    def top(target):
        y = header(target, slide, W, hsize)
        if kind == "ai":
            y = ai_cards(target, W, y, band)
        return y

    probe = Image.new("RGB", (W, H))
    y_end = top(probe)
    # 세로로 긴 캔버스에서 화면이 짧으면 폰을 아래로 내려 머리말과의 간격으로 흡수한다(머리말 위치는 모든 장에서 같게).
    extra = max(0, (H + int(radius * 0.6) - screen.height) - y_end)
    y = top(img)
    y += min(extra, int(W * 0.22))
    paste_phone(img, screen, px0, y, pw, radius, band)
    if kind == "photo":
        receipt_card(img, W, y, pw)
    if slide.get("badge") == "sound":
        img = v1.paste_sound_badge(img, W, int(W * 0.79), int(W * (0.075 + 0.105 + 0.04) + hsize * 1.0))
    return img


# ---------------------------------------------------------------------------
# 첫 장(브랜드 장): 타이포 + 직접 그린 아이콘 타일. 남의 사진은 한 장도 쓰지 않는다.
# ---------------------------------------------------------------------------
def glyph(name, S, main=INK, bgc=WHITE):
    """100 격자로 그린 납작한 재료·조리도구 그림(투명 배경). 4배로 그려 줄인다."""
    K = 4
    N = S * K
    u = N / 100.0
    im = Image.new("RGBA", (N, N), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    def P(x, y):
        return (x * u, y * u)

    def circ(cx, cy, r, fill):
        d.ellipse([(cx - r) * u, (cy - r) * u, (cx + r) * u, (cy + r) * u], fill=fill)

    def rr(x0, y0, x1, y1, r, fill):
        d.rounded_rectangle([x0 * u, y0 * u, x1 * u, y1 * u], radius=r * u, fill=fill)

    def poly(pts, fill):
        d.polygon([P(*p) for p in pts], fill=fill)

    def stroke(pts, w, fill):
        pp = [P(*p) for p in pts]
        d.line(pp, fill=fill, width=int(w * u), joint="curve")
        for p in pp:
            d.ellipse([p[0] - w * u / 2, p[1] - w * u / 2, p[0] + w * u / 2, p[1] + w * u / 2], fill=fill)

    def wave(x, y0, y1, amp, w, fill):
        import math
        pts = [(x + amp * math.sin((t / 10.0) * math.pi * 2), y0 + (y1 - y0) * t / 10.0) for t in range(11)]
        stroke(pts, w, fill)

    if name == "egg":
        for cx, cy, r in [(40, 44, 24), (62, 40, 21), (58, 64, 24), (36, 64, 18), (72, 56, 14)]:
            circ(cx, cy, r, WHITE)
        circ(52, 52, 15, (255, 170, 0))
        circ(47, 46, 4.5, (255, 224, 140))
    elif name == "pot":
        wave(38, 8, 24, 2.2, 4.2, main); wave(50, 4, 24, 2.2, 4.2, main); wave(62, 8, 24, 2.2, 4.2, main)
        rr(18, 44, 82, 84, 10, main)
        rr(12, 36, 88, 48, 6, main)
        rr(6, 54, 20, 62, 4, main); rr(80, 54, 94, 62, 4, main)
        rr(44, 28, 56, 38, 4, main)
        rr(24, 50, 76, 53, 1.5, bgc)
    elif name == "pan":
        inner = (70, 70, 78) if main != INK else (62, 62, 68)
        rr(70, 48, 98, 58, 5, main)
        circ(44, 54, 36, main)
        circ(44, 54, 29, inner)
        for cx, cy, r in [(36, 48, 12), (50, 44, 11), (48, 60, 12), (34, 60, 9)]:
            circ(cx, cy, r, WHITE)
        circ(43, 53, 8, (255, 170, 0))
    elif name == "bowl":
        wave(40, 6, 26, 2.2, 4.2, main); wave(56, 10, 26, 2.2, 4.2, main)
        d.pieslice([10 * u, 22 * u, 90 * u, 102 * u], 0, 180, fill=main)
        rr(36, 82, 64, 92, 4, main)
        rr(8, 50, 92, 56, 3, bgc if main != INK else WHITE)
    elif name == "tofu":
        poly([(20, 40), (68, 40), (86, 24), (38, 24)], (255, 255, 244))
        poly([(68, 40), (86, 24), (86, 70), (68, 86)], (230, 210, 150))
        rr(20, 40, 68, 86, 3, (255, 244, 214))
        for cx, cy in [(34, 56), (52, 68), (40, 74)]:
            circ(cx, cy, 2.2, (232, 214, 160))
    elif name == "carrot":
        for p0, p1 in [((72, 32), (66, 8)), ((72, 32), (84, 10)), ((72, 32), (94, 22))]:
            stroke([p0, p1], 8, GREEN)
        poly([(62, 28), (84, 46), (24, 92)], ORANGE)
        stroke([(62, 28), (84, 46), (24, 92), (62, 28)], 6, ORANGE)
        for a, b in [((58, 44), (68, 50)), ((46, 58), (58, 64)), ((36, 72), (46, 78))]:
            stroke([a, b], 3.2, (214, 100, 8))
    elif name == "tomato":
        circ(50, 58, 34, RED)
        circ(38, 46, 7, (255, 150, 140))
        poly([(50, 16), (56, 28), (70, 26), (60, 36), (66, 48), (50, 40), (34, 48), (40, 36), (30, 26), (44, 28)], GREEN)
        stroke([(50, 10), (50, 24)], 5, GREEN)
    elif name == "chili":
        import math
        pts = [(24, 22), (46, 22), (68, 38), (78, 62), (70, 88)]
        # 곡선을 따라 지름이 줄어드는 원을 찍는다
        def bez(t):
            n = len(pts) - 1
            xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
            from math import comb
            x = sum(comb(n, i) * (1 - t) ** (n - i) * t ** i * xs[i] for i in range(n + 1))
            y = sum(comb(n, i) * (1 - t) ** (n - i) * t ** i * ys[i] for i in range(n + 1))
            return x, y
        for i in range(60):
            t = i / 59.0
            x, y = bez(t)
            circ(x, y, 12 - 9 * t, RED)
        stroke([(22, 22), (12, 14)], 6.5, GREEN)
        circ(34, 17, 3, (255, 160, 150))
    elif name == "scallion":
        for x, dx in [(34, -8), (50, 0), (66, 9)]:
            stroke([(x, 60), (x + dx, 12)], 11, GREEN)
            stroke([(x, 60), (x + dx * 0.3, 40)], 5, (150, 214, 160))
            stroke([(x, 62), (x, 86)], 13, WHITE)
        for x in (34, 50, 66):
            stroke([(x - 3, 90), (x - 6, 96)], 2.2, (200, 190, 160)); stroke([(x + 3, 90), (x + 6, 96)], 2.2, (200, 190, 160))
    elif name == "mushroom":
        rr(38, 54, 62, 88, 8, (250, 232, 200))
        d.pieslice([12 * u, 22 * u, 88 * u, 84 * u], 180, 360, fill=(206, 138, 84))
        rr(12, 52, 88, 60, 4, (206, 138, 84))
        for cx, cy, r in [(34, 44, 5), (58, 36, 6), (70, 50, 4)]:
            circ(cx, cy, r, (255, 240, 220))
    return im.resize((S, S), Image.LANCZOS)


TILE_PLAN = [  # (그림, 타일 바탕) 5열
    [("carrot", "w"), ("egg", "k"), ("pot", "c"), ("tomato", "w"), ("tofu", "k")],
    [("bowl", "c"), ("mushroom", "w"), ("pan", "k"), ("chili", "w"), ("scallion", "k")],
    [("egg", "k"), ("tomato", "w"), ("pot", "k"), ("carrot", "c"), ("pan", "c")],
    [("scallion", "k"), ("tofu", "k"), ("bowl", "k"), ("mushroom", "c"), ("chili", "w")],
    [("pot", "c"), ("carrot", "w"), ("egg", "k"), ("pan", "c"), ("tomato", "w")],
]
TILE_BG = {"w": WHITE, "k": INK, "c": CREAM}


def tile_mosaic(W, T, gap, cols=5, rows=5):
    """타일 격자(투명 배경, 그림자 포함)."""
    pad = int(T * 0.4)
    gw = cols * T + (cols - 1) * gap + pad * 2
    gh = rows * T + (rows - 1) * gap + pad * 2
    base = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    sh = Image.new("RGBA", (gw, gh), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    tiles = []
    for r in range(rows):
        for c in range(cols):
            x, y = pad + c * (T + gap), pad + r * (T + gap)
            sd.rounded_rectangle([x, y + int(T * 0.04), x + T, y + T + int(T * 0.04)], radius=int(T * 0.22), fill=(60, 44, 0, 70))
            tiles.append((r, c, x, y))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(T * 0.06))))
    bd = ImageDraw.Draw(base)
    cache = {}
    for r, c, x, y in tiles:
        gname, bgk = TILE_PLAN[r % len(TILE_PLAN)][(c + r // len(TILE_PLAN) * 2) % len(TILE_PLAN[0])]
        bgc = TILE_BG[bgk]
        # 타일은 4배로 그려 모서리를 매끈하게
        tm = Image.new("L", (T * 3, T * 3), 0)
        ImageDraw.Draw(tm).rounded_rectangle([0, 0, T * 3 - 1, T * 3 - 1], radius=int(T * 3 * 0.22), fill=255)
        tile = Image.new("RGBA", (T, T), bgc + (255,))
        tile.putalpha(tm.resize((T, T), Image.LANCZOS))
        main = BRAND if bgk == "k" else INK
        key = (gname, main, bgc)
        if key not in cache:
            cache[key] = glyph(gname, int(T * 0.72), main=main, bgc=bgc)
        g = cache[key]
        tile.alpha_composite(g, ((T - g.width) // 2, (T - g.height) // 2))
        base.alpha_composite(tile, (x, y))
    return base


def render_brand(W, H):
    img = bg_image(W, H, "y").convert("RGBA")
    d = ImageDraw.Draw(img)
    pad = int(W * PAD)
    tall = H / W > 2.0

    # 맨 위: 앱 아이콘 + 쿡매치
    isz = int(W * 0.15)
    icon = Image.open(os.path.join(STORE, "icons", "appstore_icon_1024.png")).convert("RGB").resize((isz, isz), Image.LANCZOS).convert("RGBA")
    icon.putalpha(rounded_mask(isz, 0.225))
    y0 = int(W * 0.085)
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sm = Image.new("RGBA", icon.size, (0, 0, 0, 0))
    sm.putalpha(icon.split()[3].point(lambda a: int(a * 0.3)))
    sh.paste(sm, (pad, y0 + int(isz * 0.06)), sm)
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(isz * 0.07))))
    img.alpha_composite(icon, (pad, y0))
    d = ImageDraw.Draw(img)
    d.text((pad + isz + int(W * 0.035), y0 + isz / 2), "쿡매치", font=font(int(W * 0.062), 900), fill=INK, anchor="lm")

    # 헤드라인: 인기 레시피만 / (큰) 4만 개, / 뭘 골라도 맛집
    y = y0 + isz + int(W * (0.075 if tall else 0.055))
    f1 = font(int(W * 0.098), 900)
    d.text((pad, y), "인기 레시피만", font=f1, fill=INK)
    y += int(W * 0.098 * 1.2)
    big = int(W * (0.235 if tall else 0.215))
    f2 = font(big, 900)
    tw = d.textlength("4만 개,", font=f2)
    # 하이라이트 띠(흰색)
    d.rounded_rectangle([pad - int(W * 0.012), y + int(big * 0.64), pad + tw - int(big * 0.14), y + int(big * 0.90)], radius=int(big * 0.1), fill=WHITE)
    d.text((pad, y), "4만 개,", font=f2, fill=INK)
    y += int(big * 1.2)
    d.text((pad, y), "뭘 골라도 맛집", font=f1, fill=INK)
    y += int(W * 0.098 * 1.2) + int(W * 0.02)
    sf = font(int(W * 0.0375), 600)
    for t in ["네이버·유튜브에서 매일 엄선한 레시피를", "냉장고 속 재료로 바로 찾아요"]:
        d.text((pad, y), t, font=sf, fill=SUB_Y)
        y += int(W * 0.058)
    y_text_end = y

    # 타일 모자이크(기울여서 오른쪽·아래로 흘려 보낸다)
    T = int(W * 0.215)
    gap = int(W * 0.03)
    mosaic = tile_mosaic(W, T, gap, cols=6, rows=6)
    rot = mosaic.rotate(9, resample=Image.BICUBIC, expand=True)
    my = y_text_end - int(W * (0.02 if tall else 0.06))
    mx = -int(W * 0.17)
    sx0, sy0 = max(0, -mx), max(0, -my)
    rot = rot.crop((sx0, sy0, min(rot.width, img.width - mx), min(rot.height, img.height - my)))
    img.alpha_composite(rot, (max(0, mx), max(0, my)))
    d = ImageDraw.Draw(img)

    # 떠 있는 매칭률 알약(앱의 「내 재료 4/5 (93%)」 표시를 본뜬 그림)
    pf = font(int(W * 0.042), 900)
    txt = "내 재료 4/5 (93%)"
    tw = d.textlength(txt, font=pf)
    ph = int(W * 0.095)
    pw_ = int(tw + W * 0.07)
    px, py = pad, y_text_end + int(W * 0.035)
    pill_sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(pill_sh).rounded_rectangle([px, py + int(ph * 0.12), px + pw_, py + ph + int(ph * 0.12)], radius=ph // 2, fill=(0, 0, 0, 120))
    img.alpha_composite(pill_sh.filter(ImageFilter.GaussianBlur(int(ph * 0.14))))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([px, py, px + pw_, py + ph], radius=ph // 2, fill=INK)
    d.text((px + pw_ / 2, py + ph / 2 + 1), txt, font=pf, fill=BRAND, anchor="mm")

    # 반짝임
    for sx, sy, sr in [(0.90, 0.075, 0.034), (0.80, 0.145, 0.02)]:
        sparkle(d, W * sx, W * sy + int(W * 0.04), W * sr, INK + (255,))
    return img.convert("RGB")


def render_slide(slide, W, H, hsize):
    if slide.get("kind") == "brand":
        return render_brand(W, H)
    return render_phone_slide(slide, W, H, hsize)


def make_shots(only_play=False):
    for platform, (W, H) in SIZES.items():
        if only_play and platform != "play":
            continue
        out = os.path.join(STORE, "screenshots_v3", platform)
        os.makedirs(out, exist_ok=True)
        for old in os.listdir(out):
            if old.endswith(".png"):
                os.remove(os.path.join(out, old))
        hs = headline_size(W)
        for i, slide in enumerate(SLIDES, 1):
            save_png(render_slide(slide, W, H, hs), os.path.join(out, f"{i:02d}_{slide['key']}.png"))
        print(f"{platform} {W}x{H}: {len(SLIDES)}장 (헤드라인 {hs}px)")


def make_packages():
    """올림용 zip 3개 + 미리보기(4x2) + v2/v3 비교(윗줄 v2·아랫줄 v3). store/upload_packages/ (untracked)."""
    import glob
    import zipfile
    out = os.path.join(STORE, "upload_packages")
    os.makedirs(out, exist_ok=True)
    v3 = sorted(glob.glob(os.path.join(STORE, "screenshots_v3", "play", "*.png")))
    v2s = sorted(glob.glob(os.path.join(STORE, "screenshots_v2", "play", "*.png")))
    W, H, g = 300, 533, 14
    s = Image.new("RGB", (4 * W + 5 * g, 2 * H + 3 * g), (236, 236, 238))
    for i, f in enumerate(v3):
        s.paste(Image.open(f).resize((W, H), Image.LANCZOS), (g + (i % 4) * (W + g), g + (i // 4) * (H + g)))
    s.save(os.path.join(out, "v3_미리보기_올리는_순서.png"))
    W, H, g, lab, hh = 270, 480, 12, 70, 50
    cmp_ = Image.new("RGB", (lab + 8 * (W + g) + g, hh + 2 * (H + g) + g), (255, 255, 255))
    d = ImageDraw.Draw(cmp_)
    d.text((lab // 2, hh + H // 2), "v2", font=font(26, 900), fill=(120, 120, 126), anchor="mm")
    d.text((lab // 2, hh + H + g + H // 2), "v3", font=font(26, 900), fill=INK, anchor="mm")
    d.text((lab, hh // 2), "위: v2(흰 배경 당근 스타일, 첫 장 레시피 사진 콜라주) / 아래: v3(노랑·검정 우리 스타일, 같은 내용, 첫 장 타이포+아이콘 타일, 앱 속 사진 블러)", font=font(16, 700), fill=INK, anchor="lm")
    for r, files in enumerate([v2s, v3]):
        for i, f in enumerate(files):
            x, y = lab + g + i * (W + g), hh + r * (H + g)
            cmp_.paste(Image.open(f).resize((W, H), Image.LANCZOS), (x, y))
            if r == 1:
                d.rectangle([x - 2, y - 2, x + W + 1, y + H + 1], outline=BRAND, width=2)
    cmp_.save(os.path.join(out, "v2_vs_v3_비교.png"))
    for name, folder in [("v3_GooglePlay_폰_1080x1920_8장.zip", "play"), ("v3_AppStore_1290x2796_8장.zip", "ios"), ("v3_AppStore_1206x2622_8장.zip", "ios_1206x2622")]:
        with zipfile.ZipFile(os.path.join(out, name), "w", zipfile.ZIP_STORED) as zf:
            for i, f in enumerate(sorted(glob.glob(os.path.join(STORE, "screenshots_v3", folder, "*.png"))), 1):
                zf.write(f, f"{i}_{os.path.basename(f)[3:]}")
    print("packages ok")


if __name__ == "__main__":
    args = sys.argv[1:]
    make_shots(only_play="preview" in args)
    if "preview" not in args:
        make_packages()
