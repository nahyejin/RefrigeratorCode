# -*- coding: utf-8 -*-
"""네이티브 앱(iOS·Android)의 아이콘·스플래시·알림 아이콘·위젯 미리보기를 새 로고(P1 확정)에서 한 번에 다시 만든다.

    PYTHONIOENCODING=utf-8 python scripts/make_native_assets.py            # 전부 + 검사
    PYTHONIOENCODING=utf-8 python scripts/make_native_assets.py ios        # iOS 만
    PYTHONIOENCODING=utf-8 python scripts/make_native_assets.py android    # Android 만(런처·알림·스플래시·위젯 미리보기)
    PYTHONIOENCODING=utf-8 python scripts/make_native_assets.py check      # 만들지 않고 검사만

입력(마스터, 손으로 고치지 말 것):
    frontend/assets/icon.png                       정식 1024 (정사각·RGB·알파 없음·모서리 안 깎음)
    frontend/assets/brand/icon_reverse_1024.png    검정 바탕판 → iOS 다크 아이콘
    frontend/assets/brand/adaptive_foreground_1024.png   안드로이드 적응형 전경(안전영역 안으로 축소, 투명)
    frontend/assets/brand/notification_silhouette_1024.png  알림용 흰 단색 실루엣(투명)
    (마스터 자체는 frontend/assets/brand/make_mark_svg.py 가 시안 코드에서 만든다)

만드는 것:
    iOS      AppIcon.appiconset 의 1024 3장(정식·다크·틴트)과 Contents.json, Splash.imageset 3장,
             LaunchScreen.storyboard 배경색(노랑), frontend/assets/splash.png·splash-dark.png
    Android  mipmap-*: ic_launcher·ic_launcher_round(옛 런처), ic_launcher_foreground·ic_launcher_monochrome(적응형),
             mipmap-anydpi-v26/ic_launcher*.xml, values/ic_launcher_background.xml(노랑 단색),
             drawable-*/ic_stat_cookmatch.png(알림, 24/36/48/72/96px 흰색+투명),
             drawable*/splash.png 26장(노랑 바탕 + 마크, 앱 안 스플래시와 같은 자리),
             values/styles.xml 의 Android 12+ 시스템 시작 화면 바탕을 노랑으로(앱 스플래시와 같은 색),
             drawable-nodpi/widget_quick_square_preview.png(현재 이름 「쿡 픽」·「식단 짜기」로 다시 그림)
    지우는 것  안드로이드 스튜디오 기본 템플릿 잔재(안 쓰는 초록 격자·로봇·흰 색), 더는 안 쓰는 적응형 배경 PNG 6장

스토어 아이콘·피처 그래픽은 store/make_store_assets.py icons 가 만든다(같은 마스터를 읽는다).
"""
import json
import os
import re
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONT = os.path.join(ROOT, "frontend")
ASSETS = os.path.join(FRONT, "assets")
BRAND = os.path.join(ASSETS, "brand")
IOS_CAT = os.path.join(FRONT, "ios", "App", "App", "Assets.xcassets")
RES = os.path.join(FRONT, "android", "app", "src", "main", "res")

YELLOW = (255, 214, 0)  # #FFD600
FONT_VF = "C:/Windows/Fonts/NotoSansKR-VF.ttf"

# 앱 안 스플래시(frontend/src/components/SplashScreen.tsx)와 같은 자리·크기로 맞춘다 — 네이티브 시작 화면 → 앱 스플래시로
# 바뀔 때 마크가 튀지 않게: 마크 폭 min(46vw, 26vh, 210px), 마크 가운데가 화면 높이의 약 37.5%.
# (마스터 한 변 안에서 마크 폭은 약 0.8)
IOS_SPLASH_MARK = 724 / 2732     # iOS 스플래시(2732 정사각)에서 마스터를 붙이는 한 변 비율 — 아이폰(세로로 꽉 채움)에서 마크 폭 ≈ 화면 폭의 46%
ANDROID_SPLASH_MARK = 0.46       # 안드로이드 세로 스플래시: 짧은 변(폭) 대비 마스터 한 변 비율 → 마크 폭 ≈ 37%(CENTER_CROP 로 높이에 맞춰 확대되면 46%)
ANDROID_SPLASH_MARK_LAND = 0.325  # 가로 스플래시: 마크 높이가 화면 높이의 26%
SPLASH_CENTER_Y = 0.375          # 마크 가운데 높이(화면 높이 대비)

# 안드로이드 해상도 폴더 → (옛 런처 px, 적응형 레이어 px(108dp), 알림 아이콘 px(24dp))
DENSITY = {
    "ldpi": (36, 81, None), "mdpi": (48, 108, 24), "hdpi": (72, 162, 36),
    "xhdpi": (96, 216, 48), "xxhdpi": (144, 324, 72), "xxxhdpi": (192, 432, 96),
}
# 스플래시 26장: 폴더 → (가로, 세로) px. Capacitor 기본 구성과 같다(android/app/src/main/res).
SPLASH = {
    "drawable": (320, 480), "drawable-night": (320, 240),
    **{f"drawable-port-{d}": s for d, s in {"ldpi": (240, 320), "mdpi": (320, 480), "hdpi": (480, 800),
                                            "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}.items()},
    **{f"drawable-port-night-{d}": s for d, s in {"ldpi": (240, 320), "mdpi": (320, 480), "hdpi": (480, 800),
                                                  "xhdpi": (720, 1280), "xxhdpi": (960, 1600), "xxxhdpi": (1280, 1920)}.items()},
    **{f"drawable-land-{d}": s for d, s in {"ldpi": (320, 240), "mdpi": (480, 320), "hdpi": (800, 480),
                                            "xhdpi": (1280, 720), "xxhdpi": (1600, 960), "xxxhdpi": (1920, 1280)}.items()},
    **{f"drawable-land-night-{d}": s for d, s in {"ldpi": (320, 240), "mdpi": (480, 320), "hdpi": (800, 480),
                                                  "xhdpi": (1280, 720), "xxhdpi": (1600, 960), "xxxhdpi": (1920, 1280)}.items()},
}


def load_master():
    im = Image.open(os.path.join(ASSETS, "icon.png"))
    if im.mode != "RGB":
        raise SystemExit("frontend/assets/icon.png 는 알파 없는 RGB 여야 한다(애플 규칙) — 지금 %s" % im.mode)
    if im.size != (1024, 1024):
        raise SystemExit("frontend/assets/icon.png 는 1024x1024 여야 한다")
    return im


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path, optimize=True)


def mark_on_yellow(w, h, frac, master, cy=SPLASH_CENTER_Y):
    """노랑 캔버스에 마스터(정사각 노랑 바탕 그림)를 붙인다 — 마스터 바탕이 같은 노랑이라 이음매가 없다.
    가로는 가운데, 세로는 마크 가운데가 높이의 cy 에 오게(마스터 안 마크의 세로 가운데는 한가운데보다 9/1024 위)."""
    canvas = Image.new("RGB", (w, h), YELLOW)
    s = max(1, int(round(min(w, h) * frac)))
    top = int(round(h * cy - s * (503 / 1024)))
    canvas.paste(master.resize((s, s), Image.LANCZOS), ((w - s) // 2, top))
    return canvas


# ---------------------------------------------------------------------------
# iOS
# ---------------------------------------------------------------------------

def make_ios(master):
    icon_dir = os.path.join(IOS_CAT, "AppIcon.appiconset")
    save(master, os.path.join(icon_dir, "AppIcon-512@2x.png"))
    reverse = Image.open(os.path.join(BRAND, "icon_reverse_1024.png")).convert("RGB")
    save(reverse, os.path.join(icon_dir, "AppIcon-dark.png"))
    # 틴트(iOS 18): 시스템이 회색조 명도를 틴트색으로 칠한다 → 검정 바탕판의 회색조(받침 노랑≈207·재료 흰≈255·잎≈157)
    save(reverse.convert("L").convert("RGB"), os.path.join(icon_dir, "AppIcon-tinted.png"))
    contents = {
        "images": [
            {"filename": "AppIcon-512@2x.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
            {"appearances": [{"appearance": "luminosity", "value": "dark"}],
             "filename": "AppIcon-dark.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
            {"appearances": [{"appearance": "luminosity", "value": "tinted"}],
             "filename": "AppIcon-tinted.png", "idiom": "universal", "platform": "ios", "size": "1024x1024"},
        ],
        "info": {"author": "xcode", "version": 1},
    }
    with open(os.path.join(icon_dir, "Contents.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(contents, f, ensure_ascii=False, indent=2)
        f.write("\n")

    # 스플래시: 2732 정사각 한 장을 세 이름으로(Capacitor 관례). LaunchScreen 이 scaleAspectFill 로 깐다.
    splash = mark_on_yellow(2732, 2732, IOS_SPLASH_MARK, master)
    for n in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
        save(splash, os.path.join(IOS_CAT, "Splash.imageset", n))
    save(splash, os.path.join(ASSETS, "splash.png"))
    save(splash, os.path.join(ASSETS, "splash-dark.png"))  # 다크 대응 없음 — 노랑 한 장(앱 이름 노랑 브랜드)

    # LaunchScreen 배경색: 시스템 흰색 → 브랜드 노랑(이미지가 덮지 못하는 틈이 생겨도 흰색이 보이지 않게)
    sb = os.path.join(FRONT, "ios", "App", "App", "Base.lproj", "LaunchScreen.storyboard")
    with open(sb, encoding="utf-8", newline="") as f:
        text = f.read()
    new_color = '<color key="backgroundColor" red="1" green="0.83921568627450982" blue="0.0" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>'
    text = re.sub(r'<color key="backgroundColor" systemColor="systemBackgroundColor"/>', new_color, text)
    with open(sb, "w", encoding="utf-8", newline="") as f:
        f.write(text)
    print("ios ok")


# ---------------------------------------------------------------------------
# Android
# ---------------------------------------------------------------------------

def rounded_mask(size, ratio):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * ratio), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def circle_mask(size):
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).ellipse([0, 0, size * 4 - 1, size * 4 - 1], fill=255)
    return m.resize((size, size), Image.LANCZOS)


def resize_rgba(im, size):
    """투명 PNG 줄이기 — 알파가 있는 채로 LANCZOS 하면 가장자리 색이 번지므로 색·알파를 따로 줄인다."""
    a = im.getchannel("A").resize((size, size), Image.LANCZOS)
    rgb = im.convert("RGB")
    # 색 번짐 방지: 알파를 곱한 색을 줄인 뒤 알파로 나눈다
    arr = np.array(im).astype(np.float64)
    pm = arr[:, :, :3] * (arr[:, :, 3:4] / 255.0)
    pm_img = Image.fromarray(np.clip(pm, 0, 255).astype(np.uint8), "RGB").resize((size, size), Image.LANCZOS)
    a_arr = np.array(a).astype(np.float64)
    straight = np.clip(np.array(pm_img).astype(np.float64) / np.maximum(a_arr[:, :, None] / 255.0, 1e-3), 0, 255)
    out = np.dstack([straight, a_arr]).astype(np.uint8)
    del rgb
    return Image.fromarray(out, "RGBA")


def make_android_launcher(master):
    fg = Image.open(os.path.join(BRAND, "adaptive_foreground_1024.png")).convert("RGBA")
    for folder, (legacy, layer, _) in DENSITY.items():
        d = os.path.join(RES, "mipmap-" + folder)
        os.makedirs(d, exist_ok=True)
        # 옛 런처(안드로이드 7 이하): 마스터 전체를 둥근사각 22% / 원으로
        small = master.resize((legacy, legacy), Image.LANCZOS).convert("RGBA")
        sq = small.copy(); sq.putalpha(rounded_mask(legacy, 0.22)); sq.save(os.path.join(d, "ic_launcher.png"), optimize=True)
        rd = small.copy(); rd.putalpha(circle_mask(legacy)); rd.save(os.path.join(d, "ic_launcher_round.png"), optimize=True)
        # 적응형 전경(108dp 캔버스, 마크는 지름 66dp 안전영역 안) + 테마 아이콘(Android 13)용 단색 레이어
        fl = resize_rgba(fg, layer)
        fl.save(os.path.join(d, "ic_launcher_foreground.png"), optimize=True)
        mono = Image.new("RGBA", (layer, layer), (0, 0, 0, 0))
        mono.putalpha(fl.getchannel("A"))
        mono.save(os.path.join(d, "ic_launcher_monochrome.png"), optimize=True)
        # 더는 안 쓰는 배경 PNG(이제 단색 리소스)
        old_bg = os.path.join(d, "ic_launcher_background.png")
        if os.path.exists(old_bg):
            os.remove(old_bg)

    adaptive = (
        '<?xml version="1.0" encoding="utf-8"?>\n'
        '<!-- scripts/make_native_assets.py 가 생성. 배경=브랜드 노랑 단색(values/ic_launcher_background.xml),\n'
        '     전경=마크(지름 66dp 안전영역 안), monochrome=Android 13 테마 아이콘용 같은 모양. -->\n'
        '<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
        '    <background android:drawable="@color/ic_launcher_background" />\n'
        '    <foreground android:drawable="@mipmap/ic_launcher_foreground" />\n'
        '    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />\n'
        '</adaptive-icon>\n'
    )
    for name in ("ic_launcher.xml", "ic_launcher_round.xml"):
        with open(os.path.join(RES, "mipmap-anydpi-v26", name), "w", encoding="utf-8", newline="\n") as f:
            f.write(adaptive)
    with open(os.path.join(RES, "values", "ic_launcher_background.xml"), "w", encoding="utf-8", newline="\n") as f:
        f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
                '    <!-- 적응형 아이콘 배경 = 브랜드 노랑 #FFD600 -->\n'
                '    <color name="ic_launcher_background">#FFD600</color>\n</resources>\n')

    # 안드로이드 스튜디오 기본 템플릿 잔재(어디서도 참조하지 않음)
    for rel in ("drawable/ic_launcher_background.xml", "drawable-v24/ic_launcher_foreground.xml"):
        p = os.path.join(RES, *rel.split("/"))
        if os.path.exists(p):
            os.remove(p)
    print("android launcher ok")


def make_android_launch_theme():
    """Android 12+ 시스템 시작 화면(아이콘은 투명) 바탕 = 앱 안 스플래시와 같은 브랜드 노랑.
    예전에는 앱 스플래시가 흰색이라 흰색으로 맞췄다(2026-09-21) — 앱 스플래시가 노랑으로 바뀌면서 같이 바꾼다."""
    p = os.path.join(RES, "values", "styles.xml")
    with open(p, encoding="utf-8", newline="") as f:
        t = f.read()
    t = t.replace('<item name="windowSplashScreenBackground">#FFFFFF</item>', '<item name="windowSplashScreenBackground">#FFD600</item>')
    t = t.replace('<item name="android:background">#FFFFFF</item>', '<item name="android:background">#FFD600</item>')
    t = t.replace("앱 스플래시(App.tsx 의 SplashScreen, 흰 배경)와 같은 흰색으로", "앱 스플래시(App.tsx 의 SplashScreen, 노랑 #FFD600 배경)와 같은 노랑으로")
    with open(p, "w", encoding="utf-8", newline="") as f:
        f.write(t)


def make_android_notification():
    sil = Image.open(os.path.join(BRAND, "notification_silhouette_1024.png")).convert("RGBA")
    for folder, (_, _, px) in DENSITY.items():
        if not px:
            continue
        out = resize_rgba(sil, px)
        # 흰색 + 투명만 — 색은 전부 흰색으로 고정(안티앨리어싱은 알파로만)
        arr = np.array(out)
        arr[:, :, :3] = 255
        save(Image.fromarray(arr, "RGBA"), os.path.join(RES, "drawable-" + folder, "ic_stat_cookmatch.png"))
    print("android notification icons ok")


def make_android_splash(master):
    for folder, (w, h) in SPLASH.items():
        frac = ANDROID_SPLASH_MARK_LAND if w > h else ANDROID_SPLASH_MARK
        save(mark_on_yellow(w, h, frac, master), os.path.join(RES, folder, "splash.png"))
    print("android splash ok (%d)" % len(SPLASH))


def make_widget_preview():
    """위젯 추가 화면의 2×2 미리보기 — 옛 이름(「요리 AI」·「AI 식단」)을 현재 이름(「쿡 픽」·「식단 짜기」)으로.
    기존 그림의 카드·타일·아이콘은 그대로 두고 글자만 다시 쓴다(여러 번 돌려도 같은 결과)."""
    path = os.path.join(RES, "drawable-nodpi", "widget_quick_square_preview.png")
    im = Image.open(path).convert("RGBA")
    arr = np.array(im)
    tile = (241, 241, 244, 255)
    dark = (arr[:, :, :3].astype(int).sum(axis=2) < 450) & (arr[:, :, 3] > 200)
    LABEL = (90, 90, 99, 255)

    def font(px, weight=400):
        f = ImageFont.truetype(FONT_VF, px)
        try:
            f.set_variation_by_axes([weight])
        except Exception:  # noqa: BLE001
            pass
        return f

    # 윗줄 타일: 아이콘(맨 왼쪽 덩어리)을 잘라 두고, 글자 칸을 지운 뒤 아이콘+새 글자를 가운데로 다시 놓는다
    y0, y1 = 80, 160
    cols = np.where(dark[y0:y1, 100:360].any(axis=0))[0] + 100
    icon_x0 = cols[0]
    icon_x1 = icon_x0
    for c in cols[1:]:          # 아이콘 = 맨 왼쪽 덩어리(아이콘과 글자 사이는 20px 넘게 벌어져 있다)
        if c - icon_x1 > 20:
            break
        icon_x1 = c
    ys = np.where(dark[y0:y1, icon_x0:icon_x1 + 1].any(axis=1))[0] + y0
    icon = im.crop((icon_x0 - 3, ys.min() - 3, icon_x1 + 4, ys.max() + 4))
    fill = Image.new("RGBA", (260, 80), tile)
    im.paste(fill, (110, 80))
    d = ImageDraw.Draw(im)
    f_big = font(36)
    text = "쿡 픽"
    tw = d.textlength(text, font=f_big)
    gap = 29
    group = icon.width - 6 + gap + tw
    cx = 226
    gx = cx - group / 2
    cy_icon = 120
    im.alpha_composite(icon, (int(round(gx - 3)), cy_icon - icon.height // 2))
    d.text((gx + icon.width - 6 + gap, 122), text, font=f_big, fill=LABEL, anchor="lm")

    # 아랫줄 오른쪽 타일: 「식단 짜기」 (글자 칸만 지우고 다시 씀)
    im.paste(Image.new("RGBA", (150, 46), tile), (255, 350))
    d = ImageDraw.Draw(im)
    d.text((330.5, 372), "식단 짜기", font=font(31), fill=LABEL, anchor="mm")
    im.save(path, optimize=True)
    print("widget preview ok")


def make_android(master):
    make_android_launcher(master)
    make_android_launch_theme()
    make_android_notification()
    make_android_splash(master)
    make_widget_preview()


# ---------------------------------------------------------------------------
# 검사
# ---------------------------------------------------------------------------

def check():
    errs, notes = [], []

    def need(cond, msg):
        if not cond:
            errs.append(msg)

    master = Image.open(os.path.join(ASSETS, "icon.png"))
    need(master.mode == "RGB" and master.size == (1024, 1024), "icon.png 규격")
    # iOS
    icon_dir = os.path.join(IOS_CAT, "AppIcon.appiconset")
    cj = json.load(open(os.path.join(icon_dir, "Contents.json"), encoding="utf-8"))
    for e in cj["images"]:
        p = os.path.join(icon_dir, e["filename"])
        im = Image.open(p)
        need(im.size == (1024, 1024), e["filename"] + " 크기")
        need(im.mode in ("RGB", "L"), e["filename"] + " 알파 있음(%s) — 애플이 거절" % im.mode)
    notes.append("iOS AppIcon %d장 모두 1024·알파 없음" % len(cj["images"]))
    sj = json.load(open(os.path.join(IOS_CAT, "Splash.imageset", "Contents.json"), encoding="utf-8"))
    for e in sj["images"]:
        need(os.path.exists(os.path.join(IOS_CAT, "Splash.imageset", e["filename"])), "Splash " + e["filename"])
    # Android 적응형 안전영역
    fgm = Image.open(os.path.join(RES, "mipmap-xxxhdpi", "ic_launcher_foreground.png"))
    a = np.array(fgm.getchannel("A"))
    ys, xs = np.where(a > 8)
    half = fgm.width / 2
    rmax = np.sqrt((xs - half) ** 2 + (ys - half) ** 2).max()
    safe = 66 / 108 * half
    need(rmax <= safe, "적응형 전경이 안전영역 밖: 반지름 %.1f > %.1f" % (rmax, safe))
    notes.append("적응형 전경 최대 반지름 %.1f / 안전 %.1f px (xxxhdpi 432)" % (rmax, safe))
    for folder, (legacy, layer, px) in DENSITY.items():
        d = os.path.join(RES, "mipmap-" + folder)
        for n, sz in (("ic_launcher.png", legacy), ("ic_launcher_round.png", legacy),
                      ("ic_launcher_foreground.png", layer), ("ic_launcher_monochrome.png", layer)):
            need(Image.open(os.path.join(d, n)).size == (sz, sz), "%s/%s 크기" % (folder, n))
        if px:
            im = Image.open(os.path.join(RES, "drawable-" + folder, "ic_stat_cookmatch.png"))
            arr = np.array(im.convert("RGBA"))
            need(im.size == (px, px), "알림 아이콘 %s 크기" % folder)
            vis = arr[arr[:, :, 3] > 0][:, :3]
            need(vis.size and (vis == 255).all(), "알림 아이콘 %s 에 흰색 아닌 픽셀" % folder)
    notes.append("알림 아이콘 5개 24/36/48/72/96px — 보이는 픽셀 전부 흰색")
    for folder, (w, h) in SPLASH.items():
        im = Image.open(os.path.join(RES, folder, "splash.png"))
        need(im.size == (w, h), "스플래시 %s 크기 %s" % (folder, im.size))
    notes.append("안드로이드 스플래시 %d장 크기 일치" % len(SPLASH))
    # 리소스 참조
    xml = open(os.path.join(RES, "mipmap-anydpi-v26", "ic_launcher.xml"), encoding="utf-8").read()
    for ref in re.findall(r"@mipmap/(\w+)", xml):
        need(os.path.exists(os.path.join(RES, "mipmap-xxxhdpi", ref + ".png")), "참조 mipmap/" + ref)
    need("@color/ic_launcher_background" in xml and "FFD600" in open(os.path.join(RES, "values", "ic_launcher_background.xml"), encoding="utf-8").read(), "적응형 배경색")
    # 안 쓰는 템플릿이 남지 않았는지
    for rel in ("drawable/ic_launcher_background.xml", "drawable-v24/ic_launcher_foreground.xml"):
        need(not os.path.exists(os.path.join(RES, *rel.split("/"))), rel + " 아직 있음")
    st = open(os.path.join(RES, "values", "styles.xml"), encoding="utf-8").read()
    need("windowSplashScreenBackground\">#FFD600" in st, "Android 12+ 시작 화면 바탕이 노랑이 아님")
    sb = open(os.path.join(FRONT, "ios", "App", "App", "Base.lproj", "LaunchScreen.storyboard"), encoding="utf-8").read()
    need('systemColor="systemBackgroundColor"' not in sb, "LaunchScreen 배경이 아직 흰색")
    for e in errs:
        print("실패:", e)
    for n in notes:
        print("확인:", n)
    if errs:
        raise SystemExit(1)
    print("검사 통과")


if __name__ == "__main__":
    what = sys.argv[1:] or ["ios", "android", "check"]
    if "ios" in what or "android" in what:
        m = load_master()
        if "ios" in what:
            make_ios(m)
        if "android" in what:
            make_android(m)
    if "check" in what:
        check()
