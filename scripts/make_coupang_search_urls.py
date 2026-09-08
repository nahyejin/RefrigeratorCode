# -*- coding: utf-8 -*-
"""쿠팡 파트너스에 **붙여넣을 검색 URL** 을 미리 만들어 준다.

왜 필요한가:
    파트너스의 "간편 링크 만들기" 는 쿠팡 안의 아무 페이지 URL 이나 받아서
    `link.coupang.com/a/XXXXXX` 짧은 링크를 내준다. 상품 페이지도 되고
    **검색 결과 페이지도 된다.**

    재료 링크는 검색 URL 로 만드는 편이 낫다 — `대파` 에 상품 하나를 고르면
    그 상품이 품절되는 순간 링크가 죽지만, 검색 결과는 안 죽는다.

    그런데 194개를 일일이 쿠팡에서 검색하고 주소창을 복사하는 건 지루하다.
    이 스크립트가 그 URL 을 미리 만들어 준다. 파트너스 화면에 하나씩
    붙여넣기만 하면 된다.

무엇을 출력하나:
    `coupang_search_urls.txt` — 아직 링크가 없는 재료만, 많이 쓰이는 순서로.

쓰는 법:
    python scripts/make_coupang_search_urls.py            # 상위 40개
    python scripts/make_coupang_search_urls.py --all      # 빈 것 전부
"""

import argparse
import csv
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADS = os.path.join(ROOT, "frontend", "public", "coupang_ads.csv")
OUT = os.path.join(ROOT, "coupang_search_urls.txt")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="빈 것 전부 (기본: 상위 40개)")
    ap.add_argument("--top", type=int, default=40)
    args = ap.parse_args()

    # BOM 이 붙어 있어도 벗겨 낸다.
    with io.open(ADS, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    todo = []
    for r in rows:
        name = (r.get("ingredient_keyword") or "").strip()
        if not name or (r.get("coupang_url") or "").strip():
            continue
        try:
            rank = int(r.get("rank") or 9999)
        except ValueError:
            rank = 9999
        todo.append((rank, name, (r.get("recipe_count") or "").strip()))
    todo.sort()
    if not args.all:
        todo = todo[:args.top]

    lines = [
        "쿠팡 파트너스에 붙여넣을 검색 URL",
        "",
        "쓰는 법:",
        "  1. partners.coupang.com -> 왼쪽 메뉴 '간편 링크 만들기'",
        "  2. 아래 URL 을 하나 복사해 붙여넣고 '링크 생성'",
        "  3. 나온 link.coupang.com/a/XXXXXX 를 복사",
        "  4. frontend/public/coupang_ads.csv 의 그 재료 줄, 두 번째 칸에 붙여넣기",
        "",
        "  * 엑셀로 열지 마세요 (BOM 이 붙어 파일이 통째로 안 읽힙니다)",
        "  * 상품 하나를 고르고 싶으면 그 상품 페이지 URL 로 만들어도 됩니다.",
        "    다만 품절되면 링크가 죽으므로 검색 URL 이 관리가 편합니다.",
        "  * 검색어가 너무 넓으면 URL 의 q= 뒤를 고쳐서 만드세요.",
        "    (파 -> 대파, 고추 -> 청양고추, 면 -> 소면, 다리 -> 닭다리)",
        "    사전 대표어는 그대로 두고 **검색어만** 바꾸는 겁니다 —",
        "    CSV 의 첫 칸(ingredient_keyword)은 절대 고치지 마세요.",
        "",
        "아직 링크가 없는 재료 %d개 (많이 쓰이는 순)" % len(todo),
        "=" * 72,
        "",
    ]
    for rank, name, count in todo:
        # **한글을 그대로 둔다.** 퍼센트 인코딩(%EB%8B%A4...)을 하면 붙여넣기
        # 전에 눈으로 확인할 수가 없다. 브라우저와 파트너스 모두 한글 URL 을
        # 그대로 받는다.
        url = "https://www.coupang.com/np/search?q=" + name
        lines.append("%3s. %-14s (레시피 %s개)" % (rank, name, count or "?"))
        lines.append("     %s" % url)
        lines.append("")

    with io.open(OUT, "w", encoding="utf-8", newline="") as f:
        f.write("\n".join(lines))
    print("%d개를 적었습니다: %s" % (len(todo), OUT))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
