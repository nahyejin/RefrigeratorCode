# -*- coding: utf-8 -*-
"""P1 확정(앰버 띠 제외) — 재료를 살리는 최소 보정 비교 · 풀세트 · 계절 아이콘 · 브랜드 보드 — 제안 전용.

    PYTHONIOENCODING=utf-8 python store/logo_proposals/e9_final/p1_final/make_p1_final.py [compare|full|seasonal|docs|board|all]

색은 노랑 #FFD600 · 검정 #1A1A1E · 흰색 · 진초록 잎(#1E9252)만. 앰버·주황 계열 띠/테두리/그림자는 쓰지 않는다.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
FIN_DIR = os.path.join(os.path.dirname(HERE), "finalists")
sys.path.insert(0, FIN_DIR)
import make_finalists as FIN  # noqa: E402
import make_system_docs as SD  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

M, F, L, D = FIN.M, FIN.F, FIN.L, FIN.D
INK, BRAND, WHITE, LIGHT, G2 = FIN.INK, FIN.BRAND, FIN.WHITE, FIN.LIGHT, FIN.G2
cr = M.cr
E9G = FIN.E9G
CREAM_YELLOW = (247, 233, 168)      # F7E9A8 — 앰버가 아니라 바탕보다 살짝 연한 크림 노랑
BRAND_SHARP = (255, 208, 0)         # #FFD000 — 브랜드 노랑에서 한 톤만 더 선명하게


def pal(bg, bowl, ball, leaf, **kw):
    d = dict(bg=bg, bowl=bowl, ball=ball, leaf=leaf, hi=None)
    d.update(kw)
    return d


# (키, 설명, 팔레트, 형태)
VARIANTS = [
    ("① 순수 P1", "띠 없음 — 노랑 #FFD600 + 흰 재료 + 검정 받침 + 진초록 잎", pal(BRAND, INK, WHITE, G2), E9G),
    ("② 크림 초승달 면", "흰 재료 오른쪽 아래에 크림 노랑(#F7E9A8) 평평한 초승달 면", pal(BRAND, INK, WHITE, G2, shade=CREAM_YELLOW), E9G),
    ("③ 바탕 한 톤 진하게", "바탕 #FFD000 (브랜드 노랑에서 최소 변화)", pal(BRAND_SHARP, INK, WHITE, G2), E9G),
    ("④ 틈 넓힘", "받침과 재료 사이 틈 18 → 32", pal(BRAND, INK, WHITE, G2), dict(E9G, gap=32)),
    ("⑤ 틈 좁힘(참고)", "틈 18 → 8 — 재료 아랫부분이 검정 받침과 맞닿듯", pal(BRAND, INK, WHITE, G2), dict(E9G, gap=8)),
]


def render(shape, pl, size=1024):
    return FIN.render(shape, pl, size)


def compare():
    rowh = 330
    W = 2800
    sheet = Image.new("RGB", (W, 150 + rowh * len(VARIANTS) + 40), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "P1 확정 — 앰버 띠 없이 재료를 살리는 최소 보정 비교 (색은 노랑·검정·흰·초록 잎만)", (40, 28), 40, (20, 20, 24), 900)
    L.label(sheet, "※ 재료↔바탕 대비는 원래대로 약하다(1.41:1) — 사용자가 알고 선택했다. 숫자는 숨기지 않고 표기한다.", (40, 86), 22, (190, 40, 40), 700)
    heads = [("아이콘 1024→260", 470), ("실제 크기 120·60·29px", 790), ("홈 화면: 밝은 / 어두운 / 노랑 배경", 1290)]
    for t, x in heads:
        L.label(sheet, t, (x, 120), 20, (110, 110, 118), 700)
    for r, (key, desc, pl, shape) in enumerate(VARIANTS):
        y = 150 + r * rowh
        d.line([(30, y), (W - 30, y)], fill=(225, 225, 225), width=2)
        L.label(sheet, key, (40, y + 20), 30, (20, 20, 24), 900)
        im = render(shape, pl, 1024)
        t = L.with_corners(im, 260)
        sheet.paste(t.convert("RGB"), (470, y + 30), t.split()[3])
        L.label(sheet, desc[:26], (40, y + 64), 16, (80, 80, 88), 700)
        L.label(sheet, desc[26:], (40, y + 84), 16, (80, 80, 88), 700)
        bb = cr(pl["ball"], pl["bg"])
        edge = None
        ln = [f"재료↔바탕 {bb:.2f}:1", f"받침↔바탕 {cr(pl['bowl'], pl['bg']):.1f}:1", f"잎↔바탕 {cr(pl['leaf'], pl['bg']):.1f}:1"]
        if pl.get("shade"):
            ln.append(f"초승달↔재료 {cr(pl['shade'], pl['ball']):.2f}:1 · ↔바탕 {cr(pl['shade'], pl['bg']):.2f}:1")
        for k, s_ in enumerate(ln):
            L.label(sheet, s_, (40, y + 124 + k * 30), 19, (30, 30, 34), 700)
        # 실제 크기
        xx = 790
        for bgc in ((255, 255, 255), (30, 30, 34)):
            d.rectangle([xx, y + 30, xx + 230, y + 150], fill=bgc)
            x2 = xx + 12
            for s in (60, 29):
                tt = L.with_corners(im, s)
                sheet.paste(tt.convert("RGB"), (x2, y + 30 + (120 - s) // 2), tt.split()[3])
                x2 += s + 18
            xx += 240
        # 120px
        t120 = L.with_corners(im, 120)
        sheet.paste(t120.convert("RGB"), (790, y + 170), t120.split()[3])
        L.label(sheet, "120px", (790, y + 296), 14, (110, 110, 118), 600)
        # 홈 화면 3장(작게)
        for i, wall in enumerate(("light", "dark", "yellow")):
            pnl = FIN.home_panel([("P1", im), ("", im), ("", im)], wall, size=88)
            pnl = pnl.crop((0, 0, pnl.width, 300))
            pnl = pnl.resize((int(pnl.width * 0.72), int(300 * 0.72)))
            sheet.paste(pnl, (1290 + i * (pnl.width + 16), y + 20))
    sheet.save(os.path.join(HERE, "logo_P1_확정_비교.png"))
    for key, desc, pl, shape in VARIANTS:
        n = key.split(" ")[0].replace("①", "1").replace("②", "2").replace("③", "3").replace("④", "4").replace("⑤", "5")
        render(shape, pl, 1024).save(os.path.join(HERE, f"P1_variant{n}_icon_1024.png"))
    print("compare done", flush=True)


# ---------------------------------------------------------------- 확정안(순수 P1) 풀세트
P1_PAL = pal(BRAND, INK, WHITE, G2)                  # 정식: 노랑 바탕 + 검정 받침 + 흰 재료 + 진초록 잎
P1_BLACK = pal(INK, BRAND, WHITE, (60, 190, 110))    # 검정 바탕판(노랑 장 위에서 타일이 사라지지 않게)
P1_LIGHT = pal(WHITE, INK, BRAND, G2)                # 옅은(흰) 바탕판: 재료 노랑
SHAPE = E9G


def full():
    fd = os.path.join(HERE, "fullset")
    os.makedirs(fd, exist_ok=True)
    M.full(P1_PAL, P1_BLACK, P1_LIGHT, SHAPE, tag="P1 확정(띠 없음)", outdir=fd, labels=("기본 P1", "검정 바탕판", "옅은 판"))
    print("full done", flush=True)


# ---------------------------------------------------------------- 계절 아이콘 4종 (P1 문법: 바탕 노랑·받침 검정 고정, 재료와 잎만 교체)
def darker(c, k=0.62):
    return tuple(int(v * k) for v in c)


def p1_mark(name, size=110, two_leaf=True):
    nm, kind, ball, leaf, *_ = SD.BY_NAME[name]
    kw = dict(kind=kind, ball_col=ball, bowl_col=INK, leaf_col=leaf, leaf_ang=50, leaf_len=250, leaf_wid=124, stem_col=(255, 244, 226))
    if kind == "melon":
        kw["leaf"] = False
    ls, cy, top = F.member_raw(**kw)
    if two_leaf and kind != "melon":
        ls.append((D.lens(504 - 0.6691 * 76, top - 14 - 0.7431 * 76, 152, 80, 132), leaf, "leaf"))
    return F.place(ls, 1.32, bg=BRAND, size=size, ycenter=420).convert("RGB")


def p1_contrast(name):
    ball = SD.BY_NAME[name][2]
    c = cr(ball, BRAND)
    return ("○" if c >= 3 else "△" if c >= 1.8 else "×"), c


def seasonal():
    items = []
    for it in SD.SEASON_ITEMS:
        nm, kind, ball, leaf, *rest = it
        items.append((nm, kind, ball, darker(leaf), *rest))
    SD.SEASON_ITEMS = items
    SD.BY_NAME = {s[0]: s for s in items}
    SD.mark = p1_mark
    SD.contrast_29 = p1_contrast
    SD.HERE = HERE
    SD.BOWL_NOTE, SD.BG_NOTE = "받침 #1A1A1E(고정)", "바탕 #FFD600(고정)"
    SD.BOWL_CSV = "받침 고정(검정 #1A1A1E)"
    SD.CONTRAST_LABEL = "29px 가독성(재료↔노랑 바탕 대비)"
    SD.seasonal_csv()
    SD.seasonal_list()
    SD.WHY_PAL = P1_PAL
    SD.why_snug()
    # 대체 앱 아이콘 4종 파일
    for sn, nm in (("봄", "딸기"), ("여름", "수박"), ("가을", "감"), ("겨울", "귤")):
        p1_mark(nm, 1024).save(os.path.join(HERE, f"seasonal_{sn}_{nm}_1024.png"))
    print("seasonal done", flush=True)


def component_docs():
    SD.HERE = HERE
    SD.COMP_NOTE = "색 토큰(앰버 없음): 받침 --ink-900 #1A1A1E · 재료 흰색 / 밝은 배경 위 --brand #FFD600 · 노랑 바탕 --brand #FFD600 · 잎 제안 --brand-leaf #1E9252 · 한 색은 currentColor.  1순위 3곳, 2순위, 3순위, 쓰지 않음"
    SD.PAL_REV = pal(INK, BRAND, WHITE, BRAND)
    cards = []
    for c in SD.CARDS:
        pri, title, path, tone, size, bgname, spec, rule = c
        if title == "스플래시":
            tone, spec, bgname = "on_yellow", "노랑 바탕 위 P1(검정 받침·흰 재료) 120px · 입장 시 1회 「딱」 앉기(0.4s)", "노랑 바탕"
        if title.startswith("스토어"):
            tone, spec = "on_yellow", "풀컬러 + 패밀리 도형 · 끝장에 1회 앉기"
        cards.append((pri, title, path, tone, size, bgname, spec, rule))
    SD.CARDS = cards
    SD.component_map()


def board():
    fd = os.path.join(HERE, "fullset")
    W = 2600
    sh = Image.new("RGB", (W, 7600), (250, 250, 248))
    d = ImageDraw.Draw(sh)
    L.label(sh, "쿡매치 브랜드 보드 — P1 확정 (앰버 띠 제외, 제안)", (80, 60), 64, INK, 900)
    L.label(sh, "재료가 받침에 「딱」 앉는다 = 재료와 레시피가 맞는다. 색은 노랑·검정·흰색 + 초록 잎만.", (80, 148), 32, (110, 110, 118), 600)
    base = Image.open(os.path.join(fd, "app_icon_1024.png"))
    t = L.with_corners(base, 520)
    L.label(sh, "1. 로고", (80, 240), 40, INK, 900)
    sh.paste(t.convert("RGB"), (80, 310), t.split()[3])
    for i, fn in enumerate(("app_icon_reverse_1024.png", "app_icon_light_1024.png")):
        im = Image.open(os.path.join(fd, fn))
        t2 = L.with_corners(im, 250)
        sh.paste(t2.convert("RGB"), (640 + i * 290, 310), t2.split()[3])
    for i, s_ in enumerate((120, 60, 29)):
        t3 = L.with_corners(base, s_)
        sh.paste(t3.convert("RGB"), (640 + i * 150, 600), t3.split()[3])
    L.label(sh, "노랑(기본)·검정판·옅은 판 / 120·60·29px", (640, 740), 20, (110, 110, 118), 600)
    lk = Image.open(os.path.join(fd, "lockups_3.png"))
    lk = lk.resize((1300, int(1300 * lk.height / lk.width)), Image.LANCZOS)
    sh.paste(lk, (1260, 240))
    y = 1130
    L.label(sh, "2. 색 (앰버·주황 계열 없음)", (80, y), 40, INK, 900)
    sw = [("노랑 바탕", BRAND, "#FFD600"), ("검정 받침", INK, "#1A1A1E"), ("흰 재료", WHITE, "#FFFFFF"), ("진초록 잎", G2, "#1E9252"), ("옅은 바탕", LIGHT, "#F7F7F5")]
    for i, (nm, c, hx) in enumerate(sw):
        x = 80 + i * 250
        d.rounded_rectangle([x, y + 70, x + 230, y + 270], radius=26, fill=c, outline=(225, 225, 225), width=2)
        L.label(sh, nm, (x, y + 285), 24, INK, 800)
        L.label(sh, hx, (x, y + 320), 22, (110, 110, 118), 600)
    L.label(sh, "재료 색은 재료 하나당 한 가지(패밀리/계절). 재료↔노랑 바탕 대비는 흰 재료 1.41:1 로 약하다 — 알고 고른 선택.", (80, y + 380), 24, (190, 40, 40), 700)
    L.label(sh, "3. 사용 규칙", (1420, y), 40, INK, 900)
    rules = ["여백: 받침 두께(심볼 높이의 약 1/6) 이상을 사방에 비운다", "최소 크기: 앱 아이콘 29px, 워드마크 높이 16px, 알림 아이콘은 단색 실루엣",
             "노랑 장 위에는 검정 바탕판, 검정 장 위에는 노랑(기본) 아이콘", "받침은 항상 검정(검정 바탕판에서는 노랑), 잎은 항상 초록, 재료만 색을 바꾼다",
             "하지 말 것: 그라데이션·그림자, 앰버·주황 띠/테두리, 늘리거나 기울이기, 잎 빼기"]
    for i, t_ in enumerate(rules):
        L.label(sh, "• " + t_, (1420, y + 80 + i * 54), 24, (40, 40, 46), 600)
    y += 460
    L.label(sh, "4. 왜 이 모양인가 — 「딱 맞는다」", (80, y), 40, INK, 900)
    ws = Image.open(os.path.join(HERE, "why_snug.png"))
    ws = ws.resize((2440, int(2440 * ws.height / ws.width)), Image.LANCZOS)
    sh.paste(ws, (80, y + 70))
    y += 70 + ws.height + 50
    L.label(sh, "5. 재료 패밀리 (같은 받침·같은 잎, 재료만 교체)", (80, y), 40, INK, 900)
    fam = Image.open(os.path.join(os.path.dirname(FIN_DIR), "..", "logo_proposals", "d3_variants", "family", "family_all.png")) if False else Image.open(os.path.join(os.path.dirname(os.path.dirname(HERE)), "d3_variants", "family", "family_all.png"))
    fam = fam.crop((0, 90, fam.width, fam.height))
    fam = fam.resize((1800, int(1800 * fam.height / fam.width)), Image.LANCZOS)
    sh.paste(fam, (80, y + 70))
    y += 70 + fam.height + 50
    L.label(sh, "6. 모션 — 재료가 받침에 「딱」 앉는다", (80, y), 40, INK, 900)
    mo = Image.open(os.path.join(os.path.dirname(os.path.dirname(HERE)), "d3_variants", "motion", "story_match.png"))
    mo = mo.resize((1500, int(1500 * mo.height / mo.width)), Image.LANCZOS)
    sh.paste(mo, (80, y + 70))
    y += 70 + mo.height + 50
    L.label(sh, "7. 계절 규칙 — 받침·구도·노랑 바탕은 그대로, 재료와 잎 색만 바꾼다", (80, y), 40, INK, 900)
    se = Image.open(os.path.join(HERE, "seasonal_list.png"))
    se = se.resize((2440, int(2440 * se.height / se.width)), Image.LANCZOS)
    sh.paste(se, (80, y + 70))
    y += 70 + se.height + 60
    sh = sh.crop((0, 0, W, y))
    sh.save(os.path.join(HERE, "brand_board_P1.png"))
    print("board", sh.size, flush=True)


def main():
    what = [a for a in sys.argv[1:] if a in ("compare", "full", "seasonal", "docs", "board", "all")] or ["all"]
    if "all" in what or "compare" in what:
        compare()
    if "all" in what or "full" in what:
        full()
    if "all" in what or "seasonal" in what:
        seasonal()
    if "all" in what or "docs" in what:
        component_docs()
    if "all" in what or "board" in what:
        board()


if __name__ == "__main__":
    main()
