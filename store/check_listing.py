# -*- coding: utf-8 -*-
"""STORE_LISTING.md 의 입력칸별 글자 수가 스토어 제한 안인지 검사한다.

    python store/check_listing.py

각 칸은 ```<칸 이름> ... ``` 코드블록으로 적혀 있다. 글자 수는 두 스토어 모두
유니코드 문자 단위(한글 1자 = 1)로 센다.
"""

import io
import os
import re
import sys

LIMITS = {
    "play-title": 30,
    "play-short": 80,
    "play-full": 4000,
    "ios-name": 30,
    "ios-subtitle": 30,
    "ios-desc": 4000,
    "ios-promo": 170,
    "ios-keywords": 100,
}

path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "STORE_LISTING.md")
text = io.open(path, encoding="utf-8").read()
blocks = dict(re.findall(r"```([a-z-]+)\n(.*?)\n```", text, flags=re.S))

ok = True
for field, limit in LIMITS.items():
    body = blocks.get(field)
    if body is None:
        print(f"[없음] {field}")
        ok = False
        continue
    n = len(body.strip())
    flag = "OK " if n <= limit else "초과"
    ok &= n <= limit
    print(f"[{flag}] {field}: {n}/{limit}")
    if field == "ios-keywords" and " " in body.strip():
        print("       키워드에 띄어쓰기가 있음 — 쉼표로만 구분할 것")
        ok = False

sys.exit(0 if ok else 1)
