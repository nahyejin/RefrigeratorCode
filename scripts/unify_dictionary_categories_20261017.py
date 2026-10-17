# -*- coding: utf-8 -*-
"""재료 사전 — 같은 재료가 두 번(자기 항목 + 다른 재료의 동의어) 다른 분류로 오른 것을 한쪽으로 맞춘다 (2026-10-17, 1회용).

왜:
    내냉장고 「종류별로 묶기」 에서 방울토마토는 과일, 토마토는 채소처럼 같은 재료가 다른 칸에 갔다.
    점검해 보니 같은 재료가 자기 항목과 '다른 재료의 동의어' 로 두 번 올라 서로 다른 분류였던 것이
    18건. 분류는 유통기한 짐작(재료 자신의 보관 일수가 비어 있을 때)에도 쓰여서, 실제 버그도 있었다:
      - 참치캔: '가공육' + 냉장 일수 비어 있음 → 냉장고에 두면 고기처럼 며칠 만에 「지났어요」 알림
      - 밥: '곡류'(쌀) + 냉장 일수 비어 있음 → 지은 밥이 쌀처럼 오래 가는 걸로 계산

어떻게:
    대분류가 '재료' 인 행만 고친다('요리이름' 행은 그대로). 분류 네 칸(중분류~세세분류)을 정한 쪽에서
    베끼고, **재료 자신의 보관 일수가 비어 있는 칸만** 그쪽 값으로 채운다(이미 적힌 값은 그 재료에 맞춘
    것이라 건드리지 않는다).

    python scripts/unify_dictionary_categories_20261017.py           # 미리보기
    python scripts/unify_dictionary_categories_20261017.py --write   # 반영
그 뒤 scripts/sync_ingredient_dict.py --write(백엔드 사본) · scripts/verify_ingredient_dict.py.
"""
import argparse
import csv
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "frontend", "public", "ingredient_profile_dict_with_substitutes.csv")
CAT = ["중분류", "소분류", "세분류", "세세분류"]
DAYS = ["보관냉동", "보관냉장", "보관실온"]

# (고칠 재료들, 기준) — 기준이 재료명이면 그 행의 분류를, 튜플이면 그 분류를 그대로.
FIXES = [
    # 토마토 셋은 채소. 토마토 자신도 '잎채소류' 가 틀려서 열매채소류로.
    (["토마토", "방울토마토", "완숙토마토"], ("식재료 원물", "채소류", "열매채소류", "기타채소류")),
    (["통깨"], "참깨"),                         # 깨는 양념
    (["참치캔"], "캔참치"),                     # 통조림(가공육 아님)
    (["게장", "양념게장"], "장아찌"),           # 반찬(즉석반찬/김치류)
    (["매실장아찌", "마늘쫑장아찌"], "장아찌"),
    (["쌈무"], "무쌈"),
    (["멸치육수주머니"], "다시팩"),             # 육수 재료
    (["밥"], "쌀밥"),                           # 지은 밥
    (["산마늘", "명이나물"], ("식재료 원물", "채소류", "잎채소류", "기타잎채소")),
    (["감자만두", "납작만두"], "만두"),
    (["캐비아"], "캐비어"),                     # 유제품 아님
    (["생콩가루"], "날콩가루"),
    (["코코아가루"], "코코아파우더"),
    # 콩나물·숙주는 사전상 콩류지만 장 볼 때·냉장고에선 채소
    (["콩나물", "숙주"], ("식재료 원물", "채소류", "발아채소류", "")),
]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    raw = io.open(CSV_PATH, "rb").read()
    bom = raw.startswith(b"\xef\xbb\xbf")
    text = raw.decode("utf-8-sig")
    newline = "\r\n" if "\r\n" in text[:2000] else "\n"
    reader = csv.DictReader(io.StringIO(text, newline=""))
    fields = reader.fieldnames
    rows = list(reader)
    ing = {}
    for r in rows:
        if r["대분류"] == "재료":
            ing.setdefault(r["keyword"], r)

    changed = 0
    for targets, base in FIXES:
        if isinstance(base, tuple):
            cat, days = dict(zip(CAT, base)), {}
        else:
            src = ing[base]
            cat, days = {k: src[k] for k in CAT}, {k: src[k] for k in DAYS}
        for name in targets:
            row = ing.get(name)
            if not row:
                print(f"  ! 없음: {name}")
                continue
            before = " > ".join(row[k] for k in CAT)
            fill = {k: v for k, v in days.items() if v and not (row[k] or "").strip()}
            if all(row[k] == cat[k] for k in CAT) and not fill:
                continue
            row.update(cat)
            row.update(fill)
            changed += 1
            extra = f"  (빈 보관일수 채움 {fill})" if fill else ""
            print(f"  {name}: {before}  →  {' > '.join(cat[k] for k in CAT)}{extra}")

    print(f"\n고칠 행 {changed}개")
    if not args.write:
        print("미리보기입니다. --write 를 붙이면 반영합니다.")
        return 0
    out = io.StringIO()
    w = csv.DictWriter(out, fieldnames=fields, lineterminator=newline)
    w.writeheader()
    w.writerows(rows)
    io.open(CSV_PATH, "w", encoding="utf-8-sig" if bom else "utf-8", newline="").write(out.getvalue())
    print("반영했습니다:", CSV_PATH)
    return 0


if __name__ == "__main__":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
    raise SystemExit(main())
