# -*- coding: utf-8 -*-
"""이미 아는 동의어 단어를 품은 복합어가 서로 다른 두 줄로 갈라져 있을 때 합친다.

`merge_spacing_variants.py` 는 **띄어쓰기 차이만** 잡는다. 그런데 "계란"과
"달걀"처럼 단어 자체가 이미 사전에 동의어로 올라 있어도(달걀 대표어 행의
`synonyms`에 계란이 있다), 그 단어를 품은 복합어(삶은계란/삶은달걀,
계란말이/달걀말이)는 전혀 다른 문자열이라 띄어쓰기 병합으로는 못 잡는다.

**왜 자동으로 다 합치지 않나 (2026-09-12 실사용자 지적으로 조사)**:
전체 사전에서 "동의어 단어를 서로 바꿔치기하면 실제 존재하는 다른 줄이
되는" 경우를 기계적으로 훑어 보면(아래 `scan_candidates()`), 진짜 같은
뜻인 짝도 나오지만 겉보기만 비슷하고 실제로는 다른 재료인 짝도 섞여
나온다:

    진짜 같음   계란말이/달걀말이, 삶은계란/삶은달걀, 쇠고기장조림/소고기장조림
    다른 재료   메밀/메밀가루(곡물 알갱이 vs 가루), 호박/호박고지(생물 vs 건조),
               알새우칩/새우칩(서로 다른 과자 상품명), 파김치양념/김치양념

그래서 이 스크립트는 **사람이 확인해 `MERGE_PAIRS` 에 적어 넣은 짝만** 합친다.
`merge_spacing_variants.py` 와 같은 방식으로 값을 병합하고 로그를 남긴다.

사용법:
    1) `scan_candidates()` 로 후보를 뽑아 사람이 훑어본다.
    2) 진짜 같은 뜻인 것만 `MERGE_PAIRS` 에 (버리는 쪽, 남기는 쪽) 으로 추가.
    3) python scripts/merge_known_synonym_variants.py            # 미리보기
       python scripts/merge_known_synonym_variants.py --write    # 반영
    4) python scripts/sync_ingredient_dict.py --write
       python -u ingredient_management/renormalize_used_ingredients.py --commit
       python -u ingredient_management/migrate_user_ingredients.py --commit
       (사전 대표어 자체가 바뀌므로 대체표·색인·쿠팡 후보도 새로 돌리는 게 좋다 —
        apply_dictionary_additions_daily.bat 의 2.5/2.9/2.95 단계와 같은 스크립트)
"""
import argparse
import csv
import io
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "frontend", "public",
                        "ingredient_profile_dict_with_substitutes.csv")

# (버리는 쪽, 남기는 쪽) -- 같은 대분류(재료/요리이름) 안에서만 합친다.
# 사람이 확인 후 채워 넣는다. 처리한 짝은 지워도 되고 기록으로 남겨 둬도 된다.
#
# 2026-09-12 에 처리한 것: 계란말이->달걀말이, 삶은계란->삶은달걀
# (기본 재료 사전의 '달걀' 행이 이미 대표어라 '달걀' 쪽 표기를 남겼다)
MERGE_PAIRS = [
]


def _load_rows():
    with io.open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames or []), list(reader)


def scan_candidates(max_alias_len=3):
    """참고용 후보 스캐너. 오탐이 섞이므로 사람이 걸러서 MERGE_PAIRS 에 옮긴다."""
    cols, rows = _load_rows()
    material = [r for r in rows if (r.get("대분류") or "").strip() == "재료"]
    keywords = {(r.get("keyword") or "").strip() for r in material}
    syn_of = {}
    for r in material:
        kw = (r.get("keyword") or "").strip()
        syn_of[kw] = set(s.strip() for s in (r.get("synonyms") or "").split(",") if s.strip())

    def linked(a, b):
        return b in syn_of.get(a, set()) or a in syn_of.get(b, set()) or a == b

    pairs = set()
    for r in material:
        kw = (r.get("keyword") or "").strip()
        if len(kw) > max_alias_len:
            continue
        for s in (r.get("synonyms") or "").split(","):
            s = s.strip()
            if s and 1 <= len(s) <= max_alias_len and s != kw:
                pairs.add((s, kw))

    found = []
    seen = set()
    for alias, canon in sorted(pairs):
        for kw in sorted(keywords):
            if alias not in kw:
                continue
            swapped = kw.replace(alias, canon)
            if swapped == kw or swapped not in keywords or linked(kw, swapped):
                continue
            key = tuple(sorted((kw, swapped)))
            if key in seen:
                continue
            seen.add(key)
            found.append((alias, canon, kw, swapped))
    return found


def split_syn(cell):
    return [x.strip() for x in (cell or "").split(",") if x.strip()]


def join_syn(items):
    return ", ".join(items)


def dedupe_syn(items, keyword):
    seen, out = set(), []
    for s in items:
        if s and s != keyword and s not in seen:
            seen.add(s)
            out.append(s)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--scan", action="store_true", help="MERGE_PAIRS 대신 후보만 출력하고 끝낸다")
    args = ap.parse_args()

    if args.scan:
        for alias, canon, a, b in scan_candidates():
            print("  [%s->%s]  %s  <->  %s" % (alias, canon, a, b))
        return 0

    if not MERGE_PAIRS:
        print("MERGE_PAIRS 가 비어 있습니다. --scan 으로 후보를 먼저 훑어보세요.")
        return 0

    cols, rows = _load_rows()
    other_cols = [c for c in cols if c not in ("keyword", "synonyms", "대분류")]
    drop = set()
    log = []

    for lose_kw, keep_kw in MERGE_PAIRS:
        for cat in ("재료", "요리이름"):
            lose_idx = [i for i, r in enumerate(rows)
                        if (r.get("keyword") or "").strip() == lose_kw
                        and (r.get("대분류") or "").strip() == cat]
            keep_idx = [i for i, r in enumerate(rows)
                        if (r.get("keyword") or "").strip() == keep_kw
                        and (r.get("대분류") or "").strip() == cat]
            if not lose_idx or not keep_idx:
                continue
            li, ki = lose_idx[0], keep_idx[0]
            loser, keeper = rows[li], rows[ki]

            syns = split_syn(keeper.get("synonyms"))
            syns.append(lose_kw)
            syns.extend(split_syn(loser.get("synonyms")))
            diffs = []
            for c in other_cols:
                a = (keeper.get(c) or "").strip()
                b = (loser.get(c) or "").strip()
                if not a and b:
                    keeper[c] = b
                elif a and b and a != b:
                    diffs.append("%s: '%s'(남김) vs '%s'(버림)" % (c, a[:60], b[:60]))

            keeper["synonyms"] = join_syn(dedupe_syn(syns, keep_kw))
            drop.add(li)
            log.append("[%s] %s <- %s 합침 (동의어: %s)" % (cat, keep_kw, lose_kw, keeper["synonyms"]))
            for d in diffs:
                log.append("    ! 값이 달라 남긴 쪽을 씀 - %s" % d)

    out_rows = [r for i, r in enumerate(rows) if i not in drop]
    print("\n".join(log))
    print("\n합친 줄 %d개 삭제, 최종 %d행 (원래 %d행)" % (len(drop), len(out_rows), len(rows)))

    if not args.write:
        print("\n미리보기입니다. --write 를 붙이면 실제로 고칩니다.")
        return 0

    with io.open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, lineterminator="\n")
        w.writeheader()
        w.writerows(out_rows)
    print("반영: %s" % CSV_PATH)
    return 0


if __name__ == "__main__":
    main()
