# -*- coding: utf-8 -*-
"""메인 앱 아이콘(옅은 판)이 홈 화면에서 어떻게 보이는지 확인용 미리보기 두 장을 만든다 — brand/guide/ 에 쓴다.

    PYTHONIOENCODING=utf-8 python store/make_icon_preview.py

  brand/guide/home_screen.png         iOS 식 홈 화면 4종(밝은·어두운·노랑·알록달록 배경화면) + iOS 다크/틴트 아이콘.
                                      가짜 앱 아이콘 + 쿡매치(frontend/assets/icon.png). 합성 목업이라 실제 기기와 다를 수 있다.
  brand/logo/android/adaptive_and_notification.png
                                      Android 적응형(흰 배경 #FFFFFF + 노랑 재료 전경)을 원형·스쿼클·둥근사각 마스크로,
                                      테마 아이콘(monochrome)과 알림 실루엣.
  brand/logo/lockup/lockups_3.png     락업 3종(가로·세로·아이콘 단독) × 검정·옅은·노랑 바탕 — 타일은 모두 옅은 판(메인 아이콘)
  brand/logo/lockup/store_first_slide_top.png  스토어 첫 장 상단(노랑 장·검정 장) — 실제 스크린샷(store/screenshots_v3)에서 잘라 냄

마스터는 frontend/assets/ 에서 읽는다(손으로 고치지 말 것).
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "frontend", "assets")
OUT = os.path.join(ROOT, "brand", "guide")
OUT_ANDROID = os.path.join(ROOT, "brand", "logo", "android", "adaptive_and_notification.png")
OUT_LOCKUP = os.path.join(ROOT, "brand", "logo", "lockup")
STORE_BRAND = os.path.join(ROOT, "store", "brand")
FONT = "C:/Windows/Fonts/NotoSansKR-VF.ttf"
RATIO = 0.2237  # iOS 아이콘 모서리


def font(px, w=700):
    f = ImageFont.truetype(FONT, px)
    try:
        f.set_variation_by_axes([w])
    except Exception:  # noqa: BLE001
        pass
    return f


def tile(img, size, ratio=RATIO):
    img = img.convert("RGB").resize((size, size), Image.LANCZOS).convert("RGBA")
    m = Image.new("L", (size * 4, size * 4), 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, size * 4 - 1, size * 4 - 1], radius=int(size * 4 * ratio), fill=255)
    img.putalpha(m.resize((size, size), Image.LANCZOS))
    return img


def fake_icon(size, color, glyph):
    im = Image.new("RGB", (size * 2, size * 2), color)
    d = ImageDraw.Draw(im)
    c, r = size, size * 0.34
    if glyph == "dot":
        d.ellipse([c - r, c - r, c + r, c + r], fill=(255, 255, 255))
    elif glyph == "sq":
        d.rounded_rectangle([c - r, c - r, c + r, c + r], radius=int(r * 0.4), fill=(255, 255, 255))
    else:
        for k in (-1, 0, 1):
            d.rounded_rectangle([c - r, c + k * r * 0.7 - r * 0.14, c + r, c + k * r * 0.7 + r * 0.14], radius=int(r * 0.14), fill=(60, 60, 66))
    return tile(im, size)


def gradient(w, h, top, bottom):
    g = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(g)
    for y in range(h):
        t = y / h
        d.line([(0, y), (w, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return g


WALLS = [
    ("밝은 배경화면", lambda w, h: gradient(w, h, (246, 246, 249), (226, 228, 235)), (30, 30, 34)),
    ("어두운 배경화면", lambda w, h: gradient(w, h, (24, 24, 28), (8, 8, 11)), (235, 235, 240)),
    ("노랑 배경화면", lambda w, h: gradient(w, h, (255, 214, 0), (255, 200, 0)), (26, 26, 30)),
    ("알록달록 배경화면", lambda w, h: gradient(w, h, (72, 116, 190), (240, 150, 120)), (255, 255, 255)),
]
FAKES = [((255, 233, 160), "line"), ((120, 175, 255), "dot"), ((255, 255, 255), "line"), ((150, 214, 150), "sq"),
         ((248, 88, 112), "dot"), ((70, 70, 78), "dot"), (None, None), ((28, 28, 32), "dot"),
         ((70, 140, 255), "sq"), ((255, 160, 70), "line"), ((255, 255, 255), "line"), ((255, 148, 30), "line")]


def phone(w, h, wall, label_color, icon_img, icon_size=60):
    ph = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    scr = wall(w - 24, h - 24).convert("RGBA")
    m = Image.new("L", scr.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, scr.width - 1, scr.height - 1], radius=48, fill=255)
    d = ImageDraw.Draw(ph)
    d.rounded_rectangle([0, 0, w - 1, h - 1], radius=60, fill=(20, 20, 22))
    ph.paste(scr, (12, 12), m)
    d = ImageDraw.Draw(ph)
    cols, gy = 4, 40
    gx = (w - 24 - cols * icon_size) // (cols + 1)
    x0, y0 = 12 + gx, 120
    lab = font(12, 600)
    for i, (col, gl) in enumerate(FAKES):
        r, c = divmod(i, cols)
        x, y = x0 + c * (icon_size + gx), y0 + r * (icon_size + gy + 14)
        if col is None:
            ph.alpha_composite(tile(icon_img, icon_size), (x, y))
            name = "쿡매치"
        else:
            ph.alpha_composite(fake_icon(icon_size, col, gl), (x, y))
            name = ("메모", "날씨", "사진", "지도", "음악", "카메라", "", "시계", "메일", "책", "건강", "계산기")[i]
        d.text((x + icon_size / 2, y + icon_size + 12), name, font=lab, fill=label_color, anchor="mm")
    # 독
    d.rounded_rectangle([20, h - 100, w - 20, h - 28], radius=30, fill=(255, 255, 255, 110) if label_color[0] < 100 else (255, 255, 255, 60))
    for k in range(4):
        ph.alpha_composite(fake_icon(icon_size, [(120, 175, 255), (70, 140, 255), (60, 190, 200), (150, 150, 160)][k], "sq"), (x0 + k * (icon_size + gx), h - 94))
    return ph


def home_screen():
    master = Image.open(os.path.join(ASSETS, "icon.png"))
    reverse = Image.open(os.path.join(ASSETS, "brand", "icon_reverse_1024.png"))
    W, H, g = 330, 660, 24
    canvas = Image.new("RGB", (g + 4 * (W + g), 90 + H + g + 230), (238, 238, 240))
    d = ImageDraw.Draw(canvas)
    d.text((g, 22), "메인 앱 아이콘 = 옅은(흰 배경) 판 — 홈 화면에서의 모습 (합성 목업)", font=font(26, 800), fill=(30, 30, 34))
    for i, (name, wall, lc) in enumerate(WALLS):
        p = phone(W, H, wall, lc, master)
        canvas.paste(p, (g + i * (W + g), 70), p)
        d.text((g + i * (W + g) + W / 2, 70 + H + 22), name, font=font(20, 700), fill=(60, 60, 66), anchor="mm")
    # 아래: 같은 아이콘 크기별 + iOS 다크/틴트
    y = 70 + H + 60
    x = g
    for label, im, bg in (("옅은 판(기본) 120·60·40px", master, (255, 255, 255)), ("iOS 다크 아이콘 (검정 바탕판)", reverse, (30, 30, 34)),
                          ("iOS 틴트 (회색조 → 시스템이 색칠)", reverse.convert("L").convert("RGB"), (50, 50, 56))):
        d.rounded_rectangle([x, y, x + 400, y + 160], radius=20, fill=bg)
        for k, s in enumerate((120, 60, 40)):
            t = tile(im, s)
            canvas.paste(t, (x + 16 + sum((140, 80, 60)[:k]), y + 20 + (120 - s) // 2), t)
        d.text((x + 200, y + 190), label, font=font(18, 700), fill=(60, 60, 66), anchor="mm")
        x += 420
    canvas.save(os.path.join(OUT, "home_screen.png"), optimize=True)
    print("wrote home_screen.png", canvas.size)


def android_preview():
    fg = Image.open(os.path.join(ASSETS, "brand", "adaptive_foreground_1024.png")).convert("RGBA")
    sil = Image.open(os.path.join(ASSETS, "brand", "notification_silhouette_1024.png")).convert("RGBA")
    layer = Image.new("RGBA", (1024, 1024), (255, 255, 255, 255))  # 배경 = 흰색 단색
    layer.alpha_composite(fg)
    vis = layer.crop((int(1024 * 18 / 108), int(1024 * 18 / 108), int(1024 * 90 / 108), int(1024 * 90 / 108)))  # 108dp 중 가운데 72dp 만 보인다
    S = 240

    def masked(shape):
        im = vis.resize((S, S), Image.LANCZOS)
        m = Image.new("L", (S * 4, S * 4), 0)
        dd = ImageDraw.Draw(m)
        if shape == "circle":
            dd.ellipse([0, 0, S * 4 - 1, S * 4 - 1], fill=255)
        elif shape == "squircle":
            dd.rounded_rectangle([0, 0, S * 4 - 1, S * 4 - 1], radius=int(S * 4 * 0.34), fill=255)
        else:
            dd.rounded_rectangle([0, 0, S * 4 - 1, S * 4 - 1], radius=int(S * 4 * 0.16), fill=255)
        im.putalpha(m.resize((S, S), Image.LANCZOS))
        return im

    W, H = 1500, 560
    out = Image.new("RGB", (W, H), (236, 236, 239))
    d = ImageDraw.Draw(out)
    d.text((24, 20), "안드로이드 적응형 아이콘(배경 흰색 #FFFFFF + 노랑 재료 전경) · 테마 아이콘 · 알림", font=font(26, 800), fill=(30, 30, 34))
    items = [("원형", "circle", (246, 246, 249)), ("스쿼클", "squircle", (246, 246, 249)), ("둥근 사각", "round", (246, 246, 249)),
             ("원형 · 어두운 배경", "circle", (24, 24, 28)), ("원형 · 노랑 배경", "circle", (255, 214, 0))]
    for i, (lab, shape, bg) in enumerate(items):
        x = 24 + i * 290
        d.rounded_rectangle([x, 80, x + 270, 360], radius=24, fill=bg)
        out.paste(masked(shape), (x + 15, 95), masked(shape))
        d.text((x + 135, 385), lab, font=font(18, 700), fill=(70, 70, 76), anchor="mm")
    # 테마 아이콘(monochrome): 전경 알파를 단색으로
    x = 24
    d.rounded_rectangle([x, 420, x + 270, 540], radius=24, fill=(214, 226, 255))
    mono_col = Image.new("RGBA", (1024, 1024), (30, 50, 110, 255))
    mono_col.putalpha(fg.getchannel("A"))
    base = Image.new("RGBA", (1024, 1024), (214, 226, 255, 255))
    base.alpha_composite(mono_col)
    mv = base.crop((int(1024 * 18 / 108), int(1024 * 18 / 108), int(1024 * 90 / 108), int(1024 * 90 / 108))).resize((100, 100), Image.LANCZOS)
    m = Image.new("L", (400, 400), 0)
    ImageDraw.Draw(m).ellipse([0, 0, 399, 399], fill=255)
    mv.putalpha(m.resize((100, 100), Image.LANCZOS))
    out.paste(mv, (x + 20, 430), mv)
    d.text((x + 132, 480), "테마 아이콘", font=font(15, 700), fill=(40, 50, 90), anchor="lm")
    d.text((x + 132, 502), "(Android 13+)", font=font(13, 600), fill=(40, 50, 90), anchor="lm")
    # 알림 실루엣
    x = 24 + 290
    d.rounded_rectangle([x, 420, x + 270, 540], radius=24, fill=(48, 48, 54))
    s = sil.resize((72, 72), Image.LANCZOS)
    out.paste(s, (x + 30, 444), s)
    s2 = sil.resize((24, 24), Image.LANCZOS)
    out.paste(s2, (x + 120, 468), s2)
    d.text((x + 156, 480), "알림 72·24px", font=font(15, 700), fill=(220, 220, 225), anchor="lm")
    out.save(OUT_ANDROID, optimize=True)
    print("wrote", OUT_ANDROID, out.size)


def lockups():
    """락업 3종 × 3바탕. 타일은 전부 메인 앱 아이콘(옅은 판) — 노랑 위에서도 흰 타일이라 사라지지 않는다."""
    master = Image.open(os.path.join(ASSETS, "icon.png"))
    rows = [("black", (26, 26, 30)), ("white", (247, 247, 245)), ("yellow", (255, 214, 0))]
    W, rh, gap = 1500, 290, 20
    out = Image.new("RGB", (W, 80 + len(rows) * (rh + gap)), (255, 255, 255))
    d = ImageDraw.Draw(out)
    d.text((30, 38), "락업 3종 — 가로형 · 세로형 · 아이콘 단독 (메인 아이콘 = 옅은 판, 2026-11-08)", font=font(28, 800), fill=(26, 26, 30), anchor="lm")
    for i, (on, bg) in enumerate(rows):
        y = 80 + i * (rh + gap)
        d.rectangle([30, y, W - 30, y + rh], fill=bg)
        wm = Image.open(os.path.join(STORE_BRAND, f"wordmark_on_{on}.png")).convert("RGBA")
        wh = 50
        wm = wm.resize((int(wm.width * wh / wm.height), wh), Image.LANCZOS)
        # 가로형
        t = tile(master, 150)
        out.paste(t, (70, y + 70), t)
        out.paste(wm, (70 + 150 + 38, y + 70 + 150 // 2 - wh // 2 + 8), wm)
        # 세로형
        t = tile(master, 150)
        cx = 850
        out.paste(t, (cx - 75, y + 28), t)
        w2 = wm.resize((int(wm.width * 0.9), int(wm.height * 0.9)), Image.LANCZOS)
        out.paste(w2, (cx - w2.width // 2, y + 28 + 150 + 18), w2)
        # 아이콘 단독
        t = tile(master, 220)
        out.paste(t, (1160, y + 35), t)
    out.save(os.path.join(OUT_LOCKUP, "lockups_3.png"), optimize=True)
    print("wrote lockups_3.png", out.size)


def first_slide_top():
    """스토어 첫 장 상단 — 실제 스크린샷(노랑 장 = play/01_brand, 검정 장 = alt/01_B)의 위쪽을 나란히."""
    sd = os.path.join(ROOT, "store", "screenshots_v3")
    a = Image.open(os.path.join(sd, "play", "01_brand.png")).convert("RGB")
    b = Image.open(os.path.join(sd, "alt", "01_B.png")).convert("RGB")
    crop_h = 1000
    s = 0.62
    parts = [im.crop((0, 0, im.width, crop_h)).resize((int(im.width * s), int(crop_h * s)), Image.LANCZOS) for im in (a, b)]
    out = Image.new("RGB", (parts[0].width * 2 + 60, parts[0].height + 100), (230, 230, 232))
    d = ImageDraw.Draw(out)
    for i, (p, lab) in enumerate(zip(parts, ("노랑 장 (타일 = 옅은 판)", "검정 장 (타일 = 옅은 판)"))):
        out.paste(p, (20 + i * (p.width + 20), 70))
        d.text((20 + i * (p.width + 20), 36), lab, font=font(22, 800), fill=(30, 30, 34), anchor="lm")
    out.save(os.path.join(OUT_LOCKUP, "store_first_slide_top.png"), optimize=True)
    print("wrote store_first_slide_top.png", out.size)


if __name__ == "__main__":
    home_screen()
    android_preview()
    lockups()
    first_slide_top()
