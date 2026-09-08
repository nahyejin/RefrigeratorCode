# -*- coding: utf-8 -*-
"""CSV 에 든 쿠팡 링크가 **정말 내 계정으로 정산되는 링크인지** 본다.

왜 필요한가:
    파트너스 링크는 눌리면 302 로 쿠팡으로 넘기면서 추적 파라미터를 붙인다.
    그 중 `lptag` 가 **누구의 성과인지**를 가른다. 남의 링크나 태그 없는 링크가
    섞이면 사람들이 눌러도 내 계정에는 한 푼도 안 들어오는데, **겉으로는
    멀쩡해 보여서** 알아채기 어렵다.

    실제로 이런 것이 있었다 — 파트너 ID 로 만들어 붙이던 링크가 302 로
    쿠팡 첫 화면으로만 갔고, 당연히 성과도 안 잡혔다.

무엇을 보나:
    `frontend/public/coupang_ads.csv` 의 `coupang_url`
    재료 사전의 `coupang_link`

쓰는 법:
    python scripts/check_coupang_links.py
"""

import csv
import io
import os
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADS = os.path.join(ROOT, "frontend", "public", "coupang_ads.csv")
DICTCSV = os.path.join(ROOT, "frontend", "public",
                       "ingredient_profile_dict_with_substitutes.csv")
ENV = os.path.join(ROOT, "frontend", ".env.local")


def my_tag():
    if not os.path.exists(ENV):
        return ""
    for line in io.open(ENV, encoding="utf-8-sig"):
        if line.startswith("VITE_COUPANG_PARTNER_ID"):
            return line.split("=", 1)[1].strip()
    return ""


class NoRedirect(urllib.request.HTTPRedirectHandler):
    """따라가지 않고 **어디로 보내려 하는지**만 본다."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise urllib.error.HTTPError(req.full_url, code, newurl, headers, fp)


def main():
    tag = my_tag()
    targets = []
    for r in csv.DictReader(io.open(ADS, encoding="utf-8-sig", newline="")):
        u = (r.get("coupang_url") or "").strip()
        if u:
            targets.append(("광고 CSV", r.get("ingredient_keyword"), u))
    for r in csv.DictReader(io.open(DICTCSV, encoding="utf-8-sig", newline="")):
        u = (r.get("coupang_link") or "").strip()
        if u:
            targets.append(("재료 사전", r.get("keyword"), u))

    op = urllib.request.build_opener(NoRedirect)
    op.addheaders = [("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")]

    print("내 파트너 태그: %s" % (tag or "(설정 없음)"))
    print("확인할 링크 %d개\n" % len(targets))
    bad = 0
    for where, name, url in targets:
        print("[%s] %s" % (where, name))
        print("   %s" % url)
        try:
            op.open(url, timeout=25)
            print("   >> 쿠팡으로 넘기지 않습니다. **파트너스 링크가 아닐 수 있어요.**\n")
            bad += 1
            continue
        except urllib.error.HTTPError as e:
            dest = e.reason if isinstance(e.reason, str) else e.headers.get("Location", "")
        except Exception as e:  # noqa: BLE001
            print("   >> 확인 실패 (%s) — 네트워크를 보세요\n" % type(e).__name__)
            continue

        q = urllib.parse.parse_qs(urllib.parse.urlparse(dest).query)
        lptag = (q.get("lptag") or [""])[0]
        print("   도착: %s" % dest.split("?")[0])
        print("   lptag: %s" % (lptag or "(없음)"))
        if not lptag:
            print("   >> 추적 태그가 없습니다. **정산 안 됩니다.**")
            bad += 1
        elif tag and lptag != tag:
            print("   >> 내 태그(%s)가 아닙니다. **남의 계정으로 갑니다.**" % tag)
            bad += 1
        else:
            print("   >> 내 계정으로 정산됩니다.")
        print()

    if bad:
        print("문제 있는 링크 %d개 — 파트너스에서 다시 만들어 넣으세요." % bad)
        return 1
    print("모두 정상입니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
