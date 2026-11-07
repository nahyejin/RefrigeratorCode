# -*- coding: utf-8 -*-
"""웹/PWA 아이콘을 새 로고 마스터(frontend/assets/icon.png)에서 만든다 — frontend/public/ 에 쓴다.

    PYTHONIOENCODING=utf-8 python scripts/make_web_icons.py

파일명에 _v2 를 붙인다(옛 이름 그대로 두면 서비스워커·카톡/인스타 링크 미리보기 캐시가 옛 그림을 오래 보여 준다).
- cookmatch_icon_v2.png            512  앱 아이콘(download.html·알림 icon·OG 대용), 모서리 안 깎은 정사각
- cookmatch_icon_192_v2.png        192  manifest any
- cookmatch_icon_512_v2.png        512  manifest any
- cookmatch_maskable_512_v2.png    512  manifest maskable — 마크를 80% 로 줄여 안전영역(지름 80% 원) 안에 둔다
- cookmatch_apple_touch_v2.png     180  apple-touch-icon(알파 없는 RGB — 사파리는 알파를 검정으로 채운다)
- cookmatch_favicon_32_v2.png       32  파비콘
- cookmatch_favicon_48_v2.png       48  파비콘(크게)
- badge_white.png                   96  푸시 배지(투명 + 흰 단색 실루엣 — 컬러면 안드로이드가 흰 네모로 그린다)
"""
import os

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "frontend", "assets")
OUT = os.path.join(ROOT, "frontend", "public")
BRAND = (255, 214, 0)


def save(im, name, **kw):
    im.save(os.path.join(OUT, name), optimize=True, **kw)
    print("wrote", name, im.size, im.mode)


def main():
    master = Image.open(os.path.join(ASSETS, "icon.png")).convert("RGB")
    assert master.size == (1024, 1024)
    for name, size in [("cookmatch_icon_v2.png", 512), ("cookmatch_icon_192_v2.png", 192), ("cookmatch_icon_512_v2.png", 512),
                       ("cookmatch_apple_touch_v2.png", 180), ("cookmatch_favicon_32_v2.png", 32), ("cookmatch_favicon_48_v2.png", 48)]:
        save(master.resize((size, size), Image.LANCZOS), name)
    # maskable: 노랑 바탕 위에 마스터를 80% 로 줄여 가운데 — 원형 마스크에 마크가 잘리지 않는다
    mk = Image.new("RGB", (512, 512), BRAND)
    inner = master.resize((410, 410), Image.LANCZOS)
    mk.paste(inner, (51, 51))
    save(mk, "cookmatch_maskable_512_v2.png")
    # 푸시 배지: 알림 실루엣(투명 + 흰색)을 96px 로
    sil = Image.open(os.path.join(ASSETS, "brand", "notification_silhouette_1024.png")).convert("RGBA")
    save(sil.resize((96, 96), Image.LANCZOS), "badge_white.png")


if __name__ == "__main__":
    main()
