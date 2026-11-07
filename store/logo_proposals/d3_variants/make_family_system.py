# -*- coding: utf-8 -*-
"""D3 문법으로 자라는 「로고 가족」 시안 — 재료 패밀리·모션·계절 아이콘·앱 목업·스티커·브랜드 보드. 제안 전용.

    PYTHONIOENCODING=utf-8 python store/logo_proposals/d3_variants/make_family_system.py [family|motion|seasonal|mockups|stickers|board|all]

make_d3_variants.py(비교판, 문법 정의)를 불러 쓰고 결과는 d3_variants/ 하위 폴더에만 쓴다.
외부 이미지·폰트 없이 Pillow 로 직접 그림. 앱 목업만 store/sources/ 의 실제 앱 캡처를 배경으로 쓴다.
"""
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_d3_variants as V  # noqa: E402
from PIL import Image, ImageChops, ImageDraw, ImageFilter  # noqa: E402

L, D = V.L, V.D
P, SS = L.P, L.SS
INK, BRAND, WHITE, LIGHT, G2 = V.INK, V.BRAND, V.WHITE, V.LIGHT, V.G2
PALE = (255, 244, 184)
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
SRC = os.path.join(ROOT, "store", "sources")
TOMATO, ORANGE, EGG, TOFU = (238, 64, 58), (255, 150, 30), (250, 236, 206), (255, 255, 255)
POTATO, ZUCC, EGGP, STRAW, MELON, RIND = (196, 150, 96), (140, 196, 62), (110, 70, 150), (236, 60, 90), (240, 80, 90), (60, 160, 90)

RIM, R_BOWL, TRUNC, GAP, RR = 470, 310, 262, 18, 8


def default_icon(variant="yellow", size=1024):
    """추천 기본 아이콘(E9 도면: 큰 잎, 꽉 찬 크기) — 모든 목업·보드가 이 한 함수로 같은 도면을 쓴다."""
    bg = {"yellow": BRAND, "ink": INK, "light": LIGHT}[variant]
    bowl = {"yellow": INK, "ink": BRAND, "light": INK}[variant]
    ball = {"yellow": WHITE, "ink": WHITE, "light": BRAND}[variant]
    ls, _, _ = member_raw(kind="circle", ball_col=ball, bowl_col=bowl)
    return place(ls, 1.32, bg=bg, size=size, ycenter=420).convert("RGB")


def out_dir(sub):
    p = os.path.join(HERE, sub)
    os.makedirs(p, exist_ok=True)
    return p


# ---------------------------------------------------------------- 재료 도형(받침은 D3 그릇 그대로)
def _egg_poly(m, cx, cy, r, extra=0, inv=False):
    a, b = r * 0.96 + extra, r * 1.22 + extra
    pts = []
    for i in range(240):
        t = 2 * math.pi * i / 240
        s = math.sin(t)
        x = a * math.cos(t) * (1 + 0.17 * s if inv else 1 - 0.17 * s)
        pts.append((P(cx + x), P(cy - b * s)))
    ImageDraw.Draw(m).polygon(pts, fill=255)


def _ellipse(m, cx, cy, rx, ry):
    ImageDraw.Draw(m).ellipse([P(cx - rx), P(cy - ry), P(cx + rx), P(cy + ry)], fill=255)


def ball_shape(kind, cy, extra=0):
    """재료 한 개의 마스크들 [(mask, role)] — role: main/stem/rind. extra>0 이면 받침에 파낼 자리(간격 포함)."""
    e = extra
    m = L.new_mask()
    if kind == "circle":
        L.circle(m, 512, cy, 172 + e)
    elif kind == "egg":
        _egg_poly(m, 512, cy + 6, 160, e)
    elif kind == "strawberry":
        _egg_poly(m, 512, cy - 10, 160, e, inv=True)
    elif kind == "tofu":
        L.rrect(m, (512 - 152 - e, cy - 152 - e + 14, 512 + 152 + e, cy + 152 + e + 14), 76 + e)
    elif kind == "potato":
        _ellipse(m, 512, cy - 6, 196 + e, 150 + e)
    elif kind == "persimmon":
        _ellipse(m, 512, cy - 4, 190 + e, 160 + e)
    elif kind == "zucchini":
        L.rrect(m, (512 - 208 - e, cy - 96 - e, 512 + 208 + e, cy + 96 + e), 96 + e)
    elif kind == "eggplant":
        L.rrect(m, (512 - 104 - e, cy - 218 - e, 512 + 104 + e, cy + 120 + e), 104 + e)
    elif kind == "mushroom":
        cap = L.new_mask()
        _ellipse(cap, 512, cy - 20, 202 + e, 188 + e)
        cut = L.new_mask()
        ImageDraw.Draw(cut).rectangle([0, P(cy - 20 + e), P(1024), P(1024)], fill=255)
        cap = ImageChops.subtract(cap, cut)
        stem = L.new_mask()
        L.rrect(stem, (512 - 64 - e, cy - 40, 512 + 64 + e, cy + 150 + e), 26 + e)
        if e:
            return [(ImageChops.lighter(cap, stem), "main")]
        return [(cap, "main"), (stem, "stem")]
    elif kind == "melon":
        rind = L.new_mask()
        _ellipse(rind, 512, cy - 38, 214 + e, 214 + e)
        cutr = L.new_mask()
        ImageDraw.Draw(cutr).rectangle([0, 0, P(1024), P(cy - 38)], fill=255)
        rind = ImageChops.subtract(rind, cutr)
        if e:
            return [(rind, "main")]
        flesh = L.new_mask()
        _ellipse(flesh, 512, cy - 38, 184, 184)
        flesh = ImageChops.subtract(flesh, cutr)
        return [(rind, "rind"), (flesh, "main")]
    else:
        raise ValueError(kind)
    return [(m, "main")]


def _top_of(masks):
    ys, xs = [], []
    for m, _ in masks:
        b = m.getbbox()
        ys.append(b[1])
        xs.append((b[0] + b[2]) / 2)
    return min(ys) / SS, sum(xs) / len(xs) / SS


def member_raw(kind, ball_col=TOMATO, stem_col=None, bowl_col=INK, leaf_col=G2, lift=0, seat=0, leaf=True,
               leaf_ang=52, leaf_len=262, leaf_wid=132, leaf_pos=None, ball=True, extra_balls=None, leaf_sag=False):
    """D3 문법 한 개 — 설계 좌표 1024. 반환 [(mask, color, tag)], cy, ball_top."""
    cy = RIM - seat
    bowl = D.bowl_mask(R_BOWL, RIM, TRUNC)
    sock = L.new_mask()
    shapes = ball_shape(kind, cy, 0) if ball else []
    if ball and kind != "none":
        for m, _ in ball_shape(kind, cy, GAP):
            sock = ImageChops.lighter(sock, m)
    for dx, dy, r, col in (extra_balls or []):
        L.circle(sock, 512 + dx, cy + dy, r + GAP)
    bowl = ImageChops.subtract(bowl, sock)
    bowl = L.round_mask(bowl, RR * SS)
    ls = [(bowl, bowl_col, "bowl")]
    moved = []
    for m, role in shapes:
        if lift:
            m = ImageChops.offset(m, 0, -P(lift))
        moved.append((m, role))
        ls.append((m, ball_col if role == "main" else (stem_col or EGG) if role == "stem" else RIND, "ball"))
    for dx, dy, r, col in (extra_balls or []):
        m = L.new_mask()
        L.circle(m, 512 + dx, cy + dy - lift, r)
        ls.append((m, col, "ball"))
        moved.append((m, "main"))
    top = cy - 172 - lift
    if moved:
        top, cx0 = _top_of(moved)
    else:
        cx0 = 512
    if leaf:
        ang = leaf_ang
        bx, by = (leaf_pos or (cx0 + 10, top - 12))
        if leaf_sag:
            ang = -22
            bx, by = cx0 + 96, top + 26
            leaf_len, leaf_wid = 190, 92
        ca, sa = math.cos(math.radians(ang)), math.sin(math.radians(ang))
        lm = D.lens(bx + ca * leaf_len / 2, by - sa * leaf_len / 2, leaf_len, leaf_wid, ang)
        ls.append((lm, leaf_col, "leaf"))
    return ls, cy - lift, top


def place(ls, k=1.0, bg=None, size=1024, ycenter=406, xshift=0):
    """고정 배율로 놓기 — 가족 전체가 같은 받침 크기·같은 위치를 갖게(fit 의 개별 정규화와 다름)."""
    full = size * SS
    out = Image.new("RGBA", (full, full), (0, 0, 0, 0) if bg is None else bg + (255,))
    for m, c, _ in ls:
        mk = m.resize((int(full * k), int(full * k)), Image.LANCZOS)
        u = full / 1024
        ox = int(full / 2 - 512 * u * k + xshift * u * k)
        oy = int(full / 2 - ycenter * u * k)
        canvas = Image.new("L", (full, full), 0)
        canvas.paste(mk, (ox, oy))
        out.paste(Image.new("RGBA", (full, full), c + (255,)), (0, 0), canvas)
    return out.resize((size, size), Image.LANCZOS)


def symbol_png(ls, k=1.0, size=512):
    return place(ls, k=k, bg=None, size=size)


# ---------------------------------------------------------------- 1. 재료 패밀리
FAMILY = [
    ("01_토마토", "토마토", dict(kind="circle", ball_col=TOMATO)),
    ("02_귤", "귤", dict(kind="circle", ball_col=ORANGE)),
    ("03_달걀", "달걀", dict(kind="egg", ball_col=EGG)),
    ("04_두부", "두부", dict(kind="tofu", ball_col=TOFU)),
    ("05_버섯", "버섯", dict(kind="mushroom", ball_col=(206, 146, 104), stem_col=(255, 244, 226), leaf_len=232, leaf_wid=116)),
    ("06_감자", "감자", dict(kind="potato", ball_col=POTATO)),
    ("07_애호박", "애호박", dict(kind="zucchini", ball_col=ZUCC)),
    ("08_가지", "가지", dict(kind="eggplant", ball_col=EGGP)),
    ("09_딸기", "딸기", dict(kind="strawberry", ball_col=STRAW)),
    ("10_수박", "수박", dict(kind="melon", ball_col=MELON, leaf=False)),
]


def family():
    d = out_dir("family")
    tiles = []
    for fn, nm, kw in FAMILY:
        ls, _, _ = member_raw(**kw)
        im = place(ls, 1.0, bg=PALE).convert("RGB")
        im.save(os.path.join(d, fn + ".png"))
        tiles.append((nm, ls))
        print("family", nm, flush=True)
    cols, tw = 5, 360
    sheet = Image.new("RGB", (cols * tw + (cols + 1) * 24, 2 * (tw + 70) + 120), (255, 255, 255))
    L.label(sheet, "재료 패밀리 — 같은 받침·같은 잎, 재료(색·모양)만 바꿈 (평평한 색, 받침 크기·위치 고정)", (24, 24), 32, (20, 20, 24), 800)
    for i, (nm, ls) in enumerate(tiles):
        r, c = divmod(i, cols)
        x, y = 24 + c * (tw + 24), 90 + r * (tw + 70)
        t = place(ls, 1.0, bg=PALE, size=tw)
        m = Image.new("L", (tw, tw), 0)
        ImageDraw.Draw(m).rounded_rectangle([0, 0, tw - 1, tw - 1], radius=int(tw * 0.2237), fill=255)
        sheet.paste(t.convert("RGB"), (x, y), m)
        L.label(sheet, nm, (x + tw // 2, y + tw + 30), 28, (30, 30, 34), 800, "mm")
    sheet.save(os.path.join(d, "family_all.png"))
    # 스토어 첫 장 배경 패턴 목업(당근의 하트 일러스트 역할)
    W, H = 1290, 2796
    base = Image.new("RGBA", (W, H), BRAND + (255,))
    dr = ImageDraw.Draw(base)
    head = INK
    dr.text((90, 250), "냉장고 속 재료,", font=L.font(120, 900), fill=head)
    dr.text((90, 400), "딱 맞는 요리로", font=L.font(120, 900), fill=head)
    dr.text((94, 570), "인기 레시피 4만 개에서 바로 찾아요", font=L.font(52, 700), fill=L.SUB_Y)
    grid = Image.new("RGBA", (2400, 2200), (0, 0, 0, 0))
    ts = 360
    bgs = [INK, PALE, WHITE]
    for r in range(6):
        for c in range(7):
            nm, ls = tiles[(r * 3 + c * 2) % len(tiles)]
            bg = bgs[(r + c) % 3]
            if bg == INK:
                ls2 = [(m, BRAND if t == "bowl" else col, t) for m, col, t in ls]
            else:
                ls2 = ls
            t = place(ls2, 1.0, bg=bg, size=ts)
            mk = Image.new("L", (ts, ts), 0)
            ImageDraw.Draw(mk).rounded_rectangle([0, 0, ts - 1, ts - 1], radius=int(ts * 0.2237), fill=255)
            t.putalpha(mk)
            grid.alpha_composite(t, (c * (ts + 36) + (r % 2) * 150, r * (ts + 36)))
    grid = grid.rotate(8, resample=Image.BICUBIC, expand=True)
    base.alpha_composite(grid, (-280, 1000))
    base.convert("RGB").resize((430, 932), Image.LANCZOS).save(os.path.join(d, "store_pattern_mock.png"))
    print("family done", flush=True)


# ---------------------------------------------------------------- 2. 모션
def phone(w=300, h=520, bg=(255, 255, 255)):
    im = Image.new("RGBA", (w, h), bg + (255,))
    return im


def frame_panel(sym, caption, sub=None, bg=PALE, w=300, h=520, extra=None, k=0.9, ycenter=420):
    im = Image.new("RGBA", (w, h), bg + (255,))
    s = place(sym, k, bg=None, size=300, ycenter=ycenter)
    im.alpha_composite(s, (0, 90))
    d = ImageDraw.Draw(im)
    d.text((w // 2, 400), caption, font=L.font(24, 900), fill=INK, anchor="mm")
    if sub:
        d.text((w // 2, 436), sub, font=L.font(16, 600), fill=(90, 90, 98), anchor="mm")
    if extra:
        extra(im)
    return im


def strip(frames, labels, title):
    w, h = frames[0].size
    sheet = Image.new("RGB", (len(frames) * w + (len(frames) + 1) * 20, h + 130), (255, 255, 255))
    L.label(sheet, title, (20, 18), 28, (20, 20, 24), 800)
    for i, (f, lab) in enumerate(zip(frames, labels)):
        x = 20 + i * (w + 20)
        sheet.paste(f.convert("RGB"), (x, 70))
        L.label(sheet, f"{i + 1}. {lab}", (x, 70 + h + 14), 18, (70, 70, 76), 700)
    return sheet


def motion():
    d = out_dir("motion")
    kw = dict(kind="circle", ball_col=TOMATO)
    # --- GIF: 재료가 받침에 딱 앉는 로딩
    seq = [300, 300, 260, 200, 130, 60, 0, -14, 0, 6, 0, 0, 0, 0]
    gif = []
    for i, lift in enumerate(seq):
        ls, _, _ = member_raw(lift=max(lift, 0) if lift >= 0 else 0, leaf_ang=52 + (14 if i in (7, 9) else 0), **kw)
        im = place(ls, 1.0, bg=PALE, size=360).convert("P", palette=Image.ADAPTIVE)
        gif.append(im)
    gif[0].save(os.path.join(d, "loading.gif"), save_all=True, append_images=gif[1:], duration=[120] * 6 + [160] + [100] * 7, loop=0, disposal=2)
    # --- 스토리보드 1: 앱 안 로딩
    fr = []
    spec = [(300, "찾는 중이에요", "재료가 위에서 내려와요"), (140, "찾는 중이에요", "떨어지는 중"), (0, "딱!", "받침에 앉았어요"), (0, "찾았어요", "잎이 살짝 흔들려요")]
    for i, (lift, cap, sub) in enumerate(spec):
        ls, _, _ = member_raw(lift=lift, leaf_ang=52 if i < 3 else 66, **kw)
        if i == 1:  # 움직임 줄
            m = L.new_mask()
            for dx in (-90, 90):
                ImageDraw.Draw(m).line([(P(512 + dx), P(RIM - 140 - 260)), (P(512 + dx), P(RIM - 140 - 190))], fill=255, width=P(24))
                L.circle(m, 512 + dx, RIM - 400, 12)
                L.circle(m, 512 + dx, RIM - 330, 12)
            ls.append((m, INK, "extra"))
        if i == 2:  # 파문
            m = L.new_mask()
            ImageDraw.Draw(m).arc([P(512 - 260), P(RIM - 60), P(512 + 260), P(RIM + 220)], 200, 340, fill=255, width=P(14))
            ls.append((m, BRAND, "extra"))
        fr.append(frame_panel(ls, cap, sub))
    strip(fr, [s[2] for s in spec], "모션 ① 앱 안 로딩 — 재료가 받침에 「딱」 앉는다").save(os.path.join(d, "story_loading.png"))
    # --- 스토리보드 2: 매칭 완료 4/5 → 5/5
    fr = []
    spec = [(150, "내 재료 4/5", "하나 남았어요", (200, 200, 205), False), (60, "내 재료 4/5", "마지막 재료가 들어가요", (200, 200, 205), False),
            (0, "내 재료 5/5", "딱 맞아요!", BRAND, True), (0, "내 재료 5/5", "딱 맞아요!", BRAND, True)]
    for i, (lift, cap, sub, chip, done) in enumerate(spec):
        ls, _, _ = member_raw(lift=lift, **kw)

        def extra(im, i=i, chip=chip, done=done, cap=cap):
            dd = ImageDraw.Draw(im)
            dd.rounded_rectangle([60, 440, 240, 484], radius=22, fill=chip)
            dd.text((150, 462), "5/5 딱 맞아요" if done else "4/5", font=L.font(20, 900), fill=INK, anchor="mm")
            if i == 3:
                for (sx, sy, sr) in ((60, 140, 20), (240, 110, 14), (250, 200, 10)):
                    dd.polygon(L.star_pts(sx, sy, sr), fill=BRAND)
        im = frame_panel(ls, "", sub=None, extra=extra)
        d2 = ImageDraw.Draw(im)
        d2.text((150, 400), cap if not done else "내 재료 5/5", font=L.font(22, 900), fill=INK, anchor="mm")
        d2.text((150, 506), sub, font=L.font(15, 600), fill=(90, 90, 98), anchor="mm")
        fr.append(im)
    strip(fr, ["4/5 — 재료 하나가 위에서 기다린다", "쏙 — 마지막 재료가 들어간다", "딱 — 칩이 노랑 5/5 로 바뀐다", "반짝 — 별 세 점"],
          "모션 ② 매칭 완료 — 「내 재료 4/5 → 5/5 딱 맞아요」").save(os.path.join(d, "story_match.png"))
    # --- 스토리보드 3: 사진 인식 완료
    fr = []
    texts = ["영수증을 찍어요", "읽는 중이에요", "재료가 쏙쏙", "재료 3개 찾았어요"]
    for i in range(4):
        im = Image.new("RGBA", (300, 520), PALE + (255,))
        dd = ImageDraw.Draw(im)
        if i < 2:
            dd.rounded_rectangle([70, 90, 230, 330], radius=14, fill=WHITE)
            for j in range(6):
                dd.rounded_rectangle([88, 112 + j * 30, 212 - (j % 3) * 30, 124 + j * 30], radius=6, fill=(220, 220, 224))
            if i == 1:
                dd.rounded_rectangle([60, 210, 240, 222], radius=6, fill=BRAND)
        else:
            ls, _, _ = member_raw(kind="circle", ball=False, leaf=False)
            s = place(ls, 0.9, bg=None, size=300, ycenter=420)
            im.alpha_composite(s, (0, 120))
            balls = [(TOMATO, (150, 120 if i == 2 else 258), 26), (EGG, (92, 150 if i == 2 else 266), 22), (TOFU, (212, 170 if i == 2 else 268), 22)]
            for col, (bx, by), r in balls:
                dd.ellipse([bx - r, by - r, bx + r, by + r], fill=col, outline=(220, 200, 150) if col in (EGG, TOFU) else None, width=2)
        dd.text((150, 400), texts[i], font=L.font(24, 900), fill=INK, anchor="mm")
        fr.append(im)
    strip(fr, ["촬영", "인식 중 — 노랑 선이 훑는다", "재료가 받침으로 쏙쏙 날아간다", "다 담김"], "모션 ③ 사진 인식 완료 — 영수증 재료가 받침에 담긴다").save(os.path.join(d, "story_photo.png"))
    print("motion done", flush=True)


# ---------------------------------------------------------------- 3. 계절 아이콘
SEASONS = [  # (계절, 재료, 재료 스펙, 잎 색) — 바탕·받침·구도는 기본 아이콘과 완전히 같고 재료 모양/색 + 잎 색만 바뀐다
    ("봄", "딸기", dict(kind="strawberry", ball_col=STRAW), (112, 192, 78)),
    ("여름", "수박", dict(kind="melon", ball_col=MELON, leaf_len=232, leaf_wid=116), (30, 146, 82)),
    ("가을", "감", dict(kind="persimmon", ball_col=(236, 112, 40), leaf_len=210, leaf_wid=108), (150, 112, 30)),
    ("겨울", "귤", dict(kind="circle", ball_col=ORANGE), (24, 120, 96)),
]


def seasonal():
    d = out_dir("seasonal")
    items = []
    for sn, nm, kw, leafc in SEASONS:
        ls, _, _ = member_raw(leaf_col=leafc, **kw)
        im = place(ls, 1.32, bg=BRAND, size=1024, ycenter=420).convert("RGB")
        im.save(os.path.join(d, f"{sn}_{nm}_1024.png"))
        items.append((f"{sn} · {nm}", im))
    items.append(("야간(검정)", default_icon("ink")))
    items.append(("옅은 바탕", default_icon("light")))
    base = default_icon("yellow")
    sheet = Image.new("RGB", (7 * 270 + 60, 640), (255, 255, 255))
    L.label(sheet, "계절 규칙 — 받침·구도·노랑 바탕은 그대로, 재료(모양·색)와 잎 색만 바꾼다", (24, 18), 30, (20, 20, 24), 800)
    t = L.with_corners(base, 250)
    sheet.paste(t.convert("RGB"), (24, 80), t.split()[3])
    L.label(sheet, "기본", (24 + 125, 350), 22, (30, 30, 34), 800, "mm")
    for i, (nm, im) in enumerate(items):
        t = L.with_corners(im, 250)
        x = 24 + (i + 1) * 270
        sheet.paste(t.convert("RGB"), (x, 80), t.split()[3])
        L.label(sheet, nm, (x + 125, 350), 22, (30, 30, 34), 800, "mm")
    sm = Image.new("RGB", (sheet.width - 48, 130), (246, 246, 244))
    xx = 20
    for nm, im in [("기본", base)] + items:
        for s_ in (60, 29):
            t = L.with_corners(im, s_)
            sm.paste(t.convert("RGB"), (xx, 30 + (60 - s_) // 2), t.split()[3])
            xx += s_ + 10
        xx += 20
    sheet.paste(sm, (24, 380))
    notes = ["제작 비용이 낮다: 같은 그리드에서 재료 마스크 하나와 잎 색 하나만 바꾸면 끝(코드에서 member_raw 인자 두 개).",
             "브랜드 일관성: 노랑 바탕+검정 받침은 사계절 동일 — 계절감은 과일과 잎에서만 나온다(귤·감은 노랑 바탕 위 대비가 약한 편, 받침이 받쳐 줌).",
             "구현 메모: iOS 는 대체 앱 아이콘 API(setAlternateIconName)로 가능하지만 아이콘 세트를 번들에 미리 넣고 심사를 받아야 한다. 안드로이드는 activity-alias 로 가능."]
    for i, n in enumerate(notes):
        L.label(sheet, "• " + n, (24, 535 + i * 32), 17, (70, 70, 78), 500)
    sheet.save(os.path.join(d, "seasonal_sheet.png"))
    print("seasonal done", flush=True)


# ---------------------------------------------------------------- 4. 앱 목업
def cap(name):
    return Image.open(os.path.join(SRC, name)).convert("RGBA")


def paste_circle_symbol(base, center, r, ls, bg, k=0.64, ycenter=406):
    d = ImageDraw.Draw(base)
    d.ellipse([center[0] - r, center[1] - r, center[0] + r, center[1] + r], fill=bg)
    sz = int(r * 2.1)
    s = place(ls, k, bg=None, size=sz, ycenter=ycenter)
    mk = Image.new("L", (sz, sz), 0)
    ImageDraw.Draw(mk).ellipse([sz // 2 - r, sz // 2 - r, sz // 2 + r, sz // 2 + r], fill=255)
    s2 = Image.new("RGBA", (sz, sz), (0, 0, 0, 0))
    s2.paste(s, (0, 0), mk)
    base.alpha_composite(s2, (center[0] - sz // 2, center[1] - sz // 2))


def empty_screen(top, bottom, ls_fn, headline, sub, button=None):
    W, H = 1290, 2796
    im = Image.new("RGBA", (W, H), (255, 255, 255, 255))
    im.alpha_composite(top, (0, 0))
    im.alpha_composite(bottom, (0, H - bottom.height))
    s = ls_fn()
    im.alpha_composite(s, ((W - s.width) // 2, 880))
    d = ImageDraw.Draw(im)
    d.text((W // 2, 1560), headline[0], font=L.font(72, 900), fill=INK, anchor="mm")
    d.text((W // 2, 1650), headline[1], font=L.font(72, 900), fill=INK, anchor="mm")
    d.text((W // 2, 1770), sub, font=L.font(44, 600), fill=(120, 120, 128), anchor="mm")
    if button:
        d.rounded_rectangle([W // 2 - 300, 1890, W // 2 + 300, 2020], radius=65, fill=BRAND)
        d.text((W // 2, 1955), button, font=L.font(48, 800), fill=INK, anchor="mm")
    return im


def mockups():
    d = out_dir("mockups")
    base = cap("list_top_v3.png")
    top = base.crop((0, 0, 1290, 540))
    bottom = base.crop((0, 2600, 1290, 2796))
    outs = []

    def dashed_ring(s, cx, cy, r):
        dd = ImageDraw.Draw(s)
        for a in range(0, 360, 16):
            dd.arc([cx - r, cy - r, cx + r, cy + r], a, a + 9, fill=(200, 200, 205), width=10)

    # 1 냉장고 비었을 때: 빈 받침 + 점선 동그라미
    def sym1():
        ls, _, _ = member_raw(kind="circle", ball=False, leaf=False)
        s = place(ls, 0.62, bg=None, size=560, ycenter=470)
        dashed_ring(s, 280, 215, 108)
        return s
    im1 = empty_screen(top, bottom, sym1, ("냉장고가 비어 있어요", "재료를 담아 볼까요?"), "담으면 딱 맞는 레시피가 나와요", "재료 담으러 가기")
    # 2 검색 0건: 재료가 받침 옆으로 굴러 나감
    def sym2():
        ls, _, _ = member_raw(kind="circle", ball=False, leaf=False)
        s = place(ls, 0.62, bg=None, size=560, ycenter=470)
        dd = ImageDraw.Draw(s)
        dd.ellipse([400, 300, 500, 400], fill=TOMATO)
        dd.polygon([(446, 296), (470, 262), (492, 290), (470, 300)], fill=G2)
        for j, (xx, yy, rr) in enumerate(((340, 330, 7), (368, 310, 10), (398, 286, 13))):
            dd.ellipse([xx - rr, yy - rr, xx + rr, yy + rr], fill=(210, 210, 214))
        return s
    im2 = empty_screen(top, bottom, sym2, ("맞는 레시피가 없어요", "재료를 하나 줄여 볼까요?"), "다른 이름이나 비슷한 재료로 다시 찾아요", "필터 초기화")
    # 3 로딩: 실제 화면을 흐리게 + 가운데 카드
    im3 = base.copy()
    im3.alpha_composite(Image.new("RGBA", im3.size, (255, 255, 255, 190)))
    card = Image.new("RGBA", (760, 760), (0, 0, 0, 0))
    cd = ImageDraw.Draw(card)
    cd.rounded_rectangle([0, 0, 759, 759], radius=70, fill=(255, 255, 255, 255), outline=(232, 232, 230), width=3)
    ls, _, _ = member_raw(kind="circle", ball_col=TOMATO, lift=170)
    s = place(ls, 0.62, bg=None, size=520, ycenter=400)
    card.alpha_composite(s, (120, 40))
    cd.text((380, 590), "냉장고 재료로 찾는 중…", font=L.font(52, 900), fill=INK, anchor="mm")
    cd.text((380, 660), "34,334건 중에서 맞는 요리를 골라요", font=L.font(34, 600), fill=(120, 120, 128), anchor="mm")
    im3.alpha_composite(card, (265, 940))
    # 4 쿡 코치 첫 화면 아바타(모자 자리)
    im4 = cap("coach_demo.png")
    ls, _, _ = member_raw(kind="circle", ball_col=TOMATO)
    d4 = ImageDraw.Draw(im4)
    paste_circle_symbol(im4, (117, 552), 47, ls, WHITE, k=0.62, ycenter=430)
    # 5 쿡 픽 인사말 아바타
    im5 = cap("chat_v3.png")
    ls5 = [(m, c, t) for m, c, t in member_raw(kind="circle", ball_col=WHITE)[0]]
    paste_circle_symbol(im5, (113, 552), 44, ls5, BRAND, k=0.62, ycenter=430)
    paste_circle_symbol(im5, (110, 846), 40, ls5, BRAND, k=0.62, ycenter=430)
    # 6 푸시 알림(안드로이드 알림창 + 흑백 작은 아이콘)
    im6 = Image.new("RGBA", (1290, 2796), (28, 28, 32, 255))
    d6 = ImageDraw.Draw(im6)
    d6.text((80, 150), "9:41", font=L.font(64, 800), fill=WHITE)
    d6.text((80, 260), "알림", font=L.font(44, 600), fill=(170, 170, 176))
    d6.rounded_rectangle([50, 360, 1240, 760], radius=60, fill=(48, 48, 54))
    ls6, _, _ = member_raw(kind="circle", ball_col=INK, bowl_col=INK, leaf_col=INK)
    sil = place(ls6, 0.62, bg=None, size=150, ycenter=430)
    d6.ellipse([86, 400, 206, 520], fill=BRAND)
    sil2 = place(ls6, 0.62, bg=None, size=120, ycenter=430)
    im6.alpha_composite(sil2, (86, 400))
    d6.text((236, 436), "쿡매치", font=L.font(40, 800), fill=(235, 235, 240))
    d6.text((420, 436), "지금", font=L.font(36, 500), fill=(160, 160, 168))
    d6.text((100, 570), "곧 상할 재료가 있어요", font=L.font(52, 900), fill=WHITE)
    d6.text((100, 650), "두부·대파 — 오늘 먹으면 딱 맞아요", font=L.font(42, 500), fill=(200, 200, 206))
    # 확대 실루엣(안드로이드 작은 아이콘 = 흑백 단색)
    sil3 = place([(m, WHITE, t) for m, c, t in ls6], 0.62, bg=None, size=300, ycenter=430)
    d6.rounded_rectangle([80, 900, 700, 1240], radius=50, fill=(48, 48, 54))
    im6.alpha_composite(sil3, (150, 920))
    d6.text((420, 1010), "작은 알림 아이콘", font=L.font(36, 700), fill=WHITE)
    d6.text((420, 1070), "흰 단색 실루엣(24dp)", font=L.font(32, 500), fill=(170, 170, 176))
    d6.text((420, 1130), "받침·재료·잎이 한 덩어리", font=L.font(32, 500), fill=(170, 170, 176))
    ims = [im1, im2, im3, im4, im5, im6]
    names = ["1_냉장고_빈화면", "2_검색_0건", "3_로딩", "4_쿡코치_아바타", "5_쿡픽_아바타", "6_푸시_알림"]
    caps = ["냉장고 비었을 때(빈 받침)", "검색 결과 0건(재료가 굴러 나감)", "로딩(재료가 내려옴)", "쿡 코치 아바타", "쿡 픽 인사말 아바타", "푸시 알림 작은 아이콘"]
    for im, nm in zip(ims, names):
        im.convert("RGB").resize((645, 1398), Image.LANCZOS).save(os.path.join(d, nm + ".png"))
    w, h = 430, 932
    sheet = Image.new("RGB", (6 * w + 7 * 20, h + 120), (236, 236, 234))
    L.label(sheet, "앱 안 장면 6가지 목업 (실제 앱 캡처 위에 합성 — 1·2는 캡처 위·아래 띠 + 새로 그린 빈 화면)", (20, 20), 28, (20, 20, 24), 800)
    for i, (im, c) in enumerate(zip(ims, caps)):
        x = 20 + i * (w + 20)
        sheet.paste(im.convert("RGB").resize((w, h), Image.LANCZOS), (x, 80))
        L.label(sheet, c, (x, 80 + h + 8), 18, (60, 60, 66), 700)
    sheet.save(os.path.join(d, "mockups_sheet.png"))
    print("mockups done", flush=True)


# ---------------------------------------------------------------- 5. 스티커
def sticker_outline(s, w=23):
    """스티커 흰 테두리 — 노랑·검정·흰 어떤 채팅 배경 위에서도 받침(검정)이 사라지지 않게."""
    a = s.split()[3]
    big = a.filter(ImageFilter.MaxFilter(w))
    big = big.filter(ImageFilter.GaussianBlur(2)).point(lambda v: 255 if v > 110 else 0).filter(ImageFilter.GaussianBlur(0.8))
    out = Image.new("RGBA", s.size, (0, 0, 0, 0))
    out.paste(Image.new("RGBA", s.size, (255, 255, 255, 255)), (0, 0), big)
    out.alpha_composite(s)
    return out


def sticker_set():
    d = out_dir("stickers")
    items = []

    def base(**kw):
        ls, cy, top = member_raw(**kw)
        return ls, cy, top

    # 1 딱 맞음
    ls, cy, top = base(kind="circle", ball_col=TOMATO)
    m = L.new_mask()
    L.circle(m, 790, 300, 92)
    chk = L.new_mask()
    ImageDraw.Draw(chk).line([(P(748), P(300)), (P(782), P(335)), (P(836), P(266))], fill=255, width=P(26), joint="curve")
    for x, y in ((748, 300), (836, 266)):
        L.circle(chk, x, y, 13)
    ls += [(m, INK, "x"), (chk, BRAND, "x")]
    items.append(("딱 맞음", ls))
    # 2 쏙
    ls, cy, top = base(kind="circle", ball_col=TOMATO, lift=100)
    m = L.new_mask()
    for dx in (-250, 250):
        ImageDraw.Draw(m).line([(P(512 + dx), P(cy - 120)), (P(512 + dx), P(cy + 20))], fill=255, width=P(26))
        L.circle(m, 512 + dx, cy - 120, 13)
        L.circle(m, 512 + dx, cy + 20, 13)
    ls.append((m, INK, "x"))
    items.append(("쏙", ls))
    # 3 따끈
    ls, cy, top = base(kind="egg", ball_col=EGG)
    m = L.new_mask()
    dd = ImageDraw.Draw(m)
    for sx in (-170, -60):
        pts = [(512 + sx + 26 * math.sin(s / 40 * 2 * math.pi), top - 40 - 130 * s / 40) for s in range(41)]
        dd.line([(P(x), P(y)) for x, y in pts], fill=255, width=P(26), joint="curve")
        for x, y in (pts[0], pts[-1]):
            L.circle(m, x, y, 13)
    ls.append((m, INK, "x"))
    items.append(("따끈", ls))
    # 4 냠(한 입 먹음)
    ls, cy, top = base(kind="circle", ball_col=TOMATO)
    bite = L.new_mask()
    L.circle(bite, 512 + 150, cy - 100, 70)
    L.circle(bite, 512 + 190, cy - 20, 52)
    ls = [(ImageChops.subtract(m, bite) if t == "ball" else m, c, t) for m, c, t in ls]
    items.append(("냠", ls))
    # 5 아깝다(상함)
    ls, cy, top = base(kind="circle", ball_col=(158, 146, 120), leaf_col=(120, 108, 70), leaf_sag=True)
    m = L.new_mask()
    dd = ImageDraw.Draw(m)
    for sx in (250, 330):
        pts = [(512 + sx + 20 * math.sin(s / 30 * 2 * math.pi), cy - 20 - 150 * s / 30) for s in range(31)]
        dd.line([(P(x), P(y)) for x, y in pts], fill=255, width=P(16), joint="curve")
    ls.append((m, (150, 150, 156), "x"))
    items.append(("아깝다", ls))
    # 6 같이 먹자
    ls, cy, top = base(kind="circle", ball=False, leaf=True, extra_balls=[(-125, 0, 128, TOMATO), (128, -16, 104, BRAND)],
                       leaf_pos=(512, RIM - 128 - 12 - 70), leaf_len=214, leaf_wid=108)
    items.append(("같이 먹자", ls))
    # 7 고민
    ls, cy, top = base(kind="circle", ball_col=TOMATO, lift=110)
    m = L.new_mask()
    for (x, y, r) in ((760, cy - 20, 20), (822, cy - 90, 28), (900, cy - 180, 38)):
        L.circle(m, x, y, r)
    ls.append((m, INK, "x"))
    items.append(("오늘 뭐 먹지?", ls))
    # 8 완성
    ls, cy, top = base(kind="circle", ball_col=TOMATO)
    m = L.new_mask()
    for (x, y, r) in ((240, 250, 70), (800, 200, 90), (860, 420, 48)):
        L.star(m, x, y, r)
    ls.append((m, BRAND, "x"))
    items.append(("완성!", ls))
    cells = []
    for i, (nm, ls) in enumerate(items, 1):
        s = sticker_outline(place(ls, 0.80, bg=None, size=512, ycenter=406))
        s.save(os.path.join(d, f"{i:02d}_{nm.replace('?', '').replace('!', '').replace(' ', '')}_글자없음.png"))
        t = s.copy()
        dd = ImageDraw.Draw(t)
        tw = dd.textlength(nm, font=L.font(44, 900))
        dd.rounded_rectangle([256 - tw / 2 - 30, 430, 256 + tw / 2 + 30, 500], radius=35, fill=INK)
        dd.text((256, 466), nm, font=L.font(44, 900), fill=BRAND, anchor="mm")
        t.save(os.path.join(d, f"{i:02d}_{nm.replace('?', '').replace('!', '').replace(' ', '')}_글자.png"))
        cells.append((nm, s, t))
    W = 4 * 270 + 20
    sheet = Image.new("RGB", (W, 2 * 2 * 270 + 130), (232, 232, 230))
    L.label(sheet, "스티커·이모지 8종 — 위 줄 글자 없는 버전 / 아래 줄 글자 버전(채팅 배경 위에서 쓰는 모습: 노랑·흰·검정)", (20, 18), 24, (30, 30, 34), 800)
    for i, (nm, s, t) in enumerate(cells):
        r, c = divmod(i, 4)
        bgc = [BRAND, WHITE, INK, (236, 236, 240)][(i + r) % 4]
        x, y = 20 + c * 270, 70 + r * 540
        for j, im in enumerate((s, t)):
            tile = Image.new("RGBA", (256, 256), bgc + (255,))
            tile.alpha_composite(im.resize((256, 256), Image.LANCZOS))
            sheet.paste(tile.convert("RGB"), (x, y + j * 270))
    sheet.save(os.path.join(d, "sticker_sheet.png"))
    print("stickers done", flush=True)


# ---------------------------------------------------------------- 6. 브랜드 보드
def board():
    W = 2600
    sh = Image.new("RGB", (W, 5200), (250, 250, 248))
    d = ImageDraw.Draw(sh)
    L.label(sh, "쿡매치 브랜드 보드 — D3 문법 (제안, 적용 안 함)", (80, 60), 64, INK, 900)
    L.label(sh, "둥근 재료 + 얇은 받침 + 잎 포인트, 평평한 색. 같은 문법으로 자란다.", (80, 148), 32, (110, 110, 118), 600)
    # 1 로고
    L.label(sh, "1. 로고", (80, 240), 40, INK, 900)
    base = default_icon("yellow")
    t = L.with_corners(base, 520)
    sh.paste(t.convert("RGB"), (80, 310), t.split()[3])
    for i, v in enumerate(("ink", "light")):
        t2 = L.with_corners(default_icon(v), 250)
        sh.paste(t2.convert("RGB"), (640 + i * 290, 310), t2.split()[3])
    for i, s in enumerate((120, 60, 29)):
        t3 = L.with_corners(base, s)
        sh.paste(t3.convert("RGB"), (640 + i * 150, 600), t3.split()[3])
    L.label(sh, "노랑(기본)·검정(야간)·옅은 바탕 / 120·60·29px", (640, 740), 20, (110, 110, 118), 600)
    # 락업 3
    lx = 1260
    wm = L.wordmark("E9", "yellow")
    bg_y = Image.new("RGB", (1260, 250), BRAND)
    ih = L.with_corners(default_icon("ink"), 140)
    bg_y.paste(ih.convert("RGB"), (40, 55), ih.split()[3])
    bg_y.paste(L.fit_h(wm, 76).convert("RGB"), (210, 87))
    sh.paste(bg_y, (lx, 310))
    L.label(sh, "가로형", (lx + 12, 320), 20, SPECS_COL, 800)
    bg_v = Image.new("RGB", (610, 400), LIGHT)
    iv = L.with_corners(default_icon("yellow"), 190)
    bg_v.paste(iv.convert("RGB"), (210, 24), iv.split()[3])
    wv = L.fit_h(L.wordmark("E9", "light"), 80).convert("RGB")
    bg_v.paste(wv, ((610 - wv.width) // 2, 250))
    sh.paste(bg_v, (lx, 590))
    L.label(sh, "세로형", (lx + 12, 598), 20, (110, 110, 118), 800)
    bg_k = Image.new("RGB", (610, 400), INK)
    ik = L.with_corners(default_icon("yellow"), 260)
    bg_k.paste(ik.convert("RGB"), (175, 70), ik.split()[3])
    sh.paste(bg_k, (lx + 650, 590))
    L.label(sh, "아이콘 단독", (lx + 662, 598), 20, SUB_W, 800)
    # 2 색
    L.label(sh, "2. 색", (80, 1060), 40, INK, 900)
    sw = [("노랑", BRAND, "#FFD600"), ("검정", INK, "#1A1A1E"), ("잎 초록", G2, "#1E9252"), ("옅은 바탕", LIGHT, "#F7F7F5"), ("연한 노랑", PALE, "#FFF4B8")]
    for i, (nm, c, hx) in enumerate(sw):
        x = 80 + i * 250
        d.rounded_rectangle([x, 1130, x + 230, 1330], radius=26, fill=c, outline=(225, 225, 225), width=2)
        L.label(sh, nm, (x, 1345), 24, INK, 800)
        L.label(sh, hx, (x, 1380), 22, (110, 110, 118), 600)
    ing = [("토마토", TOMATO), ("귤", ORANGE), ("달걀", EGG), ("감자", POTATO), ("애호박", ZUCC), ("가지", EGGP), ("딸기", STRAW)]
    L.label(sh, "재료색(재료 하나당 색 한 가지)", (80, 1450), 26, INK, 800)
    for i, (nm, c) in enumerate(ing):
        x = 80 + i * 170
        d.ellipse([x, 1500, x + 120, 1620], fill=c, outline=(225, 225, 225), width=2)
        L.label(sh, nm, (x + 60, 1650), 20, INK, 700, "mm")
        L.label(sh, "#%02X%02X%02X" % c, (x + 60, 1680), 16, (110, 110, 118), 600, "mm")
    # 3 규칙
    L.label(sh, "3. 사용 규칙", (1420, 1060), 40, INK, 900)
    rules = ["여백: 받침 두께(심볼 높이의 약 1/6) 이상을 사방에 비운다", "최소 크기: 앱 아이콘 29px, 워드마크 높이 16px, 알림 아이콘은 단색 실루엣",
             "노랑 장 위에는 검정 바탕 아이콘, 검정 장 위에는 노랑 바탕 아이콘", "받침은 항상 검정(검정 바탕에선 노랑), 잎은 항상 초록, 재료만 색을 바꾼다"]
    for i, t_ in enumerate(rules):
        L.label(sh, "• " + t_, (1420, 1140 + i * 56), 24, (40, 40, 46), 600)
    L.label(sh, "하지 말 것", (1420, 1400), 30, (200, 40, 40), 900)
    donts = []
    g = Image.new("RGB", (1024, 1024), BRAND)
    gd = ImageDraw.Draw(g)
    for y in range(1024):
        gd.line([(0, y), (1024, y)], fill=(255, int(214 - y * 0.08), int(y * 0.03)))
    gi = default_icon("yellow")
    gg = Image.blend(g, gi, 0.55)
    donts.append(("그라데이션·그림자", gg))
    sq = Image.new("RGB", (1024, 1024), BRAND)
    sq.paste(gi.resize((1024, 640), Image.LANCZOS), (0, 190))
    donts.append(("늘리거나 찌그러뜨리기", sq))
    nol = Image.eval(gi, lambda v: v)
    ls_, _, _ = member_raw(kind="circle", ball_col=WHITE, leaf=False)
    donts.append(("잎 빼기·잎 색 바꾸기", place(ls_, 1.32, bg=BRAND, size=1024, ycenter=420).convert("RGB")))
    for i, (nm, im) in enumerate(donts):
        x = 1420 + i * 380
        t = L.with_corners(im, 340)
        sh.paste(t.convert("RGB"), (x, 1460), t.split()[3])
        d.line([(x + 10, 1470), (x + 330, 1790)], fill=(210, 40, 40), width=8)
        L.label(sh, nm, (x, 1810), 22, INK, 800)
    # 4 패밀리
    L.label(sh, "4. 재료 패밀리 (스티커·빈 화면·로딩·카테고리 장식·스토어 패턴)", (80, 1900), 40, INK, 900)
    fam = Image.open(os.path.join(HERE, "family", "family_all.png"))
    fam = fam.crop((0, 90, fam.width, fam.height)).resize((2440, int(2440 * (fam.height - 90) / fam.width)), Image.LANCZOS)
    sh.paste(fam, (80, 1980))
    y0 = 1980 + fam.height + 40
    # 5 모션
    L.label(sh, "5. 모션 — 재료가 받침에 「딱」 앉는다", (80, y0), 40, INK, 900)
    mo = Image.open(os.path.join(HERE, "motion", "story_match.png"))
    mo = mo.resize((1500, int(1500 * mo.height / mo.width)), Image.LANCZOS)
    sh.paste(mo, (80, y0 + 70))
    lo = Image.open(os.path.join(HERE, "motion", "story_loading.png"))
    lo = lo.resize((900, int(900 * lo.height / lo.width)), Image.LANCZOS)
    sh.paste(lo, (1640, y0 + 70))
    y1 = y0 + 70 + max(mo.height, lo.height) + 60
    # 6 계절 + 규칙
    L.label(sh, "6. 계절 규칙 — 받침·구도·바탕은 그대로, 재료와 잎 색만 바꾼다", (80, y1), 40, INK, 900)
    se = Image.open(os.path.join(HERE, "seasonal", "seasonal_sheet.png"))
    se = se.resize((2440, int(2440 * se.height / se.width)), Image.LANCZOS)
    sh.paste(se, (80, y1 + 70))
    yy = y1 + 70 + se.height + 60
    sh = sh.crop((0, 0, W, min(5200, yy)))
    sh.save(os.path.join(HERE, "brand_board_D3.png"))
    print("board", sh.size, flush=True)


SPECS_COL = (110, 90, 0)
SUB_W = (200, 200, 206)


def main():
    what = sys.argv[1:] or ["all"]
    steps = [("family", family), ("motion", motion), ("seasonal", seasonal), ("mockups", mockups), ("stickers", sticker_set), ("board", board)]
    for name, fn in steps:
        if "all" in what or name in what:
            fn()


if __name__ == "__main__":
    main()
