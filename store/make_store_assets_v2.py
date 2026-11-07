# -*- coding: utf-8 -*-
"""스토어 스크린샷 v2 — 「당근 스타일」 8장. v1(make_store_assets.py)은 그대로 둔다.

    python store/make_store_assets_v2.py            # store/screenshots_v2/{play,ios,ios_1206x2622}/ 에 8장씩 + store/upload_packages/v2_* (zip·미리보기·v1 비교)
    python store/make_store_assets_v2.py preview    # 한 장씩 빠르게 보려고 play 만

디자인(당근 앱스토어 이미지를 관찰해 옮긴 것):
    흰 배경 · 가운데 정렬 · 작은 노랑 둥근 아이콘 칩 · 검정 굵은 헤드라인 2줄(「기능 + 이득」) ·
    폰 화면은 아래가 잘려 나가며 얇은 테두리 · 한 장에 한 화면.
    첫 장만 브랜드 장(앱 아이콘 + 레시피 사진 콜라주 + 한 줄 + 보조 한 줄).

폰 화면은 v1 과 같은 `store/sources/*` 실제 앱 캡처(+ v2 에서 새로 찍은 *_v2.png)를 쓰되,
웹 브라우저처럼 보이던 상단 줄(CookMatch / 로그인·회원가입)은 잘라 내고 iOS 상태줄(9:41)을 그려 넣었다.
AI 크레딧이 드는 화면(식단·사진·쿡 픽·쿡 코치)은 v1 처럼 서버 응답만 가짜로 갈아 끼워 찍은 것이다
(자세한 내용은 make_store_assets.py 의 SOURCES 주석, CHANGELOG 참고).
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFilter

import make_store_assets as v1
from make_store_assets import BRAND, INK, ROOT, STORE, font, rounded_mask, save_png

SRC = os.path.join(STORE, "sources")
THUMBS = os.path.join(SRC, "v2")
SIZES = v1.SIZES

GRAY = (112, 112, 120)
LINE = (214, 214, 220)
SOFT_Y = (255, 242, 176)
SOFT_Y2 = (255, 226, 110)


# ---------------------------------------------------------------------------
# 슬라이드 표 — 번호 = 올리는 순서
#   cut: 캡처 위에서 잘라 낼 css px(캡처는 430x932 css @3x). 웹 상단 줄을 없애려고.
#   status: 상태줄 높이(css px)
# ---------------------------------------------------------------------------
SLIDES = [
    dict(key="brand", kind="brand"),
    dict(key="match", src="list_top_v2.png", cut=56, icon="fridge", ai=False,
         headline="내 냉장고 재료로\n만들 수 있는 요리 찾기"),
    dict(key="substitute", src="substitute_card_v2.png", cut=120, icon="swap", ai=False,
         headline="재료가 없으면\n대체 재료까지 알려줘요"),
    dict(key="photo", src="photo_receipt_v2.png", cut=140, icon="camera", ai=True, kind="photo",
         headline="사진 한 장으로\n재료 등록 끝"),
    dict(key="ai", src="chat_demo.png", cut=140, icon="chat", ai=True, kind="ai",
         headline="물어보면 레시피부터\n식단까지 척척"),
    dict(key="cook", src="cook_main.png", cut=222, icon="speaker", ai=False,
         headline="손 안 대고\n귀로 듣는 요리"),
    dict(key="expiry", src="expiry_sheet.png", cut=150, cut_short=270, icon="timer", ai=False,
         headline="곧 상할 재료부터\n먼저 알려드려요"),
    dict(key="family", src="family_main.png", cut=56, icon="users", ai=False,
         headline="가족과 함께 쓰고\n아낀 돈도 한눈에"),
]

AI_ROWS = [  # 쿡 픽 → 식단 짜기 → 쿡 코치 (고르고 → 짜고 → 요리 중 묻고)
    ("chat", "쿡 픽", "오늘 뭐 먹을지 골라 줘요"),
    ("calendar", "식단 짜기", "일주일 식단을 짜 줘요"),
    ("pot", "쿡 코치", "요리하다 막히면 답해 줘요"),
]


# ---------------------------------------------------------------------------
# 아이콘(24 격자, lucide 풍 선 아이콘). 4배로 그려 줄인다.
# ---------------------------------------------------------------------------
def draw_icon(name, size, color=INK):
    K = 4
    S = size * K
    u = S / 24.0
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lw = max(2, int(round(2.0 * u)))
    c = color + (255,)

    def P(x, y):
        return (x * u, y * u)

    def line(*v):
        pp = [P(v[i], v[i + 1]) for i in range(0, len(v), 2)]
        d.line(pp, fill=c, width=lw, joint="curve")
        for p in pp:
            d.ellipse([p[0] - lw / 2, p[1] - lw / 2, p[0] + lw / 2, p[1] + lw / 2], fill=c)

    def rrect(x0, y0, x1, y1, r):
        d.rounded_rectangle([x0 * u, y0 * u, x1 * u, y1 * u], radius=r * u, outline=c, width=lw)

    def circle(cx, cy, r):
        d.ellipse([(cx - r) * u, (cy - r) * u, (cx + r) * u, (cy + r) * u], outline=c, width=lw)

    def arc(cx, cy, r, a0, a1):
        d.arc([(cx - r) * u, (cy - r) * u, (cx + r) * u, (cy + r) * u], a0, a1, fill=c, width=lw)

    def sparkle(cx, cy, r):
        k = r * 0.3
        d.polygon([P(cx, cy - r), P(cx + k, cy - k), P(cx + r, cy), P(cx + k, cy + k), P(cx, cy + r), P(cx - k, cy + k), P(cx - r, cy), P(cx - k, cy - k)], fill=c)

    if name == "fridge":
        rrect(5, 2, 19, 22, 2.5); line(5, 10, 19, 10); line(9, 6, 9, 7.5); line(9, 13, 9, 16)
    elif name == "swap":
        line(8, 3, 4, 7, 8, 11); line(4, 7, 20, 7); line(16, 13, 20, 17, 16, 21); line(20, 17, 4, 17)
    elif name == "camera":
        rrect(2, 7, 22, 20, 3); line(7, 7, 9.2, 4, 14.8, 4, 17, 7); circle(12, 13.5, 3.6)
    elif name == "chat":
        rrect(3, 3.5, 21, 17.5, 3.5); line(8, 17.5, 8, 21.5, 12.5, 17.5); sparkle(12, 10.5, 3.4)
    elif name == "speaker":
        line(11, 5, 6.5, 9, 2.5, 9, 2.5, 15, 6.5, 15, 11, 19, 11, 5)
        arc(11, 12, 5.5, -50, 50); arc(11, 12, 9.5, -50, 50)
    elif name == "timer":
        circle(12, 14, 8); line(12, 14, 12, 9.5); line(9.5, 2.5, 14.5, 2.5)
    elif name == "users":
        circle(9, 8, 3.6); arc(9, 22, 7, 180, 360); circle(17.2, 8.8, 2.7); arc(17.2, 22, 5, 215, 360)
    elif name == "calendar":
        rrect(3, 4.5, 21, 21, 3); line(3, 10, 21, 10); line(8, 2.5, 8, 6.5); line(16, 2.5, 16, 6.5)
        sparkle(12, 15.5, 2.8)
    elif name == "pot":
        rrect(4, 10, 20, 20.5, 3); line(2.5, 10, 21.5, 10); line(9, 6.5, 9, 4.5); line(12.5, 6.5, 12.5, 3.5); line(16, 6.5, 16, 4.5)
    return im.resize((size, size), Image.LANCZOS)


def icon_chip(W, name, ai=False, d_ratio=0.1):
    """노랑 둥근 칩 + 검정 선 아이콘(+ 오른쪽 위 ✦AI 배지)."""
    D = int(W * d_ratio)
    pad_out = int(D * 0.5)
    chip = Image.new("RGBA", (D + pad_out * 2, D + pad_out), (0, 0, 0, 0))
    cm = Image.new("L", (D * 4, D * 4), 0)
    ImageDraw.Draw(cm).ellipse([0, 0, D * 4 - 1, D * 4 - 1], fill=255)
    circ = Image.new("RGBA", (D, D), BRAND + (255,))
    circ.putalpha(cm.resize((D, D), Image.LANCZOS))
    chip.alpha_composite(circ, (pad_out, pad_out // 2))
    ic = draw_icon(name, int(D * 0.56))
    chip.alpha_composite(ic, (pad_out + (D - ic.width) // 2, pad_out // 2 + (D - ic.height) // 2))
    if ai:
        bh = int(D * 0.36)
        f = font(int(bh * 0.62), 900)
        dd = ImageDraw.Draw(chip)
        tw = dd.textlength("AI", font=f)
        bw = int(bh * 0.55 + bh * 0.6 + tw + bh * 0.28)
        bx = pad_out + D - int(bw * 0.45)
        by = pad_out // 2 - int(bh * 0.28)
        bx = min(bx, chip.width - bw - 1)
        by = max(by, 0)
        m = Image.new("L", (bw * 4, bh * 4), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, bw * 4 - 1, bh * 4 - 1], radius=bh * 2, fill=255)
        badge = Image.new("RGBA", (bw, bh), INK + (255,))
        badge.putalpha(m.resize((bw, bh), Image.LANCZOS))
        bd = ImageDraw.Draw(badge)
        r = bh * 0.2
        cx, cy = bh * 0.48, bh / 2
        k = r * 0.3
        bd.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill=BRAND)
        bd.text((cx + r + bh * 0.14, bh / 2 + 1), "AI", font=f, fill=BRAND, anchor="lm")
        chip.alpha_composite(badge, (bx, by))
    return chip


# ---------------------------------------------------------------------------
# 폰 화면
# ---------------------------------------------------------------------------
def status_bar(w, h, bg, fg, scale):
    """iOS 상태줄: 9:41 · 신호 · 와이파이 · 배터리. scale = 폰 화면 px / css px."""
    im = Image.new("RGB", (w, h), bg)
    d = ImageDraw.Draw(im)
    cy = h * 0.58
    f = font(int(15.5 * scale), 800)
    d.text((26 * scale, cy), "9:41", font=f, fill=fg, anchor="lm")
    # 오른쪽 아이콘(오른쪽 끝에서 안쪽으로)
    x = w - 22 * scale
    bw, bh = 25 * scale, 12 * scale
    d.rounded_rectangle([x - bw, cy - bh / 2, x, cy + bh / 2], radius=3.6 * scale, outline=fg, width=max(1, int(1.2 * scale)))
    d.rounded_rectangle([x - bw + 2 * scale, cy - bh / 2 + 2 * scale, x - 3.2 * scale, cy + bh / 2 - 2 * scale], radius=1.8 * scale, fill=fg)
    d.rounded_rectangle([x + 1.6 * scale, cy - 2.2 * scale, x + 2.9 * scale, cy + 2.2 * scale], radius=0.6 * scale, fill=fg)
    x -= bw + 9 * scale
    # 와이파이(부채꼴 3겹)
    wx, wy = x - 8 * scale, cy + 5 * scale
    for r in (12, 8, 4):
        d.arc([wx - r * scale, wy - r * scale, wx + r * scale, wy + r * scale], 225, 315, fill=fg, width=max(1, int(2.1 * scale)))
    d.ellipse([wx - 1.6 * scale, wy - 1.6 * scale, wx + 1.6 * scale, wy + 1.6 * scale], fill=fg)
    x -= 25 * scale
    # 신호 막대 4개
    for i in range(4):
        hh = (4 + i * 2.6) * scale
        bx = x + i * 4.6 * scale
        d.rounded_rectangle([bx, cy + 6 * scale - hh, bx + 3.2 * scale, cy + 6 * scale], radius=0.8 * scale, fill=fg)
    return im


def lum(c):
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def build_screen(slide, pw):
    """앱 캡처 위를 잘라 상태줄을 얹은 폰 화면(가로 pw)."""
    im = Image.open(os.path.join(SRC, slide["src"])).convert("RGB")
    sc = pw / im.width            # 캡처 px → 화면 px
    css = pw / 430.0              # css px → 화면 px
    cut_css = slide["cut"]
    if "cut_short" in slide and slide.get("_short"):
        cut_css = slide["cut_short"]
    cut = int(cut_css * 3)
    body = im.crop((0, cut, im.width, im.height)).resize((pw, int((im.height - cut) * sc)), Image.LANCZOS)
    bg = body.getpixel((6, 4))
    fg = INK if lum(bg) > 110 else (255, 255, 255)
    st = status_bar(pw, int(48 * css), bg, fg, css)
    out = Image.new("RGB", (pw, st.height + body.height), bg)
    out.paste(st, (0, 0))
    out.paste(body, (0, st.height))
    return out, st.height


def paste_phone(img, screen, px0, y, pw, radius, border_w):
    H = img.height
    avail = H - y
    fits = screen.height + border_w <= avail
    if fits:
        shot = screen
        bottom = y + screen.height
        mh = screen.height - 1
    else:
        shot = screen.crop((0, 0, pw, avail + radius))
        bottom = H + radius
        mh = shot.height + radius
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, shot.width - 1, mh], radius=radius, fill=255)
    # 아주 옅은 그림자로 흰 화면이 흰 배경에서 살짝 떠 보이게
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([px0, y + 6, px0 + pw, bottom], radius=radius, fill=(0, 0, 0, 38))
    sh = sh.filter(ImageFilter.GaussianBlur(int(pw * 0.02)))
    img.paste(sh, (0, 0), sh)
    img.paste(shot, (px0, y), mask)
    ImageDraw.Draw(img).rounded_rectangle([px0 - 1, y - 1, px0 + pw, bottom - 1], radius=radius, outline=LINE, width=border_w)
    return bottom


def paste_card(img, crop_path, crop_box, w, cx, cy, angle, radius=22):
    """사진 카드(둥근 모서리·테두리·그림자)를 기울여 얹는다."""
    src = Image.open(crop_path).convert("RGB").crop(crop_box)
    h = int(src.height * w / src.width)
    card = src.resize((w, h), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, fill=255)
    card.putalpha(m)
    ImageDraw.Draw(card).rounded_rectangle([0, 0, w - 1, h - 1], radius=radius, outline=(255, 255, 255, 255), width=max(4, w // 90))
    rot = card.rotate(angle, resample=Image.BICUBIC, expand=True)
    x0, y0 = cx - rot.width // 2, cy - rot.height // 2
    sh = Image.new("RGBA", rot.size, (0, 0, 0, 0))
    sh.putalpha(rot.split()[3].point(lambda a: int(a * 0.42)))
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    layer.paste(sh, (x0, y0 + int(w * 0.03)), sh)
    layer = layer.filter(ImageFilter.GaussianBlur(int(w * 0.035)))
    base = img.convert("RGBA")
    base.alpha_composite(layer)
    base.alpha_composite(rot, (x0, y0))
    img.paste(base.convert("RGB"))


# ---------------------------------------------------------------------------
# 슬라이드 그리기
# ---------------------------------------------------------------------------
def fit_font(d, text, W, max_w, size, weight=900):
    f = font(size, weight)
    while d.textlength(text, font=f) > max_w and size > 10:
        size -= 2
        f = font(size, weight)
    return f, size


def header(img, slide, W, top=0):
    """아이콘 칩 + 헤드라인 2줄(가운데). top: 위 여백에 더할 px. 반환: 다음 요소가 시작할 y."""
    d = ImageDraw.Draw(img)
    y = int(W * 0.07) + top
    chip = icon_chip(W, slide["icon"], slide["ai"])
    img.paste(chip, ((W - chip.width) // 2, y - chip.height // 2 + int(W * 0.03)), chip)
    y += int(W * 0.1) + int(W * 0.045)
    size = int(W * 0.072)
    lines = slide["headline"].split(chr(10))
    f = font(size, 900)
    while max(d.textlength(t, font=f) for t in lines) > W * 0.9:
        size -= 2
        f = font(size, 900)
    for t in lines:
        d.text((W // 2, y), t, font=f, fill=INK, anchor="mt")
        y += int(size * 1.34)
    return y + int(W * 0.05)


def render_phone_slide(slide, W, H):
    img = Image.new("RGB", (W, H), (255, 255, 255))
    kind = slide.get("kind")
    slide = dict(slide, _short=H / W <= 2.0)  # 9:16(플레이)은 세로가 짧아 cut_short 가 있으면 그것을 쓴다
    pw = int(W * (0.88 if H / W > 2.0 else 0.84))
    px0 = (W - pw) // 2
    screen, _ = build_screen(slide, pw)
    radius = int(pw * 0.085)
    border = max(3, W // 300)
    # 화면이 짧아 아래로 안 흘러 나가면(세로로 긴 캔버스) 폰을 아래로 내려 머리말과의 간격으로 흡수한다(머리말 위치는 모든 장에서 같게).
    probe = Image.new("RGB", (W, H))
    y_end = header(probe, slide, W)
    if kind == "ai":
        y_end = ai_rows(probe, W, y_end)
    extra = max(0, (H + int(radius * 0.6) - screen.height) - y_end)
    y = header(img, slide, W)
    if kind == "ai":
        y = ai_rows(img, W, y)
    y += min(extra, int(W * 0.25))
    paste_phone(img, screen, px0, y, pw, radius, border)
    if kind == "photo":
        photo_cards(img, W, y, pw)
    return img


def ai_rows(img, W, y):
    """쿡 픽 · 식단 짜기 · 쿡 코치 — 아이콘 칩 + 이름 + 한 줄 설명 3줄."""
    d = ImageDraw.Draw(img)
    rh = int(W * 0.088)
    x0 = int(W * 0.13)
    fn = font(int(W * 0.036), 900)
    fd = font(int(W * 0.0315), 500)
    for name, title, desc in AI_ROWS:
        dd = int(rh * 0.78)
        ic = Image.new("RGBA", (dd, dd), (0, 0, 0, 0))
        m = Image.new("L", (dd * 4, dd * 4), 0)
        ImageDraw.Draw(m).ellipse([0, 0, dd * 4 - 1, dd * 4 - 1], fill=255)
        ic.paste(Image.new("RGBA", (dd, dd), BRAND + (255,)), (0, 0), m.resize((dd, dd), Image.LANCZOS))
        g = draw_icon(name, int(dd * 0.58))
        ic.alpha_composite(g, ((dd - g.width) // 2, (dd - g.height) // 2))
        img.paste(ic, (x0, y + (rh - dd) // 2), ic)
        tx = x0 + dd + int(W * 0.03)
        d.text((tx, y + rh / 2), title, font=fn, fill=INK, anchor="lm")
        tw = d.textlength(title, font=fn)
        d.text((tx + tw + int(W * 0.025), y + rh / 2 + 1), desc, font=fd, fill=GRAY, anchor="lm")
        y += rh
    return y + int(W * 0.045)


def photo_cards(img, W, phone_y, pw):
    """영수증 사진 + (뒤) 주문내역 사진을 폰 화면 위쪽 흐린 영역에 기울여 얹는다."""
    css = pw / 430.0
    dim_mid = phone_y + int((48 + 100) * css)  # 시트 위 흐린 영역의 가운데쯤
    back = os.path.join(SRC, "camera_coupang.png")
    front = os.path.join(SRC, "camera_receipt.png")
    paste_card(img, back, (0, 1020, 1206, 1760), int(W * 0.46), int(W * 0.71), dim_mid + int(W * 0.0), 7)
    paste_card(img, front, (0, 706, 1206, 1400), int(W * 0.55), int(W * 0.40), dim_mid + int(W * 0.02), -5)


# ---- 첫 장(브랜드 장) --------------------------------------------------------
BRAND_PHOTOS = [  # (파일, 중심 dx(W 비율), dy(일러스트 중심 기준), 지름(W 비율), 자르기 상하 비율)
    ("80558", -0.30, -0.10, 0.30),
    ("115184", 0.32, -0.20, 0.27),
    ("169041", -0.37, 0.16, 0.22),
    ("154428", 0.36, 0.08, 0.25),
    ("110388", -0.10, 0.30, 0.25),
    ("159170", 0.14, 0.30, 0.20),
    ("160390", 0.06, -0.33, 0.21),
    ("2362", -0.18, -0.34, 0.16),
]


def circle_photo(path, d, ring=0):
    im = Image.open(path).convert("RGB")
    if "2362" in path or "2395" in path:  # 위아래 검은 띠 제거
        im = im.crop((0, int(im.height * 0.14), im.width, int(im.height * 0.86)))
    s = min(im.size)
    im = im.crop(((im.width - s) // 2, (im.height - s) // 2, (im.width + s) // 2, (im.height + s) // 2)).resize((d, d), Image.LANCZOS)
    out = Image.new("RGBA", (d + ring * 2, d + ring * 2), (0, 0, 0, 0))
    big = Image.new("L", (out.width * 3, out.height * 3), 0)
    ImageDraw.Draw(big).ellipse([0, 0, big.width - 1, big.height - 1], fill=255)
    if ring:
        out.paste(Image.new("RGBA", out.size, (255, 255, 255, 255)), (0, 0), big.resize(out.size, Image.LANCZOS))
    m = Image.new("L", (d * 3, d * 3), 0)
    ImageDraw.Draw(m).ellipse([0, 0, d * 3 - 1, d * 3 - 1], fill=255)
    out.paste(im, (ring, ring), m.resize((d, d), Image.LANCZOS))
    return out


def sparkle(draw, cx, cy, r, fill):
    k = r * 0.3
    draw.polygon([(cx, cy - r), (cx + k, cy - k), (cx + r, cy), (cx + k, cy + k), (cx, cy + r), (cx - k, cy + k), (cx - r, cy), (cx - k, cy - k)], fill=fill)


def render_brand(W, H):
    img = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    d = ImageDraw.Draw(img)
    cx, cy = W // 2, int(H * (0.335 if H / W < 2 else 0.37))
    Wk = W * (1.0 if H / W < 2 else 1.08)  # 세로로 긴 캔버스에선 일러스트를 키운다
    # 뒤 도형 — 당근의 색 도형 대신 쿡매치 노랑 계열
    for dx, dy, r, col in [(-0.16, 0.02, 0.30, SOFT_Y), (0.20, -0.02, 0.26, SOFT_Y2), (0.02, 0.12, 0.22, (255, 238, 140))]:
        x, y, rr = cx + dx * Wk * 0.9, cy + dy * Wk * 0.95, r * Wk
        d.ellipse([x - rr, y - rr, x + rr, y + rr], fill=col + (255,))
    # 콜라주 — 실제 레시피 사진
    for pid, dx, dy, dia in BRAND_PHOTOS:
        D = int(Wk * dia)
        ph = circle_photo(os.path.join(THUMBS, f"{pid}.jpg"), D, ring=max(5, W // 150))
        x, y = int(cx + dx * Wk * 0.9 - ph.width / 2), int(cy + dy * Wk * 0.95 - ph.height / 2)
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        sm = Image.new("RGBA", ph.size, (0, 0, 0, 0))
        sm.putalpha(ph.split()[3].point(lambda a: int(a * 0.28)))
        sh.paste(sm, (x, y + int(Wk * 0.012)), sm)
        img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(Wk * 0.014))))
        img.alpha_composite(ph, (x, y))
    # 가운데 앱 아이콘
    icon = Image.open(os.path.join(STORE, "icons", "appstore_icon_1024.png")).convert("RGB")
    isz = int(Wk * 0.33)
    ic = icon.resize((isz, isz), Image.LANCZOS).convert("RGBA")
    ic.putalpha(rounded_mask(isz, 0.225))
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sm = Image.new("RGBA", ic.size, (0, 0, 0, 0))
    sm.putalpha(ic.split()[3].point(lambda a: int(a * 0.35)))
    sh.paste(sm, (cx - isz // 2, cy - isz // 2 + int(Wk * 0.02)), sm)
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(Wk * 0.025))))
    img.alpha_composite(ic, (cx - isz // 2, cy - isz // 2))
    d = ImageDraw.Draw(img)
    for sx, sy, sr, col in [(-0.40, -0.47, 0.028, INK), (0.40, -0.47, 0.034, INK), (0.42, 0.37, 0.024, INK), (-0.43, 0.36, 0.03, INK)]:
        sparkle(d, cx + sx * Wk, cy + sy * Wk, Wk * sr, col + (255,))

    # 글: 쿡매치 알약 → 헤드라인 → 보조
    y = int(H * (0.625 if H / W < 2 else 0.675))
    pf = font(int(W * 0.04), 900)
    pw_ = d.textlength("쿡매치", font=pf) + W * 0.07
    ph_ = W * 0.082
    d.rounded_rectangle([W / 2 - pw_ / 2, y, W / 2 + pw_ / 2, y + ph_], radius=ph_ / 2, fill=BRAND + (255,))
    d.text((W / 2, y + ph_ / 2 + 1), "쿡매치", font=pf, fill=INK, anchor="mm")
    y += int(ph_ + W * 0.045)
    lines = ["인기 레시피만 4만 개,", "뭘 골라도 맛집"]
    hf, size = fit_font(d, lines[0], W, W * 0.9, int(W * 0.088))
    for t in lines:
        d.text((W // 2, y), t, font=hf, fill=INK, anchor="mt")
        y += int(size * 1.3)
    y += int(W * 0.03)
    sf = font(int(W * 0.036), 500)
    for t in ["네이버·유튜브에서 매일 엄선한 레시피를", "냉장고 속 재료로 바로 찾아요"]:
        d.text((W // 2, y), t, font=sf, fill=GRAY, anchor="mt")
        y += int(W * 0.056)
    return img.convert("RGB")


def render_slide(slide, W, H):
    if slide.get("kind") == "brand":
        return render_brand(W, H)
    return render_phone_slide(slide, W, H)


def make_shots(only_play=False):
    for platform, (W, H) in SIZES.items():
        if only_play and platform != "play":
            continue
        out = os.path.join(STORE, "screenshots_v2", platform)
        os.makedirs(out, exist_ok=True)
        for old in os.listdir(out):
            if old.endswith(".png"):
                os.remove(os.path.join(out, old))
        for i, slide in enumerate(SLIDES, 1):
            save_png(render_slide(slide, W, H), os.path.join(out, f"{i:02d}_{slide['key']}.png"))
        print(f"{platform} {W}x{H}: {len(SLIDES)}장")


def make_packages():
    """올림용 zip 3개 + 미리보기(4x2) + v1/v2 비교(윗줄 v1·아랫줄 v2). store/upload_packages/ (untracked)."""
    import glob
    import zipfile
    from PIL import ImageDraw as D
    out = os.path.join(STORE, "upload_packages")
    os.makedirs(out, exist_ok=True)
    v2 = sorted(glob.glob(os.path.join(STORE, "screenshots_v2", "play", "*.png")))
    v1 = sorted(glob.glob(os.path.join(STORE, "screenshots", "play", "*.png")))
    W, H, g = 300, 533, 14
    s = Image.new("RGB", (4 * W + 5 * g, 2 * H + 3 * g), (236, 236, 238))
    for i, f in enumerate(v2):
        s.paste(Image.open(f).resize((W, H), Image.LANCZOS), (g + (i % 4) * (W + g), g + (i // 4) * (H + g)))
    s.save(os.path.join(out, "v2_미리보기_올리는_순서.png"))
    W, H, g, lab, hh = 270, 480, 12, 70, 50
    cmp_ = Image.new("RGB", (lab + 8 * (W + g) + g, hh + 2 * (H + g) + g), (255, 255, 255))
    d = D.Draw(cmp_)
    d.text((lab // 2, hh + H // 2), "v1", font=font(26, 900), fill=(120, 120, 126), anchor="mm")
    d.text((lab // 2, hh + H + g + H // 2), "v2", font=font(26, 900), fill=INK, anchor="mm")
    d.text((lab, hh // 2), "위: v1(노랑·검정 꽉 찬 배경, 큰 슬로건) / 아래: v2 당근 스타일(흰 배경, 기능+이득, 첫 장 브랜드)", font=font(16, 700), fill=INK, anchor="lm")
    for r, files in enumerate([v1, v2]):
        for i, f in enumerate(files):
            x, y = lab + g + i * (W + g), hh + r * (H + g)
            cmp_.paste(Image.open(f).resize((W, H), Image.LANCZOS), (x, y))
            if r == 1:
                d.rectangle([x - 2, y - 2, x + W + 1, y + H + 1], outline=BRAND, width=2)
    cmp_.save(os.path.join(out, "v1_vs_v2_비교.png"))
    for name, folder in [("v2_GooglePlay_폰_1080x1920_8장.zip", "play"), ("v2_AppStore_1290x2796_8장.zip", "ios"), ("v2_AppStore_1206x2622_8장.zip", "ios_1206x2622")]:
        with zipfile.ZipFile(os.path.join(out, name), "w", zipfile.ZIP_STORED) as zf:
            for i, f in enumerate(sorted(glob.glob(os.path.join(STORE, "screenshots_v2", folder, "*.png"))), 1):
                zf.write(f, f"{i}_{os.path.basename(f)[3:]}")  # 1_brand.png ... 8_family.png (번호 순으로 올리기)
    print("packages ok")


if __name__ == "__main__":
    args = sys.argv[1:]
    make_shots(only_play="preview" in args)
    if "preview" not in args:
        make_packages()
