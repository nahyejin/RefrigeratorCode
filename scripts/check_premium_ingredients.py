# -*- coding: utf-8 -*-
"""「특별한 날」 프리미엄 목록이 **사전과 어긋나지 않는지** 본다.

`used_ingredients` 에는 사전이 정한 **대표어만** 남는다. 그래서 프리미엄 목록에
적은 이름이 대표어로 존재하지 않으면 **영영 매칭되지 않는다.** 조용히 망가지는
종류라(아무 오류도 안 난다) 따로 확인한다.

실제로 이런 것이 있었다:
    캐비어·푸아그라·킹크랩·고르곤졸라  - 사전에 아예 없었다
    랍스터·광어                    - 사전 대표어가 `바닷가재`·`넙치` 였다
    트러플오일 -> 올리브유            - 동의어로 붙어 `트러플` 이 사라졌다

두 가지를 본다:
  1) **한 번도 매칭될 수 없는 등급** - 그 등급의 어떤 이름도 대표어에 없다.
     (`랍스터` 는 대표어가 없지만 같은 등급의 `바닷가재` 가 있으므로 괜찮다)
  2) **합쳐지며 사라지는 프리미엄** - 별칭은 프리미엄인데 대표어는 프리미엄이
     아닌 합병. `트러플오일 -> 올리브유` 가 이 경우다.

쓰는 법:
    python scripts/check_premium_ingredients.py
"""

import csv
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

import premium_ingredients as premium  # noqa: E402

CSV_PATH = os.path.join(ROOT, "frontend", "public",
                        "ingredient_profile_dict_with_substitutes.csv")

# 프리미엄 말이 사라지지만 **그래도 맞는** 합병. 붙은 말이 재료를 프리미엄으로
# 만들지 않는 경우다 (`스테이크 시즈닝` 은 시즈닝이지 스테이크가 아니다).
ACCEPTED = {
    ("스테이크 시즈닝", "시즈닝"),
    # 발사믹 드레싱은 제외어로 이미 뺀 대상이다 (드레싱은 특별한 날 재료가 아니다).
    ("화이트 발사믹", "발사믹드레싱"),
    ("화이트 발사믹 비니거", "발사믹드레싱"),
}


def _is_premium(name):
    """그 이름 자체가 프리미엄으로 잡히는가 (제외어·요리명 규칙 포함)."""
    return bool(premium.premium_hits([name]))


def main():
    with io.open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))

    canonicals = []
    lost = []
    for row in rows:
        keyword = (row.get("keyword") or "").strip()
        if keyword:
            canonicals.append(keyword)
        synonyms = [s.strip() for s in (row.get("synonyms") or "").split(",") if s.strip()]
        for alias in synonyms:
            if (alias, keyword) in ACCEPTED:
                continue
            # 별칭은 프리미엄인데 대표어는 아니면, 합치는 순간 그 정보가 사라진다.
            if _is_premium(alias) and not _is_premium(keyword):
                lost.append((alias, keyword, premium.premium_hits([alias])[0][1]))

    # 등급 단위로 본다 — 같은 등급의 다른 이름(사전 대표어 쪽 이름)이 있으면 된다.
    by_rank = {}
    for rank, name, excludes in premium.PREMIUM_INGREDIENT_DEFS:
        hits = [k for k in canonicals if name in k and not any(e in k for e in excludes)]
        entry = by_rank.setdefault(rank, {"names": [], "ok": False})
        entry["names"].append(name)
        if hits:
            entry["ok"] = True
    missing = [(rank, e["names"]) for rank, e in sorted(by_rank.items()) if not e["ok"]]

    print("프리미엄 %d개 · 사전 대표어 %d개"
          % (len(premium.PREMIUM_INGREDIENT_DEFS), len(canonicals)))

    if missing:
        print("\n[문제] 대표어가 없어 **한 번도 매칭될 수 없는** 등급 %d개:" % len(missing))
        for rank, names in missing:
            print("  - [%3d] %s" % (rank, " / ".join(names)))
        print("  -> 사전에 그 재료를 넣거나, 사전이 쓰는 대표어 이름을")
        print("     `backend/premium_ingredients.py` 에 같이 적어 주세요.")

    if lost:
        print("\n[문제] 동의어로 합쳐지며 프리미엄이 사라지는 것 %d개:" % len(lost))
        for alias, keyword, name in lost:
            print("  - %s -> %s  (`%s` 소실)" % (alias, keyword, name))
        print("  -> `backend/dictionary_curation.py` 의 `KEEP_DISTINCT` 참고.")
        print("     붙는 게 맞는 것이면 이 파일의 `ACCEPTED` 에 적어 두세요.")

    if not missing and not lost:
        print("\n[정상] 어긋난 곳이 없습니다.")
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
