# -*- coding: utf-8 -*-
"""쿠팡 파트너스에서 **복사만 하면** CSV 를 알아서 채운다.

왜 필요한가:
    파트너스 API 키는 **최종 승인된 회원만** 발급받을 수 있어서, 승인 전에는
    링크를 손으로 만들 수밖에 없다. 그런데 재료가 250개다. 원래 한 개당 이렇다:

        1) 파트너스에서 재료 이름 검색
        2) 링크 복사 버튼 클릭
        3) CSV 를 열어서
        4) 그 재료 줄을 찾아서
        5) 두 번째 칸에 붙여넣고
        6) 저장

    이 스크립트를 켜 두면 **1)과 2)만** 하면 된다. 3~6은 알아서 한다.
    클립보드에 `link.coupang.com/a/...` 가 들어오는 순간 그 재료 줄에 적고
    **바로 저장한 뒤** 다음 재료를 화면에 띄운다.

    중간에 그만둬도 그때까지 한 것은 이미 저장돼 있다 (한 개마다 저장한다).

쓰는 법:
    python scripts/collect_coupang_links.py            # 상위 30개
    python scripts/collect_coupang_links.py --top 100
    python scripts/collect_coupang_links.py --only 대파  # 특정 재료만

    멈추려면 Ctrl+C. 어떤 재료를 건너뛰려면 그 재료 차례에 Enter 를 누른다.
"""

import argparse
import csv
import io
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ADS = os.path.join(ROOT, "frontend", "public", "coupang_ads.csv")
PARTNER_PREFIX = "https://link.coupang.com/a/"
POLL_SEC = 0.4

# 재료 이름 그대로 검색하면 엉뚱한 게 나오는 것들.
# **CSV 첫 칸은 그대로 두고 검색어만 바꾼다** — 첫 칸은 사전 대표어라 그걸로 매칭된다.
SEARCH_OVERRIDE = {
    "파": "대파", "고추": "청양고추", "면": "소면", "무": "무우",
    "간": "소간", "떡": "떡국떡", "물": "생수", "밥": "즉석밥",
    "김": "조미김", "술": "청주", "차": "녹차", "알": "메추리알",
}


def clipboard():
    """윈도우 클립보드 읽기. 실패하면 빈 문자열."""
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", "Get-Clipboard -Raw"],
            capture_output=True, timeout=10)
        return out.stdout.decode("utf-8", "replace").strip()
    except Exception:  # noqa: BLE001
        return ""


def load():
    with io.open(ADS, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        return list(reader.fieldnames), list(reader)


def save(fields, rows):
    # **BOM 을 붙이지 않는다.** 붙으면 첫 열 이름이 깨져 파일이 통째로 안 읽힌다.
    with io.open(ADS, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--top", type=int, default=30)
    ap.add_argument("--only", help="이름에 이 말이 든 재료만")
    args = ap.parse_args()

    fields, rows = load()
    todo = [r for r in rows
            if (r.get("ingredient_keyword") or "").strip()
            and not (r.get("coupang_url") or "").strip()]
    if args.only:
        todo = [r for r in todo if args.only in (r.get("ingredient_keyword") or "")]
    todo.sort(key=lambda r: int(r.get("rank") or 9999))
    todo = todo[:args.top]

    if not todo:
        print("채울 것이 없습니다.")
        return 0

    done_now = 0
    total_filled = sum(1 for r in rows if (r.get("coupang_url") or "").strip())

    print("=" * 66)
    print(" 쿠팡 파트너스에서 **검색하고 링크 복사만** 하세요.")
    print(" 복사하는 순간 이 창이 알아서 CSV 에 적고 다음 재료로 넘어갑니다.")
    print("")
    print("   건너뛰기: Enter    /    그만두기: Ctrl+C")
    print("=" * 66)

    seen = clipboard()      # 지금 클립보드에 든 것은 무시한다
    try:
        for i, row in enumerate(todo, 1):
            name = (row.get("ingredient_keyword") or "").strip()
            term = SEARCH_OVERRIDE.get(name, name)
            # 퍼센트 인코딩을 하지 않는다 — 화면에서 눈으로 확인할 수 있어야 한다.
            # 브라우저와 파트너스 모두 한글 URL 을 그대로 받는다.
            url = "https://www.coupang.com/np/search?q=" + term

            print("")
            print("[%d/%d]  %s%s   (레시피 %s개)"
                  % (i, len(todo), name,
                     ("  ← 검색어: %s" % term) if term != name else "",
                     row.get("recipe_count")))
            print("        %s" % url)
            print("        기다리는 중... ", end="")
            sys.stdout.flush()

            while True:
                # Enter 를 누르면 건너뛴다 (윈도우에서만 되는 방식)
                try:
                    import msvcrt
                    if msvcrt.kbhit():
                        if msvcrt.getch() in (b"\r", b"\n"):
                            print("건너뜀")
                            break
                except ImportError:
                    pass

                now = clipboard()
                if now != seen:
                    seen = now
                    if now.startswith(PARTNER_PREFIX):
                        row["coupang_url"] = now
                        row["active"] = "Y"
                        save(fields, rows)
                        done_now += 1
                        total_filled += 1
                        print("받음 → %s   (저장 완료 · 지금까지 %d개)"
                              % (now, total_filled))
                        break
                    if now:
                        # 파트너스 링크가 아닌 것을 복사한 경우 — 그냥 계속 기다린다.
                        print("")
                        print("        (파트너스 링크가 아니에요: %s...)" % now[:48])
                        print("        기다리는 중... ", end="")
                        sys.stdout.flush()
                time.sleep(POLL_SEC)
    except KeyboardInterrupt:
        print("\n\n그만둡니다.")

    print("")
    print("이번에 채운 것 %d개 · 전체 %d / %d" % (done_now, total_filled, len(rows)))
    print("`python scripts/check_coupang_links.py` 로 정산 태그를 확인하세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
