# -*- coding: utf-8 -*-
"""**어떤 줄의 동의어가 다른 줄의 대표어**로도 서 있는 것들을 갈래 지어 본다.

무엇이 문제인가:
    `'면'` 의 동의어에 `냉면` 이 적혀 있는데, `냉면` 은 그 자체로 대표어이기도
    하다. 사전 로더는 `alias[key] = canonical` 로 덮어쓰므로 **CSV 에서 뒤에
    오는 줄이 이긴다** — 줄 순서가 뜻을 정한다.

    그런데 이건 띄어쓰기와 달리 **자동으로 합치면 안 된다.** 예전에 동의어를
    넓게 잡았다가 `트러플오일 -> 올리브유` 처럼 격을 뭉갠 적이 있다.
    `냉면` 을 `면` 으로 접으면 냉면 레시피가 국수·파스타와 한 덩어리가 된다.

그래서 **판정하지 않고 갈래만 나눈다.** 사람이 볼 수 있게:

    A. 지금 누가 이기고 있나 (줄 순서에 따라)
    B. 두 이름이 **상위어 관계**인가 — 동의어 쪽 줄의 대표어가, 겹치는
       대표어의 `hyperonym` 이면 "좁은 것을 넓은 것에 접으려는" 시도다.
       (`냉면` 의 상위어가 `면` 이면 바로 그 경우)
    C. 겹치는 대표어가 **제 속성을 얼마나 갖고 있나** — Feature·분류·보관일이
       채워져 있다면 독립된 재료로 다뤄 온 것이다. 그런 것을 동의어로 접으면
       그 정보가 통째로 죽는다.

쓰는 법:
    python scripts/audit_alias_vs_keyword.py
    python scripts/audit_alias_vs_keyword.py --detail 40
"""

import argparse
import csv
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "frontend", "public",
                        "ingredient_profile_dict_with_substitutes.csv")
OUT_PATH = os.path.join(ROOT, "scratch_backups", "alias_vs_keyword.txt")

MATERIAL = "재료"
# 제 속성이라고 볼 칸들. 이게 채워져 있으면 독립된 재료로 다뤄 온 것이다.
OWN_COLS = ("중분류", "소분류", "세분류", "세세분류", "Feature",
            "보관냉동", "보관냉장", "보관실온")


def nospace(s):
    return re.sub(r"\s+", "", str(s or "").strip())


def split_syn(cell):
    return [x.strip() for x in str(cell or "").split(",") if x.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--detail", type=int, default=30, help="갈래별로 몇 개씩 보일지")
    args = ap.parse_args()

    with io.open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        rows = [r for r in csv.DictReader(f)
                if (r.get("대분류") or "").strip() == MATERIAL]

    by_key = {}                    # 공백 없는 대표어 -> row
    for r in rows:
        k = nospace(r.get("keyword"))
        if k:
            by_key.setdefault(k, r)

    # 줄 순서상 지금 누가 이기나: 나중 줄이 이긴다
    winner = {}
    for r in rows:
        canon = (r.get("keyword") or "").strip()
        for name in [canon] + split_syn(r.get("synonyms")):
            k = nospace(name)
            if k:
                winner[k] = canon

    hits = []
    for r in rows:
        owner = (r.get("keyword") or "").strip()
        for s in split_syn(r.get("synonyms")):
            k = nospace(s)
            other = by_key.get(k)
            if other is None:
                continue
            other_key = (other.get("keyword") or "").strip()
            if nospace(other_key) == nospace(owner):
                continue
            hits.append((owner, s, other_key, other))

    def own_score(row):
        return sum(1 for c in OWN_COLS if (row.get(c) or "").strip() not in ("", "-"))

    # ── 갈래 나누기 ──────────────────────────────────────────────────
    parent_pull, rich, thin = [], [], []
    for owner, syn, other_key, other in hits:
        hyp = (other.get("hyperonym") or "").strip()
        score = own_score(other)
        if hyp and nospace(hyp) == nospace(owner):
            parent_pull.append((owner, syn, other_key, hyp, score))
        elif score >= 4:
            rich.append((owner, syn, other_key, hyp, score))
        else:
            thin.append((owner, syn, other_key, hyp, score))

    out = ["재료 %d행 · 겹치는 것 %d건" % (len(rows), len(hits)), ""]

    out.append("=== A. 좁은 것을 제 상위어에 접으려는 것: %d건 ===" % len(parent_pull))
    out.append("    (겹치는 대표어의 hyperonym 이 바로 그 동의어를 품은 줄이다)")
    out.append("    -> **접으면 안 된다.** 상위어 관계는 `hyperonym` 칸이 이미 맡고 있다.")
    out.append("       동의어로까지 적으면 좁은 것이 사라진다 (냉면 -> 면).")
    for owner, syn, other_key, hyp, sc in parent_pull[:args.detail]:
        out.append("  '%s' 의 동의어 '%s'  |  '%s'(상위어 %s, 제속성 %d칸)"
                   % (owner, syn, other_key, hyp, sc))
    if len(parent_pull) > args.detail:
        out.append("  ... 외 %d건" % (len(parent_pull) - args.detail))
    out.append("")

    out.append("=== B. 겹치는 쪽이 **제 속성을 갖춘** 재료: %d건 ===" % len(rich))
    out.append("    (Feature·분류·보관일이 4칸 이상 채워져 독립 재료로 다뤄 온 것)")
    out.append("    -> 접으면 그 정보가 통째로 죽는다. 손대지 않는 편이 안전하다.")
    for owner, syn, other_key, hyp, sc in rich[:args.detail]:
        out.append("  '%s' 의 동의어 '%s'  |  '%s'(상위어 %s, 제속성 %d칸)"
                   % (owner, syn, other_key, hyp or "-", sc))
    if len(rich) > args.detail:
        out.append("  ... 외 %d건" % (len(rich) - args.detail))
    out.append("")

    out.append("=== C. 겹치는 쪽이 **껍데기에 가까운** 줄: %d건 ===" % len(thin))
    out.append("    (제 속성이 3칸 이하 — 진짜 중복일 가능성이 있다. 사람이 볼 것)")
    for owner, syn, other_key, hyp, sc in thin[:args.detail]:
        out.append("  '%s' 의 동의어 '%s'  |  '%s'(상위어 %s, 제속성 %d칸)  지금 이기는 쪽: %s"
                   % (owner, syn, other_key, hyp or "-", sc, winner.get(nospace(syn))))
    if len(thin) > args.detail:
        out.append("  ... 외 %d건" % (len(thin) - args.detail))

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    io.open(OUT_PATH, "w", encoding="utf-8").write("\n".join(out))
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
