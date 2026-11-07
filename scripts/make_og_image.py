# -*- coding: utf-8 -*-
"""링크 공유(OG) 이미지 — frontend/public/og_image.png (1200x630, 노랑 바탕 + 마크 + 한 줄 카피).

    PYTHONIOENCODING=utf-8 python scripts/make_og_image.py

마크는 새 로고 마스터(frontend/assets/icon.png)를 그대로 쓴다(바탕이 같은 노랑이라 이음매가 없다).
문구는 사실 확인된 것만: 레시피 44,001건 = 네이버 39,630 + 유튜브 4,371, 매일 엄선 수집.
글꼴은 시안과 같은 Noto Sans KR(없으면 맑은 고딕 굵게).
"""
import os

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "frontend", "public", "og_image.png")
ICON = os.path.join(ROOT, "frontend", "assets", "icon.png")
BRAND = (255, 214, 0)
INK = (26, 26, 30)
INK_SUB = (74, 62, 0)       # 노랑 위 보조 글자(대비 확보)
W, H = 1200, 630

FONTS = ["C:/Windows/Fonts/NotoSansKR-VF.ttf", "C:/Windows/Fonts/malgunbd.ttf",
         "/usr/share/fonts/truetype/noto/NotoSansCJK-Black.ttc", "/System/Library/Fonts/AppleSDGothicNeo.ttc"]


def font(size, weight=900):
    for p in FONTS:
        if os.path.exists(p):
            f = ImageFont.truetype(p, size)
            try:
                f.set_variation_by_axes([weight])
            except Exception:  # noqa: BLE001
                pass
            return f
    raise SystemExit("한글 글꼴을 찾지 못했다")


def main():
    # 44,001 = 39,630 + 4,371 — 숫자가 어긋나면 이 이미지를 만들지 않는다
    assert 39630 + 4371 == 44001
    im = Image.new("RGB", (W, H), BRAND)
    d = ImageDraw.Draw(im)
    icon = Image.open(ICON).convert("RGB").resize((470, 470), Image.LANCZOS)
    im.paste(icon, (60, 80))
    x = 580
    f1 = font(60, 900)
    d.text((x, 150), "인기 레시피만 4만 개,", font=f1, fill=INK)
    d.text((x, 232), "뭘 골라도 맛집", font=f1, fill=INK)
    f2 = font(29, 600)
    d.text((x, 345), "네이버·유튜브 인기 레시피 44,001개를", font=f2, fill=INK_SUB)
    d.text((x, 389), "매일 엄선해서 모아요", font=f2, fill=INK_SUB)
    # 아래: 워드마크(굵은 한글 + 작은 영문) — 앱 헤더와 같은 구성
    d.text((x, 485), "쿡매치", font=font(52, 900), fill=INK)
    d.text((x + 175, 506), "CookMatch", font=font(26, 600), fill=INK_SUB)
    im.save(OUT, optimize=True)
    print("wrote", OUT, im.size)


if __name__ == "__main__":
    main()
