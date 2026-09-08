# -*- coding: utf-8 -*-
"""저장된 쿠팡 링크가 **그 재료가 맞는지** 대조한다.

왜 필요한가:
    파트너스 화면이 아직 앞 재료를 보여 주는 상태에서 복사 버튼을 다시 누르면
    **같은 링크가 또 복사된다.** 수집기는 "클립보드가 바뀌었다" 고 보고 그대로
    받는다. 실제로 `브로콜리` -> `토마토소스`, `표고버섯` -> `새우젓` 두 건이
    그렇게 들어갔다. 겉으로는 멀쩡한 링크라 눈으로는 못 가린다.

    수집기에 중복 거부를 넣었지만, **다른 상품을 가리키는 경우**는 여기서만
    잡힌다.

무엇을 보나:
    1) 같은 링크가 두 재료에 들어갔는가
    2) 링크를 따라간 도착지의 검색어가 그 재료와 다른가
       (상품 페이지로 가는 링크는 검색어가 없어 이 방법으로는 못 가린다)

쓰는 법:
    python scripts/audit_coupang_links.py
"""
import csv
import io
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from collect_coupang_links import SEARCH_OVERRIDE  # noqa: E402

ADS = os.path.join(ROOT, "frontend", "public", "coupang_ads.csv")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, newurl, headers, fp)


op = urllib.request.build_opener(NoRedirect)
op.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]

rows = list(csv.DictReader(io.open(ADS, encoding="utf-8-sig", newline="")))
filled = [r for r in rows if (r.get("coupang_url") or "").strip()]

out = ["저장된 링크 %d개를 대조합니다" % len(filled), ""]

# 1) 중복
by_url = {}
for r in filled:
    by_url.setdefault(r["coupang_url"].strip(), []).append(r["ingredient_keyword"])
dups = {u: ns for u, ns in by_url.items() if len(ns) > 1}
out.append("=== 같은 링크가 여러 재료에 들어간 것: %d건 ===" % len(dups))
for u, ns in dups.items():
    out.append("  %s  ->  %s" % (u, " / ".join(ns)))

# 2) 도착지 검색어 대조
out.append("")
out.append("=== 도착지가 그 재료가 아닌 것 ===")
bad = 0
for r in filled:
    name = r["ingredient_keyword"].strip()
    want = SEARCH_OVERRIDE.get(name, name)
    url = r["coupang_url"].strip()
    try:
        op.open(url, timeout=25)
        dest = ""
    except urllib.error.HTTPError as e:
        dest = e.reason if isinstance(e.reason, str) else e.headers.get("Location", "")
    except Exception:  # noqa: BLE001
        out.append("  %-12s 확인 실패" % name)
        continue

    q = urllib.parse.parse_qs(urllib.parse.urlparse(dest).query)
    term = (q.get("q") or q.get("ctag") or [""])[0]
    if not term:
        # 상품 페이지로 가는 링크는 검색어가 없다 — 눈으로 못 가린다.
        continue
    if term.replace(" ", "") != want.replace(" ", ""):
        bad += 1
        out.append("  %-12s 기대 '%s'  ->  실제 '%s'" % (name, want, term))
out.append("  (검색어가 어긋난 것 %d건)" % bad)

print("\n".join(out))
