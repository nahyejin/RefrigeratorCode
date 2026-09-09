# -*- coding: utf-8 -*-
"""이미 저장된 **글자 띠 썸네일**을 음식 사진으로 바꾼다.

무엇이 문제였나:
    크롤러가 본문 첫 이미지를 그대로 썸네일로 썼다. 협찬 글은 맨 위에
    「이 포스팅은 … 수수료를 제공받습니다」 같은 **가로로 긴 글자 띠**를
    붙이는 경우가 있어서, 그게 카드에 뜬다. 음식이 아예 안 보인다.

    크롤러는 고쳤다(`crawler/common/thumbnail_pick.py`). 이 스크립트는
    **이미 쌓여 있는 것**을 손본다.

어떻게 하나 — 싼 것부터:

    1) **머리 3KB 만 받아 크기를 안다.**
       JPEG 는 앞부분에 가로·세로가 들어 있다. `Range` 로 3KB 만 받으면
       한 장에 3KB 다. 4만 장이라도 100MB 남짓.
       가로가 세로의 2.5배를 넘으면 띠로 본다 (실제로 본 것: 322x69, 966x235).
       **비율만** 본다 — 옛 썸네일은 80px 로 줄여 저장돼 있어서 세로 픽셀로
       재면 멀쩡한 사진까지 전부 걸린다. 비율은 줄여도 안 변한다.

    2) **띠로 보이는 것만 글을 다시 연다.**
       `PostView.naver` 는 셀레늄 없이 그냥 받아진다. 본문 이미지 태그의
       `data-width`/`data-height` 를 보고 크롤러와 **같은 규칙**으로 고른다.

    3) 고른 것이 지금 것과 다르면 바꾼다.

    헛짚어도 손해가 없다 — 다시 봐도 같은 이미지를 고르면 그대로다.

쓰는 법:
    python scripts/fix_text_thumbnails.py                 # 미리보기(재기만)
    python scripts/fix_text_thumbnails.py --write         # 실제로 바꾼다
    python scripts/fix_text_thumbnails.py --limit 2000    # 일부만
"""

import argparse
import os
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor

import requests
from bs4 import BeautifulSoup
from PIL import ImageFile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
sys.path.insert(0, os.path.join(ROOT, "scripts"))
from apply_dictionary_additions import load_env, db  # noqa: E402
from crawler.common.thumbnail_pick import (  # noqa: E402
    is_sponsor_widget, is_wide_strip, pick_from_tags)

UA = {"User-Agent": "Mozilla/5.0", "Referer": "https://blog.naver.com/"}
HEAD_BYTES = 3071


def image_size(url):
    """머리만 받아 (가로, 세로). 모르면 None."""
    try:
        h = dict(UA, Range="bytes=0-%d" % HEAD_BYTES)
        r = requests.get(url, headers=h, timeout=10)
        p = ImageFile.Parser()
        p.feed(r.content)
        return p.image.size if p.image else None
    except Exception:  # noqa: BLE001
        return None


def post_view_url(link):
    """글 주소를 **본문이 들어 있는** 주소로.

    블로그(`blog.naver.com`)는 본문이 iframe 안에 있어서 그 주소를 따로
    만들어야 한다. 인플루언서(`in.naver.com`)는 주소 그대로 열면 본문이
    들어 있다 — 둘 다 셀레늄 없이 그냥 받아진다.
    """
    link = link or ""
    if "in.naver.com/" in link:
        return link
    m = re.search(r"blog\.naver\.com/([^/?]+)/(\d+)", link)
    if not m:
        return None
    return ("https://blog.naver.com/PostView.naver?blogId=%s&logNo=%s"
            "&redirect=Dlog&widgetTypeCall=true&directAccess=false"
            % (m.group(1), m.group(2)))


def repick(link, tries=3):
    """글을 다시 열어 크롤러와 같은 규칙으로 이미지를 고른다.

    **몇 번 다시 해 본다.** 한 번에 여럿을 열면 네이버가 간간이 끊는데,
    그걸 "고칠 게 없음" 으로 삼키면 협찬 띠가 그대로 남는다. 실제로 첫 실행에서
    118건이 그렇게 남았고, 하나씩 다시 열어 보니 전부 멀쩡히 골라졌다.
    """
    u = post_view_url(link)
    if not u:
        return None
    for i in range(tries):
        try:
            html = requests.get(u, headers=UA, timeout=20).text
            cont = BeautifulSoup(html, "html.parser").select_one("div.se-main-container")
            if cont:
                got = pick_from_tags(cont.select("img.se-image-resource"))
                if got:
                    return got
        except Exception:  # noqa: BLE001
            pass
        time.sleep(1.5 * (i + 1))
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="0 이면 전부")
    ap.add_argument("--workers", type=int, default=12)
    args = ap.parse_args()
    load_env()

    conn = db()
    cur = conn.cursor()
    # **네이버 CDN 만 보면 안 된다.**
    #
    # 처음에는 `thumbnail LIKE '%%pstatic%%'` 로 좁혀 놨었다. 그런데 체험단
    # 글은 위젯 이미지를 본문에 심고, 그 이미지는 `revu.net`·`cloudreview.co.kr`
    # 같은 **남의 호스트**에 있다. 그래서 12%(5,018건)를 아예 안 봤고,
    # 「협찬을 통해 작성」 배지가 그대로 카드에 남아 있었다.
    #
    # 유튜브 썸네일(`ytimg`)은 영상 대표 이미지라 손댈 이유가 없다.
    sql = ("SELECT id, link, thumbnail FROM recipes "
           "WHERE llm_ingredients_at IS NOT NULL AND thumbnail <> '' "
           "AND thumbnail NOT LIKE '%%ytimg%%' "
           "ORDER BY id")
    if args.limit:
        sql += " LIMIT %d" % args.limit
    cur.execute(sql)
    rows = cur.fetchall()
    print("볼 것 %d건" % len(rows), flush=True)

    # ── 1) 크기로 추린다 ─────────────────────────────────────────────
    t0 = time.time()
    done = [0]

    def size_of(r):
        s = image_size(r["thumbnail"])
        done[0] += 1
        if done[0] % 2000 == 0:
            print("  %d/%d (%.0f초)" % (done[0], len(rows), time.time() - t0), flush=True)
        return (r, s)

    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        sized = list(ex.map(size_of, rows))

    unknown = [r for r, s in sized if not s]
    # 다시 볼 것: **체험단 위젯 이미지** 와 **가로로 긴 띠**.
    #
    # `too_small_for_photo` 는 여기서 쓰면 안 된다 — 옛 썸네일은 80px 로 줄여
    # 저장돼 있어서 멀쩡한 음식 사진까지 전부 걸린다. 그 규칙은 크롤러가
    # **본문에서 읽은 원본 크기**에만 쓴다.
    suspect = [(r, s) for r, s in sized
               if is_sponsor_widget(r["thumbnail"])
               or (s and is_wide_strip(s[0], s[1]))]
    print("\n크기를 못 잰 것 %d건" % len(unknown))
    print("띠로 보이는 것 %d건 (%.2f%%)"
          % (len(suspect), len(suspect) / max(1, len(rows)) * 100), flush=True)
    for r, s in suspect[:15]:
        print("  #%s %dx%d  %s" % (r["id"], s[0], s[1], r["link"]))

    if not suspect:
        conn.close()
        return 0

    # ── 2) 그것만 글을 다시 연다 ─────────────────────────────────────
    print("\n글을 다시 열어 고릅니다...", flush=True)

    def again(item):
        r, s = item
        return (r, s, repick(r["link"]))

    # 글을 여는 쪽은 **천천히** 연다 — 한꺼번에 몰면 네이버가 끊는다.
    with ThreadPoolExecutor(max_workers=4) as ex:
        picked = list(ex.map(again, suspect))

    changed = [(r, s, p) for r, s, p in picked
               if p and p.split("?")[0] != (r["thumbnail"] or "").split("?")[0]]
    same = len(picked) - len(changed)
    print("바꿀 것 %d건 · 그대로 %d건" % (len(changed), same))
    for r, s, p in changed[:20]:
        print("  #%s %dx%d\n      전: %s\n      후: %s" % (r["id"], s[0], s[1],
                                                          r["thumbnail"][:90], p[:90]))

    if not args.write:
        print("\n미리보기입니다. --write 를 붙이면 실제로 바꿉니다.")
        conn.close()
        return 0

    for r, s, p in changed:
        cur.execute("UPDATE recipes SET thumbnail=%s WHERE id=%s", [p, r["id"]])
    conn.commit()
    print("\n%d건 바꿨습니다. (%.0f초)" % (len(changed), time.time() - t0))
    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
