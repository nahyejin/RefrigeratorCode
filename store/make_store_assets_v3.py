# -*- coding: utf-8 -*-
"""스토어 스크린샷 v3 — 「우리 스타일(노랑/검정 꽉 찬 배경) + v2 내용」 8장. v1·v2 코드·결과물은 그대로 둔다.

    python store/make_store_assets_v3.py            # store/screenshots_v3/{play,ios,ios_1206x2622}/ 에 8장씩 + store/upload_packages/v3_* (zip·미리보기·v2 비교)
    python store/make_store_assets_v3.py preview    # 한 장씩 빠르게 보려고 play 만

v2 에서 가져온 것: 8장의 구성·헤드라인·이야기 흐름, 아이콘 칩, AI 통합 장, 상태줄(9:41)을 그려 넣고 웹 상단 줄(로그인/회원가입)을 잘라 낸 폰 화면.
v1 에서 가져온 것: 노랑(#FFD600)/검정(#1A1A1E) 꽉 찬 배경을 번갈아, 큰 굵은 왼쪽 정렬 헤드라인, ✦AI 칩, 폰 화면 크게(아래가 잘림).
v3 에서 새로 한 것:
  · 첫 장(2026-11-07 재디자인): 큰 글자 + 앱 헤더 워드마크(작게) + 앱 목록의 실제 카드. 시안 A·B·C 중 BRAND_VARIANT(=A)가 정식, 셋 다 screenshots_v3/alt/ 에 둔다.
  · 4번 장(2026-11-07): 대체 칩 → 쿡 코치 카드 화면(답은 가짜 응답). Play(9:16)는 짧은 캡처(src_short), iOS 는 긴 캡처.
  · 순서(2026-11-07 수정): 1 브랜드 → 2 요약된 단계+귀로 듣기 → 3 내 냉장고 매칭 → 4 대체 재료 → 5 사진 등록(영수증+음식 사진)
    → 6 AI 통합(쿡 픽·식단 짜기·쿡 코치) → 7 곧 상할 재료 → 8 가족.
  · 앱 화면 속 레시피 썸네일·N/YT 배지는 가리지 않고 **그대로**(사용자: 기존 앱스토어 이미지도 같은 네이버·유튜브 이미지를 써서 괜찮다고 판단). 로고 이미지를 새로 넣지는 않는다.
  · 5번 사진 장: 영수증 사진 + 음식 사진 두 장(카메라 화면에서 사진 부분만 잘라 낸 것, 쿠팡 주문내역은 로고·상품 사진 때문에 뺐다).
  · 6번 AI 통합 장: 쿡 픽·식단 짜기·쿡 코치만. 폰 위쪽 흐린 배경에 남던 조각(알약·노란 조각)은 지웠다.
  · 「노란 테두리」 제거: 노란 배경 장에서 폰 둘레의 호박색 그림자 띠를 옅고 중립적으로, 흐린 배경에 남던 노란 토글·알약 조각을 지움.
"""

import os
import sys

from PIL import Image, ImageDraw, ImageFilter

import make_store_assets as v1
import make_store_assets_v2 as v2
from make_store_assets import BRAND, BRAND_LIGHT, INK, STORE, font, rounded_mask, save_png

SRC = os.path.join(STORE, "sources")
# 태블릿(Play 7인치·10인치 공통, 9:16) — 2026-11-08 사용자 요청. 폰과 같은 장을 더 크게 그린다.
SIZES = {**v1.SIZES, "tablet_1440x2560": (1440, 2560)}
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
         headline="재료 매칭률 높은 순으로\n만들 수 있는 요리 찾기"),
    dict(key="ai", src="chat_v3.png", cut=150, icon="chat", ai=True, kind="ai", band="y", fix="chat",
         headline="물어보면 레시피부터\n식단까지 척척"),
    dict(key="substitute", src="coach_substitute_v3.png", src_short="coach_substitute_v3_short.png", cut=108, icon="swap", ai=True, band="k", fix="coach",
         headline="재료 대체부터 계량까지\n쿡 코치가 다 답해요"),
    dict(key="photo", src="photo_receipt_v2.png", cut=140, icon="camera", ai=True, kind="photo", band="y", fix="photo",
         headline="사진 한 장으로\n재료 등록 끝"),
    dict(key="expiry", src="expiry_v3.png", cut=150, cut_short=270, icon="timer", ai=False, band="k", fix="expiry",
         headline="소비기한은 자동으로\n곧 상할 재료부터 먼저"),
    dict(key="cook", src="cook_v3.png", cut=236, icon="speaker", ai=False, band="y", kind="cook",
         headline="단계별로 요약해서\n손 안 대고 귀로 듣기"),
    dict(key="family", src="family_v3.png", cut=56, icon="users", ai=False, band="k",
         headline="가족과 함께 쓰고\n아낀 돈도 한눈에"),
]

AI_ROWS = [  # 쿡 픽 → 식단 짜기 → 쿡 코치 (고르고 → 짜고 → 요리 중 묻고)
    ("chat", "쿡 픽", "오늘 뭐 먹을지 골라 줘요"),
    ("calendar", "식단 짜기", "일주일 식단을 짜 줘요"),
    ("pot", "쿡 코치", "요리하다 막히면 답해 줘요"),
]

PAD = 0.075  # 왼쪽 여백(W 비율)


# ---------------------------------------------------------------------------
# 캡처 정리: 흐린 배경(시트 뒤)에 남던 조각을 지운다. 앱 화면 자체는 건드리지 않는다.
# ---------------------------------------------------------------------------
def fix_chat(im):
    """쿡 픽 시트 위쪽 흐린 배경에 남은 알약·노란 조각(매칭도·필터 버튼 줄)을 배경색으로 덮는다. 시트(흰색)는 그대로."""
    im = im.copy()
    px = im.load()
    for y in range(446, 541):
        base = px[2, y]
        # 시트 위 가장자리(y<480) 위쪽은 가로 전체, 그 아래는 시트 모서리 바깥(양 끝)만 — 시트 머리줄(아이콘·AI 칩)은 건드리지 않는다
        xs = range(im.width) if y < 480 else list(range(0, 40)) + list(range(im.width - 40, im.width))
        for x in xs:
            p = px[x, y]
            if min(p) >= 245:  # 시트(흰색)
                continue
            if sum(abs(p[i] - base[i]) for i in range(3)) > 10:
                px[x, y] = base
    return im


def fix_photo(im):
    """사진 시트 위쪽 흐린 배경의 「내 냉장고 재료 관리」 글자·노란 토글을 배경색으로 덮는다."""
    im = im.copy()
    d = ImageDraw.Draw(im)
    d.rectangle([0, 520, im.width, 1088], fill=im.getpixel((900, 700)))
    return im


def fix_expiry(im):
    """임박 재료 시트 위쪽 흐린 배경(세로로 긴 캔버스에서만 보임)의 「종류별로 묶기」 노란 토글·임박 배지 줄을 배경색으로 덮는다."""
    im = im.copy()
    ImageDraw.Draw(im).rectangle([0, 520, im.width, 770], fill=im.getpixel((1280, 650)))
    return im


def fix_coach(im):
    """쿡 코치 카드 아래(카드와 화면 아래 사이 12px)에 비치는 뒤 화면 조각(쿠팡 파트너스 안내 글 등)을 흐린 배경색으로 덮는다. 카드는 그대로."""
    im = im.copy()
    px = im.load()
    x = im.width // 2
    y = im.height - 1
    while y > 0 and sum(px[x, y][:3]) > 150:  # 아래에서 위로: 카드(검정) 맨 아랫변을 찾는다
        y -= 1
    bg = px[3, min(im.height - 1, y + 8)]
    ImageDraw.Draw(im).rectangle([0, y + 3, im.width, im.height], fill=bg)
    return im


FIXES = {"chat": fix_chat, "photo": fix_photo, "expiry": fix_expiry, "coach": fix_coach}


def build_screen(slide, pw):
    """v2.build_screen 과 같되, 캡처에 `fix` 가 지정돼 있으면 먼저 정리한다."""
    src = slide["src_short"] if slide.get("_short") and "src_short" in slide else slide["src"]  # 9:16(플레이)용으로 따로 찍은 캡처가 있으면 그것
    im = Image.open(os.path.join(SRC, src)).convert("RGB")
    if slide.get("fix"):
        im = FIXES[slide["fix"]](im)
    sc = pw / im.width
    css = pw / 430.0
    cut_css = slide["cut"]
    if "cut_short" in slide and slide.get("_short"):
        cut_css = slide["cut_short"]
    cut = int(cut_css * 3)
    body = im.crop((0, cut, im.width, im.height)).resize((pw, int((im.height - cut) * sc)), Image.LANCZOS)
    bg = body.getpixel((6, 4))
    fg = INK if v2.lum(bg) > 110 else (255, 255, 255)
    st = v2.status_bar(pw, int(48 * css), bg, fg, css)
    out = Image.new("RGB", (pw, st.height + body.height), bg)
    out.paste(st, (0, 0))
    out.paste(body, (0, st.height))
    return out, st.height


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
    ImageDraw.Draw(sh).rounded_rectangle([px0, y + int(pw * 0.012), px0 + pw, bottom], radius=radius, fill=(0, 0, 0, 150 if band == "k" else 46))
    sh = sh.filter(ImageFilter.GaussianBlur(int(pw * (0.028 if band == "k" else 0.045))))
    img.paste(sh, (0, 0), sh)
    img.paste(shot, (px0, y), mask)
    if band == "k":
        ImageDraw.Draw(img).rounded_rectangle([px0, y, px0 + pw - 1, bottom - 1], radius=radius, outline=(66, 66, 72), width=max(2, img.width // 380))
    return bottom


def flow_chips(img, W, y, band):
    """조리 순서 장의 흐름 칩: 원문 → 요약 → 읽어 주기(단계 수는 쓰지 않는다 — 레시피마다 다르다). 반환: 다음 요소의 y."""
    d = ImageDraw.Draw(img)
    pad = int(W * PAD)
    h = int(W * 0.088)
    f = font(int(W * 0.0385), 800)
    fb = font(int(W * 0.0385), 900)
    gap = int(W * 0.045)
    items = [("원문", "dim"), ("요약", "hi"), ("읽어 주기", "dim")]
    x = pad
    for i, (t, kind) in enumerate(items):
        ff = fb if kind == "hi" else f
        tw = d.textlength(t, font=ff)
        w = int(tw + h * 0.9)
        if band == "y":  # 노랑 바탕: 강조 칩은 검정 바탕+노랑 글자, 나머지는 옅은 노랑 칩+검정 글자
            if kind == "hi":
                d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=INK)
                col = BRAND
            else:
                d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=(255, 238, 140), outline=(26, 26, 30), width=3)
                col = INK
        elif kind == "hi":
            d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=BRAND)
            col = INK
        else:
            d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=(46, 46, 52), outline=(84, 84, 92), width=2)
            col = (226, 226, 232)
        d.text((x + w / 2, y + h / 2 + 1), t, font=ff, fill=col, anchor="mm")
        x += w
        if i < len(items) - 1:
            ax0, ax1, ay = x + gap * 0.22, x + gap * 0.78, y + h / 2
            lw = max(3, int(W * 0.004))
            ac = (26, 26, 30) if band == "y" else (176, 176, 184)
            d.line([(ax0, ay), (ax1, ay)], fill=ac, width=lw)
            d.line([(ax1 - gap * 0.18, ay - gap * 0.18), (ax1, ay), (ax1 - gap * 0.18, ay + gap * 0.18)], fill=ac, width=lw, joint="curve")
            x += gap
    return y + h + int(W * 0.04)


def photo_cards(img, W, phone_y, pw):
    """영수증 사진 + 음식 사진을 폰 화면 위쪽 흐린 영역에 서로 겹쳐 기울여 얹고, 「영수증 · 음식 사진」 칩을 단다.
    카메라 화면에서 사진이 보이는 부분만 잘라 쓴다(노란 초점 괄호·셔터 UI 제외). 쿠팡 주문내역은 로고·상품 사진 때문에 뺐다."""
    css = pw / 430.0
    dim_top = phone_y + int(48 * css)
    dim_bot = phone_y + int((48 + 223) * css)
    mid = (dim_top + dim_bot) // 2
    cw = int(W * 0.40)
    box = (0, 706, 1206, 1400)
    # 왼쪽 영수증 · 가운데(뒤→앞) 음식 한 접시 · 오른쪽 쿠팡 주문내역(여러 식품) — 2026-11-07 「여러 음식이 있는 사진도」
    v2.paste_card(img, os.path.join(SRC, "camera_receipt.png"), box, cw, int(W * 0.5 - W * 0.285), mid - int(W * 0.03), -6)
    v2.paste_card(img, os.path.join(SRC, "camera_coupang.png"), box, cw, int(W * 0.5 + W * 0.285), mid - int(W * 0.01), 6)
    v2.paste_card(img, os.path.join(SRC, "camera_pizza_cheese.png"), box, cw, int(W * 0.5), mid + int(W * 0.03), -1)
    # 칩: 카드 아래쪽 가운데에 걸친다
    d = ImageDraw.Draw(img)
    f = font(int(W * 0.036), 900)
    txt = "영수증 · 음식 · 주문내역"
    h = int(W * 0.082)
    ic = v2.draw_icon("camera", int(h * 0.56), color=BRAND)
    tw = d.textlength(txt, font=f)
    w = int(tw + h * 0.55 + ic.width + h * 0.28 + h * 0.45)
    x = (W - w) // 2
    y = dim_bot - int(h * 1.05)
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x, y + int(h * 0.12), x + w, y + h + int(h * 0.12)], radius=h // 2, fill=(0, 0, 0, 90))
    base = img.convert("RGBA")
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(h * 0.16))))
    img.paste(base.convert("RGB"))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([x, y, x + w, y + h], radius=h // 2, fill=INK)
    img.paste(ic, (int(x + h * 0.45), int(y + (h - ic.height) / 2)), ic)
    d.text((x + h * 0.45 + ic.width + h * 0.28, y + h / 2 + 1), txt, font=f, fill=WHITE, anchor="lm")


def render_phone_slide(slide, W, H, hsize):
    band = slide["band"]
    img = bg_image(W, H, band)
    slide2 = dict(slide, _short=H / W <= 2.0)  # 9:16(플레이)은 세로가 짧아 cut_short 가 있으면 그것을 쓴다
    kind = slide.get("kind")
    # 세로로 긴 캔버스에서 화면이 짧아 머리말과 폰 사이가 너무 벌어지면 폰을 조금 키운다(0.86W → 최대 0.92W).
    for ratio in (0.86, 0.88, 0.90, 0.92):
        pw = int(W * ratio)
        px0 = (W - pw) // 2
        screen, _ = build_screen(slide2, pw)
        radius = int(pw * 0.075)
        probe0 = Image.new("RGB", (W, H))
        y_e = header(probe0, slide, W, hsize)
        if kind == "ai":
            y_e = ai_cards(probe0, W, y_e, band)
        elif kind == "cook":
            y_e = flow_chips(probe0, W, y_e, band)
        if (H + int(radius * 0.6) - screen.height) - y_e <= int(W * 0.09):
            break

    def top(target):
        y = header(target, slide, W, hsize)
        if kind == "ai":
            y = ai_cards(target, W, y, band)
        elif kind == "cook":
            y = flow_chips(target, W, y, band)
        return y

    probe = Image.new("RGB", (W, H))
    y_end = top(probe)
    # 세로로 긴 캔버스에서 화면이 짧으면 폰을 아래로 내려 머리말과의 간격으로 흡수한다(머리말 위치는 모든 장에서 같게).
    extra = max(0, (H + int(radius * 0.6) - screen.height) - y_end)
    y = top(img)
    y += min(extra, int(W * 0.22))
    paste_phone(img, screen, px0, y, pw, radius, band)
    if kind == "photo":
        photo_cards(img, W, y, pw)
    if slide.get("badge") == "sound":
        img = v1.paste_sound_badge(img, W, int(W * 0.79), int(W * (0.075 + 0.105 + 0.04) + hsize * 1.0))
    return img


# ---------------------------------------------------------------------------
# 첫 장(브랜드 장) 2026-11-07 재디자인: 타이포가 주인공, 로고는 앱 헤더의 워드마크(CookMatch)만 작게, 아래는 앱의 실제 목록 카드.
# 시안 3개(A·B·C)를 만들어 하나를 정식 01_brand 로 쓴다 — BRAND_VARIANT 로 고른다. 장식(타일·형광펜 띠·알약·반짝임)은 모두 뺐다.
# ---------------------------------------------------------------------------
BRAND_VARIANT = "A"
BRAND_DIR = os.path.join(STORE, "brand")  # 새 로고(P1 확정) 공용 자산 — store/make_brand_assets.py 가 만든다(마크를 여기서 다시 그리지 않는다)
YELLOW_SHEET_TILE = "cookmatch_mark_1024.png"  # 노랑 장 락업 타일 — 옅은 판(정식). "cookmatch_mark_reverse_1024.png"(검정 바탕판)로 바꾸면 더 진하게 보인다
CARD_FILES = ["card12_v3.png", "card9_v3.png", "card2_v3.png"]  # 냉장고요리 목록의 실제 카드 캡처(폰 화면 밖, 카드만)


def lockup(height, dark):
    """새 락업(P1 확정): 마크 타일 + 「쿡매치 CookMatch」 글자를 가로로 붙인 RGBA. dark=True 면 검정 장(타일 + 노랑 글자),
    False 면 노랑 장(타일 + 검정 글자). 타일은 두 장 모두 메인 앱 아이콘(옅은 판: 흰 타일 + 노랑 재료, 2026-11-08) —
    흰 타일이라 검정 위에서도 노랑 위에서도 사라지지 않는다(예전 노랑 타일은 노랑 장에서 사라져 검정 바탕판을 썼다).
    타일은 모서리 없는 정사각 PNG 에 iOS 식 둥근 모서리(22.37%)를 씌운다."""
    tile = Image.open(os.path.join(BRAND_DIR, YELLOW_SHEET_TILE if not dark else "cookmatch_mark_1024.png")).convert("RGBA")
    tile = tile.resize((height, height), Image.LANCZOS)
    m = Image.new("L", (height * 4, height * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, height * 4 - 1, height * 4 - 1], radius=int(height * 4 * 0.2237), fill=255)
    tile.putalpha(m.resize((height, height), Image.LANCZOS))
    wm = Image.open(os.path.join(BRAND_DIR, "wordmark_on_black.png" if dark else "wordmark_on_yellow.png")).convert("RGBA")
    wh = int(height * 0.47)
    wm = wm.resize((int(wm.width * wh / wm.height), wh), Image.LANCZOS)
    gap = int(height * 0.20)
    out = Image.new("RGBA", (height + gap + wm.width, height), (0, 0, 0, 0))
    out.alpha_composite(tile, (0, 0))
    out.alpha_composite(wm, (height + gap, int(height * 0.47)))  # 락업 시안(가로형)과 같은 높이 — 글자 줄이 타일 가운데보다 약간 아래
    return out


def card_image(name, cw, radius):
    """앱 목록 카드 캡처를 폭 cw 로 맞춰 둥근 모서리 RGBA 로. 아래 가장자리에 걸치는 다음 카드 띠는 잘라 낸다."""
    im = Image.open(os.path.join(SRC, name)).convert("RGB")
    ye = im.height - 1
    while ye > 0 and im.getpixel((im.width * 3 // 4, ye))[:3] != (255, 255, 255):  # 카드 아래 회색 틈(다음 카드와의 간격)은 잘라 낸다
        ye -= 1
    im = im.crop((0, 0, im.width, ye + 1))
    h = int(im.height * cw / im.width)
    im = im.resize((cw, h), Image.LANCZOS)
    m = Image.new("L", (cw * 2, h * 2), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, cw * 2 - 1, h * 2 - 1], radius=radius * 2, fill=255)
    out = im.convert("RGBA")
    out.putalpha(m.resize((cw, h), Image.LANCZOS))
    return out


def place_card(img, card, x, y, dark, blur=None):
    """카드를 그림자와 함께 올린다(캔버스 밖으로 나가는 부분은 알아서 잘린다)."""
    cw, ch = card.size
    r = int(cw * 0.045)
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([x, y + int(cw * 0.014), x + cw, y + ch + int(cw * 0.014)], radius=r,
                                         fill=(0, 0, 0, 170) if dark else (70, 50, 0, 70))
    img.alpha_composite(sh.filter(ImageFilter.GaussianBlur(blur or int(cw * 0.035))))
    img.alpha_composite(card, (x, y))
    if dark:
        ImageDraw.Draw(img).rounded_rectangle([x, y, x + cw - 1, y + ch - 1], radius=r, outline=(66, 66, 72), width=max(2, img.width // 380))


def brand_text(img, W, hsize, ink, sub, accent, bigk=0.17, pad=None, ytop=None, wm_color=None):
    """워드마크 + 헤드라인(인기 레시피만 / 큰 4만 개, / 뭘 골라도 맛집) + 보조 두 줄. 반환: 다음 y.
    워드마크·헤드라인 첫 줄 위치는 다른 장(아이콘 원 + 헤드라인)과 같게 맞춘다."""
    d = ImageDraw.Draw(img)
    D = int(W * 0.105)
    y0 = int(W * 0.075)  # 다른 장(아이콘 원 + 헤드라인)의 머리말 위치 — 헤드라인 첫 줄 기준
    lk = lockup(int(W * 0.125), dark=(wm_color or ink) != INK)
    img.alpha_composite(lk, (int(W * PAD), int(W * 0.06)))  # 락업은 머리말 줄보다 약간 위·크게(마크가 읽히게)
    pad = pad if pad is not None else int(W * PAD)
    y = ytop if ytop is not None else y0 + D + int(W * 0.04)
    f = font(hsize, 900)
    d.text((pad, y), "인기 레시피만", font=f, fill=ink)
    y += int(hsize * 1.26)
    big = int(W * bigk)
    fb = font(big, 800)  # 900 + 너무 큰 크기는 세로로 늘어나 보였다(2026-11-08) — 크기를 줄이고 한 단계 가볍게
    d.text((pad - int(big * 0.03), y - int(big * 0.04)), "4만 개,", font=fb, fill=accent)
    y += int(big * 1.2)  # 쉼표가 다음 줄(뭘 골라도 맛집)을 침범하지 않게
    d.text((pad, y), "뭘 골라도 맛집", font=f, fill=ink)
    y += int(hsize * 1.26) + int(W * 0.012)
    sf = font(int(W * 0.0375), 600)
    for t in ["네이버·유튜브에서 매일 엄선한 레시피를", "냉장고 속 재료로 바로 찾아요"]:
        d.text((pad, y), t, font=sf, fill=sub)
        y += int(W * 0.058)
    return y


def render_brand(W, H, hsize, variant=None):
    variant = variant or BRAND_VARIANT
    dark = variant == "B"
    img = bg_image(W, H, "k" if dark else "y").convert("RGBA")
    gap = int(W * 0.05)
    if variant == "C":
        # C: 검은 둥근 판(벤토 칸) 안에 글, 그 아래 노란 바탕 위에 실제 카드 — 워드마크는 판 밖 위쪽에 작게
        cw = int(W * 0.86)
        px = (W - cw) // 2
        top = int(W * 0.075) + int(W * 0.105) + int(W * 0.02)
        probe = Image.new("RGBA", (W, H))
        iy = brand_text(probe, W, hsize, WHITE, (170, 170, 178), BRAND, bigk=0.16, pad=px + int(W * 0.06), ytop=top + int(W * 0.055), wm_color=INK)
        bottom = iy + int(W * 0.035)
        ImageDraw.Draw(img).rounded_rectangle([px, top, px + cw, bottom], radius=int(W * 0.06), fill=INK)
        y_end = brand_text(img, W, hsize, WHITE, (170, 170, 178), BRAND, bigk=0.16, pad=px + int(W * 0.06), ytop=top + int(W * 0.055), wm_color=INK)
        y_end = bottom - int(W * 0.015)
    elif dark:
        y_end = brand_text(img, W, hsize, WHITE, (170, 170, 178), BRAND)
    else:
        y_end = brand_text(img, W, hsize, INK, SUB_Y, INK)
    # 목록 카드 두세 장을 쌓아 아래로 흘려 보낸다(폰 프레임 없음)
    cw = int(W * 0.86)
    x = (W - cw) // 2
    y = y_end + gap
    for nm in CARD_FILES:
        c = card_image(nm, cw, int(cw * 0.045))
        place_card(img, c, x, y, dark)
        y += c.height + int(W * 0.035)
        if y > H:
            break
    return img.convert("RGB")


def render_slide(slide, W, H, hsize):
    if slide.get("kind") == "brand":
        return render_brand(W, H, hsize)
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


def make_brand_alts():
    """첫 장 시안 A·B·C(Play 1080x1920) → screenshots_v3/alt/01_*.png + 비교 이미지 upload_packages/v3_first_slide_시안비교.png.
    비교 이미지: 윗줄 시안 3장(크게), 아랫줄 「스토어 목록에서 작게 보일 때」(첫 장 시안 + 2·3번 장)."""
    W, H = SIZES["play"]
    hs = headline_size(W)
    alt = os.path.join(STORE, "screenshots_v3", "alt")
    os.makedirs(alt, exist_ok=True)
    shots = []
    for v in "ABC":
        im = render_brand(W, H, hs, v)
        save_png(im, os.path.join(alt, f"01_{v}.png"))
        shots.append(im)
    nxt = [Image.open(os.path.join(STORE, "screenshots_v3", "play", f)) for f in ("02_match.png", "03_ai.png")]
    out = os.path.join(STORE, "upload_packages")
    os.makedirs(out, exist_ok=True)
    cw, ch, g, top = 400, 711, 20, 56
    sw = 128
    sh_ = int(sw * 16 / 9)
    canvas = Image.new("RGB", (3 * cw + 4 * g, top + ch + 3 * g + 36 + sh_ + g), (255, 255, 255))
    d = ImageDraw.Draw(canvas)
    titles = {"A": "A  노랑 · 큰 숫자 + 카드 쌓기", "B": "B  검정 · 노랑 숫자 + 카드 쌓기", "C": "C  노랑 · 검은 판 안의 글 + 카드"}
    for i, (v, im) in enumerate(zip("ABC", shots)):
        x = g + i * (cw + g)
        d.text((x, top // 2), titles[v] + ("  (정식 채택)" if v == BRAND_VARIANT else ""), font=font(20, 900), fill=INK, anchor="lm")
        canvas.paste(im.resize((cw, ch), Image.LANCZOS), (x, top))
        if v == BRAND_VARIANT:
            d.rectangle([x - 3, top - 3, x + cw + 2, top + ch + 2], outline=BRAND, width=3)
    y2 = top + ch + 2 * g
    d.text((g, y2), "스토어 목록에서 작게 보일 때(시안 + 이어지는 2·3번 장):", font=font(16, 700), fill=INK, anchor="lm")
    for i, im in enumerate(shots):
        x = g + i * (cw + g) + (cw - (3 * sw + 2 * 8)) // 2
        for pic in [im] + nxt:
            canvas.paste(pic.resize((sw, sh_), Image.LANCZOS), (x, y2 + 24))
            x += sw + 8
    canvas.save(os.path.join(out, "v3_first_slide_시안비교.png"))
    print("brand alts ok")


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
    d.text((lab, hh // 2), "위: v2(흰 배경 당근 스타일, 첫 장 레시피 사진 콜라주) / 아래: v3(노랑·검정 우리 스타일, 첫 장 타이포+아이콘 타일, 순서 재배치·음식 사진·썸네일 선명)", font=font(16, 700), fill=INK, anchor="lm")
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


def make_before_after(before_dir):
    """이전 v3(before_dir 의 PNG 8장, 파일명 순)와 지금 v3 의 변경 전후 비교(윗줄 이전·아랫줄 새). store/upload_packages/ (untracked)."""
    import glob
    out = os.path.join(STORE, "upload_packages")
    old = sorted(glob.glob(os.path.join(before_dir, "*.png")))
    new = sorted(glob.glob(os.path.join(STORE, "screenshots_v3", "play", "*.png")))
    W, H, g, lab, hh = 270, 480, 12, 90, 50
    im = Image.new("RGB", (lab + 8 * (W + g) + g, hh + 2 * (H + g) + g), (255, 255, 255))
    d = ImageDraw.Draw(im)
    d.text((lab // 2, hh + H // 2), "이전 v3", font=font(22, 900), fill=(120, 120, 126), anchor="mm")
    d.text((lab // 2, hh + H + g + H // 2), "새 v3", font=font(22, 900), fill=INK, anchor="mm")
    d.text((lab, hh // 2), "위: 이전 v3 / 아래: 새 v3 (순서·헤드라인·음식 사진·썸네일 선명·노란 조각 제거)", font=font(16, 700), fill=INK, anchor="lm")
    for r, files in enumerate([old, new]):
        for i, f in enumerate(files):
            x, y = lab + g + i * (W + g), hh + r * (H + g)
            im.paste(Image.open(f).resize((W, H), Image.LANCZOS), (x, y))
    im.save(os.path.join(out, "v3_before_after_비교.png"))
    print("before/after ok")


if __name__ == "__main__":
    args = sys.argv[1:]
    make_shots(only_play="preview" in args)
    if "preview" not in args:
        make_packages()
        make_brand_alts()
    if "--before" in args:
        make_before_after(args[args.index("--before") + 1])
