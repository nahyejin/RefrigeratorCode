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

# 원본 화면: (파일, 영상이면 초 단위 시점). 녹화본 대부분이 폭 880 안팎 × 높이 1920,
# 위쪽 약 180px 이 iOS 상태바 + 화면 녹화 표시라 잘라낸다(릴스 편집 때와 같은 값).
SOURCES = {
    "diet": ("reel4_shopping_freeze.png", None, 180),
    "chat": ("reel6_chatbot_demo.mp4", 29.2, 180),
    "photo": ("reel1_loading_freeze.png", None, 0),  # 이 녹화본은 상태바 없이 앱 화면만
    "match": ("reel2_matching_demo_fixed.mp4", 9.0, 180),
    "substitute": ("reel2_substitute_freeze.png", None, 180),
    "expiry": ("reel5_expiry_demo.mp4", 16.0, 180),
    "cook": ("reel3_reading_freeze.png", None, 180),
    "family": ("reel8_family_demo.mp4", 16.5, 180),
}

# band: k=검정(AI 기능), y=브랜드 노랑, w=밝은 회색. focus: 폰 화면을 위에서부터 어디쯤
# 보여줄지(원본 높이 대비 비율, 상태바 자른 뒤 기준) — 핵심 UI가 잘리지 않게 편마다 맞춤.
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
         headline="손에 물 묻어도\n귀로 들으세요", sub="조리 순서를 소리로 읽어드려요", focus=0.0),
    dict(key="family", band="y", ai=False, eyebrow="우리 식구 요리",
         headline="가족이 함께 쓰는\n요리 캘린더", sub="누가 언제 뭘 만들었는지, 이번 달 목표까지", focus=0.0),
]

SIZES = {"play": (1080, 1920), "ios": (1290, 2796)}


def load_frame(key):
    name, t, top_crop = SOURCES[key]
    path = os.path.join(VIDEO_PUBLIC, name)
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
    d.text((pad, y), slide["sub"], font=sf, fill=sub_c)
    y += int(W * 0.038 * 1.5) + int(W * 0.06)

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
    return img


def make_shots():
    for platform, (W, H) in SIZES.items():
        out = os.path.join(STORE, "screenshots", platform)
        os.makedirs(out, exist_ok=True)
        for i, slide in enumerate(SLIDES, 1):
            render_slide(slide, W, H).save(os.path.join(out, f"{i:02d}_{slide['key']}.png"))
        print(f"{platform} {W}x{H}: {len(SLIDES)}장")


if __name__ == "__main__":
    what = sys.argv[1:] or ["icons", "shots"]
    if "icons" in what:
        make_icons()
    if "shots" in what:
        make_shots()
