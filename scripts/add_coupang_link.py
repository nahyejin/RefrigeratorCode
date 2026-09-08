# -*- coding: utf-8 -*-
"""파트너스에서 만든 링크를 `coupang_ads.csv` 에 넣는다.

왜 스크립트로 넣나:
    손으로 열어 고쳐도 되지만, **엑셀로 열면 BOM 이 붙어 파일이 통째로 안 읽힌다.**
    오류도 안 나고 조용히 0개가 된다(재료 사전에서 실제로 났던 사고다).
    이 스크립트는 BOM 없는 utf-8 로 다시 쓰므로 그 사고가 안 난다.

    넣기 전에 **파트너스 링크가 맞는지**도 본다. 그냥 검색 URL
    (`coupang.com/np/search?q=...`)은 광고가 아니라 수수료가 안 붙는데,
    모양이 비슷해서 헷갈리기 쉽다.

쓰는 법:
    python scripts/add_coupang_link.py 다진마늘 https://link.coupang.com/a/XXXXXX
    python scripts/add_coupang_link.py 다진마늘 https://... 대파 https://...
    python scripts/add_coupang_link.py --check          # 지금 채워진 것 보기
"""

import csv
import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADS = os.path.join(ROOT, "frontend", "public", "coupang_ads.csv")
PARTNER_PREFIX = "https://link.coupang.com/a/"


def load():
    # BOM 이 붙어 있어도 벗겨 낸다.
    with io.open(ADS, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames), list(reader)


def save(fields, rows):
    # **BOM 을 붙이지 않는다.**
    with io.open(ADS, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def show(rows):
    filled = [r for r in rows if (r.get("coupang_url") or "").strip()]
    print("채워진 링크 %d개 / 후보 %d줄" % (len(filled), len(rows)))
    for r in sorted(filled, key=lambda x: int(x.get("rank") or 9999)):
        print("  %3s. %-12s %s  [%s/%s]"
              % (r.get("rank"), r.get("ingredient_keyword"), r.get("coupang_url"),
                 r.get("priority"), r.get("active")))


def main():
    args = sys.argv[1:]
    fields, rows = load()

    if not args or args[0] == "--check":
        show(rows)
        if not args:
            print("\n쓰는 법: python scripts/add_coupang_link.py <재료명> <링크> ...")
        return 0

    if len(args) % 2:
        print("재료명과 링크를 짝으로 주세요.")
        return 1

    by_name = {}
    for r in rows:
        by_name.setdefault((r.get("ingredient_keyword") or "").strip(), []).append(r)

    changed = 0
    for i in range(0, len(args), 2):
        name, url = args[i].strip(), args[i + 1].strip()
        if not url.startswith(PARTNER_PREFIX):
            print("  ! %s: 파트너스 링크가 아닙니다. `%s` 로 시작해야 해요." % (name, PARTNER_PREFIX))
            print("    (그냥 검색 URL 은 광고가 아니라 수수료가 안 붙습니다)")
            continue
        hits = by_name.get(name)
        if not hits:
            print("  ! %s: coupang_ads.csv 에 그 재료 줄이 없습니다." % name)
            print("    사전 대표어와 똑같이 적어야 해요. `--check` 로 목록을 보세요.")
            continue
        hits[0]["coupang_url"] = url
        hits[0]["active"] = "Y"
        changed += 1
        print("  + %-12s %s" % (name, url))

    if changed:
        save(fields, rows)
        print()
        show(rows)
        print("\n커밋·푸시하면 반영됩니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
