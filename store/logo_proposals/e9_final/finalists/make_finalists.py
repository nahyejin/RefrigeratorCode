# -*- coding: utf-8 -*-
"""최종 후보 3안(P1·P12·P14) 다듬기·비교·풀세트 — 제안 전용(운영 자산 변경 없음).

    PYTHONIOENCODING=utf-8 python store/logo_proposals/e9_final/finalists/make_finalists.py [refine|compare|full|all] [P1|P12|P14 …]

사용자 취향: 탁한 회색·애매한 중간색 금지, 노랑/검정/흰(+초록 잎)의 선명한 대비.
형태는 E9g(큰 잎 + 작은 잎)가 기본. 평평한 면 규칙은 깨지 않는다(그라데이션·그림자 번짐 없음, 얇은 한 색 띠/초승달 면만 허용).
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
import make_e9_final as M  # noqa: E402
from PIL import Image, ImageChops, ImageDraw  # noqa: E402

F, L, D = M.F, M.L, M.D
P, SS = L.P, L.SS
INK, BRAND, WHITE, LIGHT, G2 = M.INK, M.BRAND, M.WHITE, M.LIGHT, M.G2
cr = M.cr

E9G = dict(M.BASE, leaves=[(50, 250, 124, 12, 12), (132, 152, 80, -8, 14)])
E9GB = dict(M.BASE, leaves=[(38, 270, 122, 14, 22), (126, 150, 78, -8, 22)])   # 잎을 눕힌 E9g + E9b
AMBER = (176, 118, 0)
AMBER2 = (232, 172, 0)
LEAF_MINT = (150, 225, 120)


# ---------------------------------------------------------------- 레이어(고리·초승달 지원)
def layers(p, pal):
    bowl, ball, hi, leaves = M.parts(p)
    r = p["ball_r"]
    cx, cy = 512 + p["dx"], p["rim"]
    ls = [(bowl, pal["bowl"], "bowl")]
    if pal.get("ring"):
        w = pal.get("ring_w", 12)
        ring = L.new_mask()
        ImageDraw.Draw(ring).ellipse([P(cx - r - w), P(cy - r - w), P(cx + r + w), P(cy + r + w)], fill=255)
        ls.append((ring, pal["ring"], "ring"))
    ls.append((ball, pal["ball"], "ball"))
    if pal.get("shade"):
        sh = ImageChops.subtract(ball, ImageChops.offset(ball, -P(26), -P(34)))
        ls.append((sh, pal["shade"], "shade"))
    for lm in leaves:
        ls.append((lm, pal["leaf"], "leaf"))
    return ls


def render(p, pal, size=1024):
    return F.place(layers(p, pal), 1.32, bg=pal["bg"], size=size, ycenter=420).convert("RGB")


def sym(p, pal, size=1024):
    return F.place(layers(p, pal), 1.0, bg=None, size=size, ycenter=420)


M.layers = lambda p, pal: layers(p, pal)          # M.render/M.sym/M.full 이 같은 레이어 함수를 쓰게
M.render = render


# ---------------------------------------------------------------- 후보와 다듬기
def pal(bg, bowl, ball, leaf, **kw):
    d = dict(bg=bg, bowl=bowl, ball=ball, leaf=leaf, hi=None)
    d.update(kw)
    return d


WHITE_PURE = (255, 255, 255)
YELLOW_DEEP = (255, 196, 0)
CANDS = {
    "P1": [
        ("P1·0", "원안", pal(BRAND, INK, WHITE, G2), E9G),
        ("P1·a", "재료에 진한 앰버 가는 띠(12px)", pal(BRAND, INK, WHITE, G2, ring=AMBER, ring_w=12), E9G),
        ("P1·b", "재료 아래쪽 크림 초승달 면(평평한 음영면)", pal(BRAND, INK, WHITE, G2, shade=(238, 210, 140)), E9G),
        ("P1·c", "바탕 한 단계 진한 노랑 + 앰버 띠", pal(YELLOW_DEEP, INK, WHITE, G2, ring=AMBER, ring_w=12), E9G),
    ],
    "P12": [
        ("P12·0", "원안(받침·잎 노랑)", pal(INK, BRAND, WHITE, BRAND), E9G),
        ("P12·a", "받침을 한 단계 진한 노랑(앰버)", pal(INK, AMBER2, WHITE, BRAND), E9G),
        ("P12·b", "잎만 연초록(받침 노랑)", pal(INK, BRAND, WHITE, LEAF_MINT), E9G),
        ("P12·c", "받침 앰버 + 잎 연초록", pal(INK, AMBER2, WHITE, LEAF_MINT), E9G),
    ],
    "P14": [
        ("P14·0", "원안(옅은 회백 바탕)", pal(LIGHT, INK, BRAND, G2), E9G),
        ("P14·a", "바탕을 순백으로", pal(WHITE_PURE, INK, BRAND, G2), E9G),
        ("P14·b", "순백 바탕 + 재료 호박 노랑(255,176,0)", pal(WHITE_PURE, INK, (255, 176, 0), G2), E9G),
        ("P14·c", "순백 바탕 + 재료 노랑 + 앰버 띠", pal(WHITE_PURE, INK, BRAND, G2, ring=AMBER, ring_w=12), E9G),
    ],
}


def metrics(key, pl):
    ball_bg = cr(pl["ball"], pl["bg"])
    bowl_bg = cr(pl["bowl"], pl["bg"])
    leaf_bg = cr(pl["leaf"], pl["bg"])
    ball_bowl = cr(pl["ball"], pl["bowl"])
    edge = cr(pl["ring"], pl["bg"]) if pl.get("ring") else None
    return ball_bg, bowl_bg, leaf_bg, ball_bowl, edge


def refine():
    W = 2300
    rowh = 520
    sheet = Image.new("RGB", (W, 120 + rowh * 3 + 20), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "최종 후보 3안 다듬기 — 약점을 그 안의 정신을 지키며 최소 수정(평평한 면 유지, 회색 없음)", (30, 24), 36, (20, 20, 24), 800)
    csv = ["variant,desc,ball_bg,bowl_bg,leaf_bg,ball_bowl,ring_edge"]
    for r, (fk, items) in enumerate(CANDS.items()):
        y = 100 + r * rowh
        d.line([(30, y), (W - 30, y)], fill=(225, 225, 225), width=2)
        for i, (vk, nm, pl, shape) in enumerate(items):
            x = 40 + i * 560
            im = render(shape, pl, 300)
            t = L.with_corners(im, 300)
            if pl["bg"] in (LIGHT, WHITE_PURE):
                d.rounded_rectangle([x - 1, y + 19, x + 300, y + 320], radius=67, outline=(222, 222, 220), width=2)
            sheet.paste(t.convert("RGB"), (x, y + 20), t.split()[3])
            for j, s in enumerate((60, 29)):
                sm = L.with_corners(render(shape, pl, 128), s)
                bgc = (246, 246, 244) if j == 0 else (246, 246, 244)
                d.rectangle([x + 320, y + 20 + j * 120, x + 450, y + 130 + j * 120], fill=bgc)
                sheet.paste(sm.convert("RGB"), (x + 320 + (130 - s) // 2, y + 20 + j * 120 + (110 - s) // 2), sm.split()[3])
            d.rectangle([x + 460, y + 20, x + 540, y + 130], fill=(36, 36, 42))
            sm = L.with_corners(render(shape, pl, 128), 60)
            sheet.paste(sm.convert("RGB"), (x + 470, y + 45), sm.split()[3])
            bb, bw, lf, bwl, edge = metrics(fk, pl)
            L.label(sheet, vk, (x, y + 335), 28, (20, 20, 24), 900)
            L.label(sheet, nm, (x, y + 372), 16, (80, 80, 88), 700)
            ln = [f"재료↔바탕 {bb:.2f}:1   받침↔바탕 {bw:.1f}:1", f"잎↔바탕 {lf:.1f}:1   재료↔받침 {bwl:.2f}:1"]
            if edge:
                ln.append(f"가는 띠↔바탕 {edge:.1f}:1 (재료 윤곽)")
            for k, t_ in enumerate(ln):
                L.label(sheet, t_, (x, y + 402 + k * 28), 17, (30, 30, 34), 600)
            csv.append(f"{vk},{nm},{bb:.2f},{bw:.2f},{lf:.2f},{bwl:.2f},{'' if not edge else f'{edge:.2f}'}")
    sheet.save(os.path.join(HERE, "finalists_refine.png"))
    with open(os.path.join(HERE, "finalists_metrics.csv"), "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(csv) + "\n")
    for fk, items in CANDS.items():
        for vk, nm, pl, shape in items:
            render(shape, pl, 1024).save(os.path.join(HERE, f"{vk.replace('·', '_')}_icon_1024.png"))
    print("refine done", flush=True)


# ---------------------------------------------------------------- 최종 선택(다듬기 결과 확인 후 고정)
CHOICE = {}


def set_choice(c):
    CHOICE.update(c)


def silhouette(shape, pl, size=256):
    mono = dict(bg=pl["bg"], bowl=WHITE, ball=WHITE, leaf=WHITE, hi=None)
    s = sym(shape, mono, 1024)
    bb = s.getbbox()
    s = s.crop(bb)
    k = 0.86 * 1024 / max(s.size)
    s = s.resize((int(s.width * k), int(s.height * k)), Image.LANCZOS)
    out = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    out.alpha_composite(s, ((1024 - s.width) // 2, (1024 - s.height) // 2))
    return out.resize((size, size), Image.LANCZOS)


def adaptive_fg(shape, pl):
    s = sym(shape, pl, 1024)
    bb = s.getbbox()
    c = s.crop(bb)
    k = 0.58 * 1024 / max(c.size)
    c = c.resize((int(c.width * k), int(c.height * k)), Image.LANCZOS)
    fg = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    fg.alpha_composite(c, ((1024 - c.width) // 2, (1024 - c.height) // 2))
    return fg


def masked(img_rgba, mk, s_):
    vis = img_rgba.crop((int(1024 * 18 / 108), int(1024 * 18 / 108), int(1024 * 90 / 108), int(1024 * 90 / 108))).resize((s_, s_), Image.LANCZOS)
    mask = Image.new("L", (s_ * 4, s_ * 4), 0)
    dd = ImageDraw.Draw(mask)
    if mk == "circle":
        dd.ellipse([0, 0, s_ * 4 - 1, s_ * 4 - 1], fill=255)
    else:
        dd.rounded_rectangle([0, 0, s_ * 4 - 1, s_ * 4 - 1], radius=int(s_ * 4 * 0.3), fill=255)
    vis.putalpha(mask.resize((s_, s_), Image.LANCZOS))
    return vis


def home_panel(icons, wall, size=150):
    """icons: [(label, RGB icon)] — 가상 앱 타일 사이에 섞어 넣은 홈 화면 한 장(클릭 없는 이미지)."""
    cols, rws = 4, 4
    gx, gy = 40, 92
    w = cols * size + (cols + 1) * gx
    h = rws * (size + gy) + 90
    scr = Image.new("RGBA", (w, h), (0, 0, 0, 255))
    d = ImageDraw.Draw(scr)
    for y in range(h):
        t = y / h
        if wall == "light":
            c = (int(210 + 30 * t), int(222 + 18 * t), int(240 - 10 * t))
        elif wall == "dark":
            c = (int(22 + 18 * t), int(24 + 20 * t), int(34 + 30 * t))
        else:
            c = (255, int(206 - 30 * t), int(0 + 40 * t))
        d.line([(0, y), (w, y)], fill=c + (255,))
    fg = (30, 30, 34, 255) if wall in ("light", "yellow") else (255, 255, 255, 235)
    slots = [1, 6, 11]
    gi = 0
    for i in range(cols * rws):
        r_, c_ = divmod(i, cols)
        x, y = gx + c_ * (size + gx), 50 + r_ * (size + gy)
        if i in slots:
            lab, ic = icons[slots.index(i)]
            scr.alpha_composite(L.with_corners(ic, size), (x, y))
            d.text((x + size // 2, y + size + 20), lab, font=L.font(24, 800), fill=fg, anchor="mt")
        else:
            nm, col, shp = L.APP_TILES[gi % len(L.APP_TILES)]
            gi += 1
            scr.alpha_composite(L.generic_tile(size, col, shp), (x, y))
            d.text((x + size // 2, y + size + 20), nm, font=L.font(22, 600), fill=fg, anchor="mt")
    return scr.convert("RGB")


DARKMODE = {  # iOS 다크 모드 아이콘 제안(어두운 바탕 + 선명한 색)
    "P1": dict(bg=INK, bowl=BRAND, ball=WHITE, leaf=(60, 190, 110), hi=None),
    "P12": None,
    "P14": dict(bg=INK, bowl=WHITE, ball=BRAND, leaf=(60, 190, 110), hi=None),
}


def compare():
    keys = list(CHOICE)
    W = 2900
    colw = 920
    ch = 1480
    y0 = 130
    home_h = 1100
    sheet = Image.new("RGB", (W, y0 + ch + 60 + home_h + 60), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "최종 후보 3안 같은 조건 비교 — P1 · P12 · P14 (다듬은 판)", (40, 28), 46, (20, 20, 24), 900)
    mains = {}
    for i, k in enumerate(keys):
        lab, pl, shape = CHOICE[k]
        x = 40 + i * (colw + 30)
        im = render(shape, pl, 1024)
        mains[k] = im
        d.rounded_rectangle([x, y0, x + colw, y0 + ch], radius=24, fill=(247, 247, 245))
        L.label(sheet, f"{k}  {lab}", (x + 20, y0 + 16), 30, (20, 20, 24), 900)
        t = L.with_corners(im, 360)
        sheet.paste(t.convert("RGB"), (x + 20, y0 + 70), t.split()[3])
        yy = y0 + 70
        for (bgc, label) in (((255, 255, 255), "밝은 배경"), ((30, 30, 34), "어두운 배경")):
            d.rectangle([x + 410, yy, x + 880, yy + 160], fill=bgc)
            xx = x + 430
            for s in (120, 60, 29):
                tt = L.with_corners(im, s)
                sheet.paste(tt.convert("RGB"), (xx, yy + (160 - s) // 2), tt.split()[3])
                xx += s + 20
            L.label(sheet, label, (x + 410, yy + 166), 16, (110, 110, 118), 600)
            yy += 205
        # iOS 다크 모드 제안
        dm = DARKMODE[k] or pl
        dimg = render(shape, dm, 1024)
        td = L.with_corners(dimg, 120)
        sheet.paste(td.convert("RGB"), (x + 410, y0 + 70 + 410 - 40 + 30 - 30), td.split()[3]) if False else None
        # 적응형 + 알림
        fgp = adaptive_fg(shape, pl)
        base = Image.new("RGBA", (1024, 1024), pl["bg"] + (255,))
        base.alpha_composite(fgp)
        yb = y0 + 470
        L.label(sheet, "안드로이드 적응형(원형·둥근사각) · 알림 실루엣(24dp 흰 단색)", (x + 20, yb), 20, (60, 60, 66), 700)
        xx = x + 20
        for mk in ("circle", "round"):
            v = masked(base, mk, 230)
            sheet.paste(v.convert("RGB"), (xx, yb + 40), v.split()[3])
            xx += 250
        nb = Image.new("RGBA", (230, 230), (48, 48, 54, 255))
        nb.alpha_composite(silhouette(shape, pl, 190), (20, 20))
        sheet.paste(nb.convert("RGB"), (xx, yb + 40))
        # iOS 다크 모드 제안
        ydm = yb + 300
        L.label(sheet, "iOS 다크 모드 아이콘(제안)" + (" — 원안이 이미 어두움" if DARKMODE[k] is None else ""), (x + 20, ydm), 20, (60, 60, 66), 700)
        tdm = L.with_corners(dimg, 150)
        sheet.paste(tdm.convert("RGB"), (x + 20, ydm + 36), tdm.split()[3])
        # 스토어 장 상단
        ys = ydm + 220
        L.label(sheet, "스토어 첫 장 상단 — 노랑 장 / 검정 장", (x + 20, ys), 20, (60, 60, 66), 700)
        wm_y, wm_k = L.wordmark("E9", "yellow"), L.wordmark("E9", "ink")
        ic_y = im if pl["bg"] != BRAND else dimg
        ic_k = im if pl["bg"] != INK else render(shape, dict(bg=BRAND, bowl=INK, ball=WHITE, leaf=G2, hi=None, ring=AMBER, ring_w=12), 1024)
        s1 = L.slide_top(ic_y, wm_y, "y", f"{k} · 노랑 장", 640, 620).convert("RGB").resize((430, 417))
        s2 = L.slide_top(ic_k, wm_k, "k", f"{k} · 검정 장", 640, 620).convert("RGB").resize((430, 417))
        sheet.paste(s1, (x + 20, ys + 36))
        sheet.paste(s2, (x + 470, ys + 36))
    yh = y0 + ch + 60
    L.label(sheet, "홈 화면 — 밝은 배경 · 어두운 배경 · 노랑 배경 (세 후보를 같은 칸에서, 가상 앱 타일 사이)", (40, yh), 34, (20, 20, 24), 900)
    icons = [(k, mains[k]) for k in keys]
    for i, wall in enumerate(("light", "dark", "yellow")):
        pnl = home_panel(icons, wall)
        sheet.paste(pnl, (40 + i * (pnl.width + 24), yh + 60))
    sheet.save(os.path.join(os.path.dirname(HERE), "logo_E9_최종후보3_비교.png"))
    print("compare done", flush=True)


def lean():
    keys = list(CHOICE)
    sheet = Image.new("RGB", (len(keys) * 700, 760), (255, 255, 255))
    L.label(sheet, "잎 각도 비교 — E9g(기본) vs E9g+E9b(잎 눕힘)", (30, 20), 30, (20, 20, 24), 800)
    for i, k in enumerate(keys):
        lab, pl, shape = CHOICE[k]
        for j, (sh, nm) in enumerate(((E9G, "E9g"), (E9GB, "E9g + 눕힘"))):
            im = render(sh, pl, 300)
            t = L.with_corners(im, 300)
            x = 30 + i * 700 + j * 330
            sheet.paste(t.convert("RGB"), (x, 90), t.split()[3])
            L.label(sheet, f"{k} {nm}", (x, 410), 22, (30, 30, 34), 800)
            for kk, s in enumerate((60, 29)):
                tt = L.with_corners(render(sh, pl, 128), s)
                sheet.paste(tt.convert("RGB"), (x + kk * 90, 450), tt.split()[3])
    sheet.save(os.path.join(HERE, "finalists_lean.png"))


def main():
    what = [a for a in sys.argv[1:] if a in ("refine", "compare", "full", "all")] or ["all"]
    set_choice({
        "P1": ("노랑 바탕 + 흰 재료(앰버 띠)", CANDS["P1"][1][2], E9G),
        "P12": ("검정 바탕 + 흰 재료 + 앰버 받침 + 노랑 잎", CANDS["P12"][1][2], E9G),
        "P14": ("순백 바탕 + 노랑 재료(앰버 띠)", CANDS["P14"][3][2], E9G),
    })
    if "all" in what or "refine" in what:
        refine()
    if "all" in what or "compare" in what:
        compare()
        lean()
    if "all" in what or "full" in what:
        os.makedirs(os.path.join(HERE, "fullset"), exist_ok=True)
        M.full(CANDS["P12"][1][2], CANDS["P1"][1][2], CANDS["P14"][3][2], E9G, tag="P12 정식 · P1 노랑 반전 · P14 옅은 판",
               outdir=os.path.join(HERE, "fullset"), labels=("기본(P12)", "노랑 반전(P1)", "옅은 판(P14)"))


if __name__ == "__main__":
    main()
