# -*- coding: utf-8 -*-
"""**띄어쓰기만 다른 이름**이 사전에 따로 서 있는지 본다.

무엇이 문제였나:
    내냉장고 검색창에 `나박김치` 를 치면 「나박 김치」와 「나박김치」가 **둘 다**
    나온다. 같은 재료인데 사전에 두 줄로 있어서다. 사용자는 둘 중 하나를
    고르게 되고, 어느 쪽을 골랐느냐에 따라 매칭 결과가 달라진다.

어떻게 세나:
    이름에서 공백을 빼고 묶는다. 한 묶음에 대표어(`keyword`)가 둘 이상이면
    **따로 서 있는 것**이다. 동의어(`synonyms`)에 이미 들어 있는 형태는
    문제가 아니다 — 그건 이미 합쳐진 것이다.

    같이 본다:
      · 대표어끼리 부딪히는 것 (진짜 문제)
      · 대표어와 **다른 줄의 동의어**가 부딪히는 것 (검색에서 둘 다 뜬다)
      · 한 줄 안에서 공백만 다른 동의어가 중복으로 적힌 것 (군더더기)

쓰는 법:
    python scripts/audit_spacing_variants.py
"""

import argparse
import csv
import io
import os
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "frontend", "public",
                        "ingredient_profile_dict_with_substitutes.csv")


def nospace(s):
    return (s or "").replace(" ", "").replace("　", "").strip()


def split_syn(s):
    return [x.strip() for x in (s or "").split(",") if x.strip()]


def load(path=CSV_PATH):
    with io.open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "scratch_backups",
                                                  "spacing_variants.txt"))
    args = ap.parse_args()

    rows = load()
    out = ["사전 %d행" % len(rows), ""]

    # ── 1) 대표어끼리 ────────────────────────────────────────────────
    by_key = defaultdict(list)
    for r in rows:
        k = (r.get("keyword") or "").strip()
        if k:
            by_key[nospace(k)].append(k)

    clash = {n: ks for n, ks in by_key.items() if len(set(ks)) > 1}
    out.append("=== 대표어끼리 띄어쓰기만 다른 것: %d 묶음 ===" % len(clash))
    for n in sorted(clash):
        out.append("  %s" % " | ".join(sorted(set(clash[n]))))
    out.append("")

    # ── 2) 대표어 vs 다른 줄의 동의어 ────────────────────────────────
    key_of = {}
    for r in rows:
        k = (r.get("keyword") or "").strip()
        if k:
            key_of.setdefault(nospace(k), k)

    syn_hit = []
    for r in rows:
        k = (r.get("keyword") or "").strip()
        for s in split_syn(r.get("synonyms")):
            owner = key_of.get(nospace(s))
            if owner and owner != k:
                syn_hit.append((k, s, owner))
    out.append("=== 어떤 줄의 동의어가 **다른 줄의 대표어**와 같은 것(공백 무시): %d건 ==="
               % len(syn_hit))
    for k, s, owner in syn_hit[:40]:
        out.append("  '%s' 의 동의어 '%s'  ->  대표어 '%s'" % (k, s, owner))
    if len(syn_hit) > 40:
        out.append("  ... 외 %d건" % (len(syn_hit) - 40))
    out.append("")

    # ── 3) 한 줄 안에서 공백만 다른 동의어 ───────────────────────────
    dup_in_row = []
    for r in rows:
        k = (r.get("keyword") or "").strip()
        syns = split_syn(r.get("synonyms"))
        seen = defaultdict(list)
        for s in syns:
            seen[nospace(s)].append(s)
        # 대표어 자신과 공백만 다른 동의어도 군더더기다
        for n, forms in seen.items():
            if len(forms) > 1 or (n == nospace(k) and forms):
                dup_in_row.append((k, forms))
    out.append("=== 한 줄 안에서 공백만 다른(또는 대표어와 같은) 동의어: %d건 ==="
               % len(dup_in_row))
    for k, forms in dup_in_row[:40]:
        out.append("  '%s' <- %s" % (k, ", ".join(forms)))
    if len(dup_in_row) > 40:
        out.append("  ... 외 %d건" % (len(dup_in_row) - 40))
    out.append("")

    # ── 4) 공백이 들어간 대표어는 몇 개나 되나 ───────────────────────
    spaced = [(r.get("keyword") or "").strip() for r in rows
              if " " in (r.get("keyword") or "")]
    out.append("=== 이름에 공백이 든 대표어: %d개 ===" % len(spaced))
    out.append("  " + ", ".join(sorted(spaced)[:60]))
    if len(spaced) > 60:
        out.append("  ... 외 %d개" % (len(spaced) - 60))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    io.open(args.out, "w", encoding="utf-8").write("\n".join(out))
    print("\n".join(out))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
