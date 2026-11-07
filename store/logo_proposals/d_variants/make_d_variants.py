# -*- coding: utf-8 -*-
"""D안(그릇 + 맞는 재료) 변형 시안 D1~D8 생성기 — 제안 전용(운영 자산 변경 없음).

    PYTHONIOENCODING=utf-8 python store/logo_proposals/d_variants/make_d_variants.py

부모 폴더의 make_logo_proposals.py 의 도구(마스크·글꼴·미리보기)를 그대로 쓰고,
결과는 store/logo_proposals/d_variants/ 안에만 쓴다.

공통 원칙(모든 변형): 한 변형 안의 모서리 반지름·간격은 같은 수(gap)의 배수, 심볼은 같은 크기(가로 ≤ 660)로
맞춰 비교가 공정하도록 fit() 으로 중앙·크기 정규화.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import make_logo_proposals as L  # noqa: E402
from PIL import Image, ImageChops, ImageDraw  # noqa: E402

SS, P = L.SS, L.P
GREEN = (62, 178, 108)
for _v in L.PALS.values():
    _v["leaf"] = GREEN


# ---------------------------------------------------------------- 공통 부품
def fit(layers, target=660, oy=0):
    """레이어 전체의 경계상자를 재서 같은 크기로 줄이고 캔버스 한가운데에 놓는다."""
    bb = None
    for m, _ in layers:
        b = m.getbbox()
        if b:
            bb = b if bb is None else (min(bb[0], b[0]), min(bb[1], b[1]), max(bb[2], b[2]), max(bb[3], b[3]))
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    k = target * SS / max(w, h * 1.12)
    out = []
    size = 1024 * SS
    for m, c in layers:
        g = m.crop(bb).resize((max(1, int(w * k)), max(1, int(h * k))), Image.LANCZOS)
        canvas = Image.new("L", (size, size), 0)
        canvas.paste(g, ((size - g.width) // 2, (size - g.height) // 2 + P(oy)))
        out.append((canvas, c))
    return out


def bowl_mask(R, rim, trunc, cx=512):
    m = L.new_mask()
    L.circle(m, cx, rim, R)
    cut = L.new_mask()
    d = ImageDraw.Draw(cut)
    d.rectangle([0, 0, P(1024), P(rim)], fill=255)
    d.rectangle([0, P(rim + trunc), P(1024), P(1024)], fill=255)
    return ImageChops.subtract(m, cut)


def bowl_ball(pal, R=320, ball_r=160, gap=20, trunc=288, rim=448, seat=0, lift=0, ball_col=None,
              rr=8, bowl_col=None, ball_shape=None):
    """그릇(반원을 평평하게 자른 것) + 윗면을 파낸 자리에 앉는 둥근 재료. seat = 공 중심이 윗선보다 위로 몇(+)."""
    cy = rim - seat
    bowl = bowl_mask(R, rim, trunc)
    sock = L.new_mask()
    if ball_shape == "egg":
        egg(sock, 512, cy, ball_r, extra=gap)
    else:
        L.circle(sock, 512, cy, ball_r + gap)
    bowl = ImageChops.subtract(bowl, sock)
    bowl = L.round_mask(bowl, rr * SS)
    ball = L.new_mask()
    if ball_shape == "egg":
        egg(ball, 512, cy - lift, ball_r)
    else:
        L.circle(ball, 512, cy - lift, ball_r)
    return bowl, ball, cy - lift


def egg(m, cx, cy, r, extra=0):
    """달걀 모양(위가 좁고 아래가 넓다). r = 기준 반지름(너비의 절반), extra = 바깥으로 넓힌 양."""
    a, b = r * 0.96 + extra, r * 1.22 + extra
    pts = []
    for i in range(240):
        t = 2 * math.pi * i / 240
        s = math.sin(t)
        x = a * math.cos(t) * (1 - 0.17 * s)
        y = -b * s
        pts.append((P(cx + x), P(cy + y)))
    ImageDraw.Draw(m).polygon(pts, fill=255)


def lens(cx, cy, length, width, angle_deg):
    """잎 모양(두 원의 교집합) 마스크 — 중심 (cx,cy), 가로로 만든 뒤 angle 만큼 반시계로 돌림."""
    rr = (length ** 2 / 4 + width ** 2 / 4) / width           # 두 원의 반지름
    off = rr - width / 2
    a, b = L.new_mask(), L.new_mask()
    L.circle(a, cx, cy + off, rr)
    L.circle(b, cx, cy - off, rr)
    m = L.round_mask(ImageChops.multiply(a, b), 5 * SS)
    return m.rotate(angle_deg, resample=Image.BICUBIC, center=(P(cx), P(cy)))


# ---------------------------------------------------------------- D1~D8
def layers_D1(pal):
    """D1 기하 정리 — 그릇 반지름 R=320, 공 반지름 R/2, 간격=모서리 반지름=20 한 체계. 평평한 바닥."""
    bowl, ball, _ = bowl_ball(pal)
    return fit([(bowl, pal["main"]), (ball, pal["second"])])


def layers_D2(pal):
    """D2 하나의 덩어리 — 그릇과 재료가 같은 색, 사이는 가는 초승달 간격뿐(밥 한 공기 실루엣)."""
    bowl, ball, _ = bowl_ball(pal, R=320, ball_r=190, seat=28, trunc=290, rim=470)
    return fit([(bowl, pal["main"]), (ball, pal["main"])])


def d3_geom(pal, lift=0):
    """D3 도형: 공이 주인공(반지름 172), 그릇은 받치는 얇은 바닥(밑 두께 72), 잎은 기울어진 렌즈."""
    bowl, ball, cy = bowl_ball(pal, R=310, ball_r=172, gap=18, trunc=262, rim=470, lift=lift, rr=8)
    leaf = lens(522 + 0.574 * 88, cy - 172 + 6 - 0.819 * 88, 176, 80, 55)
    return bowl, ball, leaf, cy


def layers_D3(pal):
    """D3 포인트 색 하나 — 둥근 재료가 주인공, 그릇은 받침. 초록 잎 하나가 두 번째 색(당근의 잎 같은 역할)."""
    bowl, ball, leaf, _ = d3_geom(pal)
    return fit([(bowl, pal["main"]), (ball, pal["second"]), (leaf, pal["leaf"])])


def layers_D4(pal):
    """D4 윗면 시점 — 그릇을 위에서 본 두꺼운 고리 + 안쪽에 맞닿듯 앉은 재료."""
    ring = L.new_mask()
    L.circle(ring, 512, 512, 320)
    hole = L.new_mask()
    L.circle(hole, 512, 512, 232)
    ring = ImageChops.subtract(ring, hole)
    ang = math.radians(48)
    dist = 232 - 108 - 22
    ball = L.new_mask()
    L.circle(ball, 512, 512 + dist, 108)
    return fit([(ring, pal["main"]), (ball, pal["second"])])


def layers_D5(pal):
    """D5 알아볼 수 있는 재료 — 둥근 공 대신 달걀 한 알(위가 좁은 달걀형)이 앉는다."""
    bowl, ball, _ = bowl_ball(pal, ball_r=150, seat=62, rim=470, ball_shape="egg")
    return fit([(bowl, pal["main"]), (ball, pal["second"])])


def layers_D6(pal):
    """D6 김 한 줄 — D2(한 덩어리) 위로 곡선 하나. ✦ 대신 가장 단순한 김."""
    bowl, ball, cy = bowl_ball(pal, R=320, ball_r=190, seat=28, trunc=290, rim=470)
    steam = L.new_mask()
    d = ImageDraw.Draw(steam)
    top = cy - 190 - 70
    pts = []
    for i in range(0, 61):
        s = i / 60
        pts.append((512 + 34 * math.sin(s * 2 * math.pi), top - 150 * s))
    wdt = 40
    d.line([(P(x), P(y)) for x, y in pts], fill=255, width=P(wdt), joint="curve")
    for x, y in (pts[0], pts[-1]):
        d.ellipse([P(x - wdt / 2), P(y - wdt / 2), P(x + wdt / 2), P(y + wdt / 2)], fill=255)
    return fit([(bowl, pal["main"]), (ball, pal["main"]), (steam, pal["second"])])


def layers_D7(pal):
    """D7 쿡 글자 — 공 안에 「ㅋ」(쿡의 첫 자음이자 웃음). 이름 + 웃음을 재료에 담는다."""
    bowl, ball, cy = bowl_ball(pal, R=330, ball_r=185, gap=22, trunc=300, rim=470, seat=0)
    g = L.glyph_mask("ㅋ", 150, weight=900, rnd=0.012)
    g = ImageChops.offset(g, 0, P(cy - 512))
    return fit([(bowl, pal["main"]), (ball, pal["second"]), (g, pal["main"])])


def layers_D8(pal):
    """D8 극미니멀 — 굵은 선 하나(둥근 끝)로 그릇을 암시하고 원 하나만. 모든 곡선이 같은 선 굵기의 반."""
    cy0, R_out, R_in = 470, 300, 200
    arc = L.new_mask()
    L.circle(arc, 512, cy0, R_out)
    hole = L.new_mask()
    L.circle(hole, 512, cy0, R_in)
    cut = L.new_mask()
    ImageDraw.Draw(cut).rectangle([0, 0, P(1024), P(cy0)], fill=255)
    arc = ImageChops.subtract(ImageChops.subtract(arc, hole), cut)
    for sx in (-1, 1):
        L.circle(arc, 512 + sx * 250, cy0, 50)
    ball = L.new_mask()
    L.circle(ball, 512, cy0 + 40, 130)
    return fit([(arc, pal["main"]), (ball, pal["second"])])


VARS = {
    "D1": ("기하 정리", layers_D1),
    "D2": ("한 덩어리(밥 한 공기)", layers_D2),
    "D3": ("잎 포인트", layers_D3),
    "D4": ("윗면 시점", layers_D4),
    "D5": ("달걀", layers_D5),
    "D6": ("김 한 줄", layers_D6),
    "D7": ("그릇+ㅋ", layers_D7),
    "D8": ("극미니멀", layers_D8),
}
for k, (nm, fn) in VARS.items():
    L.LAYERS[k] = fn
    L.NAMES[k] = nm


# ---------------------------------------------------------------- 비교판
def ic(key, v):
    return L.icon(key, v)


def comparison():
    keys = ["D"] + list(VARS)
    rowh = 300
    W = 2300
    sheet = Image.new("RGB", (W, 130 + rowh * len(keys) + 20), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "D안 변형 D1~D8 — 노랑·검정·옅은 바탕, 실제 크기(120·60·29px)", (40, 30), 40, (20, 20, 24), 800)
    heads = [("노랑 바탕", 330), ("검정 바탕", 600), ("옅은 바탕", 870), ("실제 크기 — 밝은 배경", 1170), ("어두운 배경", 1620)]
    for t, x in heads:
        L.label(sheet, t, (x, 96), 20, (110, 110, 118), 600)
    for r, k in enumerate(keys):
        y = 130 + r * rowh
        d.line([(40, y), (W - 40, y)], fill=(225, 225, 225), width=2)
        nm = "D (기존)" if k == "D" else f"{k}"
        L.label(sheet, nm, (50, y + 100), 40, (20, 20, 24), 800)
        if k != "D":
            L.label(sheet, VARS[k][0], (50, y + 160), 22, (110, 110, 118), 600)
        for (t, x), v in zip(heads[:3], ("yellow", "ink", "light")):
            im = L.with_corners(ic(k, v), 240)
            if v == "light":
                d.rounded_rectangle([x - 1, y + 29, x + 240, y + 270], radius=54, outline=(228, 228, 226), width=2)
            sheet.paste(im.convert("RGB"), (x, y + 30), im.split()[3])
        for bx, bgc, vs in ((1170, (246, 246, 244), ("yellow", "light")), (1620, (40, 40, 46), ("ink",))):
            d.rectangle([bx, y + 40, bx + 420, y + 260], fill=bgc)
            x = bx + 20
            for v in vs:
                for s in (120, 60, 29):
                    im = L.with_corners(ic(k, v), s)
                    sheet.paste(im.convert("RGB"), (x, y + 40 + (220 - s) // 2), im.split()[3])
                    x += s + 14
                x += 14
    return sheet


def home_wide(variant, scale=0.8):
    keys = ["D"] + list(VARS)
    cols, rows = 5, 4
    icon_s, gx, gy = 150, 70, 120
    w = cols * icon_s + (cols + 1) * gx
    h = rows * (icon_s + gy) + 200
    scr = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    d = ImageDraw.Draw(scr)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(70 + 90 * t), int(110 + 30 * t), int(190 - 30 * t), 255))
    d.ellipse([-200, h - 500, 900, h + 400], fill=(255, 150, 120, 60))
    slots = [1, 3, 5, 7, 8, 10, 12, 14, 16, 18]
    names = dict(zip(slots, keys))
    gi = 0
    for i in range(cols * rows):
        r, c = divmod(i, cols)
        x = gx + c * (icon_s + gx)
        y = 90 + r * (icon_s + gy)
        if i in names:
            k = names[i]
            scr.alpha_composite(L.with_corners(ic(k, variant), icon_s), (x, y))
            lab = "D(기존)" if k == "D" else k
            d.text((x + icon_s // 2, y + icon_s + 24), lab, font=L.font(26, 800), fill=(255, 255, 255, 255), anchor="mt")
        else:
            nm, col, shp = L.APP_TILES[gi % len(L.APP_TILES)]
            gi += 1
            scr.alpha_composite(L.generic_tile(icon_s, col, shp), (x, y))
            d.text((x + icon_s // 2, y + icon_s + 24), nm, font=L.font(24, 600), fill=(255, 255, 255, 220), anchor="mt")
    out = scr.convert("RGB")
    return out.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


def slides():
    keys = ["D"] + list(VARS)
    tw, th = 640, 620
    sheet = Image.new("RGB", (len(keys) * tw + (len(keys) + 1) * 20, 2 * th + 60), (230, 230, 228))
    for i, k in enumerate(keys):
        nm = "D(기존)" if k == "D" else f"{k} {VARS[k][0]}"
        t = L.slide_top(ic(k, "ink"), L.wordmark(k, "yellow"), "y", nm + " · 노랑 장", tw, th)
        sheet.paste(t.convert("RGB"), (20 + i * (tw + 20), 20))
        t = L.slide_top(ic(k, "yellow"), L.wordmark(k, "ink"), "k", nm + " · 검정 장", tw, th)
        sheet.paste(t.convert("RGB"), (20 + i * (tw + 20), 20 + th + 20))
    return sheet.resize((int(sheet.width * 0.5), int(sheet.height * 0.5)), Image.LANCZOS)


# ---------------------------------------------------------------- 스티커(확장)
def sticker_layers(key, pal, mode):
    """추천 안의 둥근 조각 문법으로 만든 스티커 4종: 떨어지는 중 / 딱 맞음 / 따끈(김) / 신남(ㅋㅋ)."""
    lift = 0 if mode != "drop" else 150
    if key == "D3":
        bowl, ball, leaf, cy = d3_geom(pal, lift)
        ls = [(bowl, pal["main"]), (ball, pal["second"]), (leaf, pal["leaf"])]
    else:
        bowl, ball, cy = bowl_ball(pal, lift=lift)
        ls = [(bowl, pal["main"]), (ball, pal["second"])]
    if mode == "drop":  # 움직임 줄 두 개
        for dx in (-70, 70):
            m = L.new_mask()
            ImageDraw.Draw(m).line([(P(512 + dx), P(cy - 270)), (P(512 + dx), P(cy - 215))], fill=255, width=P(26))
            L.circle(m, 512 + dx, cy - 270, 13)
            L.circle(m, 512 + dx, cy - 215, 13)
            ls.append((m, pal["main"]))
    elif mode == "check":
        m = L.new_mask()
        ImageDraw.Draw(m).line([(P(450), P(cy - 5)), (P(500), P(cy + 45)), (P(580), P(cy - 55))], fill=255, width=P(40), joint="curve")
        for x, y in ((450, cy - 5), (580, cy - 55)):
            L.circle(m, x, y, 20)
        ls.append((m, pal["main"]))
    elif mode == "steam":
        m = L.new_mask()
        d = ImageDraw.Draw(m)
        sx = -95 if key == "D3" else 0
        pts = [(512 + sx + 30 * math.sin(s / 50 * 2 * math.pi), cy - 215 - 130 * s / 50) for s in range(51)]
        d.line([(P(x), P(y)) for x, y in pts], fill=255, width=P(34), joint="curve")
        for x, y in (pts[0], pts[-1]):
            L.circle(m, x, y, 17)
        ls.append((m, pal["main"]))
    elif mode == "laugh":
        g = L.glyph_mask("ㅋ", 120, weight=900, rnd=0.012)
        g = ImageChops.offset(g, 0, P(cy - 512))
        ls.append((g, pal["main"]))
    return fit(ls, target=560)


def sticker_sheet(key="D1"):
    modes = [("drop", "쏙 들어간다"), ("check", "딱 맞음"), ("steam", "따끈"), ("laugh", "ㅋㅋ")]
    W = 1400
    sheet = Image.new("RGB", (W, 360), (232, 232, 230))
    L.label(sheet, f"{key} 스티커·이모지 시안 (1:1, 투명 배경 PNG 로도 뽑을 수 있음)", (24, 18), 26, (30, 30, 34), 800)
    x = 24
    for mode, nm in modes:
        for v, bgc in (("yellow", None),):
            pal = L.PALS["yellow"]
            ls = sticker_layers(key, pal, mode)
            im = L.compose(pal["bg"], ls, 1024).resize((250, 250), Image.LANCZOS).convert("RGBA")
            im.putalpha(L.circle_mask_img(250))
            sheet.paste(im.convert("RGB"), (x, 60), im.split()[3])
            L.label(sheet, nm, (x + 125, 322), 20, (60, 60, 66), 700, "mm")
        x += 262
    # 검정 버전 한 줄(작게)
    pal = L.PALS["ink"]
    x2 = x + 10
    for idx, (mode, nm) in enumerate(modes[:2]):
        ls = sticker_layers(key, pal, mode)
        im = L.compose(pal["bg"], ls, 1024).resize((120, 120), Image.LANCZOS).convert("RGBA")
        im.putalpha(L.circle_mask_img(120))
        sheet.paste(im.convert("RGB"), (x2, 70 + idx * 130), im.split()[3])
    return sheet


def extension_all(key):
    base = L.extension_sheet(key)
    if key != "D3":
        return base
    st = sticker_sheet(key)
    W = max(base.width, st.width)
    out = Image.new("RGB", (W, base.height + st.height + 10), (232, 232, 230))
    out.paste(base, (0, 0))
    out.paste(st, (0, base.height + 10))
    return out


# ---------------------------------------------------------------- 방향 대안 스케치
def alt_sketches():
    """D 방향이 안 먹힐 때의 대안 두 가지 거친 스케치 — S1 냉장고+체크, S2 말풍선 ㅋ."""
    out = Image.new("RGB", (1500, 520), (255, 255, 255))
    L.label(out, "방향 대안 스케치(거친 초안)", (30, 20), 34, (20, 20, 24), 800)

    def s1(pal):
        m = L.new_mask()
        L.rrect(m, (330, 180, 694, 850), 100)
        gapm = L.new_mask()
        L.rrect(gapm, (330, 400, 694, 428), 0)
        chk = L.new_mask()
        ImageDraw.Draw(chk).line([(P(430), P(650)), (P(500), P(720)), (P(610), P(580))], fill=255, width=P(52), joint="curve")
        for x, y in ((430, 650), (610, 580)):
            L.circle(chk, x, y, 26)
        h1 = L.new_mask()
        L.rrect(h1, (610, 270, 636, 360), 13)
        h2 = L.new_mask()
        L.rrect(h2, (610, 470, 636, 560), 13)
        for h in (gapm, chk, h1, h2):
            m = ImageChops.subtract(m, h) if h is not None else m
        return fit([(m, pal["main"])])

    def s2(pal):
        m = L.new_mask()
        L.rrect(m, (190, 240, 834, 720), 200)
        ImageDraw.Draw(m).polygon([(P(330), P(700)), (P(300), P(850)), (P(470), P(720))], fill=255)
        g = L.glyph_mask("ㅋ", 300, weight=900, rnd=0.012)
        g = ImageChops.offset(g, 0, P(-20))
        gm = L.new_mask()
        gm.paste(g, (0, 0))
        m = ImageChops.subtract(m, gm)
        return fit([(m, pal["main"])])

    x = 40
    for fn, nm in ((s1, "S1 냉장고 + 체크 구멍(입력=재료, 한 덩어리)"), (s2, "S2 말풍선 속 ㅋ(대화·웃음, 쿡 코치와 이어짐)")):
        for v in ("yellow", "ink", "light"):
            pal = L.PALS[v]
            im = L.compose(pal["bg"], fn(pal), 1024)
            t = L.with_corners(im, 200)
            out.paste(t.convert("RGB"), (x, 90), t.split()[3])
            x += 230
        L.label(out, nm, (x - 3 * 230, 310), 22, (60, 60, 66), 700)
        x += 40
    return out


# ---------------------------------------------------------------- 메인
def build():
    out = HERE
    for k in VARS:
        for v, suf in (("yellow", ""), ("ink", "_reverse"), ("light", "_light")):
            ic(k, v).save(os.path.join(out, f"{k}_icon{suf}_1024.png" if suf == "" else f"{k}_icon{suf}_1024.png"))
        print("icon", k, flush=True)
    comparison().save(os.path.join(HERE, "..", "logo_D변형_비교.png"))
    home_wide("yellow").save(os.path.join(out, "logo_D변형_홈화면_노랑.png"))
    home_wide("light").save(os.path.join(out, "logo_D변형_홈화면_옅은바탕.png"))
    home_wide("ink").save(os.path.join(out, "logo_D변형_홈화면_검정.png"))
    slides().save(os.path.join(out, "logo_D변형_장_사용예.png"))
    alt_sketches().save(os.path.join(out, "alt_sketches.png"))
    for k in (sys.argv[1:] or ["D3", "D8"]):
        extension_all(k).save(os.path.join(out, f"logo_D변형_확장예시_{k}.png"))
    print("ok")


if __name__ == "__main__":
    build()
