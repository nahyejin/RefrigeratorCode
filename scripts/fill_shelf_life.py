# -*- coding: utf-8 -*-
"""재료 사전에 **재료별 보관 일수**를 채운다 (`보관냉동`·`보관냉장`·`보관실온`).

왜 필요한가:
    지금까지 유통기한 짐작은 **분류 단위**였다. 그런데 사전의 분류는 "무엇으로
    만들었나" 기준이라, 보관 기간이 전혀 다른 것이 한 칸에 들어온다. 실제로:

        두부·콩나물  →  `두류/콩류`(마른 콩과 같은 칸)  →  냉장 180일
        만두·피자    →  `즉석조리 필요`(라면과 같은 칸)  →  냉장 180일
        김치        →  `완제품·조리불요`              →  냉장 10일

    앞의 둘은 상한 것을 먹게 만들고, 뒤의 하나는 임박 목록을 김치로 덮는다.
    재료마다 값을 두면 이 문제가 근본적으로 없어진다.

    분류 표는 **없애지 않는다.** 값이 빈 재료는 지금처럼 분류로 내려간다
    (가자미 12종에 각각 값을 넣을 이유가 없다). 순서는
    `이름 예외 → 사전 칸 → 세분류 → 소분류 → 중분류` 다.

안전장치 — **한쪽으로만 엄격한 밴드**:
    LLM 이 낸 숫자를 그대로 믿지 않되, **두 방향을 다르게 다룬다.**

      길게 잡는 쪽(분류 기준의 3배 초과)  → 버린다.
          틀리면 사람이 상한 것을 먹는다. 실제로 `아이스크림 실온 14일` 이
          이렇게 걸렸다.
      짧게 잡는 쪽(1/20배 미만만 버림)     → 웬만하면 받는다.
          애초에 분류 값이 틀려서 이 작업을 하는 것이다. 처음에 양쪽을 똑같이
          조였더니 `바게트 실온 2일`(맞는 값)을 분류 기준 30일과 다르다고
          버렸다. 짧게 잡아 틀리면 손해는 "멀쩡한 걸 버리는" 쪽이라 덜 위험하다.
          다만 `간장 365 → 1일` 같은 헛소리는 막아야 하므로 하한은 둔다.

    `null`(그 방법으로 보관 안 함)은 **분류도 null 일 때만** 받는다. LLM 이
    멋대로 "이건 냉동 안 해" 라고 하면 멀쩡한 추정이 사라진다.

쓰는 법:
    python scripts/fill_shelf_life.py --limit 40          # 미리보기
    python scripts/fill_shelf_life.py --write             # 전량 반영
    python scripts/fill_shelf_life.py --write --only 두부  # 특정 재료만
"""

import argparse
import csv
import io
import json
import os
import re
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSVS = [
    os.path.join(ROOT, "frontend", "public", "ingredient_profile_dict_with_substitutes.csv"),
    os.path.join(ROOT, "backend", "ingredient_profile_dict_with_substitutes.csv"),
]
COLS = ["보관냉동", "보관냉장", "보관실온"]
BATCH = 40

PROMPT = """너는 한국 가정에서 식재료가 얼마나 가는지 아는 사람이다.
재료 이름과 분류를 줄 테니, **가정에서 보관했을 때 며칠쯤 쓸 수 있는지**를 적어라.

세 가지를 각각 적는다.
  frozen : 냉동실(-18도). **상하는 날이 아니라 맛이 떨어지기 시작하는 날**이다.
           가정 냉동실은 문을 자주 여닫고 소분 포장도 아니라, 보통 1~6개월이다.
           공장 기준(8~12개월)을 쓰지 마라.
  fridge : 냉장실(0~4도). **안전과 직결된다.** 애매하면 짧게 잡아라.
  room   : 실온(서늘한 곳).

그 방법으로 보관하지 않는 것은 숫자 대신 null 을 적어라.
  - 생선·조개·생고기는 실온에 두지 않는다 → room: null
  - 우유·요거트는 얼리지 않는다 → frozen: null

기준이 되는 예:
  생고기 4일 / 생선 2일 / 조개 2일 / 두부 5일 / 콩나물 3일 / 밥 3일 / 끓인 육수 3일
  잎채소 7일 / 오이 10일 / 감자 30일(냉장) / 김치 90일 / 마른 미역 180일(실온)
  간장·소금·설탕 365일 / 라면 365일(실온)

아래 JSON 배열만 출력해라. 다른 텍스트는 쓰지 마라.
[{"name":"입력한 이름","frozen":90,"fridge":5,"room":null}]

재료 목록:
"""


def api_key():
    return (os.getenv("GEMINI_API_KEY_CURATION") or os.getenv("GEMINI_API_KEY_CHAT")
            or os.getenv("GEMINI_API_KEY") or "").strip()


def load_env():
    for path in (os.path.join(ROOT, "backend", ".env"), os.path.join(ROOT, ".env")):
        if not os.path.exists(path):
            continue
        with io.open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


def call_llm(prompt):
    key = api_key()
    if not key:
        raise SystemExit("GEMINI_API_KEY 가 없습니다.")
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    url = ("https://generativelanguage.googleapis.com/v1beta/models/"
           f"{model}:generateContent?key={key}")
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}]}).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = json.loads(r.read())
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts)


def extract_json(text):
    text = re.sub(r"^```[a-zA-Z]*|```$", "", (text or "").strip(), flags=re.M).strip()
    try:
        return json.loads(text)
    except Exception:  # noqa: BLE001
        m = re.search(r"\[.*\]", text, re.S)
        if not m:
            return []
        try:
            return json.loads(m.group(0))
        except Exception:  # noqa: BLE001
            return []


# ── 분류 밴드 ────────────────────────────────────────────────────────────
# `frontend/src/utils/shelfLife.ts` 의 표를 그대로 읽어 온다. 두 곳에 같은
# 숫자를 적어 두면 반드시 어긋난다.
def load_bands():
    ts = io.open(os.path.join(ROOT, "frontend", "src", "utils", "shelfLife.ts"),
                 encoding="utf-8").read()

    def table(name):
        body = ts.split("const %s: Record<string, ShelfLife> = {" % name, 1)[1].split("\n};", 1)[0]
        out = {}
        for m in re.finditer(
                r"'([^']+)':\s*\{ frozen: ([^,]+), fridge: ([^,]+), room: ([^}]+)\}", body):
            vals = []
            for x in m.groups()[1:]:
                x = x.strip()
                vals.append(None if x == "null" else int(x))
            out[m.group(1)] = dict(zip(("frozen", "fridge", "room"), vals))
        return out

    return table("BY_DETAIL"), table("BY_SUB"), table("BY_MID"), table("BY_NAME")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="이만큼만 처리 (0=전체)")
    ap.add_argument("--only", help="이름에 이 말이 든 재료만")
    ap.add_argument("--refill", action="store_true", help="이미 채운 것도 다시 묻는다")
    args = ap.parse_args()
    load_env()

    BY_DETAIL, BY_SUB, BY_MID, BY_NAME = load_bands()

    with io.open(CSVS[0], encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        rows = list(reader)
    for col in COLS:
        if col not in fieldnames:
            fieldnames.append(col)
    for r in rows:
        for col in COLS:
            r.setdefault(col, "")

    def band(row):
        name = (row.get("keyword") or "").strip()
        if name in BY_NAME:
            return BY_NAME[name]
        for tbl, key in ((BY_DETAIL, "세분류"), (BY_SUB, "소분류"), (BY_MID, "중분류")):
            k = (row.get(key) or "").strip()
            if k in tbl:
                return tbl[k]
        return None

    targets = []
    for r in rows:
        if (r.get("대분류") or "").strip() != "재료":
            continue
        name = (r.get("keyword") or "").strip()
        if not name:
            continue
        if args.only and args.only not in name:
            continue
        if not args.refill and any((r.get(c) or "").strip() for c in COLS):
            continue
        targets.append(r)
    if args.limit:
        targets = targets[:args.limit]

    print("대상 %d개 (사전 재료 %d개 중)" % (
        len(targets), sum(1 for r in rows if (r.get("대분류") or "").strip() == "재료")), flush=True)
    if not targets:
        return 0

    by_name = {(r.get("keyword") or "").strip(): r for r in targets}
    filled = rejected = 0
    reject_log = []

    for i in range(0, len(targets), BATCH):
        chunk = targets[i:i + BATCH]
        listing = "\n".join(
            "- %s (%s > %s > %s)" % (
                (r.get("keyword") or "").strip(), (r.get("중분류") or "").strip(),
                (r.get("소분류") or "").strip(), (r.get("세분류") or "").strip())
            for r in chunk)
        try:
            got = extract_json(call_llm(PROMPT + listing))
        except Exception as e:  # noqa: BLE001
            print("  호출 실패(%s) — 건너뜁니다" % type(e).__name__, flush=True)
            time.sleep(5)
            continue

        for item in got:
            name = str(item.get("name") or "").strip()
            row = by_name.get(name)
            if row is None:
                continue
            b = band(row)
            for col, key in zip(COLS, ("frozen", "fridge", "room")):
                v = item.get(key)
                ref = (b or {}).get(key)
                if v is None:
                    # 분류도 "보관 안 함" 일 때만 받는다 (위 머리말 참고)
                    if b is not None and ref is None:
                        row[col] = "-"
                    continue
                try:
                    v = int(v)
                except (TypeError, ValueError):
                    continue
                if v <= 0:
                    continue
                if ref:
                    if v > ref * 3:
                        rejected += 1
                        reject_log.append("%s %s: %s → 너무 김 (분류 %s)" % (name, key, v, ref))
                        continue
                    if v < ref / 20.0:
                        rejected += 1
                        reject_log.append("%s %s: %s → 너무 짧음 (분류 %s)" % (name, key, v, ref))
                        continue
                row[col] = str(v)
            filled += 1
        print("  %d/%d" % (min(i + BATCH, len(targets)), len(targets)), flush=True)
        time.sleep(4)

    print("\n채운 재료 %d개 · 분류 밴드 밖이라 버린 값 %d개" % (filled, rejected))
    for line in reject_log[:25]:
        print("  버림: " + line)

    if not args.write:
        print("\n미리보기입니다. 반영하려면 --write")
        return 0

    for path in CSVS:
        if not os.path.exists(path):
            continue
        # **BOM 을 붙이면 안 된다.** 사전을 읽는 backend/ingredient_dictionary.py 는
        # 그냥 utf-8 로 열어서, BOM 이 있으면 첫 열 이름이 ﻿keyword 가 되고
        # keyword 열을 못 찾아 **사전이 통째로 빈다**(실제로 그렇게 됐다).
        # 읽을 때만 utf-8-sig 로 관대하게 받고, 쓸 때는 원본과 같게 utf-8 로 쓴다.
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)
        print("저장: %s" % path)
    return 0


if __name__ == "__main__":
    sys.exit(main())
