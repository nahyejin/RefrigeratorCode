# -*- coding: utf-8 -*-
"""광고 후보 목록(`coupang_ads.csv`)의 **건수와 순위를 지금 데이터로 다시 센다.**

왜 필요한가:
    이 파일은 한 번 만들어 두고 그대로였는데, 그 사이 사전이 크게 바뀌었다.
    `파` 는 `대파` 로 갈렸고 `황다랑어` 는 다른 이름에 붙었다. 그래서 적혀
    있는 순위가 지금과 전혀 다르다 (2026-09-08 실측):

        파       11,540 -> 0        황다랑어  4,633 -> 0
        배추      3,958 -> 620       가지     4,758 -> 1,018
        다진마늘  11,678 -> 17,190    참깨     6,913 -> 12,720

    순위대로 링크를 채우는데 그 순위가 틀리면 **아무 글에도 안 걸리는 재료에
    시간을 쓰게 된다.** `파`·`황다랑어` 는 지금 0건이라 링크를 넣어도 안 뜬다.

무엇을 건드리지 않나:
    - **이미 채워 둔 링크.** 건수가 0이어도 그 줄은 남긴다.
    - **`priority`.** 이건 빈도가 아니라 **단가 등급**이다
      (`ingredient_management/sync_coupang_ads.py` 가 정한다). 새로 들어온
      줄에만 그 규칙으로 매기고, 기존 줄은 그대로 둔다.
    - **`active`.**

무엇을 빼나:
    사전에 **대표어로 없는 이름**(= 매칭될 수 없다), 그리고 `다리`·`정육` 처럼
    **그 이름으로는 물건을 살 수 없는 것**. 그 외에는 건수가 0이어도 남긴다 —
    `캐비어` 처럼 일부러 넣어 둔 후보가 있다.

쓰는 법:
    python scripts/refresh_coupang_ads.py            # 미리보기
    python scripts/refresh_coupang_ads.py --write
"""

import argparse
import csv
import io
import os
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
sys.path.insert(0, os.path.join(ROOT, "ingredient_management"))
from apply_dictionary_additions import load_env, db  # noqa: E402
from sync_coupang_ads import classify_priority  # noqa: E402

ADS = os.path.join(ROOT, "frontend", "public", "coupang_ads.csv")
DICT = os.path.join(ROOT, "frontend", "public",
                    "ingredient_profile_dict_with_substitutes.csv")
ADD_TOP = 200      # 이 순위 안에 드는 것은 후보로 새로 넣는다

# **그 이름으로는 물건을 살 수 없다.**
#
# `다리` 는 사전에 `부위명칭-일반` 으로 들어 있어서, LLM 이 "문어 다리를 썬다"
# 같은 문장에서 뽑은 `다리` 가 그대로 재료가 됐다. 실제로 걸린 글을 보면
# 문어볶음·김치전·마파두부, 심지어 강아지 초콜릿 만들기까지 섞여 있다.
# 쿠팡에서 "다리" 를 검색해 봐야 아무 의미가 없다.
NOT_SHOPPABLE = {
    "다리", "정육", "살코기", "절단육", "부산물", "잡뼈", "꼬리",
    "고기", "생선", "채소", "야채", "과일", "해물", "면", "떡", "가루",
    "육수", "양념", "양념장", "소스", "기름", "물", "얼음물", "나물", "밥",
}


# **사람이 "이건 빼자" 고 한 것.**
#
# `NOT_SHOPPABLE` 과 다르다 — 그 이름으로 살 수 없는 것이 아니라, **살 수는
# 있지만 광고로 둘 만큼은 아닌** 것들이다. 여기 적어 두지 않으면 다음 갱신 때
# 건수 순으로 다시 들어온다.
SKIPPED_BY_HAND = {
    "새우젓",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--top", type=int, default=ADD_TOP)
    args = ap.parse_args()
    load_env()

    with io.open(ADS, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames)
        old_rows = list(reader)

    canonicals = set()
    alias = {}
    for r in csv.DictReader(io.open(DICT, encoding="utf-8-sig", newline="")):
        if (r.get("대분류") or "").strip() not in ("재료", "포장/제품"):
            continue
        if (r.get("중분류") or "").strip() == "요리명":
            continue          # 요리 이름은 광고 후보가 아니다
        k = (r.get("keyword") or "").strip()
        if not k:
            continue
        canonicals.add(k)
        for syn in (r.get("synonyms") or "").split(","):
            syn = syn.strip()
            if syn:
                alias.setdefault(syn.replace(" ", ""), k)

    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT used_ingredients FROM recipes WHERE llm_ingredients_at IS NOT NULL")
    counts = Counter()
    for row in cur.fetchall():
        for t in (row["used_ingredients"] or "").split(","):
            t = t.strip()
            if t:
                counts[t] += 1
    conn.close()

    kept, dropped, renamed = [], [], []
    for r in old_rows:
        k = (r.get("ingredient_keyword") or "").strip()
        url = (r.get("coupang_url") or "").strip()
        if url:                       # 사람이 만든 링크는 무슨 일이 있어도 지킨다
            kept.append(r)
            continue
        if k in NOT_SHOPPABLE:
            dropped.append((k, "그 이름으론 살 수 없음"))
            continue
        if k in SKIPPED_BY_HAND:
            dropped.append((k, "손으로 뺀 것"))
            continue
        if k not in canonicals:
            # **대표어가 바뀐 것뿐이면 그쪽으로 옮긴다.**
            # `광어` -> `넙치`, `갈비` -> `소갈비`, `올리브오일` -> `올리브유`.
            # 동의어로 키를 잡아 둔 줄은 아무 글에도 안 걸린다.
            moved_to = alias.get(k.replace(" ", ""))
            if moved_to:
                r["ingredient_keyword"] = moved_to
                renamed.append((k, moved_to))
                kept.append(r)
            else:
                dropped.append((k, "사전에 대표어로 없음"))
            continue
        kept.append(r)

    # 옮기다 보면 같은 이름이 둘이 될 수 있다 (`올리브오일`·`올리브유`).
    # 링크가 있는 쪽을 남긴다.
    merged, by_name = [], {}
    for r in kept:
        k = (r.get("ingredient_keyword") or "").strip()
        prev = by_name.get(k)
        if prev is None:
            by_name[k] = r
            merged.append(r)
        elif (r.get("coupang_url") or "").strip() and not (prev.get("coupang_url") or "").strip():
            merged[merged.index(prev)] = r
            by_name[k] = r
    kept = merged

    have = {(r.get("ingredient_keyword") or "").strip() for r in kept}
    added = []
    ranked = sorted(((n, k) for k, n in counts.items()
                     if k in canonicals and k not in NOT_SHOPPABLE
                     and k not in SKIPPED_BY_HAND),
                    key=lambda x: (-x[0], x[1]))[:args.top]
    for n, k in ranked:
        if k in have:
            continue
        added.append(k)
        kept.append({"ingredient_keyword": k, "coupang_url": "",
                     "priority": classify_priority(k), "active": "Y",
                     "recipe_count": "", "rank": ""})

    # 건수·순위 다시 매기기 — 건수 내림차순
    for r in kept:
        r["recipe_count"] = str(counts.get((r.get("ingredient_keyword") or "").strip(), 0))
    kept.sort(key=lambda r: (-int(r["recipe_count"]),
                             (r.get("ingredient_keyword") or "")))
    for i, r in enumerate(kept, 1):
        r["rank"] = str(i)

    print("후보 %d개 -> %d개" % (len(old_rows), len(kept)))
    print("\n뺀 것 %d개:" % len(dropped))
    for k, why in dropped[:30]:
        print("  - %-12s %s" % (k, why))
    if len(dropped) > 30:
        print("  ... 외 %d개" % (len(dropped) - 30))
    print("\n대표어가 바뀌어 옮긴 것 %d개:" % len(renamed))
    for a, b in renamed:
        print("  %s -> %s" % (a, b))
    print("\n새로 넣은 것 %d개:" % len(added))
    print("  " + ", ".join(added[:26]))
    print("\n새 상위 12:")
    for r in kept[:12]:
        mark = "  <- 링크 있음" if (r.get("coupang_url") or "").strip() else ""
        print("  %3s. %-12s %6s건  [%s]%s"
              % (r["rank"], r["ingredient_keyword"], r["recipe_count"],
                 r.get("priority"), mark))

    if not args.write:
        print("\n미리보기입니다. --write 를 붙이면 실제로 고칩니다.")
        return 0

    # **BOM 을 붙이지 않는다.** (예전 파일에는 붙어 있었다)
    with io.open(ADS, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(kept)
    print("\n반영: %s" % ADS)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
