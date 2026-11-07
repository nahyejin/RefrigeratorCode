# -*- coding: utf-8 -*-
"""새 로고(P1 확정) 마케팅용 공용 자산 — 스토어 스크린샷(v3)·릴스(my-video)·문서가 같이 쓴다.

    PYTHONIOENCODING=utf-8 python store/make_brand_assets.py

입력: store/logo_proposals/e9_final/p1_final/fullset/ 의 확정 아이콘(옅은 판=메인·노랑 바탕판·검정 바탕판) + make_logo_proposals.py 의 워드마크 글꼴 처리
      (「쿡매치」 굵은 한글 + 「CookMatch」 보조, 둥글게 다듬은 모서리 0.012 — 락업 3종 시안과 같은 값).
출력: store/brand/  (투명 배경 PNG — 다른 코드가 그대로 읽어 쓴다. 마크를 다시 그리지 않는다.)
    cookmatch_mark_1024.png          정식 마크 = **메인 앱 아이콘(옅은 판: 흰 바탕 #FFFFFF + 노랑 재료, 2026-11-08 확정)**, 모서리 없는 정사각 1024
    cookmatch_mark_yellow_1024.png   노랑 바탕판(옛 기본: 노랑 바탕 + 흰 재료) — 노랑 화면 자체에 마크를 직접 얹을 때(바탕 이음매 없음)
    cookmatch_mark_reverse_1024.png  검정 바탕판(노랑 장 위에서 타일을 더 진하게 쓰고 싶을 때 / iOS 다크)
    cookmatch_mark_512.png / _120.png  소셜 로그인 콘솔(카카오·구글·네이버) 같은 작은 로고 칸용 축소본(정사각 RGB, 모서리 없음 — 콘솔이 알아서 마스크)
    wordmark_on_white.png / _on_yellow.png / _on_black.png   「쿡매치 CookMatch」 가로형 글자(투명), 바탕에 맞춘 색
"""
import os
import shutil
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
LP = os.path.join(HERE, "logo_proposals")
FULL = os.path.join(LP, "e9_final", "p1_final", "fullset")
OUT = os.path.join(HERE, "brand")
sys.path.insert(0, LP)
import make_logo_proposals as L  # noqa: E402
from PIL import Image  # noqa: E402

KO_FOR = {"on_white": L.INK, "on_yellow": L.INK, "on_black": L.BRAND}
EN_FOR = {"on_white": L.SUB_L, "on_yellow": L.SUB_Y, "on_black": L.SUB_K}


def wordmark_rgba(ko_c, en_c, ss=3, height=360):
    """make_logo_proposals.wordmark() 의 가로형과 같은 배치를 투명 배경으로(글자 둘레 여백 없이 잘라 낸다)."""
    KO = 300
    ko, kb, kw, kp = L.text_mask("쿡매치", KO, 900, tracking=-0.02, rnd=0.012, ss=ss)
    en, eb, ew, ep = L.text_mask("CookMatch", 108, 600, tracking=0.035, ss=ss)
    W, H = 4000 * ss, 1000 * ss
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    base_y = 560 * ss
    x = 80 * ss
    layer.paste(Image.new("RGBA", ko.size, ko_c + (255,)), (int(x - kp), int(base_y - kb)), ko)
    x += kw + 64 * ss
    layer.paste(Image.new("RGBA", en.size, en_c + (255,)), (int(x - ep), int(base_y - eb)), en)
    im = layer.crop(layer.getbbox())
    return im.resize((int(im.width * height / im.height), height), Image.LANCZOS)


def main():
    os.makedirs(OUT, exist_ok=True)
    shutil.copy(os.path.join(FULL, "app_icon_light_1024.png"), os.path.join(OUT, "cookmatch_mark_1024.png"))
    shutil.copy(os.path.join(FULL, "app_icon_1024.png"), os.path.join(OUT, "cookmatch_mark_yellow_1024.png"))
    shutil.copy(os.path.join(FULL, "app_icon_reverse_1024.png"), os.path.join(OUT, "cookmatch_mark_reverse_1024.png"))
    big = Image.open(os.path.join(OUT, "cookmatch_mark_1024.png")).convert("RGB")
    for n in (512, 120):
        big.resize((n, n), Image.LANCZOS).save(os.path.join(OUT, f"cookmatch_mark_{n}.png"))
    for k in KO_FOR:
        wordmark_rgba(KO_FOR[k], EN_FOR[k]).save(os.path.join(OUT, f"wordmark_{k}.png"))
    print("brand assets ->", OUT)


if __name__ == "__main__":
    main()
