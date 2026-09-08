# -*- coding: utf-8 -*-
"""쿠팡 파트너스 **딥링크 API** 로 링크를 한꺼번에 만들어 CSV 에 채운다.

왜 필요한가:
    파트너스 화면에서 재료 하나마다 검색 -> 링크 복사 -> CSV 붙여넣기를 하면
    250번을 반복해야 한다. 파트너스는 **URL 을 넣으면 단축 링크를 돌려주는
    API** 를 제공하므로, 그걸로 한 번에 끝낸다.

한 번만 준비하면 된다 — API 키 발급:
    1. https://partners.coupang.com 로그인
    2. 오른쪽 위 **내 정보** 또는 왼쪽 메뉴에서 **Open API / API 키** 를 찾는다
       (메뉴 이름은 바뀔 수 있다. "API" 라고 적힌 곳)
    3. **ACCESS KEY** 와 **SECRET KEY** 를 발급받는다
    4. **`backend/.env`** 에 두 줄을 적는다 (이 파일은 git 에 안 올라간다)

           COUPANG_ACCESS_KEY=발급받은_액세스키
           COUPANG_SECRET_KEY=발급받은_시크릿키

    키를 남에게 주거나 코드에 직접 적지 마세요. 이 스크립트는 `.env` 파일에서만 읽는다.

    **루트 `.env` 말고 `backend/.env` 에 적으세요.** 루트 `.env` 는
    `.gitignore` 에 적혀 있는데도 **git 이 이미 추적하고 있었다** — 한 번
    추적된 파일에는 gitignore 가 적용되지 않는다. 그래서 거기 적으면 다음
    커밋에 딸려 올라간다. (2026-09-08 에 추적을 끊었지만, 안전한 쪽을 쓴다)

무엇을 만드나:
    각 재료의 **쿠팡 검색 결과 URL** 로 링크를 만든다. 상품 하나를 고르는 것보다
    나은 이유는 **품절돼도 링크가 안 죽기** 때문이다. 특정 상품으로 하고 싶은
    재료는 나중에 `add_coupang_link.py` 로 덮어쓰면 된다.

    검색어가 너무 넓은 것은 `SEARCH_OVERRIDE` 로 바꿔 준다 (`파` -> `대파`).

쓰는 법:
    python scripts/generate_coupang_links.py --top 30          # 미리보기
    python scripts/generate_coupang_links.py --top 30 --write  # 실제로 채움
    python scripts/generate_coupang_links.py --all --write     # 빈 것 전부
"""

import argparse
import csv
import hashlib
import hmac
import io
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADS = os.path.join(ROOT, "frontend", "public", "coupang_ads.csv")

DOMAIN = "https://api-gateway.coupang.com"
PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink"
CHUNK = 50          # 한 번에 보낼 URL 개수
PARTNER_PREFIX = "https://link.coupang.com/a/"

# 재료 이름 그대로 검색하면 엉뚱한 게 나오는 것들.
# **CSV 의 첫 칸은 그대로 두고 검색어만 바꾼다** — 첫 칸은 사전 대표어라
# 그걸로 매칭되기 때문이다.
SEARCH_OVERRIDE = {
    "파": "대파",
    "고추": "청양고추",
    "면": "소면",
    "무": "무우",
    "간": "소간",
    "떡": "떡국떡",
    "물": "생수",
    "밥": "즉석밥",
    "김": "조미김",
    "술": "청주",
    "차": "녹차",
    "알": "메추리알",
}


def load_env():
    for path in (os.path.join(ROOT, ".env"), os.path.join(ROOT, "backend", ".env")):
        if not os.path.exists(path):
            continue
        for line in io.open(path, encoding="utf-8-sig"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def signature(method, url_path, secret, access):
    """쿠팡 Open API 의 HMAC 서명. 형식이 정해져 있어 그대로 따른다."""
    parts = url_path.split("?")
    path_only, query = parts[0], (parts[1] if len(parts) > 1 else "")
    signed_date = datetime.now(timezone.utc).strftime("%y%m%dT%H%M%SZ")
    message = signed_date + method + path_only + query
    digest = hmac.new(secret.encode("utf-8"), message.encode("utf-8"),
                      hashlib.sha256).hexdigest()
    return ("CEA algorithm=HmacSHA256, access-key=%s, signed-date=%s, signature=%s"
            % (access, signed_date, digest))


def make_links(urls, access, secret):
    """URL 목록 -> {원래 URL: 단축 링크}"""
    body = json.dumps({"coupangUrls": urls}).encode("utf-8")
    req = urllib.request.Request(
        DOMAIN + PATH, data=body, method="POST",
        headers={"Authorization": signature("POST", PATH, secret, access),
                 "Content-Type": "application/json;charset=UTF-8"})
    with urllib.request.urlopen(req, timeout=60) as r:
        payload = json.loads(r.read().decode("utf-8"))

    if str(payload.get("rCode", "0")) not in ("0", "200"):
        raise RuntimeError("쿠팡 API 오류: %s %s"
                           % (payload.get("rCode"), payload.get("rMessage")))
    out = {}
    for item in (payload.get("data") or []):
        short = (item.get("shortenUrl") or "").strip()
        original = (item.get("originalUrl") or "").strip()
        if short and original:
            out[original] = short
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--top", type=int, default=30, help="상위 몇 개까지 (기본 30)")
    ap.add_argument("--all", action="store_true", help="빈 것 전부")
    args = ap.parse_args()
    load_env()

    access = (os.getenv("COUPANG_ACCESS_KEY") or "").strip()
    secret = (os.getenv("COUPANG_SECRET_KEY") or "").strip()
    if not access or not secret:
        print("backend/.env 에 COUPANG_ACCESS_KEY 와 COUPANG_SECRET_KEY 를 적어 주세요.")
        print("발급 방법은 이 파일 맨 위 설명을 보세요.")
        return 1

    with io.open(ADS, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames)
        rows = list(reader)

    todo = []
    for r in rows:
        name = (r.get("ingredient_keyword") or "").strip()
        if not name or (r.get("coupang_url") or "").strip():
            continue
        todo.append(r)
    todo.sort(key=lambda r: int(r.get("rank") or 9999))
    if not args.all:
        todo = todo[:args.top]

    if not todo:
        print("채울 것이 없습니다.")
        return 0

    # 검색 URL 을 만든다. 같은 URL 이 두 번 가지 않게 짝을 지어 둔다.
    want = []
    for r in todo:
        name = (r.get("ingredient_keyword") or "").strip()
        term = SEARCH_OVERRIDE.get(name, name)
        url = "https://www.coupang.com/np/search?q=" + urllib.parse.quote(term)
        want.append((r, name, term, url))

    print("링크를 만들 재료 %d개" % len(want))
    for r, name, term, _ in want[:8]:
        mark = ("  (검색어: %s)" % term) if term != name else ""
        print("  %3s. %s%s" % (r.get("rank"), name, mark))
    if len(want) > 8:
        print("  ... 외 %d개" % (len(want) - 8))

    if not args.write:
        print("\n미리보기입니다. --write 를 붙이면 실제로 만들어 채웁니다.")
        return 0

    made, failed = 0, []
    for i in range(0, len(want), CHUNK):
        batch = want[i:i + CHUNK]
        try:
            links = make_links([u for _, _, _, u in batch], access, secret)
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "replace")[:300]
            print("  호출 실패 (HTTP %d): %s" % (e.code, detail))
            failed += [n for _, n, _, _ in batch]
            time.sleep(3)
            continue
        except Exception as e:  # noqa: BLE001
            print("  호출 실패 (%s): %s" % (type(e).__name__, e))
            failed += [n for _, n, _, _ in batch]
            time.sleep(3)
            continue

        for r, name, _, url in batch:
            short = links.get(url)
            if not short or not short.startswith(PARTNER_PREFIX):
                failed.append(name)
                continue
            r["coupang_url"] = short
            r["active"] = "Y"
            made += 1
            print("  + %-12s %s" % (name, short))
        time.sleep(1)

    if made:
        # **BOM 을 붙이지 않는다.**
        with io.open(ADS, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)

    filled = sum(1 for r in rows if (r.get("coupang_url") or "").strip())
    print("\n만든 링크 %d개 · 실패 %d개 · 이제 채워진 것 %d / %d"
          % (made, len(failed), filled, len(rows)))
    if failed:
        print("실패: " + ", ".join(failed[:20]))
    print("\n`python scripts/check_coupang_links.py` 로 정산 태그를 확인하세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
