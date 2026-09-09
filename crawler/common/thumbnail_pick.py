# -*- coding: utf-8 -*-
"""본문 이미지 중에서 **음식 사진**을 고른다.

무엇이 문제였나:
    크롤러는 본문 **첫 번째** 이미지를 썸네일로 썼다. 그런데 협찬·제휴 글은
    맨 위에 「이 포스팅은 쿠팡 파트너스 활동의 일환으로…」 같은 **글자 이미지**를
    붙이는 경우가 있다. 그러면 카드에 음식 대신 글자판이 뜬다.

    표본 500건을 받아 재 보니 대략 0.7% 였다. 많지는 않지만, 걸리면 그 카드는
    음식이 아예 안 보인다.

어떻게 고르나 — 싼 것부터:

    1) **크기만 보고 거른다 (공짜)**
       네이버 본문 이미지 태그에는 `data-width`/`data-height` 가 들어 있다.
       내려받지 않고도 알 수 있다. 협찬 띠는 가로로 길고 납작하다
       (실제로 본 것: 322x69, 886x215). 음식 사진이 그런 비율인 경우는 없다.

    2) **색을 보고 의심만 한다 (판정에는 안 쓴다)**
       사진은 색이 많고 고르게 퍼져 있다. 글자판은 배경 한 색 + 글자색이라
       한 색이 크게 차지하고 색 수가 적다. 그런데 **흰 접시에 담긴 음식도
       똑같이 그렇다.** 라벨을 붙여 재 보니 실제로 겹쳤다:

           글자판 #139967  한 색 0.72 · 색 수 1.72
           음식   #153969  한 색 0.73 · 색 수 1.72   <- 구분이 안 된다

       「글자가 들어 있나」는 결국 글자를 읽어야 아는 것이라, 픽셀 통계로는
       여기까지다. 그래서 이 값으로 **자르지 않는다.** 대신 `looks_suspicious()`
       로 남겨 뒀다 — 이미 저장된 썸네일 중 **다시 볼 것을 추리는 데** 쓴다
       (`scripts/fix_text_thumbnails.py`). 거기서는 헛짚어도 손해가 없다.
       다시 봐도 1) 이 같은 이미지를 고르면 그대로일 뿐이다.

    어느 쪽에도 안 걸리면 **지금까지와 똑같이 첫 이미지**를 쓴다. 못 고르는
    경우에 더 나빠지지는 않는다.
"""

import io
from collections import Counter

# 크기를 재려면 `requests` 와 PIL 이, 색을 재려면 거기에 numpy 가 더 필요하다.
# 둘을 따로 잡는다 — numpy 가 없다고 크기 재기까지 꺼지면 안 된다.
try:
    import requests
    from PIL import Image, ImageFile
    _CAN_FETCH = True
except Exception:  # noqa: BLE001
    _CAN_FETCH = False

try:
    import numpy as np
    _CAN_LOOK = _CAN_FETCH
except Exception:  # noqa: BLE001
    _CAN_LOOK = False

# 가로가 세로의 이 배를 넘으면 띠 배너로 본다.
BANNER_RATIO = 2.5
# 이보다 납작하면(픽셀) 사진으로 안 본다.
MIN_HEIGHT = 200
# 「다시 볼 것」을 추리는 기준. 자르는 기준이 아니라 **넓게 잡는다** —
# 헛짚어도 다시 보고 같은 것을 고를 뿐이라 손해가 없다.
# 표본 796건에 대면 약 5%가 걸린다.
FLAT_MIN = 0.55
ENTROPY_MAX = 3.0
# 앞에서부터 이만큼만 본다. 그 뒤까지 가면 글의 주제와 멀어진다.
MAX_CANDIDATES = 6

_UA = {"User-Agent": "Mozilla/5.0", "Referer": "https://blog.naver.com/"}


def _int(v):
    try:
        return int(str(v).strip())
    except Exception:  # noqa: BLE001
        return 0


def is_wide_strip(width, height):
    """**비율만** 보고 가로로 긴 띠인지. 크기를 모르면 판단하지 않는다.

    비율은 이미지를 줄여도 안 변한다. 그래서 원본 크기를 모르는 곳
    (이미 저장된 썸네일 등)에서도 쓸 수 있다.
    """
    w, h = _int(width), _int(height)
    if not w or not h:
        return False
    return (w / h) >= BANNER_RATIO


def looks_like_banner(width, height):
    """크기만 보고 띠 배너인지. 크기를 모르면 판단하지 않는다(False).

    **본문에서 읽은 원본 크기**에만 쓸 것. 세로 픽셀을 보므로, 줄여서 저장된
    이미지에 쓰면 멀쩡한 사진까지 걸린다 (실제로 옛 썸네일은 80px 로 저장돼
    있어 전부 걸렸다). 그런 곳에는 `is_wide_strip` 을 쓴다.
    """
    w, h = _int(width), _int(height)
    if not w or not h:
        return False
    return h < MIN_HEIGHT or (w / h) >= BANNER_RATIO


def _small(url):
    """조금이라도 작게 받는다.

    네이버 `postfiles` 는 URL 에 서명이 걸려 있어 아무 크기나 안 된다.
    `w80`·`w160` 은 404 고 실제로 열리는 것은 `w773`·`w966` 뿐이다.
    """
    return url.replace("type=w966", "type=w773") if "type=w966" in url else url


def flatness(url, timeout=8):
    """(한 색이 차지하는 비율, 색 엔트로피). 못 받으면 None."""
    if not _CAN_LOOK or not url:
        return None
    try:
        r = requests.get(_small(url), headers=_UA, timeout=timeout)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content)).convert("RGB")
        im.thumbnail((80, 80))
        a = np.asarray(im).reshape(-1, 3)
        # 색을 32단계로 뭉갠다 — 사진의 미세한 그라데이션에 안 속게.
        q = (a // 32).astype(np.int32)
        keys = (q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2]).tolist()
        cnt = Counter(keys)
        n = len(keys)
        flat = cnt.most_common(1)[0][1] / n
        p = np.array(list(cnt.values()), dtype=float) / n
        ent = float(-(p * np.log2(p)).sum())
        return flat, ent
    except Exception:  # noqa: BLE001
        return None


def looks_suspicious(url):
    """**다시 볼 만한가.** 자르는 판정이 아니다 — 위 설명을 보라.

    이미 저장된 썸네일 중 글이 박혀 있을 법한 것을 넓게 추리는 데 쓴다.
    """
    m = flatness(url)
    if m is None:
        return False
    flat, ent = m
    return flat >= FLAT_MIN and ent <= ENTROPY_MAX


def remote_size(url, timeout=10):
    """머리 3KB 만 받아 (가로, 세로). 모르면 None.

    JPEG·PNG 는 앞부분에 크기가 들어 있다. `Range` 로 3KB 만 받으면 되므로
    이미지를 통째로 내려받는 것과는 비용이 다르다.
    """
    if not _CAN_FETCH or not url:
        return None
    try:
        h = dict(_UA, Range="bytes=0-3071")
        r = requests.get(url, headers=h, timeout=timeout)
        p = ImageFile.Parser()
        p.feed(r.content)
        return p.image.size if p.image else None
    except Exception:  # noqa: BLE001
        return None


def pick_from_tags(img_tags, measure_missing=True):
    """BeautifulSoup 의 `img.se-image-resource` 목록에서 하나를 고른다.

    태그에 붙어 있는 `data-width`/`data-height` 를 본다 — 대개 공짜다.

    그런데 **협찬 띠에는 그 속성이 아예 없는 경우가 많다.** (실제로 본 글
    셋 다 첫 이미지만 속성이 없었다. 머리를 받아 재 보니 518x111, 900x142,
    285x58 — 전부 띠였다.) 그래서 속성이 없으면 머리 3KB 만 받아서 잰다.
    `measure_missing=False` 면 아무것도 안 받고 속성만 본다.

    고를 것이 없으면 첫 이미지를 그대로 돌려준다 — 지금까지와 같다.
    """
    cands = []
    for tag in img_tags[:MAX_CANDIDATES]:
        src = tag.get("data-lazy-src") or tag.get("src") or ""
        if not src:
            continue
        cands.append((src, tag.get("data-width"), tag.get("data-height")))
    if not cands:
        return ""

    for src, w, h in cands:
        if not _int(w) or not _int(h):
            if not measure_missing:
                return src          # 모르면 예전처럼 그냥 쓴다
            size = remote_size(src)
            if not size:
                return src
            w, h = size
        if not looks_like_banner(w, h):
            return src
    return cands[0][0]
