# -*- coding: utf-8 -*-
"""D3 변형 시안 E1~E10 생성기 — 제안 전용(운영 자산 변경 없음).

    PYTHONIOENCODING=utf-8 python store/logo_proposals/d3_variants/make_d3_variants.py [확장예시 키 ...]

D3 의 고정 문법: ① 위계(재료 > 받침 그릇 > 포인트 잎) ② 둥글고 평평한 면, 내부 디테일·글자 없음
③ 노랑 바탕 + 검정 그릇 + 초록 잎 ④ 그리드·반지름 체계(간격 = 모서리 반지름 기본 18).
D3 의 약점 = 29px 에서 잎이 점이 된다 → 잎 크기·각도·색 대비를 바꿔 가며 푼다.
결과는 store/logo_proposals/d3_variants/ 안과 상위 폴더의 비교판 1장.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PARENT = os.path.dirname(HERE)
sys.path.insert(0, PARENT)
sys.path.insert(0, os.path.join(PARENT, "d_variants"))
import make_logo_proposals as L  # noqa: E402
import make_d_variants as D  # noqa: E402
from PIL import Image, ImageChops, ImageDraw  # noqa: E402

P, SS = L.P, L.SS
INK, BRAND, WHITE, LIGHT = L.INK, L.BRAND, L.WHITE, L.LIGHT
G2 = (30, 146, 82)          # D3 의 초록(62,178,108)보다 진하게 — 노랑 위 대비 1.9:1 → 2.8:1
RED = (238, 64, 58)
CORAL = (255, 150, 122)
VAR_OF = {BRAND: "yellow", INK: "ink", LIGHT: "light"}


# ---------------------------------------------------------------- 스펙
BASE = dict(R=310, ball_r=172, gap=18, trunc=262, rim=470, rr=8, bowl="rice", seat=0,
            leaf="one", leaf_len=176, leaf_wid=80, leaf_ang=55, target=660, balls=None, mono=False, ball_col=None)

SPECS = {
    "E1": ("큰 잎", dict(leaf_len=262, leaf_wid=132, leaf_ang=52, target=700),
           "D3 의 잎만 키우고 진한 초록으로. 29px 해결의 가장 단순한 길."),
    "E2": ("두 장 잎", dict(leaf="two", leaf_len=206, leaf_wid=100, target=700),
           "잎 두 장을 V 로. 면적이 늘어 작은 크기에서 읽힌다(하트형은 당근과 겹쳐 피함)."),
    "E3": ("토마토(빨강 재료)", dict(ball_col=RED, leaf_len=240, leaf_wid=120, leaf_ang=52, target=700),
           "재료만 빨강 포인트 + 큰 잎. 노랑 바탕과 대비가 가장 강하다."),
    "E4": ("복숭아(코랄 재료) + 둥근 잎", dict(ball_col=CORAL, leaf="one", leaf_len=190, leaf_wid=150, leaf_ang=62, target=700),
           "재료 코랄 + 둥근 한 장 잎. 주황은 당근과 겹쳐 코랄로."),
    "E5": ("반달 그릇", dict(bowl="rice", trunc=310, leaf_len=240, leaf_wid=120, leaf_ang=52, target=700),
           "받침을 완전한 반원(반달)로. 곡선 하나로 단순해진다."),
    "E6": ("U자 그릇이 감쌈", dict(bowl="wrap", seat=-46, leaf_len=240, leaf_wid=120, leaf_ang=52, target=700),
           "그릇이 재료를 감싸 안고 윗부분만 보인다(뚝배기 윤곽의 단순형)."),
    "E7": ("접시 위에 얹힘", dict(bowl="plate", leaf_len=240, leaf_wid=120, leaf_ang=52, target=700),
           "얇은 접시 위에 재료가 살짝 얹혔다. 가볍고 공간이 넓다."),
    "E8": ("2색 극단순", dict(mono=True, leaf_len=250, leaf_wid=124, leaf_ang=52, target=700),
           "한 가지 색의 실루엣(그릇·재료·잎 모두 같은 색) — 작은 크기 가독성 시험."),
    "E9": ("꽉 찬 크기", dict(leaf_len=282, leaf_wid=140, leaf_ang=52, target=880),
           "심볼이 캔버스를 86% 채운다(당근처럼). 안드로이드 적응형 아이콘에선 잘린다."),
    "E10": ("방울토마토 둘", dict(balls=[(-118, 128, "r1"), (126, 100, "r2")], ball_col=RED, leaf_len=200, leaf_wid=100,
                          leaf_ang=60, target=700, R=330, trunc=250),
            "재료 둘(복수) + 잎 하나. 「재료들」 느낌이지만 복잡해진다."),
}


def spec_of(key):
    s = dict(BASE)
    s.update(SPECS[key][1])
    return s


def colors(spec, variant):
    if spec["mono"]:
        c = INK if variant != "ink" else BRAND
        return dict(bowl=c, ball=c, leaf=c)
    bowl = {"yellow": INK, "ink": BRAND, "light": INK}[variant]
    ball = {"yellow": WHITE, "ink": WHITE, "light": BRAND}[variant]
    if spec["ball_col"]:
        ball = spec["ball_col"]
    return dict(bowl=bowl, ball=ball, leaf=G2)


# ---------------------------------------------------------------- 도형
def parts(spec, lift=0):
    """(bowl_mask, [ball_mask...], [leaf_mask...], cy, top) — 설계 좌표(1024)."""
    R, gap, rim, rr = spec["R"], spec["gap"], spec["rim"], spec["rr"]
    cy = rim - spec["seat"]
    balls = spec["balls"] or [(0, spec["ball_r"], None)]
    kind = spec["bowl"]
    if kind == "wrap":
        bowl = L.new_mask()
        L.rrect(bowl, (512 - 300, rim, 512 + 300, rim + 420), 210)
        ImageDraw.Draw(bowl).rectangle([P(512 - 300), P(rim), P(512 + 300), P(rim + 210)], fill=255)
    elif kind == "plate":
        bowl = L.new_mask()
        ImageDraw.Draw(bowl).ellipse([P(512 - 350), P(rim - 140), P(512 + 350), P(rim + 140)], fill=255)
        cut = L.new_mask()
        ImageDraw.Draw(cut).rectangle([0, 0, P(1024), P(rim)], fill=255)
        bowl = ImageChops.subtract(bowl, cut)
        cy = rim - gap - balls[0][1] - 4
    else:
        bowl = D.bowl_mask(R, rim, spec["trunc"])
    sock = L.new_mask()
    if kind != "plate":
        for dx, r, _ in balls:
            L.circle(sock, 512 + dx, cy - (30 if spec["balls"] and r < 110 else 0), r + gap)
        bowl = ImageChops.subtract(bowl, sock)
    bowl = L.round_mask(bowl, rr * SS)
    ball_masks = []
    tops = []
    for dx, r, tag in balls:
        yy = cy - (30 if spec["balls"] and r < 110 else 0) - lift
        m = L.new_mask()
        L.circle(m, 512 + dx, yy, r)
        ball_masks.append(m)
        tops.append((512 + dx, yy - r, r))
    # 잎: 가장 큰 재료의 위쪽에서 gap 만큼 띄워 시작
    tx, ty, tr = min(tops, key=lambda t: t[1])
    leaf_masks = []
    ln, wd, ang = spec["leaf_len"], spec["leaf_wid"], spec["leaf_ang"]
    if spec["balls"]:
        tx = 512  # 둘 사이 위쪽
        ty = min(t[1] for t in tops) - 10
    leaf_dirs = [(ang, 10)] if spec["leaf"] == "one" else [(42, 10), (138, -10)]
    for a, ox in leaf_dirs:
        ca, sa = math.cos(math.radians(a)), math.sin(math.radians(a))
        bx, by = tx + ox, ty - 12
        leaf_masks.append(D.lens(bx + ca * ln / 2, by - sa * ln / 2, ln, wd, a))
    return bowl, ball_masks, leaf_masks, cy - lift, ty


def raw_layers(spec, variant, lift=0, extras=None):
    c = colors(spec, variant)
    bowl, balls, leaves, cy, top = parts(spec, lift)
    ls = [(bowl, c["bowl"], "bowl")]
    for m in balls:
        ls.append((m, c["ball"], "ball"))
    for m in leaves:
        ls.append((m, c["leaf"], "leaf"))
    for m, col in (extras or []):
        ls.append((m, c[col] if col in c else col, "extra"))
    return ls, cy


def fit_tagged(ls, target):
    fitted = D.fit([(m, c) for m, c, _ in ls], target=target)
    return [(m, c, t) for (m, c), (_, _, t) in zip(fitted, ls)]


def make_layers(key):
    spec = spec_of(key)

    def fn(pal):
        v = VAR_OF[pal["bg"]]
        ls, _ = raw_layers(spec, v)
        return [(m, c) for m, c, _ in fit_tagged(ls, spec["target"])]
    return fn


for _k, (_nm, _s, _d) in SPECS.items():
    L.LAYERS[_k] = make_layers(_k)
    L.NAMES[_k] = _nm


def leaf_area_px(key, px=29):
    """yellow 바탕 아이콘을 px 로 줄였을 때 잎 면적(px²) — 작은 크기 가독성의 객관 지표."""
    if key == "D3":
        pal = L.PALS["yellow"]
        bowl, ball, leaf, _ = D.d3_geom(pal)
        ls = D.fit([(bowl, INK), (ball, WHITE), (leaf, G2)])
        m = ls[2][0]
    else:
        spec = spec_of(key)
        ls, _ = raw_layers(spec, "yellow")
        m = fit_tagged(ls, spec["target"])
        m = [x[0] for x in m if x[2] == "leaf"]
        m = m[0] if len(m) == 1 else None if not m else ImageChops.lighter(m[0], m[1])
    h = m.histogram()
    area = sum(i * v for i, v in enumerate(h)) / 255 / (SS * SS)
    return area * (px / 1024) ** 2


def ic(key, v):
    return L.icon(key, v)


# D3 는 기준선으로 비교판에 같이 넣는다(D.layers_D3 는 진한 초록이 아니라 원래 초록).
ALL = ["D3"] + list(SPECS)


def icon_of(key, v):
    return D.L.icon(key, v)


# ---------------------------------------------------------------- 비교판 / 홈 화면
def comparison():
    rowh = 270
    W = 2500
    sheet = Image.new("RGB", (W, 130 + rowh * len(ALL) + 20), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "D3 변형 E1~E10 — 노랑·검정·옅은 바탕, 실제 크기(120·60·29px), 29px 잎 면적", (40, 30), 38, (20, 20, 24), 800)
    heads = [("노랑 바탕", 330), ("검정 바탕", 590), ("옅은 바탕", 850), ("실제 크기 — 밝은 배경", 1130), ("어두운 배경", 1560), ("29px 잎 면적", 1980)]
    for t, x in heads:
        L.label(sheet, t, (x, 96), 20, (110, 110, 118), 600)
    for r, k in enumerate(ALL):
        y = 130 + r * rowh
        d.line([(40, y), (W - 40, y)], fill=(225, 225, 225), width=2)
        L.label(sheet, "D3(기준)" if k == "D3" else k, (50, y + 80), 34, (20, 20, 24), 800)
        if k != "D3":
            L.label(sheet, SPECS[k][0], (50, y + 135), 20, (110, 110, 118), 600)
        for (t, x), v in zip(heads[:3], ("yellow", "ink", "light")):
            im = L.with_corners(ic(k, v), 210)
            if v == "light":
                d.rounded_rectangle([x - 1, y + 29, x + 210, y + 240], radius=47, outline=(228, 228, 226), width=2)
            sheet.paste(im.convert("RGB"), (x, y + 30), im.split()[3])
        for bx, bgc, vs in ((1130, (246, 246, 244), ("yellow", "light")), (1560, (40, 40, 46), ("ink",))):
            d.rectangle([bx, y + 40, bx + 400, y + 230], fill=bgc)
            x = bx + 16
            for v in vs:
                for s in (120, 60, 29):
                    im = L.with_corners(ic(k, v), s)
                    sheet.paste(im.convert("RGB"), (x, y + 40 + (190 - s) // 2), im.split()[3])
                    x += s + 12
                x += 12
        a = leaf_area_px(k)
        L.label(sheet, f"{a:.1f} px²", (1980, y + 100), 30, (20, 20, 24), 800)
    return sheet


def home_wide(variant, scale=0.8):
    keys = ALL
    cols, rows = 5, 5
    icon_s, gx, gy = 150, 70, 110
    w = cols * icon_s + (cols + 1) * gx
    h = rows * (icon_s + gy) + 150
    scr = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    d = ImageDraw.Draw(scr)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=(int(70 + 90 * t), int(110 + 30 * t), int(190 - 30 * t), 255))
    d.ellipse([-200, h - 600, 900, h + 300], fill=(255, 150, 120, 60))
    slots = [1, 3, 5, 7, 8, 10, 12, 14, 16, 17, 19, 21]
    names = dict(zip(slots, keys))
    gi = 0
    for i in range(cols * rows):
        r, c = divmod(i, cols)
        x, y = gx + c * (icon_s + gx), 70 + r * (icon_s + gy)
        if i in names:
            k = names[i]
            scr.alpha_composite(L.with_corners(ic(k, variant), icon_s), (x, y))
            d.text((x + icon_s // 2, y + icon_s + 22), "D3" if k == "D3" else k, font=L.font(26, 800), fill=(255, 255, 255, 255), anchor="mt")
        else:
            nm, col, shp = L.APP_TILES[gi % len(L.APP_TILES)]
            gi += 1
            scr.alpha_composite(L.generic_tile(icon_s, col, shp), (x, y))
            d.text((x + icon_s // 2, y + icon_s + 22), nm, font=L.font(24, 600), fill=(255, 255, 255, 220), anchor="mt")
    out = scr.convert("RGB")
    return out.resize((int(w * scale), int(h * scale)), Image.LANCZOS)


# ---------------------------------------------------------------- 추천안 확장
def sticker_sheet(key):
    spec = spec_of(key)
    modes = [("drop", "쏙 들어간다"), ("check", "딱 맞음"), ("steam", "따끈"), ("laugh", "ㅋㅋ")]
    W = 1400
    sheet = Image.new("RGB", (W, 360), (232, 232, 230))
    L.label(sheet, f"{key} 스티커·이모지 시안", (24, 18), 26, (30, 30, 34), 800)

    def stick(mode, variant):
        lift = 150 if mode == "drop" else 0
        extras = []
        ls, cy = raw_layers(spec, variant, lift)
        r = spec["ball_r"]
        if mode == "drop":
            for dx in (-80, 80):
                m = L.new_mask()
                ImageDraw.Draw(m).line([(P(512 + dx), P(cy - 320)), (P(512 + dx), P(cy - 262))], fill=255, width=P(26))
                L.circle(m, 512 + dx, cy - 320, 13)
                L.circle(m, 512 + dx, cy - 262, 13)
                extras.append((m, "bowl"))
        elif mode == "check":
            m = L.new_mask()
            ImageDraw.Draw(m).line([(P(450), P(cy - 5)), (P(500), P(cy + 45)), (P(580), P(cy - 55))], fill=255, width=P(40), joint="curve")
            for x, y in ((450, cy - 5), (580, cy - 55)):
                L.circle(m, x, y, 20)
            extras.append((m, "bowl"))
        elif mode == "steam":
            m = L.new_mask()
            dd = ImageDraw.Draw(m)
            pts = [(512 - 130 + 30 * math.sin(s / 50 * 2 * math.pi), cy - r - 60 - 120 * s / 50) for s in range(51)]
            dd.line([(P(x), P(y)) for x, y in pts], fill=255, width=P(34), joint="curve")
            for x, y in (pts[0], pts[-1]):
                L.circle(m, x, y, 17)
            extras.append((m, "bowl"))
        elif mode == "laugh":
            g = L.glyph_mask("ㅋ", 120, weight=900, rnd=0.012)
            g = ImageChops.offset(g, 0, P(cy - 512))
            extras.append((g, "bowl"))
        c = colors(spec, variant)
        for m, col in extras:
            ls.append((m, c["bowl"] if variant != "yellow" else INK, "extra"))
        f = fit_tagged(ls, 560)
        return L.compose(L.PALS[variant]["bg"], [(m, cc) for m, cc, _ in f], 1024)

    x = 24
    for mode, nm in modes:
        im = stick(mode, "yellow").resize((250, 250), Image.LANCZOS).convert("RGBA")
        im.putalpha(L.circle_mask_img(250))
        sheet.paste(im.convert("RGB"), (x, 60), im.split()[3])
        L.label(sheet, nm, (x + 125, 322), 20, (60, 60, 66), 700, "mm")
        x += 262
    for idx, (mode, nm) in enumerate(modes[:2]):
        im = stick(mode, "ink").resize((120, 120), Image.LANCZOS).convert("RGBA")
        im.putalpha(L.circle_mask_img(120))
        sheet.paste(im.convert("RGB"), (x + 10, 70 + idx * 130), im.split()[3])
    return sheet


def adaptive_panel(key):
    """안드로이드 적응형 아이콘: 전경을 안전영역(108dp 중 66dp = 61%) 안에 맞추고 여러 마스크로 보기."""
    W, H = 1500, 460
    sheet = Image.new("RGB", (W, H), (240, 240, 238))
    L.label(sheet, f"{key} 앱 아이콘 1024 + 안드로이드 적응형 아이콘 마스크(전경 = 안전영역 61% 안)", (24, 18), 26, (30, 30, 34), 800)
    icon = ic(key, "yellow")
    t = L.with_corners(icon, 330)
    sheet.paste(t.convert("RGB"), (30, 90), t.split()[3])
    L.label(sheet, "iOS (1024 → 330)", (30, 430), 18, (110, 110, 118), 600, "lm")
    sym = L.symbol_rgba(key, "yellow")
    k = 0.61 * 1024 / max(sym.width, sym.height)
    sym = sym.resize((int(sym.width * k), int(sym.height * k)), Image.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), L.PALS["yellow"]["bg"] + (255,))
    canvas.alpha_composite(sym, ((1024 - sym.width) // 2, (1024 - sym.height) // 2))
    vis = canvas.crop((int(1024 * 18 / 108), int(1024 * 18 / 108), int(1024 * 90 / 108), int(1024 * 90 / 108)))  # 보이는 72dp
    x = 420
    for nm, mk in (("원형", "circle"), ("둥근 사각", "round"), ("스쿼클", "squircle"), ("작게(원형 48dp)", "small")):
        s = 250 if mk != "small" else 100
        v = vis.resize((s, s), Image.LANCZOS)
        mask = Image.new("L", (s * 4, s * 4), 0)
        dd = ImageDraw.Draw(mask)
        if mk in ("circle", "small"):
            dd.ellipse([0, 0, s * 4 - 1, s * 4 - 1], fill=255)
        else:
            dd.rounded_rectangle([0, 0, s * 4 - 1, s * 4 - 1], radius=int(s * 4 * (0.3 if mk == "round" else 0.2237)), fill=255)
        mask = mask.resize((s, s), Image.LANCZOS)
        v.putalpha(mask)
        yy = 110 if mk != "small" else 180
        sheet.paste(v.convert("RGB"), (x, yy), v.split()[3])
        L.label(sheet, nm, (x, 390 if mk != "small" else 300), 18, (110, 110, 118), 600)
        x += s + 40
    return sheet


def lockups(key):
    """락업 3가지(가로형·세로형·아이콘 단독) × 노랑/옅은/검정 바탕."""
    W, H = 1500, 1050
    sheet = Image.new("RGB", (W, H), (255, 255, 255))
    L.label(sheet, f"{key} 락업 — 가로형 · 세로형 · 아이콘 단독 (굵고 둥근 한글 + CookMatch 보조)", (30, 20), 32, (20, 20, 24), 800)
    cases = [("yellow", "ink", BRAND), ("light", "yellow", LIGHT), ("ink", "yellow", INK)]
    for r, (wv, iv, bgc) in enumerate(cases):
        y = 90 + r * 320
        sheet.paste(Image.new("RGB", (1440, 300), bgc), (30, y))
        icn = ic(key, iv)
        wm = L.wordmark(key, wv)
        # 가로형
        ih = L.with_corners(icn, 150)
        sheet.paste(ih.convert("RGB"), (70, y + 75), ih.split()[3])
        w2 = L.fit_h(wm, 90).convert("RGB")
        sheet.paste(w2, (240, y + 105))
        # 세로형
        iv_ = L.with_corners(icn, 150)
        cx = 780
        sheet.paste(iv_.convert("RGB"), (cx - 75, y + 25), iv_.split()[3])
        w3 = L.fit_h(wm, 70).convert("RGB")
        sheet.paste(w3, (cx - w3.width // 2, y + 190))
        # 아이콘 단독
        i1 = L.with_corners(icn, 220)
        sheet.paste(i1.convert("RGB"), (1150, y + 40), i1.split()[3])
        if r == 0:
            L.label(sheet, "가로형", (240, y + 20), 20, SPECS_LABEL_COL, 700)
            L.label(sheet, "세로형", (cx - 40, y + 4), 20, SPECS_LABEL_COL, 700)
            L.label(sheet, "아이콘 단독", (1150, y + 10), 20, SPECS_LABEL_COL, 700)
    return sheet


SPECS_LABEL_COL = (110, 90, 0)


def extension_all(key):
    base = L.extension_sheet(key)
    st = sticker_sheet(key)
    ad = adaptive_panel(key)
    W = max(base.width, st.width, ad.width)
    out = Image.new("RGB", (W, base.height + st.height + ad.height + 20), (232, 232, 230))
    out.paste(base, (0, 0))
    out.paste(st, (0, base.height + 10))
    out.paste(ad, (0, base.height + st.height + 20))
    return out


# ---------------------------------------------------------------- 메인
def build():
    for k in SPECS:
        for v, suf in (("yellow", ""), ("ink", "_reverse"), ("light", "_light")):
            ic(k, v).save(os.path.join(HERE, f"{k}_icon{suf}_1024.png"))
        print("icon", k, flush=True)
    comparison().save(os.path.join(PARENT, "logo_D3변형_비교.png"))
    for v, nm in (("yellow", "노랑"), ("light", "옅은바탕"), ("ink", "검정")):
        home_wide(v).save(os.path.join(HERE, f"logo_E변형_홈화면_{nm}.png"))
    for k in (sys.argv[1:] or ["E1", "E3"]):
        extension_all(k).save(os.path.join(HERE, f"logo_E확장예시_{k}.png"))
        lockups(k).save(os.path.join(HERE, f"logo_E락업_{k}.png"))
    print("ok")


if __name__ == "__main__":
    build()
