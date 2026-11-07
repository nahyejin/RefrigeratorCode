# -*- coding: utf-8 -*-
"""계절 리스트·컴포넌트 지도·「딱 맞는다」 설명 이미지 — 문서용 시안(앱 코드와 연결하지 않음).

    PYTHONIOENCODING=utf-8 python store/logo_proposals/e9_final/finalists/make_system_docs.py
"""
import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import make_finalists as FIN  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

M, F, L, D = FIN.M, FIN.F, FIN.L, FIN.D
P = L.P
INK, BRAND, WHITE, LIGHT = FIN.INK, FIN.BRAND, FIN.WHITE, FIN.LIGHT
AMBER2 = FIN.AMBER2


WHY_PAL = None
CONTRAST_LABEL = "29px 가독성(재료↔검정 바탕 대비)"
BOWL_NOTE = "받침 #E8AC00(고정)"
BG_NOTE = "바탕 #1A1A1E(고정)"
BOWL_CSV = "받침 고정(앰버 #E8AC00)"
COMP_NOTE = "색 토큰: 바탕 --ink-900 #1A1A1E · 재료 --brand #FFD600(밝은 배경 위 color) · 받침 제안 토큰 --brand-bowl #E8AC00 · 잎 제안 --brand-leaf #1E9252 · 한 색은 currentColor.  1순위 3곳, 2순위, 3순위, 쓰지 않음(회색)"


def cr(a, b):
    return M.cr(a, b)


# ---------------------------------------------------------------- 계절 재료 표
# (이름, 모양 kind|None, 재료색, 잎색(검정 바탕용), 적용월, 애플 위험, 용도, 대체 앱 아이콘 후보, 비고)
SEASON_ITEMS = [
    ("딸기", "strawberry", (236, 60, 90), (150, 215, 100), "12~5월(시설재배, 2~4월 절정)", "△", "배너·스티커·릴스 끝장", "봄", "시설재배 기준 — 확인 필요"),
    ("참외", "egg", (255, 222, 60), (120, 210, 110), "5~7월", "낮음", "스티커·배너", "", ""),
    ("토마토", "circle", (238, 64, 58), (84, 200, 120), "6~8월(노지 7~8월)", "⚠", "스티커(한 입 먹은 모양 금지)", "", "노지/시설 구분 — 확인 필요"),
    ("복숭아", "circle", (255, 150, 122), (120, 210, 110), "7~8월", "△", "스티커·배너", "", ""),
    ("수박", "melon", (240, 80, 90), (60, 160, 90), "6~8월", "낮음", "배너·스티커·릴스 끝장", "여름", "반원 + 초록 껍질이라 애플과 거리가 멂"),
    ("애호박", "zucchini", (140, 196, 62), (84, 200, 120), "6~9월", "낮음", "스티커", "", ""),
    ("가지", "eggplant", (140, 100, 190), (84, 200, 120), "7~9월", "낮음", "스티커", "", "보라는 어두운 바탕에서 대비 약함(○ 아님)"),
    ("배", "circle", (232, 222, 140), (120, 210, 110), "9~10월", "△", "스티커·배너", "", "노란 둥근 과일+잎 — 애플과 닮아 보일 수 있음"),
    ("밤", "circle", (170, 104, 60), (120, 210, 110), "9~10월", "낮음", "스티커", "", ""),
    ("고구마", "potato", (180, 90, 130), (120, 210, 110), "9~11월", "낮음", "스티커", "", ""),
    ("감", "persimmon", (236, 112, 40), (220, 175, 60), "10~11월(홍시 11~12월)", "낮음", "배너·스티커·릴스 끝장", "가을", "단감/대봉 시기 차이 — 확인 필요"),
    ("귤", "circle", (255, 150, 30), (90, 200, 170), "11~2월", "낮음", "배너·스티커·릴스 끝장", "겨울", "극조생 10~11월 — 확인 필요"),
    ("사과", "circle", (226, 52, 52), (84, 200, 120), "9~11월", "⚠⚠", "쓰지 않기(애플 로고 연상 최대)", "", "마크 변형으로 만들지 않는다"),
]
TEXT_ONLY = ["냉이", "달래", "두릅", "쑥", "미나리", "봄동", "마늘종", "완두콩", "햇양파", "매실", "옥수수", "포도", "대추", "감자", "무", "배추", "시금치", "대파"]

MONTHS = [
    (1, "겨울", ["귤", "무", "배추", "시금치", "대파", "딸기(시설재배 ※확인 필요)"]),
    (2, "겨울", ["귤", "무", "시금치", "딸기", "봄동(※확인 필요)"]),
    (3, "봄", ["딸기", "냉이", "달래", "쑥", "봄동(※확인 필요)"]),
    (4, "봄", ["딸기", "두릅", "쑥", "달래", "미나리(※확인 필요)"]),
    (5, "봄", ["딸기", "두릅", "참외", "마늘종", "완두콩", "햇양파(※확인 필요)"]),
    (6, "여름", ["참외", "매실", "감자", "애호박", "수박(초입)", "토마토(※확인 필요)"]),
    (7, "여름", ["수박", "참외", "옥수수", "토마토", "복숭아", "가지", "애호박"]),
    (8, "여름", ["수박", "복숭아", "옥수수", "포도", "토마토", "가지"]),
    (9, "가을", ["포도", "배", "밤", "대추", "고구마", "사과(⚠ 쓰지 않기)"]),
    (10, "가을", ["감", "배", "밤", "대추", "고구마", "사과(⚠ 쓰지 않기)"]),
    (11, "가을", ["감", "귤", "배추", "무", "시금치", "고구마"]),
    (12, "겨울", ["귤", "무", "배추", "시금치", "대파", "딸기(시설재배 시작 ※확인 필요)"]),
]
SEASON_RANGE = {"봄": "3~5월", "여름": "6~8월", "가을": "9~11월", "겨울": "12~2월"}
HEX = lambda c: "#%02X%02X%02X" % c  # noqa: E731
BY_NAME = {s[0]: s for s in SEASON_ITEMS}


def mark(name, size=110, two_leaf=True):
    """P12 정식 팔레트(검정 바탕 + 앰버 받침 + 재료색 + 잎색)로 그린 계절 재료 아이콘."""
    nm, kind, ball, leaf, *_ = BY_NAME[name]
    kw = dict(kind=kind, ball_col=ball, bowl_col=AMBER2, leaf_col=leaf, leaf_ang=50, leaf_len=250, leaf_wid=124, stem_col=(255, 244, 226))
    if kind == "melon":
        kw["leaf"] = False
    ls, cy, top = F.member_raw(**kw)
    if two_leaf and kind != "melon":
        ls.append((D.lens(504 - 0.6691 * 76, top - 14 - 0.7431 * 76, 152, 80, 132), leaf, "leaf"))
    return F.place(ls, 1.32, bg=INK, size=size, ycenter=420).convert("RGB")


def contrast_29(name):
    nm, kind, ball, *_ = BY_NAME[name]
    c = cr(ball, INK)
    return "○" if c >= 3 else "△" if c >= 1.8 else "×", c


def seasonal_csv():
    rows = []
    for nm, kind, ball, leaf, months, apple, use, alt, note in SEASON_ITEMS:
        g, c = contrast_29(nm)
        rows.append([nm, BOWL_CSV, HEX(ball), HEX(leaf), months, apple, f"{g} ({c:.1f}:1)", use, "후보" if alt else "아님", alt, note])
    with open(os.path.join(HERE, "seasonal_list.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["재료", "받침", "재료 색", "잎 색", "적용 기간", "애플 연상 위험(⚠=빨강 둥근 과일)", CONTRAST_LABEL, "앱 안 용도", "대체 앱 아이콘", "계절", "비고"])
        w.writerows(rows)
        w.writerow([])
        w.writerow(["텍스트 칩만(마크 변형 안 만듦)"] + TEXT_ONLY)
    with open(os.path.join(HERE, "seasonal_months.csv"), "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["월", "계절", "제철 재료(수산물 제외, ※확인 필요 표기)"])
        for m, s, items in MONTHS:
            w.writerow([m, s, ", ".join(items)])


def seasonal_list():
    seasons = ["봄", "여름", "가을", "겨울"]
    colw = 700
    W = 4 * colw + 5 * 24
    sheet = Image.new("RGB", (W, 3000), (250, 250, 248))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "계절·월별 제철 재료와 아이콘 변형 (받침 고정, 재료와 잎 색만 교체)", (24, 24), 44, INK, 900)
    L.label(sheet, "대체 앱 아이콘은 4개만(봄 딸기·여름 수박·가을 감·겨울 귤). 나머지는 스티커·배너·릴스 끝장용. ※확인 필요 = 재배 방식·지역에 따라 달라 농사로 등에서 재확인할 것. 수산물(주꾸미·굴 등)은 제외.", (24, 92), 22, (90, 90, 98), 600)
    for si, sn in enumerate(seasons):
        x = 24 + si * (colw + 24)
        d.rounded_rectangle([x, 150, x + colw, 2330], radius=26, fill=WHITE, outline=(228, 228, 226), width=2)
        L.label(sheet, f"{sn}  {SEASON_RANGE[sn]}", (x + 24, 168), 38, INK, 900)
        y = 240
        mlist = [m for m in MONTHS if m[1] == sn]
        mlist = sorted(mlist, key=lambda t: (t[0] + (12 if sn == "겨울" and t[0] <= 2 else 0)))
        for mo, _, items in mlist:
            d.rounded_rectangle([x + 16, y, x + colw - 16, y + 470], radius=18, fill=(247, 247, 245))
            L.label(sheet, f"{mo}월", (x + 34, y + 14), 32, INK, 900)
            xx = x + 34
            shown = 0
            for it in items:
                nm = it.split("(")[0]
                if nm in BY_NAME and shown < 4 and BY_NAME[nm][0] != "사과":
                    sm = L.with_corners(mark(nm, 100), 100)
                    sheet.paste(sm.convert("RGB"), (xx, y + 64), sm.split()[3])
                    L.label(sheet, nm, (xx + 50, y + 186), 18, INK, 800, "mm")
                    xx += 120
                    shown += 1
            ty = y + 215
            for it in items:
                nm = it.split("(")[0]
                warn = "⚠" in it
                col = (190, 40, 40) if warn else (60, 60, 66)
                L.label(sheet, "· " + it, (x + 34, ty), 22, col, 700 if warn else 600)
                ty += 32
            y += 490
        # 대체 앱 아이콘 후보
        alt = [s for s in SEASON_ITEMS if s[7] == sn]
        if alt:
            nm = alt[0][0]
            big = L.with_corners(mark(nm, 360), 300)
            d.rounded_rectangle([x + 16, 1730, x + colw - 16, 2310], radius=18, fill=(255, 246, 194))
            L.label(sheet, f"대체 앱 아이콘 후보 — {nm}", (x + 34, 1748), 26, INK, 900)
            sheet.paste(big.convert("RGB"), (x + 34, 1800), big.split()[3])
            hx = x + 360
            for k_, ln in enumerate([f"재료 {HEX(alt[0][2])}", f"잎 {HEX(alt[0][3])}", BOWL_NOTE, BG_NOTE, f"기간 {SEASON_RANGE[sn]}"]):
                L.label(sheet, ln, (hx, 1830 + k_ * 42), 22, (50, 50, 56), 700)
    # 표(요약)
    ty = 2360
    L.label(sheet, "아이콘 변형 스펙 표 (전체는 seasonal_list.csv)", (24 + 16, ty), 28, INK, 900)
    heads = ["재료", "재료 HEX", "잎 HEX", "적용 기간", "애플 위험", "29px", "용도 / 앱 아이콘"]
    xs = [40, 220, 400, 580, 1090, 1260, 1380]
    for h, xx in zip(heads, xs):
        L.label(sheet, h, (xx, ty + 50), 17, (110, 110, 118), 800)
    yy = ty + 80
    for nm, kind, ball, leaf, months, apple, use, alt, note in SEASON_ITEMS:
        g, c = contrast_29(nm)
        row = [nm, HEX(ball), HEX(leaf), months, apple, f"{g} {c:.1f}", use + (f" · 앱 아이콘({alt})" if alt else "")]
        for t_, xx in zip(row, xs):
            L.label(sheet, t_, (xx, yy), 16, (190, 40, 40) if t_ in ("⚠", "⚠⚠") else INK, 600)
        yy += 24
    sheet = sheet.crop((0, 0, W, yy + 30))
    sheet.save(os.path.join(HERE, "seasonal_list.png"))
    print("seasonal list done", flush=True)


# ---------------------------------------------------------------- 「딱 맞는다」 설명
def why_snug():
    sheet = Image.new("RGB", (2400, 1100), (255, 255, 255))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "왜 이 모양인가 — 재료가 받침에 「딱」 앉는다 = 재료와 레시피가 맞는다 (Cook + Match)", (30, 24), 42, INK, 900)
    base = dict(M.BASE, leaves=FIN.E9G["leaves"])
    pal = WHY_PAL if WHY_PAL else FIN.CANDS["P12"][1][2]

    def tile(p, lift=0, pl=pal):
        pp = dict(p)
        im = FIN.render(pp, pl, 400)
        return im

    items = [
        ("OK  딱 맞음", "재료와 받침 사이 얇은 틈 18 — 닿을 듯 말 듯, 푹 앉은 깊이(재료 중심이 받침 윗선)", base, True),
        ("NG  둥둥 뜸", "받침에 안 닿고 떠 있다 — 「맞는다」가 아니라 「떨어진다」", dict(base, rim=470), False),
        ("NG  틈이 큼", "틈 44 — 헐렁해서 맞는다는 느낌이 없다", dict(base, gap=44), False),
        ("NG  너무 깊음", "재료가 받침에 파묻혀 주인공이 사라짐", dict(base, ball_r=172), False),
        ("NG  틈이 없음", "틈 0 — 하나로 뭉쳐 두 조각의 만남이 안 보인다", dict(base, gap=0), False),
    ]
    x = 30
    for i, (t, sub, p, ok) in enumerate(items):
        if i == 1:
            pp = dict(p)
            ball_lift = 70
        im = None
        if i == 0:
            im = FIN.render(p, pal, 400)
        elif i == 1:
            ls = FIN.layers(p, pal)
            ls2 = []
            for m, c, tg in ls:
                if tg in ("ball", "leaf", "ring", "shade"):
                    m = F.ImageChops.offset(m, 0, -P(55))
                ls2.append((m, c, tg))
            im = F.place(ls2, 1.32, bg=pal["bg"], size=400, ycenter=420).convert("RGB")
        elif i == 3:
            ls = FIN.layers(p, pal)
            ls2 = []
            for m, c, tg in ls:
                if tg in ("ball", "leaf"):
                    m = F.ImageChops.offset(m, 0, P(70))
                ls2.append((m, c, tg))
            # 깊이 파묻기: 받침을 재료 위에 다시 덮는다(받침 마스크를 맨 위로)
            bowl = ls2[0]
            ls2 = ls2[1:] + [bowl]
            im = F.place(ls2, 1.32, bg=pal["bg"], size=400, ycenter=420).convert("RGB")
        else:
            im = FIN.render(p, pal, 400)
        t_ = L.with_corners(im, 400)
        sheet.paste(t_.convert("RGB"), (x, 120), t_.split()[3])
        d.rounded_rectangle([x, 540, x + 400, 590], radius=10, fill=(30, 140, 70) if ok else (200, 50, 50))
        L.label(sheet, t, (x + 14, 565), 24, WHITE, 900, "lm")
        # 설명 줄바꿈
        words = sub
        lines = [words[j:j + 22] for j in range(0, len(words), 22)]
        for k_, ln in enumerate(lines[:4]):
            L.label(sheet, ln, (x, 610 + k_ * 30), 20, (50, 50, 56), 600)
        x += 460
    L.label(sheet, "딱 맞음이 보이는 세 가지: ① 간격(재료와 받침 사이 얇은 틈, 항상 같은 폭) ② 앉는 깊이(재료 중심 = 받침 윗선, 반쯤 앉음) ③ 모션(위에서 내려와 0.4초 안에 앉고 한 번 눌렸다 올라옴).", (30, 790), 26, INK, 800)
    L.label(sheet, "하지 말 것: 둥둥 뜬 재료, 받침에 안 닿는 재료, 헐렁한 틈, 틈 없이 뭉친 모양, 재료를 받침 밖으로 굴려 두는 연출(빈 화면 「굴러 나간」 장면은 예외 — 맞는 레시피가 없음을 뜻할 때만).", (30, 840), 22, (190, 40, 40), 700)
    sheet = sheet.crop((0, 0, 2400, 910))
    sheet.save(os.path.join(HERE, "why_snug.png"))
    print("why snug done", flush=True)


PAL_COLOR = dict(bg=WHITE, bowl=INK, ball=BRAND, leaf=(30, 146, 82), hi=None)
PAL_REV = dict(bg=INK, bowl=AMBER2, ball=WHITE, leaf=BRAND, hi=None)
PAL_ON_YELLOW = dict(bg=BRAND, bowl=INK, ball=WHITE, leaf=(30, 146, 82), hi=None)
PAL_MONO_W = dict(bg=INK, bowl=WHITE, ball=WHITE, leaf=WHITE, hi=None)
PAL_MONO_K = dict(bg=WHITE, bowl=INK, ball=INK, leaf=INK, hi=None)
SHAPE = FIN.E9G


def mark_preview(tone, size, ingredient=None):
    if ingredient:
        kw = dict(kind=ingredient[0], ball_col=ingredient[1], bowl_col=INK, leaf_col=(30, 146, 82), leaf_ang=50, leaf_len=250, leaf_wid=124)
        ls, cy, top = F.member_raw(**kw)
        ls.append((D.lens(504 - 0.6691 * 76, top - 14 - 0.7431 * 76, 152, 80, 132), (30, 146, 82), "leaf"))
        return F.place(ls, 1.0, bg=None, size=size, ycenter=420)
    pal = {"color": PAL_COLOR, "reverse": PAL_REV, "mono_w": PAL_MONO_W, "mono_k": PAL_MONO_K, "on_yellow": PAL_ON_YELLOW}[tone]
    return F.place(FIN.layers(SHAPE, pal), 1.0, bg=None, size=size, ycenter=420)


CARDS = [
    (1, "스플래시", "components/SplashScreen.tsx", "reverse", 120, "검정 바탕", "reverse 풀컬러 120px · 입장 시 1회 「딱」 앉기(0.4s)", "앱 아이콘(검정 바탕)과 같은 얼굴로 시작. 반복 재생 금지."),
    (1, "매칭 계산 로딩", "components/FloatingScanLoader.tsx", "color", 72, "밝은 배경", "color 72px · 재료가 내려와 앉기를 루프(1.2s)", "지금의 「칸이 하나씩 맞춰지는」 그림과 같은 말 — 교체/통합 1순위. AI 대기(StepLoading·scan-frame)에는 쓰지 않는다(크레딧 신호)."),
    (1, "빈 화면(레시피 0건·재료 0개)", "pages/RecipeList.tsx : 2746 · 2776", "color", 88, "밝은 배경", "color 88px · 토마토 등 재료 1개", "「맞는 레시피가 없어요」 재료가 받침 옆으로 굴러 나간 연출만 예외. 섹션 안의 작은 「재료가 아직 없어요」(MyFridge.tsx:2891 등)에는 쓰지 않는다."),
    (2, "「내 재료 N/M」 배지", "components/RecipeCard.tsx : 787 (RecipeRow.tsx)", "color", 16, "밝은 배경", "color 16px · M/M(전부 보유)일 때만 · 처음 보일 때 1회 앉기", "카드마다 깔지 않는다. 스크롤 중 재생 금지(IntersectionObserver 로 화면에 들어올 때 1회)."),
    (2, "사진 인식 완료", "components/IngredientRecognitionSheet.tsx : 691", "color", 28, "밝은 배경", "color 28px · 결과 시트가 열릴 때 1회 앉기", "기다리는 동안은 StepLoading(AI·크레딧 신호)을 그대로 쓴다. 마크는 완료 순간에만."),
    (2, "식단 짜기 완성", "pages/WeeklyPlan.tsx", "color", 36, "밝은 배경", "color 36px · 결과 카드 상단 · 완성 순간 1회", "AI 결과 카드의 「AI」 칩(별 모양 표시)과 나란히 두지 않는다(별 모양 표시는 AI 전용)."),
    (2, "성공 토스트(딱 맞아요)", "components/Toast.tsx · RecipeToast.tsx", "mono_w", 20, "토스트(검정 92%)", "mono 20px(흰) · 「딱 맞아요」 같은 성공 메시지에만", "일반 토스트(저장됨·오류)에는 쓰지 않는다."),
    (2, "푸시 알림 아이콘", "components/NativePushBridge.tsx · android drawable-*/ic_stat_cookmatch.png(5개)", "mono_w", 48, "알림창", "mono 24dp 흰 실루엣(투명 PNG)", "받침·재료·잎이 한 덩어리로 보이게 틈 없는 판을 따로 만든다(작은 크기에서 틈이 뭉개짐)."),
    (2, "홈 화면 위젯", "android res/layout/widget_*.xml · ios CookMatchWidget/*.swift", "color", 32, "밝은/노랑", "color 또는 mono 18~32px · 모서리 한 곳", "위젯 전체를 마크로 덮지 않는다. 위젯 이름·기능이 먼저."),
    (3, "온보딩 · 사용 가이드", "components/GuideOverlay.tsx · PWAInstallGuide.tsx", "reverse", 56, "어두운 면", "reverse 56px · 첫 장 한 번", "단계마다 반복해 깔지 않는다."),
    (3, "마이페이지 기본 프로필", "pages/MyPage.tsx : 24 (assets/profile_default.png)", "color", 56, "밝은 배경", "color 56px · 사용자가 사진을 안 올렸을 때만", "사용자의 사진이 있으면 쓰지 않는다. 가족 구성원마다 재료를 달리 줄 수 있음(후보)."),
    (3, "쿡 픽 · 쿡 코치 아바타", "components/RecipeChatWidget.tsx : 561, 688 · components/CookCoach.tsx : 85", "mono_k", 40, "AI 기능 아이콘 체계", "지금 그대로(선 아이콘 포크·나이프 / 요리사 모자)", "AI 기능은 별 표시·선 아이콘 체계라 마크로 바꾸지 않는다. 마크는 첫 인사말 옆 28px 장식 정도만 검토."),
    (3, "스토어 첫 장 · 릴스 끝장", "store/make_store_assets_v3.py · my-video/src/shared.tsx", "reverse", 100, "노랑/검정 장", "풀컬러 + 패밀리 도형 · 끝장에 1회 앉기", "노랑 장에는 검정 바탕 아이콘, 검정 장에는 노랑 반전 아이콘을 쓴다."),
    (0, "헤더 (TopNavBar)", "components/TopNavBar.tsx : 3, 88", None, 0, "밝은 배경", "마크 없이 워드마크(높이 20px)만", "헤더에 마크까지 넣으면 혼잡. 마크는 스플래시·빈 화면·완료 순간에 아낀다."),
    (0, "하단 탭 · 버튼 · 카드 일반", "components/BottomNavBar.tsx · PrimaryButton.tsx · 카드류", None, 0, "—", "쓰지 않는다", "모든 버튼·카드에 마크를 깔면 의미가 닳는다(과사용 금지)."),
]


def component_map():
    cols = 3
    cw, chh = 1000, 470
    rows = (len(CARDS) + cols - 1) // cols
    W = cols * cw + (cols + 1) * 24
    sheet = Image.new("RGB", (W, 200 + rows * (chh + 24) + 40), (246, 246, 244))
    d = ImageDraw.Draw(sheet)
    L.label(sheet, "앱 전반 컴포넌트 지도 — 어디에 마크를 쓰고 어디에 쓰지 않나 (쿡매치 E9g, 제안)", (24, 24), 44, INK, 900)
    L.label(sheet, COMP_NOTE, (24, 100), 22, (80, 80, 88), 600)
    pri_col = {1: (30, 140, 70), 2: (230, 160, 0), 3: (120, 120, 130), 0: (200, 50, 50)}
    pri_txt = {1: "1순위", 2: "2순위", 3: "3순위", 0: "쓰지 않음"}
    for i, (pri, title, path, tone, size, bgname, spec, rule) in enumerate(CARDS):
        r_, c_ = divmod(i, cols)
        x, y = 24 + c_ * (cw + 24), 170 + r_ * (chh + 24)
        d.rounded_rectangle([x, y, x + cw, y + chh], radius=24, fill=WHITE, outline=(228, 228, 226), width=2)
        d.rounded_rectangle([x + 20, y + 20, x + 20 + 120, y + 58], radius=19, fill=pri_col[pri])
        L.label(sheet, pri_txt[pri], (x + 80, y + 40), 22, WHITE, 900, "mm")
        L.label(sheet, title, (x + 160, y + 40), 30, INK, 900, "lm")
        L.label(sheet, path, (x + 20, y + 82), 17, (100, 100, 108), 600)
        # 미리보기
        pv = Image.new("RGBA", (260, 260), (0, 0, 0, 0))
        if tone:
            dark = tone in ("reverse", "mono_w")
            bg = BRAND if tone == "on_yellow" else (INK if dark else WHITE)
            if tone == "mono_k":
                bg = (245, 245, 247)
            tile = Image.new("RGBA", (260, 260), bg + (255,))
            ing = ("circle", (238, 64, 58)) if title.startswith("빈 화면") else None
            s_ = mark_preview(tone if not ing else "color", 200 if size >= 40 else 200, ing)
            tile.alpha_composite(s_.resize((200, 200), Image.LANCZOS), (30, 40))
            msk = Image.new("L", (260, 260), 0)
            ImageDraw.Draw(msk).rounded_rectangle([0, 0, 259, 259], radius=40, fill=255)
            tile.putalpha(msk)
            sheet.paste(tile.convert("RGB"), (x + 20, y + 120), tile.split()[3])
            # 실제 px 크기로 한 번 더
            real = max(16, min(size, 120))
            r_im = mark_preview(tone if not ing else "color", real * 2, ing).resize((real, real), Image.LANCZOS)
            bgp = Image.new("RGBA", (real + 24, real + 24), bg + (255,))
            bgp.alpha_composite(r_im, (12, 12))
            sheet.paste(bgp.convert("RGB"), (x + 300, y + 120))
            L.label(sheet, f"실제 {size}px", (x + 300, y + 130 + real + 40), 16, (100, 100, 108), 600)
        else:
            d.rounded_rectangle([x + 20, y + 120, x + 280, y + 380], radius=40, fill=(238, 238, 238))
            L.label(sheet, "마크 없음", (x + 150, y + 250), 30, (160, 160, 168), 900, "mm")
        L.label(sheet, "바탕: " + bgname, (x + 470, y + 130), 18, (100, 100, 108), 600)
        # 문구 줄바꿈
        def wrap(t, n):
            return [t[j:j + n] for j in range(0, len(t), n)]
        yy = y + 170
        for ln in wrap(spec, 27):
            L.label(sheet, ln, (x + 470, yy), 22, INK, 800)
            yy += 30
        yy += 14
        for ln in wrap(rule, 29):
            L.label(sheet, ln, (x + 470, yy), 19, (190, 40, 40) if pri != 0 else (70, 70, 76), 600)
            yy += 27
    sheet.save(os.path.join(HERE, "component_map.png"))
    print("component map done", flush=True)


if __name__ == "__main__":
    seasonal_csv()
    seasonal_list()
    why_snug()
    component_map()
