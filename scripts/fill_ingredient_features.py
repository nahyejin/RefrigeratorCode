# -*- coding: utf-8 -*-
"""재료 사전의 빈 `Feature` 칸을 채운다.

왜 필요한가:
    대체 재료(`ingredient_management/generate_substitutes.py`)는 **Feature 60% +
    분류 40%** 로 비슷한 재료를 고른다. Feature 가 비어 있으면 Feature 유사도가
    늘 0 이라, 그 재료는 **분류가 같다는 이유만으로** 묶인다. 같은 칸에 들어
    있다는 것만으로 "이걸로 바꿔 써도 된다" 고 말하는 셈이다.

    승인·자동 큐레이션으로 들어온 새 재료는 Feature 가 비어 있다
    (`scripts/apply_dictionary_additions.py` 는 분류와 보관 일수만 채운다).
    2026-09-07 기준 사전의 재료 1,634개 중 **274개**가 그 상태였다.

말을 지어내지 못하게 한다:
    Feature 는 **재료끼리 겹쳐야** 쓸모가 있다. `고소함` 과 `고소한맛` 이 따로
    생기면 그 둘은 영영 안 겹친다. 그래서 **사전에 이미 쓰이는 말만** 쓰게 하고,
    목록에 없는 말은 버린다. 남은 것이 3개 미만이면 그 재료는 건너뛴다 —
    억지로 두 개만 넣느니 비워 두는 게 낫다(빈 것은 상위어에서 물려받는다).

쓰는 법:
    python scripts/fill_ingredient_features.py --limit 40    # 미리보기
    python scripts/fill_ingredient_features.py --write       # 전량 반영
    python scripts/fill_ingredient_features.py --write --only 김치
"""

import argparse
import csv
import io
import json
import os
import re
import time
import urllib.request
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSVS = [
    os.path.join(ROOT, "frontend", "public", "ingredient_profile_dict_with_substitutes.csv"),
    os.path.join(ROOT, "backend", "ingredient_profile_dict_with_substitutes.csv"),
]
BATCH = 25
# 전체에서 이만큼 이상 쓰인 말만 "쓸 수 있는 말" 로 준다. 한 번만 쓰인 말을
# 후보로 주면 그 말이 계속 번져서 어휘가 늘어나기만 한다.
MIN_USES = 3
MIN_KEPT = 3        # 검증 뒤 이만큼도 안 남으면 그 재료는 비워 둔다
MAX_FEATURES = 7

PROMPT = """너는 한국 요리 재료를 잘 아는 사람이다.
재료마다 **맛·식감·쓰임을 나타내는 말**을 4~7개 골라라. 대체 재료를 찾을 때
"이 둘은 바꿔 써도 되나" 를 재는 데 쓰는 값이다.

**반드시 아래 [쓸 수 있는 말] 안에서만 골라라.** 비슷한 뜻이라도 목록에 없는
말을 지어내면 그 말은 버려진다 — 다른 재료와 겹치지 않아 쓸모가 없기 때문이다.

고르는 순서는 중요하다. **가장 잘 설명하는 말을 앞에** 둬라 (앞쪽에 가중치가 있다).
맛 -> 식감 -> 쓰임 -> 분류 성격 순으로 적으면 대체로 맞는다.

아래 JSON 배열만 출력해라. 다른 텍스트는 쓰지 마라.
[{"name":"입력한 이름","features":["고소함","부드러움","구이용"]}]
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


def api_key():
    return (os.getenv("GEMINI_API_KEY_CURATION") or os.getenv("GEMINI_API_KEY_CHAT")
            or os.getenv("GEMINI_API_KEY") or "").strip()


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


def parse_features(cell):
    return [t.strip() for t in str(cell or "").split(",") if t.strip()]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--limit", type=int, default=0, help="이만큼만 처리 (0=전체)")
    ap.add_argument("--only", help="이름에 이 말이 든 재료만")
    args = ap.parse_args()
    load_env()

    with io.open(CSVS[0], encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames)
        rows = list(reader)

    # 어휘 — 사전에서 실제로 쓰이는 말만 후보로 준다.
    counts = Counter()
    for r in rows:
        counts.update(parse_features(r.get("Feature")))
    vocab = {w for w, n in counts.items() if n >= MIN_USES}
    # 소분류마다 그 칸에서 쓰이는 말을 따로 모은다. 전체 어휘(수백 개)를 통째로
    # 주면 모델이 아무 데서나 골라 오고, 무엇보다 프롬프트가 길어진다.
    by_sub = {}
    for r in rows:
        sub = (r.get("소분류") or "").strip()
        for w in parse_features(r.get("Feature")):
            if w in vocab:
                by_sub.setdefault(sub, Counter())[w] += 1
    common = [w for w, _ in counts.most_common(60) if w in vocab]

    targets = []
    for r in rows:
        if (r.get("대분류") or "").strip() not in ("재료", "포장/제품"):
            continue
        name = (r.get("keyword") or "").strip()
        if not name or parse_features(r.get("Feature")):
            continue
        if args.only and args.only not in name:
            continue
        targets.append(r)
    if args.limit:
        targets = targets[:args.limit]

    print("어휘 %d개(%d회 이상) · 대상 %d개" % (len(vocab), MIN_USES, len(targets)), flush=True)
    if not targets:
        return 0

    filled = skipped = 0
    for i in range(0, len(targets), BATCH):
        chunk = targets[i:i + BATCH]
        words = list(common)
        for r in chunk:
            sub = (r.get("소분류") or "").strip()
            words += [w for w, _ in (by_sub.get(sub) or Counter()).most_common(40)]
        seen, allowed = set(), []
        for w in words:
            if w not in seen:
                seen.add(w)
                allowed.append(w)

        listing = "\n".join(
            "- %s (%s > %s > %s)" % (
                (r.get("keyword") or "").strip(), (r.get("중분류") or "").strip(),
                (r.get("소분류") or "").strip(), (r.get("세분류") or "").strip())
            for r in chunk)
        prompt = (PROMPT + "\n[쓸 수 있는 말]\n" + ", ".join(allowed)
                  + "\n\n[재료 목록]\n" + listing)
        try:
            got = extract_json(call_llm(prompt))
        except Exception as e:  # noqa: BLE001
            print("  호출 실패(%s) - 건너뜁니다" % type(e).__name__, flush=True)
            time.sleep(5)
            continue

        by_name = {(r.get("keyword") or "").strip(): r for r in chunk}
        for item in got:
            if not isinstance(item, dict):
                continue
            row = by_name.get(str(item.get("name") or "").strip())
            if row is None:
                continue
            picked, dropped = [], []
            for w in (item.get("features") or []):
                w = str(w).strip()
                if not w or w in picked:
                    continue
                (picked if w in vocab else dropped).append(w)
            picked = picked[:MAX_FEATURES]
            name = (row.get("keyword") or "").strip()
            if len(picked) < MIN_KEPT:
                skipped += 1
                print("  - %-14s 남은 말 %d개 - 비워 둠 (버림: %s)"
                      % (name, len(picked), ", ".join(dropped[:5]) or "-"), flush=True)
                continue
            row["Feature"] = ", ".join(picked)
            filled += 1
            tail = ("   (버림: %s)" % ", ".join(dropped)) if dropped else ""
            print("  + %-14s %s%s" % (name, ", ".join(picked), tail), flush=True)
        time.sleep(1)

    print("\n채움 %d · 건너뜀 %d" % (filled, skipped), flush=True)
    if not args.write:
        print("미리보기입니다. --write 를 붙이면 실제로 고칩니다.")
        return 0

    # **BOM 을 붙이지 않는다.** utf-8-sig 로 쓰면 첫 열 이름이 깨져 사전이
    # 통째로 0개로 읽힌다 (실제로 한 번 그랬다).
    for path in CSVS:
        with io.open(path, "w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fieldnames)
            w.writeheader()
            w.writerows(rows)
    print("두 사본 모두 반영했습니다.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
