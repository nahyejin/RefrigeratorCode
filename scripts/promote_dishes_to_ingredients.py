# -*- coding: utf-8 -*-
"""`요리이름` 으로만 있는 것 중 **재료로도 쓰이는 것**에 재료 행을 만든다.

무슨 문제인가:
    사전은 `대분류` 로 재료와 요리이름을 갈라 두는데, 재료 매칭은 `재료` 행만
    본다. 그래서 요리이름으로만 등록된 것은 **본문에 나와도 통째로 버려진다.**
    실제로 세어 보면:

        사전에 재료로 있는 것        레시피의 재료로 잡힌 수 / 제목에 나온 수
          김치                          2,650 / 3,456
          두부                          3,726 / 2,180
          어묵                          1,411 /   548

        요리이름으로만 있는 것
          불고기                            0 /   506
          계란말이                          0 /   255
          떡볶이                            0 /   390
          아이스크림                         0 /    60

    `김치` 는 이미 두 줄(요리이름 + 재료)로 들어 있어서 잘 잡힌다. **틀이 없는
    게 아니라 채워 넣지 않았을 뿐**이다. 지금 그런 이중 등록이 32개뿐이고,
    요리이름 전용이 984개다.

무엇을 재료로 올리나:
    기준은 "요리인가" 가 아니라 **"이걸 사다가 다른 요리에 넣는가"** 다.
      올린다   김치 · 어묵 · 만두 · 순대 · 아이스크림 · 계란말이 · 단무지 · 잼
      안 올린다 된장찌개 · 비빔냉면 · 제육볶음 (그 자체로 한 끼고, 다른 요리에
                넣지 않는다)
    판단은 LLM 이 하고, 분류와 보관 일수도 함께 받는다. `요리이름` 행은 **그대로
    둔다** — 인기 급상승 요리 랭킹이 그 행을 쓴다. 재료 행을 하나 더 만들 뿐이다.

쓰는 법:
    python scripts/promote_dishes_to_ingredients.py --limit 60      # 미리보기
    python scripts/promote_dishes_to_ingredients.py --write
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
BATCH = 30

PROMPT = """너는 한국 요리 앱의 재료 사전을 관리한다.
아래는 사전에 **요리 이름**으로만 등록된 것들이다. 이 중 **재료로도 등록해야 할
것**을 골라라.

가르는 기준은 "요리인가" 가 아니다. **"이걸 사다가(또는 만들어 두고) 다른 요리에
넣는가, 냉장고에 두고 쓰는가"** 다.

  재료로도 등록한다  — 김치, 어묵, 만두, 순대, 아이스크림, 계란말이, 단무지,
                       라면사리, 잼, 떡, 햄, 젓갈, 피클
  등록하지 않는다    — 된장찌개, 비빔냉면, 제육볶음, 김치볶음밥
                       (그 자체로 한 끼고, 다른 요리에 넣지 않는다)

재료로 등록할 것에는 분류와 보관 일수도 함께 적어라.
  - 분류는 **반드시 아래 "쓸 수 있는 분류" 에 있는 조합**이어야 한다. 지어내지 마라.
  - frozen / fridge / room 은 가정에서 며칠 가는지다. 그 방법으로 보관하지
    않으면 null. (냉동은 상하는 날이 아니라 맛이 떨어지는 날 — 보통 1~6개월)
    기준 예 — 김치 냉장 90 / 어묵 냉장 7 / 만두 냉동 90·냉장 3 / 아이스크림 냉동 90

아래 JSON 배열만 출력해라. 다른 텍스트는 쓰지 마라.
[{"name":"입력한 이름","ingredient":true,"중분류":"","소분류":"","세분류":"",
  "frozen":90,"fridge":7,"room":null,"reason":"한국어 한 문장"}]

이름 목록:
"""


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
    key = (os.getenv("GEMINI_API_KEY_CURATION") or os.getenv("GEMINI_API_KEY_CHAT")
           or os.getenv("GEMINI_API_KEY") or "").strip()
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="이만큼만 (0=전체)")
    ap.add_argument("--max-calls", type=int, default=40,
                    help="LLM 호출 상한 (챗봇과 같은 키를 쓴다)")
    args = ap.parse_args()
    load_env()

    with io.open(CSVS[0], encoding="utf-8-sig", newline="") as f:
        rd = csv.DictReader(f)
        fields = list(rd.fieldnames)
        rows = list(rd)

    def col(r, name):
        return (r.get(name) or "").strip()

    material_names = {col(r, "keyword") for r in rows if col(r, "대분류") in ("재료", "포장/제품")}
    # 쓸 수 있는 분류 조합 (재료 행에서만 모은다)
    paths = sorted({(col(r, "중분류"), col(r, "소분류"), col(r, "세분류"))
                    for r in rows if col(r, "대분류") == "재료"})
    path_lines = "\n".join(
        "- 중분류=%s / 소분류=%s" % (p[0], p[1]) + (" / 세분류=%s" % p[2] if p[2] else "")
        for p in paths if p[0])

    targets = [r for r in rows
               if col(r, "대분류") == "요리이름" and col(r, "keyword")
               and col(r, "keyword") not in material_names]
    # 같은 이름이 여러 번 나오면 한 번만
    seen, uniq = set(), []
    for r in targets:
        k = col(r, "keyword")
        if k in seen:
            continue
        seen.add(k)
        uniq.append(r)
    targets = uniq[:args.limit] if args.limit else uniq

    print("요리이름 전용 %d개 중 %d개를 본다" % (len(uniq), len(targets)), flush=True)
    if not targets:
        return 0

    valid_paths = {(p[0], p[1], p[2]) for p in paths}
    promoted, refused, bad_path = [], [], []

    for i in range(0, len(targets), BATCH):
        if i // BATCH >= args.max_calls:
            print("  호출 상한에 닿아 멈춥니다. 남은 %d개는 다음에." % (len(targets) - i), flush=True)
            break
        chunk = targets[i:i + BATCH]
        listing = "\n".join("- " + col(r, "keyword") for r in chunk)
        try:
            got = extract_json(call_llm(PROMPT + "\n[쓸 수 있는 분류]\n" + path_lines
                                        + "\n\n이름 목록:\n" + listing))
        except Exception as e:  # noqa: BLE001
            print("  호출 실패(%s) — 건너뜁니다" % type(e).__name__, flush=True)
            time.sleep(6)
            continue

        for item in got:
            name = str(item.get("name") or "").strip()
            if not name or name in material_names:
                continue
            if not item.get("ingredient"):
                refused.append(name)
                continue
            path = (str(item.get("중분류") or "").strip(),
                    str(item.get("소분류") or "").strip(),
                    str(item.get("세분류") or "").strip())
            if path not in valid_paths:
                bad_path.append("%s (%s)" % (name, " > ".join(x for x in path if x)))
                continue
            promoted.append((name, path, item))
            material_names.add(name)

        print("  %d/%d  (재료로 올릴 것 %d · 아니라고 한 것 %d)"
              % (min(i + BATCH, len(targets)), len(targets), len(promoted), len(refused)), flush=True)
        time.sleep(4)

    print("\n재료로 올릴 것 %d · 요리로 남길 것 %d · 분류가 목록에 없어 뺀 것 %d"
          % (len(promoted), len(refused), len(bad_path)))
    for name, path, item in promoted[:40]:
        print("  + %-14s %-34s 냉동%s/냉장%s/실온%s"
              % (name, " > ".join(x for x in path if x),
                 item.get("frozen"), item.get("fridge"), item.get("room")))
    if refused:
        print("  요리로 남김: " + ", ".join(refused[:30]))
    if bad_path:
        print("  분류 안 맞음: " + ", ".join(bad_path[:15]))

    if not args.write:
        print("\n미리보기입니다. 반영하려면 --write")
        return 0

    def days(v):
        if v is None:
            return "-"
        try:
            n = int(v)
        except (TypeError, ValueError):
            return ""
        return str(n) if 0 < n <= 3650 else ""

    for col_name in ("보관냉동", "보관냉장", "보관실온"):
        if col_name not in fields:
            fields.append(col_name)
    today = time.strftime("%Y-%m-%d")
    for name, path, item in promoted:
        row = {f: "" for f in fields}
        row["keyword"] = name
        row["대분류"] = "재료"
        row["중분류"], row["소분류"], row["세분류"] = path
        row["보관냉동"] = days(item.get("frozen"))
        row["보관냉장"] = days(item.get("fridge"))
        row["보관실온"] = days(item.get("room"))
        row["추가일자"] = today
        rows.append(row)

    for path_out in CSVS:
        if not os.path.exists(path_out):
            continue
        # **BOM 없이 쓴다.** 사전을 읽는 쪽이 utf-8 이라 BOM 이 붙으면 첫 열
        # 이름이 깨져 사전이 통째로 빈다 (2026-09-06 에 실제로 그렇게 됐다).
        with io.open(path_out, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(rows)
        print("저장: %s" % path_out)
    print("\n※ scripts/verify_ingredient_dict.py 로 사전이 정상인지 꼭 확인하세요.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
