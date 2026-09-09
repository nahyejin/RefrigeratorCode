# -*- coding: utf-8 -*-
"""**띄어쓰기만 다른 이름**을 한 줄로 합친다. 공백 없는 쪽을 기준으로 삼는다.

무엇이 문제였나:
    내냉장고 검색창에 김치를 치면 「나박 김치」와 「나박김치」가 **둘 다** 뜬다.
    같은 재료인데 사전에 두 줄로 있어서다.

    더 나쁜 것은 **둘이 서로 다른 말을 한다**는 점이다:
        한우등심   hyperonym=소고기 · 냉동 90일
        한우 등심  hyperonym=등심   · 냉동 60일
    백엔드는 이미 공백을 지우고 찾으므로(`normalize_key`) 둘 중 **CSV 에서 뒤에
    오는 줄이 이긴다.** 줄 순서가 뜻을 정하고 있었다.

무엇을 합치나 (범위를 좁게 잡는다):
    · **같은 분류 안에서만.** 「재료」끼리, 「요리이름」끼리.
      같은 이름이 재료로도 요리명으로도 있는 것은 **일부러 그렇게 둔 것**이라
      건드리지 않는다 (검색창은 `대분류 === '재료'` 만 읽어서 같이 뜨지도 않는다).
    · 이름이 **공백만 다르거나 완전히 같은** 줄끼리.
    · 뜻이 다른 것은 손대지 않는다. 예전에 동의어를 넓게 잡았다가
      `트러플오일 -> 올리브유` 처럼 격을 뭉갠 적이 있다.

어떻게 합치나:
    · 남는 이름은 **공백 없는 쪽**. (사용자가 정한 기준)
    · 사라지는 표기는 **동의어로 넣어 둔다** — 본문에 그렇게 적힌 글이 있다.
    · 나머지 칸은 남는 줄을 우선하고, 비어 있는 칸만 사라지는 줄에서 채운다.
      값이 서로 다른 칸은 **전부 기록에 남긴다** — 사람이 나중에 볼 수 있게.
    · 동의어는 공백을 무시하고 중복을 없앤다(공백 없는 표기를 남긴다).
      대표어와 같아진 동의어는 뺀다.

쓰는 법:
    python scripts/merge_spacing_variants.py            # 미리보기
    python scripts/merge_spacing_variants.py --write    # 실제로 고친다
"""

import argparse
import csv
import io
import os
import re
from collections import OrderedDict, defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "frontend", "public",
                        "ingredient_profile_dict_with_substitutes.csv")
LOG_PATH = os.path.join(ROOT, "scratch_backups", "spacing_merge_log.txt")

# 검색창(`MyFridge.tsx`)과 사전 로더가 재료로 치는 분류.
MATERIAL = "재료"

# **분류를 넘나들며 합치지 않는다.**
#
# 같은 이름이 「재료」와 「요리이름」에 각각 있는 것은 일부러 그렇게 둔 것이다
# (예: 감자샐러드 — 재료로도 쓰고 요리 이름으로도 쓴다). 검색창은 재료만 읽으므로
# 그 둘이 같이 뜨지도 않는다. 합치는 것은 **같은 분류 안에서만.**
MERGE_WITHIN = ("재료", "요리이름")


def nospace(s):
    return re.sub(r"\s+", "", str(s or "").strip())


def split_syn(cell):
    return [x.strip() for x in str(cell or "").split(",") if x.strip()]


def join_syn(items):
    # 백엔드 로더가 `", "` 로 자른다 — 쉼표 뒤 한 칸을 반드시 둔다.
    return ", ".join(items)


def dedupe_syn(items, keyword):
    """공백을 무시하고 중복을 없앤다. 공백 없는 표기를 남기고, 대표어와 같은 것은 뺀다."""
    best = OrderedDict()
    for s in items:
        k = nospace(s)
        if not k or k == nospace(keyword):
            continue
        if k not in best or (" " in best[k] and " " not in s):
            best[k] = s
    return list(best.values())


# 상위어가 어긋날 때 손으로 정한 것.
#
# 아래 규칙(**사전에 대표어로 실제 있는 쪽**)으로 여섯 중 넷이 저절로 풀린다.
# 나머지 둘은 둘 다 대표어라서 규칙이 안 갈라 준다 — 이유를 적고 못 박는다.
HYPERONYM_PICK = {
    # 한우사골->사골, 한우소갈비->소갈비, 한우곱창->곱창 처럼 **제 마디가 사전에
    # 있으면 그것**을 상위어로 둔다. 등심도 대표어로 있다.
    "한우등심": "등심",
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    with io.open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        cols = list(reader.fieldnames or [])
        rows = list(reader)

    # ── 같은 분류 안에서 이름이 겹치는 줄을 묶는다 ───────────────────
    groups = defaultdict(list)          # (대분류, 공백 없는 이름) -> [행 index]
    for i, r in enumerate(rows):
        cat = (r.get("대분류") or "").strip()
        if cat not in MERGE_WITHIN:
            continue
        k = (r.get("keyword") or "").strip()
        if k:
            groups[(cat, nospace(k))].append(i)

    targets = {n: idx for n, idx in groups.items() if len(idx) > 1}

    # 상위어를 고를 때 쓴다 — **사전에 대표어로 실제 있는 이름**만이 상위어 통합에
    # 쓸모가 있다. 없는 이름을 상위어로 두면 아무 데도 안 걸린다.
    material_keys = {(rows[i].get("keyword") or "").strip()
                     for (cat, _), idx in groups.items() if cat == MATERIAL
                     for i in idx}
    log = ["사전 %d행 (합칠 대상 분류 %d행)"
           % (len(rows), sum(len(v) for v in groups.values())),
           "합칠 묶음 %d개" % len(targets), ""]

    drop = set()
    other_cols = [c for c in cols if c not in ("keyword", "synonyms", "대분류")]

    for cat, n in sorted(targets):
        idxs = targets[(cat, n)]
        # 남길 줄: 공백 없는 이름을 가진 것 중 **칸이 가장 많이 채워진** 줄.
        # (둘 다 공백이 있거나 둘 다 없으면 채워진 칸 수로만 고른다)
        def score(i):
            r = rows[i]
            filled = sum(1 for c in other_cols if (r.get(c) or "").strip())
            return (" " not in (r.get("keyword") or ""), filled)
        keep = max(idxs, key=score)
        losers = [i for i in idxs if i != keep]

        keeper = rows[keep]
        old_key = (keeper.get("keyword") or "").strip()
        new_key = nospace(old_key)

        syns = split_syn(keeper.get("synonyms"))
        diffs = []
        for i in losers:
            r = rows[i]
            lk = (r.get("keyword") or "").strip()
            # 사라지는 표기를 동의어로 남긴다 (본문에 그렇게 적힌 글이 있다)
            syns.append(lk)
            syns.extend(split_syn(r.get("synonyms")))
            for c in other_cols:
                a = (keeper.get(c) or "").strip()
                b = (r.get(c) or "").strip()
                if not a and b:
                    keeper[c] = b            # 빈 칸만 채운다
                elif a and b and a != b:
                    if c == "hyperonym":
                        # 상위어는 점수로 고르면 안 된다 — 매칭의 뜻이 바뀐다.
                        # 사전에 대표어로 **실제 있는 쪽**을 쓴다. 없는 이름을
                        # 상위어로 두면 상위어 통합이 아무 데도 안 걸린다.
                        pick = HYPERONYM_PICK.get(new_key)
                        if not pick:
                            a_ok, b_ok = a in material_keys, b in material_keys
                            pick = b if (b_ok and not a_ok) else a
                        keeper[c] = pick
                        diffs.append("hyperonym: '%s' vs '%s' -> **%s** 로 정함" % (a, b, pick))
                    else:
                        diffs.append("%s: '%s'(남김) vs '%s'(버림)" % (c, a[:40], b[:40]))
            drop.add(i)

        keeper["keyword"] = new_key
        keeper["synonyms"] = join_syn(dedupe_syn(syns, new_key))

        log.append("· [%s] %s  <-  %s" % (cat, new_key, ", ".join(
            (rows[i].get("keyword") or "").strip() for i in losers)))
        if keeper["synonyms"]:
            log.append("    동의어: %s" % keeper["synonyms"])
        for d in diffs:
            log.append("    ! 값이 달라 남긴 쪽을 씀 — %s" % d)

    # ── 합치지 않는 줄도 동의어 중복은 없앤다 ────────────────────────
    tidy = 0
    for i, r in enumerate(rows):
        if i in drop:
            continue
        if (r.get("대분류") or "").strip() not in MERGE_WITHIN:
            continue
        before = split_syn(r.get("synonyms"))
        after = dedupe_syn(before, (r.get("keyword") or "").strip())
        if after != before:
            r["synonyms"] = join_syn(after)
            tidy += 1

    out_rows = [r for i, r in enumerate(rows) if i not in drop]
    log.append("")
    log.append("합친 줄 %d개 삭제 · 동의어 정리한 줄 %d개 · 최종 %d행"
               % (len(drop), tidy, len(out_rows)))

    os.makedirs(os.path.dirname(LOG_PATH), exist_ok=True)
    io.open(LOG_PATH, "w", encoding="utf-8").write("\n".join(log))
    print("\n".join(log[:60]))
    if len(log) > 60:
        print("... 나머지는 %s" % LOG_PATH)

    if not args.write:
        print("\n미리보기입니다. --write 를 붙이면 실제로 고칩니다.")
        return 0

    # BOM 없이, 개행은 그대로 유지해서 쓴다.
    with io.open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(out_rows)
    print("\n%s 를 고쳤습니다." % CSV_PATH)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
