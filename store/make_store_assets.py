# -*- coding: utf-8 -*-
"""스토어 등록용 이미지 전부를 한 번에 다시 만든다 — 아이콘·피처 그래픽·스크린샷.

    python store/make_store_assets.py            # 전부
    python store/make_store_assets.py icons      # 아이콘만(앱 프로젝트 안 아이콘까지 교체)
    python store/make_store_assets.py shots      # 스크린샷만

왜 스크립트인가:
    카피 한 줄, 화면 한 장만 바꿔도 사이즈별(플레이/앱스토어)로 전부 다시 뽑아야
    해서, 손으로 편집하면 금방 서로 어긋난다. 여기 SLIDES 표만 고치고 다시 돌린다.

만드는 것:
    store/icons/appstore_icon_1024.png   App Store 아이콘(1024, 투명 없음 — 애플 필수 조건)
    store/icons/play_icon_512.png        Google Play 고해상도 아이콘(512, 꽉 찬 정사각)
    store/play_feature_graphic.png       Google Play 피처 그래픽(1024x500, 필수)
    store/screenshots/play/NN_*.png      Play 폰 스크린샷 1080x1920 (9:16 — 긴 변 ≤ 짧은 변×2 조건)
    store/screenshots/ios/NN_*.png       App Store 6.9" 스크린샷 1290x2796
    + 앱 프로젝트 안 아이콘 교체:
      frontend/ios/.../AppIcon-512@2x.png (지금까지 Capacitor 기본 placeholder였음)
      frontend/android/.../mipmap-*/ic_launcher*.png + 적응형 아이콘 xml

아이콘 원본(frontend/assets/icon.png)은 모서리를 둥글게 깎은(투명) 그림이라 그대로
쓰면 스토어·런처가 한 번 더 둥글게 잘라 "이중 모서리"가 된다. 그래서 원본에서 흰 로고
글리프와 배경 그라데이션을 따로 뽑아, **모서리까지 꽉 찬 정사각형**으로 다시 그린다.

스크린샷은 목업이 아니라 **실제 앱 화면**(릴스 데모용 화면 녹화)에서 뽑는다 — 애플
심사는 스크린샷이 실제 앱 사용 모습을 보여줄 것을 요구한다. 녹화본 상단의 상태바·
녹화 표시는 잘라내고, 헤더의 계정 이름은 블러 처리한다.
"""

import os
import subprocess
import sys
import time

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORE = os.path.join(ROOT, "store")
VIDEO_PUBLIC = os.path.join(ROOT, "my-video", "public")
FRONT = os.path.join(ROOT, "frontend")
ICON_SRC = os.path.join(FRONT, "assets", "icon.png")
FRAME_CACHE = os.path.join(STORE, ".frames")  # 영상에서 뽑은 원본 프레임(재생성 가능, gitignore)

FONT_VF = "C:/Windows/Fonts/NotoSansKR-VF.ttf"

INK = (26, 26, 30)
BRAND = (255, 214, 0)
BRAND_LIGHT = (255, 228, 92)
PAGE_LIGHT = (246, 246, 244)


def font(size, weight=700):
    f = ImageFont.truetype(FONT_VF, size)
    try:
        f.set_variation_by_axes([weight])
    except Exception:  # noqa: BLE001 — 가변 축이 없으면 기본 굵기로
        pass
    return f


# ---------------------------------------------------------------------------
# 아이콘
# ---------------------------------------------------------------------------

def _diag_gradient_lut(src):
    """원본 아이콘의 배경색을 대각선(좌상→우하) 위치별로 평균 내 LUT로 만든다.
    투명 모서리 쪽 값이 비면 가까운 칸 값으로 채운다."""
    W, H = src.size
    px = src.load()
    bins = 256
    acc = [[0, 0, 0, 0] for _ in range(bins)]
    for y in range(0, H, 2):
        for x in range(0, W, 2):
            r, g, b, a = px[x, y]
            if a < 250 or b > 60:  # 투명 모서리·흰 글리프(파랑이 높음) 제외
                continue
            i = min(bins - 1, int((x + y) / (W + H) * bins))
            c = acc[i]
            c[0] += r; c[1] += g; c[2] += b; c[3] += 1
    lut = [None] * bins
    for i, (r, g, b, n) in enumerate(acc):
        if n:
            lut[i] = (r / n, g / n, b / n)
    known = [i for i, v in enumerate(lut) if v]
    for i in range(bins):
        if lut[i] is None:
            j = min(known, key=lambda k: abs(k - i))
            lut[i] = lut[j]
    return lut


def _glyph_alpha(src):
    """흰 로고 글리프의 알파(가장자리 안티앨리어싱 유지). 배경은 파랑 채널이 거의 0이라
    파랑 값이 곧 "흰색이 섞인 정도"다."""
    r, g, b, a = src.split()
    white = b.point(lambda v: 0 if v < 40 else min(255, int((v - 40) * 255 / 215)))
    # 투명 모서리 픽셀은 색값이 (255,255,255,0)으로 저장돼 있어 파랑만 보면 "흰색"으로
    # 잡힌다 — 원본 알파를 곱해 모서리를 빼야 한다(안 그러면 아이콘 모서리가 하얗게 나옴).
    return ImageChops.multiply(white, a)


def build_master_icon(size=1024):
    src = Image.open(ICON_SRC).convert("RGBA").resize((1024, 1024), Image.LANCZOS)
    lut = _diag_gradient_lut(src)
    bg = Image.new("RGB", (1024, 1024))
    bp = bg.load()
    for y in range(1024):
        for x in range(1024):
            r, g, b = lut[min(255, int((x + y) / 2048 * 256))]
            bp[x, y] = (int(r), int(g), int(b))
    bg = bg.filter(ImageFilter.GaussianBlur(3))  # LUT 계단 무늬 제거
    glyph = _glyph_alpha(src)
    white = Image.new("RGB", (1024, 1024), (255, 255, 255))
    icon = Image.composite(white, bg, glyph)
    if size != 1024:
        icon = icon.resize((size, size), Image.LANCZOS)
    return icon, bg, glyph


def rounded_mask(size, radius_ratio):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * radius_ratio), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def circle_mask(size):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def make_icons():
    icon, bg, glyph = build_master_icon()
    out = os.path.join(STORE, "icons")
    os.makedirs(out, exist_ok=True)

    # App Store: 1024 RGB, 투명·둥근 모서리 없이(애플이 직접 마스크)
    icon.save(os.path.join(out, "appstore_icon_1024.png"))
    icon.save(os.path.join(FRONT, "ios", "App", "App", "Assets.xcassets", "AppIcon.appiconset", "AppIcon-512@2x.png"))
    # Play: 512 꽉 찬 정사각(구글이 직접 마스크). 32비트 PNG 요구라 RGBA로 저장.
    icon.resize((512, 512), Image.LANCZOS).convert("RGBA").save(os.path.join(out, "play_icon_512.png"))

    res = os.path.join(FRONT, "android", "app", "src", "main", "res")
    # 적응형 아이콘(안드로이드 8+): 108dp 캔버스, 배경=그라데이션 꽉 채움, 전경=흰 글리프만.
    # 런처가 원·둥근사각 등으로 잘라도 글리프가 안 잘리게 지름 66dp 안전영역 안에 둔다.
    bbox = glyph.getbbox()
    g = glyph.crop(bbox)
    for folder, legacy, layer in [("ldpi", 36, 81), ("mdpi", 48, 108), ("hdpi", 72, 162),
                                  ("xhdpi", 96, 216), ("xxhdpi", 144, 324), ("xxxhdpi", 192, 432)]:
        d = os.path.join(res, f"mipmap-{folder}")
        os.makedirs(d, exist_ok=True)
        bg.resize((layer, layer), Image.LANCZOS).save(os.path.join(d, "ic_launcher_background.png"))
        target = int(layer * 50 / 108)  # 글리프 긴 변 = 50dp
        scale = target / max(g.size)
        gs = g.resize((max(1, int(g.width * scale)), max(1, int(g.height * scale))), Image.LANCZOS)
        fg = Image.new("RGBA", (layer, layer), (255, 255, 255, 0))
        layer_alpha = Image.new("L", (layer, layer), 0)
        layer_alpha.paste(gs, ((layer - gs.width) // 2, (layer - gs.height) // 2))
        fg.putalpha(layer_alpha)
        fg.save(os.path.join(d, "ic_launcher_foreground.png"))
        # 옛 런처(안드로이드 7 이하)용 완성 아이콘
        small = icon.resize((legacy, legacy), Image.LANCZOS).convert("RGBA")
        sq = small.copy(); sq.putalpha(rounded_mask(legacy, 0.22))
        sq.save(os.path.join(d, "ic_launcher.png"))
        rd = small.copy(); rd.putalpha(circle_mask(legacy))
        rd.save(os.path.join(d, "ic_launcher_round.png"))

    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- store/make_store_assets.py 가 생성. 배경(그라데이션)·전경(흰 글리프)을 108dp 캔버스에\n'
        '     꽉 채워 그렸으므로 inset 없이 그대로 쓴다. -->\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@mipmap/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '</adaptive-icon>\n'
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(res, "mipmap-anydpi-v26", name), "w", encoding="utf-8", newline="\n") as f:
            f.write(adaptive)

    make_feature_graphic(icon)
    print("icons ok")


def make_feature_graphic(icon):
    """Google Play 피처 그래픽 1024x500 — 스토어 상단 배너. 글자는 가운데 안전영역에."""
    W, H = 1024, 500
    img = Image.new("RGB", (W, H))
    dp = img.load()
    for y in range(H):
        for x in range(W):
            t = (x / W) * 0.7 + (y / H) * 0.3
            c = [int(BRAND_LIGHT[i] + (BRAND[i] - BRAND_LIGHT[i]) * t) for i in range(3)]
            dp[x, y] = tuple(c)
    ic = icon.resize((230, 230), Image.LANCZOS).convert("RGBA")
    ic.putalpha(rounded_mask(230, 0.22))
    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle([96, 147, 96 + 230, 147 + 230], radius=50, fill=(120, 80, 0, 90))
    img.paste(shadow.filter(ImageFilter.GaussianBlur(18)), (0, 12), shadow.filter(ImageFilter.GaussianBlur(18)))
    img.paste(ic, (96, 135), ic)
    d = ImageDraw.Draw(img)
    d.text((380, 150), "쿡매치", font=font(96, 900), fill=INK)
    d.text((384, 272), "냉장고에 있는 걸로, 오늘 저녁", font=font(40, 700), fill=(91, 70, 0))
    d.text((384, 330), "사진 한 장으로 재료 등록 · AI 식단 · 레시피 추천", font=font(28, 500), fill=(110, 86, 0))
    img.save(os.path.join(STORE, "play_feature_graphic.png"))


# ---------------------------------------------------------------------------
# 스크린샷
# ---------------------------------------------------------------------------

# 원본 화면: (저장소 기준 경로, 영상이면 초 단위 시점, 위에서 잘라낼 px). 녹화본 대부분은
# 위쪽이 iOS 상태바 + 화면 녹화 표시라 잘라낸다. 상태바 없이 앱 화면만 녹화된 것(01·02편 데모)은 0.
# store/sources/ 는 사용자가 직접 찍어 준 실제 앱 캡처(2026-09-18).
V = "my-video/public/"
SOURCES = {
    "diet": ("store/sources/diet_ai_plan.png", None, 185),
    "chat": (V + "reel6_chatbot_demo.mp4", 29.2, 180),
    "photo": (V + "reel1_loading_freeze.png", None, 0),
    "match": (V + "reel2_matching_demo_fixed.mp4", 9.0, 0),
    "substitute": (V + "reel2_substitute_freeze.png", None, 0),
    "expiry": (V + "reel5_expiry_demo.mp4", 16.0, 180),
    "cook": (V + "reel3_reading_freeze.png", None, 180),
    "family": (V + "reel8_family_demo.mp4", 16.5, 180),
}

# 폰 화면 위에 겹쳐 올리는 보조 이미지(기울인 작은 카드 / 확대 콜아웃).
#   crop: 원본 픽셀 좌표(상태바 자르기 전)  w: 캔버스 폭 대비 너비  angle: 반시계 방향 기울기(도)
#   cx: 캔버스 폭 대비 중심 x  cy: 폰 화면 윗변에서 중심까지 거리(캔버스 폭 대비)
INSETS = {
    # 사진 찍는 화면 3장(영수증 · 음식 · 쿠팡 주문내역) — "영수증이든 음식 사진이든"을 한눈에.
    # 위쪽에 부채꼴로 펼치고, 가운데 장을 맨 앞에(목록 순서대로 그려서 마지막이 위로 온다).
    "photo": [
        dict(src="store/sources/camera_receipt.png", crop=(0, 223, 1206, 2622),
             w=0.27, angle=9, cx=0.22, cy=0.36, radius=0.045),
        # 쿠팡 주문내역 — 다른 회사 상표(로고·"로켓프레시")와 상품명이 그대로 보여 뷰파인더
        # 안쪽만 흐리게(사용자 요청). "주문 화면을 찍는다"는 모양만 남긴다.
        dict(src="store/sources/camera_coupang.png", crop=(0, 223, 1206, 2622),
             blur=(0, 384, 1206, 1993), w=0.27, angle=-9, cx=0.78, cy=0.36, radius=0.045),
        dict(src="store/sources/camera_pizza_cheese.png", crop=(0, 223, 1206, 2622),
             w=0.29, angle=0, cx=0.5, cy=0.33, radius=0.045),
    ],
    # 재료 매칭도 설정 팝업
    "match": dict(src="store/sources/match_filter_popup.png", crop=(92, 642, 1114, 2166),
                  w=0.47, angle=-6, cx=0.72, cy=0.40, radius=0.04),
    # "대체 가능 · 당근→양파"가 있는 레시피 카드를 잘라 크게
    "substitute": dict(src=V + "reel2_substitute_freeze.png", crop=(30, 624, 910, 1070),
                       w=0.92, angle=-2, cx=0.5, cy=0.78, radius=0.03),
    # 임박 재료 설정 팝업
    "expiry": dict(src="store/sources/expiry_filter_popup.png", crop=(92, 665, 1114, 2145),
                   w=0.47, angle=-6, cx=0.72, cy=0.40, radius=0.04),
    # 가족별 요리 횟수 + 이번 달 절약액과 그 계산식
    "family": dict(src=V + "reel8_savings_bg.png", crop=(20, 248, 860, 850),
                   w=0.9, angle=-2, cx=0.5, cy=0.62, radius=0.03),
}

# band: k=검정(AI 기능), y=브랜드 노랑, w=밝은 회색. focus: 폰 화면을 위에서부터 어디쯤
# 보여줄지(원본 높이 대비 비율, 상태바 자른 뒤 기준) — 핵심 UI가 잘리지 않게 편마다 맞춤.
# badge="sound": 폰 화면 가운데에 소리 표시(요리 모드).
SLIDES = [
    dict(key="diet", band="k", ai=True, eyebrow="AI 식단 추천",
         headline="말 한마디로\n일주일 식단 완성", sub="냉장고 재료로 먼저 채워서, 장보기는 최소한만", focus=0.0),
    dict(key="chat", band="k", ai=True, eyebrow="요리 챗봇",
         headline="검색 말고,\n그냥 물어보세요", sub="내 재료·취향까지 반영해서 골라드려요", focus=0.0),
    dict(key="photo", band="k", ai=True, eyebrow="사진 인식",
         headline="사진 한 장이면\n재료 등록 끝", sub="영수증이든 음식 사진이든, 재료와 유통기한까지", focus=0.0),
    dict(key="match", band="y", ai=False, eyebrow="냉장고 요리",
         headline="지금 있는 재료로\n만들 수 있는 요리", sub="내 냉장고 기준 매칭률 순으로 정렬해드려요", focus=0.0),
    dict(key="substitute", band="y", ai=False, eyebrow="대체 재료",
         headline="재료가 없어도\n포기하지 마세요", sub="한두 개 부족하면 대신 쓸 재료를 알려드려요", focus=0.0),
    dict(key="expiry", band="w", ai=False, eyebrow="유통기한 관리",
         headline="곧 상할 재료부터\n먼저 요리하세요", sub="유통기한 임박한 재료 순으로 레시피를 추천해요", focus=0.0),
    dict(key="cook", band="w", ai=False, eyebrow="요리 모드",
         headline="손에 물 묻어도\n귀로 들으세요", sub="조리 순서를 소리로 읽어드려요", focus=0.0, badge="sound"),
    dict(key="family", band="y", ai=False, eyebrow="우리 식구 요리",
         headline="가족이 함께,\n아낀 돈까지 한눈에", sub="가족이 함께 무슨 요리를 얼마나 했는지,\n외식 대비 아낀 돈을 계산해요.", focus=0.0),
]

SIZES = {"play": (1080, 1920), "ios": (1290, 2796)}


def load_frame(key):
    name, t, top_crop = SOURCES[key]
    path = os.path.join(ROOT, name)
    if t is not None:
        os.makedirs(FRAME_CACHE, exist_ok=True)
        cached = os.path.join(FRAME_CACHE, f"{key}.png")
        if not os.path.exists(cached):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(t), "-i", path, "-frames:v", "1", cached], check=True)
        path = cached
    im = Image.open(path).convert("RGB")
    im = im.crop((0, top_crop, im.width, im.height))
    # 헤더 오른쪽(계정 이름·요금제 배지·로그아웃)을 블러 — 실제 사용자 이름이 찍혀 있다
    hh = int(im.width * 0.1)
    box = (int(im.width * 0.46), 0, im.width, hh)
    im.paste(im.crop(box).filter(ImageFilter.GaussianBlur(int(im.width * 0.02))), box[:2])
    return im


def wrap_lines(text):
    return text.split("\n")


def save_png(img, path):
    """임시 파일에 쓴 뒤 바꿔 끼운다. 윈도우에서 백신·검색 색인이 방금 쓴 PNG를 잠깐 붙잡고
    있으면 같은 이름으로 다시 열 때 `OSError: [Errno 22]`가 나서, 몇 번 다시 시도한다."""
    tmp = path + ".tmp.png"
    img.save(tmp)
    for attempt in range(10):
        try:
            os.replace(tmp, path)
            return
        except OSError:
            time.sleep(0.5 * (attempt + 1))
    raise OSError(f"저장 실패(파일이 잠겨 있음): {path}")


def paste_inset(img, spec, W, phone_top):
    """보조 이미지를 둥근 카드로 잘라 기울여서 그림자와 함께 얹는다."""
    src = Image.open(os.path.join(ROOT, spec["src"])).convert("RGB")
    if spec.get("blur"):  # 원본 좌표 기준 영역을 흐리게(상표·개인정보 가리기)
        box = spec["blur"]
        src.paste(src.crop(box).filter(ImageFilter.GaussianBlur(28)), box[:2])
    src = src.crop(spec["crop"])
    w = int(W * spec["w"])
    h = int(src.height * w / src.width)
    card = src.resize((w, h), Image.LANCZOS).convert("RGBA")
    r = int(W * spec["radius"])
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)
    card.putalpha(mask)
    # 흰 카드가 흰 앱 화면 위에서도 구분되게 얇은 테두리
    ImageDraw.Draw(card).rounded_rectangle([0, 0, w - 1, h - 1], radius=r, outline=(215, 215, 222, 255), width=max(2, W // 500))

    rot = card.rotate(spec["angle"], resample=Image.BICUBIC, expand=True)
    cx = int(W * spec["cx"])
    cy = phone_top + int(W * spec["cy"])
    x0, y0 = cx - rot.width // 2, cy - rot.height // 2

    shadow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sh = Image.new("RGBA", rot.size, (0, 0, 0, 0))
    sh.putalpha(rot.split()[3].point(lambda a: int(a * 0.45)))
    shadow.paste(sh, (x0, y0 + int(W * 0.018)), sh)
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(W * 0.022)))
    base = img.convert("RGBA")
    base.alpha_composite(shadow)
    base.alpha_composite(rot, (x0, y0))
    return base.convert("RGB")


def paste_sound_badge(img, W, cx, cy):
    """요리 모드 — 폰 화면 가운데에 "소리로 읽는 중" 표시(노란 원 + 스피커 + 음파, 아래 알약 문구)."""
    base = img.convert("RGBA")
    D = int(W * 0.3)
    layer = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    # 그림자
    sh = Image.new("RGBA", base.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([cx - D // 2, cy - D // 2 + int(W * 0.02), cx + D // 2, cy + D // 2 + int(W * 0.02)], fill=(0, 0, 0, 110))
    base.alpha_composite(sh.filter(ImageFilter.GaussianBlur(int(W * 0.025))))
    d.ellipse([cx - D // 2, cy - D // 2, cx + D // 2, cy + D // 2], fill=BRAND + (255,))
    # 스피커(사각 + 나팔)
    u = D / 10
    sx = cx - u * 2.6
    d.rectangle([sx - u * 1.0, cy - u * 0.9, sx + u * 0.2, cy + u * 0.9], fill=INK)
    d.polygon([(sx + u * 0.2, cy - u * 0.9), (sx + u * 1.9, cy - u * 2.3), (sx + u * 1.9, cy + u * 2.3), (sx + u * 0.2, cy + u * 0.9)], fill=INK)
    # 음파 호 2개
    lw = max(3, int(u * 0.55))
    for rr in (u * 1.6, u * 3.0):
        ax = sx + u * 1.9
        d.arc([ax - rr, cy - rr, ax + rr, cy + rr], start=-50, end=50, fill=INK, width=lw)
    # 아래 알약 문구
    f = font(int(W * 0.036), 800)
    text = "소리로 읽는 중"
    tw = d.textlength(text, font=f)
    ph = int(W * 0.075)
    py = cy + D // 2 + int(W * 0.03)
    d.rounded_rectangle([cx - tw / 2 - ph * 0.6, py, cx + tw / 2 + ph * 0.6, py + ph], radius=ph // 2, fill=INK + (240,))
    d.text((cx, py + ph / 2), text, font=f, fill=BRAND, anchor="mm")
    base.alpha_composite(layer)
    return base.convert("RGB")


def render_slide(slide, W, H):
    band = slide["band"]
    bg = {"k": INK, "y": BRAND, "w": PAGE_LIGHT}[band]
    img = Image.new("RGB", (W, H), bg)
    if band == "y":
        dp = ImageDraw.Draw(img)
        for y in range(H):
            t = y / H
            c = tuple(int(BRAND_LIGHT[i] + (BRAND[i] - BRAND_LIGHT[i]) * t) for i in range(3))
            dp.line([(0, y), (W, y)], fill=c)
    d = ImageDraw.Draw(img)

    head_c = (255, 255, 255) if band == "k" else INK
    sub_c = (216, 216, 222) if band == "k" else ((61, 47, 0) if band == "y" else (91, 91, 99))
    label_c = (255, 214, 94) if band == "k" else ((107, 82, 0) if band == "y" else (154, 123, 0))

    pad = int(W * 0.075)
    y = int(W * 0.085)
    # eyebrow: [AI] 칩 + 기능 이름
    ef = font(int(W * 0.036), 800)
    x = pad
    if slide["ai"]:
        cf = font(int(W * 0.032), 900)
        tw = d.textlength("AI", font=cf)
        ch = int(W * 0.058)
        chip_bg, chip_fg = (BRAND, INK) if band == "k" else (INK, BRAND)
        d.rounded_rectangle([x, y, x + tw + ch * 0.9, y + ch], radius=ch // 2, fill=chip_bg)
        d.text((x + ch * 0.45, y + ch / 2), "AI", font=cf, fill=chip_fg, anchor="lm")
        x += int(tw + ch * 0.9 + W * 0.02)
    d.text((x, y + int(W * 0.029)), slide["eyebrow"], font=ef, fill=label_c, anchor="lm")
    y += int(W * 0.058) + int(W * 0.035)

    hf = font(int(W * 0.088), 900)
    for line in wrap_lines(slide["headline"]):
        d.text((pad, y), line, font=hf, fill=head_c)
        y += int(W * 0.088 * 1.2)
    y += int(W * 0.018)
    sf = font(int(W * 0.038), 500)
    # 설명 줄이 폭을 넘으면 어절(띄어쓰기) 단위로 줄바꿈 — 한 단어가 두 줄로 쪼개지지 않게
    # (문장 안에 \n 을 넣으면 그 자리에서 먼저 끊는다 — 쉼표 뒤처럼 읽기 좋은 자리에서 끊고 싶을 때)
    lines = []
    for part in slide["sub"].split("\n"):
        cur = ""
        for word in part.split(" "):
            trial = f"{cur} {word}".strip()
            if cur and d.textlength(trial, font=sf) > W - pad * 2:
                lines.append(cur)
                cur = word
            else:
                cur = trial
        lines.append(cur)
    for line in lines:
        d.text((pad, y), line, font=sf, fill=sub_c)
        y += int(W * 0.038 * 1.45)
    y += int(W * 0.06)

    # 폰 화면: 가운데, 둥근 모서리 + 그림자, 아래로는 화면 밖으로 흘려 보낸다
    frame = load_frame(slide["key"])
    pw = int(W * 0.8)
    ph = int(frame.height * pw / frame.width)
    shot = frame.resize((pw, ph), Image.LANCZOS)
    focus_px = int(ph * slide["focus"])
    radius = int(pw * 0.06)
    px0 = (W - pw) // 2
    # 화면이 캔버스 안에 다 들어가면(앱스토어처럼 세로로 긴 캔버스) 아래 모서리까지 둥글게
    # 닫힌 카드로, 안 들어가면(플레이 9:16) 아래로 화면 밖까지 흘려 보낸다 — 들어가는데도
    # 흘려 보내게 그리면 화면이 끝난 아래에 테두리만 남은 빈 띠가 생긴다.
    fits = focus_px == 0 and y + ph <= H - int(W * 0.03)
    if fits:
        bottom = y + ph
    else:
        shot = shot.crop((0, focus_px, pw, min(ph, focus_px + (H - y) + radius)))
        bottom = H + radius  # 아래 모서리는 캔버스 밖으로
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, shot.width - 1, (shot.height - 1) if fits else shot.height + radius], radius=radius, fill=255
    )

    shadow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sa = 110 if band != "k" else 160
    ImageDraw.Draw(shadow).rounded_rectangle([px0, y + int(W * 0.012), px0 + pw, bottom], radius=radius, fill=(0, 0, 0, sa))
    shadow = shadow.filter(ImageFilter.GaussianBlur(int(W * 0.03)))
    img.paste(shadow, (0, 0), shadow)
    img.paste(shot, (px0, y), mask)
    if band == "k":
        # 검은 배경에선 흰 화면 가장자리가 너무 튀지 않게 얇은 테두리
        ImageDraw.Draw(img).rounded_rectangle([px0, y, px0 + pw - 1, bottom - 1], radius=radius, outline=(60, 60, 66), width=max(2, W // 400))

    if slide["key"] in INSETS:
        specs = INSETS[slide["key"]]
        for spec in specs if isinstance(specs, list) else [specs]:
            img = paste_inset(img, spec, W, y)
    if slide.get("badge") == "sound":
        # 보이는 폰 화면의 가운데쯤(캔버스 아래로 흘러 나간 부분은 빼고)
        visible_bottom = min(bottom, H)
        img = paste_sound_badge(img, W, W // 2, (y + visible_bottom) // 2)
    return img


def make_shots():
    for platform, (W, H) in SIZES.items():
        out = os.path.join(STORE, "screenshots", platform)
        os.makedirs(out, exist_ok=True)
        for i, slide in enumerate(SLIDES, 1):
            save_png(render_slide(slide, W, H), os.path.join(out, f"{i:02d}_{slide['key']}.png"))
        print(f"{platform} {W}x{H}: {len(SLIDES)}장")


if __name__ == "__main__":
    what = sys.argv[1:] or ["icons", "shots"]
    if "icons" in what:
        make_icons()
    if "shots" in what:
        make_shots()
