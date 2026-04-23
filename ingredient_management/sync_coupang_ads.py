"""
수동 동기화 스크립트:
- MyFridge 초기 기본 재료 + premiumIngredients.ts 재료를 coupang_ads.csv에 보강
- priority는 통상 단가 기준 A/B/C/D 자동 분류
- active는 기본 Y로 보정

사용:
  python ingredient_management/sync_coupang_ads.py
  python ingredient_management/sync_coupang_ads.py --dry-run
"""

from __future__ import annotations

import argparse
import csv
import re
from pathlib import Path
from typing import Iterable


ROOT = Path(__file__).resolve().parents[1]
MYFRIDGE_PATH = ROOT / "frontend" / "src" / "pages" / "MyFridge.tsx"
PREMIUM_PATH = ROOT / "frontend" / "src" / "utils" / "premiumIngredients.ts"
COUPANG_ADS_PATH = ROOT / "frontend" / "public" / "coupang_ads.csv"

# 통상 단가/객단가 기준 우선순위(높은 우선순위 = A)
PRICE_TIER_A = {
    "캐비어", "푸아그라", "트러플", "킹크랩", "랍스터", "대게", "전복", "성게", "멍게",
    "해삼", "가리비", "관자", "와규", "한우", "안심", "등심", "스테이크",
    "소고기", "쇠고기", "갈매기살", "샴페인", "와인", "메이플시럽",
}
PRICE_TIER_B = {
    "연어", "참치", "광어", "도미", "문어", "오징어", "바지락", "홍합", "골뱅이",
    "갈비", "삼겹살", "목살", "돼지고기", "닭고기", "만두", "멸치",
    "송이버섯", "표고버섯", "새송이버섯", "느타리버섯",
    "모짜렐라", "고르곤졸라", "파마산", "리코타", "크림치즈", "버터", "생크림",
    "올리브오일", "발사믹", "꿀",
}
PRICE_TIER_C = {
    "아스파라거스", "로메인", "치커리", "루꼴라",
    "두부", "달걀", "우유", "김치", "식용유", "참기름",
    "간장", "된장", "고추장", "고춧가루", "미림", "맛술", "알룰로스",
    "라면", "양파", "마늘", "대파", "감자", "당근",
}
# 나머지는 D


def classify_priority(keyword: str) -> str:
    if keyword in PRICE_TIER_A:
        return "A"
    if keyword in PRICE_TIER_B:
        return "B"
    if keyword in PRICE_TIER_C:
        return "C"
    return "D"


def _extract_array_items(ts_text: str, array_var_name: str) -> list[str]:
    pattern = re.compile(
        rf"const\s+{re.escape(array_var_name)}\s*=\s*\[(.*?)\];",
        re.DOTALL,
    )
    m = pattern.search(ts_text)
    if not m:
        return []
    body = m.group(1)
    return re.findall(r"'([^']+)'", body)


def get_default_myfridge_ingredients() -> list[str]:
    text = MYFRIDGE_PATH.read_text(encoding="utf-8")
    room = _extract_array_items(text, "defaultRoomIngredients")
    fridge = _extract_array_items(text, "defaultFridgeIngredients")
    frozen = _extract_array_items(text, "defaultFrozenIngredients")
    return room + fridge + frozen


def get_premium_ingredients() -> list[str]:
    text = PREMIUM_PATH.read_text(encoding="utf-8")
    return re.findall(r"\{\s*rank:\s*\d+,\s*name:\s*'([^']+)'\s*\}", text)


def unique_keep_order(items: Iterable[str]) -> list[str]:
    out: list[str] = []
    seen: set[str] = set()
    for item in items:
        key = item.strip()
        if not key:
            continue
        if key in seen:
            continue
        seen.add(key)
        out.append(key)
    return out


def read_coupang_ads() -> list[dict[str, str]]:
    if not COUPANG_ADS_PATH.exists():
        return []
    with COUPANG_ADS_PATH.open("r", encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        return [dict(row) for row in reader]


def write_coupang_ads(rows: list[dict[str, str]]) -> None:
    fieldnames = ["ingredient_keyword", "coupang_url", "priority", "active"]
    with COUPANG_ADS_PATH.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    required_keywords = unique_keep_order(
        get_default_myfridge_ingredients() + get_premium_ingredients()
    )

    rows = read_coupang_ads()
    row_by_keyword: dict[str, dict[str, str]] = {}
    ordered_keywords: list[str] = []

    for row in rows:
        keyword = (row.get("ingredient_keyword") or "").strip()
        if not keyword:
            continue
        normalized = {
            "ingredient_keyword": keyword,
            "coupang_url": (row.get("coupang_url") or "").strip(),
            "priority": (row.get("priority") or "").strip() or "A",
            "active": (row.get("active") or "").strip() or "Y",
        }
        if keyword not in row_by_keyword:
            ordered_keywords.append(keyword)
        row_by_keyword[keyword] = normalized

    added = 0
    updated = 0
    tier_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
    for keyword in required_keywords:
        target_priority = classify_priority(keyword)
        tier_counts[target_priority] += 1

        if keyword in row_by_keyword:
            row = row_by_keyword[keyword]
            changed = False
            if row["priority"] != target_priority:
                row["priority"] = target_priority
                changed = True
            if row["active"].upper() != "Y":
                row["active"] = "Y"
                changed = True
            if changed:
                updated += 1
        else:
            row_by_keyword[keyword] = {
                "ingredient_keyword": keyword,
                "coupang_url": "",
                "priority": target_priority,
                "active": "Y",
            }
            ordered_keywords.append(keyword)
            added += 1

    final_rows = [row_by_keyword[k] for k in ordered_keywords]

    print(f"동기화 대상(기본+프리미엄): {len(required_keywords)}개")
    print(
        f"자동 등급 분포: A={tier_counts['A']} / B={tier_counts['B']} / C={tier_counts['C']} / D={tier_counts['D']}"
    )
    print(f"추가: {added}개, 갱신(priority/active): {updated}개")
    print(f"최종 coupang_ads 행 수: {len(final_rows)}개")

    if args.dry_run:
        print("(dry-run) 파일 저장 없이 종료")
        return

    write_coupang_ads(final_rows)
    print(f"저장 완료: {COUPANG_ADS_PATH}")


if __name__ == "__main__":
    main()

