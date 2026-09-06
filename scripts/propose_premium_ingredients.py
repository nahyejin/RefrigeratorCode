# -*- coding: utf-8 -*-
"""새로 들어온 재료 중 **「특별한 날」 재료**를 골라 프리미엄 목록에 넣는다.

왜 필요한가:
    사전은 매일 자동으로 늘어난다(`scripts/auto_curate_dictionary.py`). 그런데
    프리미엄 목록은 손으로 적은 41개짜리 표라, 새로 들어온 `성게알`·`한우 채끝`
    같은 것이 사전에는 있어도 「특별한 날 특별한 음식」은 **영영 못 본다.**

무엇이 어려운가 — **흔한 재료가 들어오면 섹션이 죽는다.**
    예전에 이 목록에 버터·새우·표고버섯이 들어 있었다. 카탈로그 전체로 재 보면
    `버터` 9.0% · `새우` 8.9% · `표고버섯` 5.2% 였고, 인기 목록 110건 중 58건이
    「특별한 날」로 뽑혔다. **아무 날이나 특별한 날이 되면 그 섹션은 없는 것과
    같다.** 그래서 사람 눈 대신 **셀 수 있는 것**으로 막는다:

      1) **빈도 상한 1%** — 카탈로그의 1% 넘는 레시피에 나오면 무조건 뺀다.
         지금 목록에서 가장 흔한 것이 `굴` 0.85%, `루꼴라` 0.68% 다. 1% 는
         "손에 꼽게 나오는 것" 과 "장바구니에 늘 있는 것" 사이에 그어진 선이다.
      2) **최소 등장 5회** — 한두 번 스쳐 간 이름은 넣어도 아무 글에도 안 걸린다.
      3) **LLM 판정** — 위 둘을 통과한 것 중에서 "상에 올리는 재료인가" 를 묻는다.
         찹쌀·아몬드·바나나도 1% 아래라, 빈도만으로는 갈라지지 않는다.

    한 번 물어본 이름은 `asked` 에 남겨 다시 묻지 않는다. 매일 도는 배치라
    같은 것을 매일 물으면 호출만 쓰고 답은 늘 같다.

어디에 쓰나:
    `backend/premium_ingredients_auto.json` 에 쌓이고, `premium_ingredients.py`
    가 손으로 적은 목록과 합쳐 쓴다. 손으로 적은 쪽이 항상 이긴다.

쓰는 법:
    python scripts/propose_premium_ingredients.py            # 미리보기
    python scripts/propose_premium_ingredients.py --write    # 실제로 넣는다
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
from collections import Counter
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))
sys.path.insert(0, os.path.join(ROOT, "scripts"))

import premium_ingredients as premium  # noqa: E402
from apply_dictionary_additions import load_env, db  # noqa: E402

CSV_PATH = os.path.join(ROOT, "frontend", "public",
                        "ingredient_profile_dict_with_substitutes.csv")
OUT_PATH = os.path.join(ROOT, "backend", "premium_ingredients_auto.json")

# 손으로 적은 목록에서 **일부러 뺀 이름들.** 자동 판정이 그것을 모르고 새
# 항목으로 다시 넣으면 사람의 판단이 조용히 뒤집힌다.
EXCLUDED = {e for _, _, ex in premium._HANDPICKED for e in ex}

MAX_SHARE = 0.01      # 카탈로그의 1% 를 넘으면 «특별한 날» 재료가 아니다
MIN_HITS = 5          # 이보다 드물면 넣어도 아무 글에 안 걸린다
BATCH = 30
MAX_CALLS = 10        # 하루 호출 상한 (챗봇과 같은 키를 쓴다)

# LLM 이 고를 수 있는 등급. 손으로 적은 목록의 각 구역 **바로 뒤**에 앉힌다 —
# 같은 성격이면 사람이 고른 것이 먼저 보이게.
#
# **`초고가`(캐비어·푸아그라 자리)는 자동으로 못 준다.** 첫 실행에서 모델이
# `떡` 에 초고가를 매겼다. 맨 위 자리는 화면 첫 줄을 차지하므로, 틀렸을 때
# 가장 크게 보인다. 그 자리는 사람이 적은 것만 쓴다.
TIERS = {
    "해산물": 28,
    "육류": 48,
    "버섯채소": 64,
    "치즈유제품": 74,
    "주류조미료": 84,
}

PROMPT = """너는 한국 가정의 장보기를 아는 사람이다.
재료 이름을 줄 테니, 그것이 **값이 비싸서 큰맘 먹고 사는 재료**인지 판정해라.

기준은 **재료의 값**이다. "언제 먹느냐" 가 아니다.
  premium 인 것 : 전복 · 랍스터 · 한우 · 트러플 · 캐비어 · 부라타 · 샴페인 ·
                 대게 · 관자 · 성게 · 채끝 · 양갈비 — **한 근/한 마리 값이 크다.**
  premium 아닌 것: 찹쌀 · 아몬드 · 바나나 · 대파 · 닭다리살 · 베이킹파우더 ·
                  참기름 · 밀가루 · 어묵 · 라면 — **평소에도 사는 것**이다.

**명절 음식이라고 premium 이 아니다.** 이건 특히 자주 틀리는 곳이다.
  떡 · 고사리 · 도라지 · 시금치 · 숙주 · 밤 · 대추 · 곶감 · 동그랑땡 · 잡채당면
  — 명절에 먹지만 **싸다.** 우리가 찾는 건 "그날 먹는 음식" 이 아니라
    **"그날이라서 사는 비싼 재료"** 다.

이것들도 전부 **premium 이 아니다.**
  - 양념·조미료·가루·소스류 (아무리 이름이 근사해도 상의 주인공이 아니다)
  - 베이킹 재료, 밀가루·전분류, 면류·떡류
  - 그 재료를 **주로 값싸게 먹는 방식**이 있는 것 (닭다리살, 다짐육, 통조림)
  - 국거리·찌개거리처럼 **평소 반찬으로 쓰는 부위**

premium 이면 아래 중 하나를 `tier` 에 적어라:
  해산물 · 육류 · 버섯채소 · 치즈유제품 · 주류조미료

**확신이 없으면 premium=false 로 해라.** 한 번 들어가면 「특별한 날」 섹션이
그만큼 평범해진다. 넣어서 얻는 것보다 잘못 넣어서 잃는 것이 크다.
100개를 보면 5개쯤 통과하는 것이 정상이다.

아래 JSON 배열만 출력해라. 다른 텍스트는 쓰지 마라.
[{"name":"입력한 이름","premium":true,"tier":"해산물","reason":"한 문장"}]
"""


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


def load_store():
    if not os.path.exists(OUT_PATH):
        return {"items": [], "asked": []}
    with io.open(OUT_PATH, encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("items", [])
    data.setdefault("asked", [])
    return data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--recheck", action="store_true",
                    help="이미 물어본 이름도 다시 묻는다")
    args = ap.parse_args()
    load_env()

    store = load_store()
    asked = set(store["asked"])
    have = {it["name"] for it in store["items"]}

    # ── 사전에서 재료 대표어 (요리명은 뺀다) ─────────────────────────
    with io.open(CSV_PATH, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    materials = {}
    for r in rows:
        if (r.get("대분류") or "").strip() not in ("재료", "포장/제품"):
            continue
        if (r.get("중분류") or "").strip() == "요리명":
            continue
        name = (r.get("keyword") or "").strip()
        if name:
            materials[name] = r

    # ── 카탈로그 빈도 ────────────────────────────────────────────────
    conn = db()
    cur = conn.cursor()
    cur.execute("SELECT used_ingredients FROM recipes WHERE llm_ingredients_at IS NOT NULL")
    recipes = cur.fetchall()
    conn.close()
    total = len(recipes) or 1
    counts = Counter()
    for r in recipes:
        for t in premium.split_tokens(r["used_ingredients"]):
            counts[t] += 1

    candidates = []
    for name, row in materials.items():
        if name in have or (name in asked and not args.recheck):
            continue
        if premium.premium_hits([name]):
            continue          # 이미 목록에 걸린다
        if name in EXCLUDED:
            continue          # 손으로 일부러 뺀 이름이다 (`갈비` 의 `등갈비` 등)
        n = counts.get(name, 0)
        if n < MIN_HITS:
            continue
        share = n / float(total)
        if share > MAX_SHARE:
            continue          # 너무 흔하다 — 「특별한 날」이 아무 날이 된다
        candidates.append((n, name, share, row))
    candidates.sort(reverse=True)
    if args.limit:
        candidates = candidates[:args.limit]

    print("LLM 처리 레시피 %d건 · 후보 %d종 (등장 %d회 이상 · 빈도 %.1f%% 미만)"
          % (total, len(candidates), MIN_HITS, MAX_SHARE * 100), flush=True)
    if not candidates:
        return 0

    accepted, calls = [], 0
    for i in range(0, len(candidates), BATCH):
        if calls >= MAX_CALLS:
            print("  호출 상한(%d회) — 남은 %d종은 내일 이어서 봅니다."
                  % (MAX_CALLS, len(candidates) - i), flush=True)
            break
        chunk = candidates[i:i + BATCH]
        calls += 1
        listing = "\n".join(
            "- %s (%s > %s)" % (name, (row.get("중분류") or "").strip(),
                                (row.get("소분류") or "").strip())
            for _, name, _, row in chunk)
        try:
            got = extract_json(call_llm(PROMPT + "\n[재료 목록]\n" + listing))
        except Exception as e:  # noqa: BLE001
            print("  호출 실패(%s) — 이 묶음은 건너뜁니다" % type(e).__name__, flush=True)
            time.sleep(5)
            continue

        by_name = {name: (n, share) for n, name, share, _ in chunk}
        for item in got:
            if not isinstance(item, dict):
                continue
            name = str(item.get("name") or "").strip()
            if name not in by_name:
                continue
            asked.add(name)
            if not item.get("premium"):
                continue
            tier = str(item.get("tier") or "").strip()
            if tier not in TIERS:
                print("  ? %-12s 등급 '%s' 이 목록에 없어 건너뜁니다" % (name, tier), flush=True)
                continue
            n, share = by_name[name]
            accepted.append({
                "name": name,
                "rank": TIERS[tier],
                "tier": tier,
                "hits": n,
                "share": round(share, 5),
                "reason": str(item.get("reason") or "")[:120],
                "added": datetime.now().strftime("%Y-%m-%d"),
            })
            print("  + [%3d %-6s] %-12s %4d건 %.2f%%  %s"
                  % (TIERS[tier], tier, name, n, share * 100, item.get("reason") or ""),
                  flush=True)
        # 물어본 것은 모두 표시한다 — 답이 안 온 이름도 다시 묻지 않는다.
        for _, name, _, _ in chunk:
            asked.add(name)
        time.sleep(1)

    print("\n새로 넣을 것 %d종 · 이번에 물어본 것 %d종"
          % (len(accepted), len(asked) - len(store["asked"])), flush=True)
    if not args.write:
        print("미리보기입니다. --write 를 붙이면 실제로 넣습니다.")
        return 0

    store["items"].extend(accepted)
    store["asked"] = sorted(asked)
    store["updated"] = datetime.now().strftime("%Y-%m-%d %H:%M")
    with io.open(OUT_PATH, "w", encoding="utf-8", newline="") as f:
        json.dump(store, f, ensure_ascii=False, indent=1, sort_keys=False)
    print("반영: %s (총 %d종)" % (OUT_PATH, len(store["items"])))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
