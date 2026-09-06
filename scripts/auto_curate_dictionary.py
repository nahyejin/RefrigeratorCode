# -*- coding: utf-8 -*-
"""사전에 없어 **버려진 이름**을 자동으로 판정해 사전에 넣는다.

왜 필요한가:
    LLM 이 레시피 본문에서 뽑은 재료 중 사전에 없는 이름은 그대로 버려진다.
    2026-09-06 기준 **14,328종 / 62,185회**가 그렇게 사라졌다. 그래서 카드의
    재료가 실제보다 적게 나오고, 매칭률도 그만큼 낮게 잡힌다.

    어드민 '사전' 탭에서 `모두 고르기 → 제안받기 → 사전에 반영` 셋을 누르면
    되지만, 1만 4천 종을 손으로 넘기는 건 현실적이지 않다.

왜 전부 자동으로 하지 않나 — **꼬리가 쓰레기다**:
    레시피에서 나온 횟수로 세어 보면

        2회 이하  누적 37.7%      5회 이하  누적 71.9%

    그 구간에 `코스트코 호래기`, `더미식 요리양념 제육볶음`, `쿠킹 포일`,
    `1/2 하프마요`, `압력밥솥 밥물` 같은 것이 있다. 사전은 **모든 사용자의
    매칭 기준**이라 한 번 들어가면 되돌리기 어렵다.

    그래서 **6회 이상**만 자동으로 돌린다(기본값). 그 위는 목록을 눈으로 훑어
    보면 거의 다 진짜 재료다 — `흰쌀밥`, `편마늘`, `청홍고추`, `슈레드치즈`,
    `계란지단`, `치아씨드`, `케이퍼`. 나머지 꼬리는 어드민에 그대로 남아
    필요하면 손으로 볼 수 있다.

동의어와 새 재료를 반드시 가른다:
    `흰밥`·`공기밥`을 **새 표제어**로 만들면 `쌀밥`과 서로 다른 재료가 되어
    매칭이 오히려 갈라진다. 판정은 `synonym / keyword / skip` 셋이고,
    이 셋은 이미 `dictionary_curation` 이 하고 있다. 여기서는 그 판정을
    **사람 대신 그대로 받아들일 뿐**이다. `skip` 은 넣지 않는다.

한 번 크게 헛짚었던 것 — **사전이 비면 전부 새 재료가 된다**:
    프롬프트는 `synonym` 의 대상을 "사전에 이미 있는 대표어" 목록에서만 고르게
    한다. 그런데 `fill_shelf_life.py` 가 사전 CSV 를 BOM 붙여 저장하는 바람에
    (`backend/ingredient_dictionary.py` 는 그냥 utf-8 로 읽는다) 첫 열 이름이
    `\ufeffkeyword` 가 되어 **사전이 통째로 0개로 읽혔다.**

    그러면 이 배치는 조용히 망가진다 — 후보가 없으니 `흰쌀밥`·`편마늘`·`흰설탕`
    이 전부 **새 표제어**로 판정된다. 그대로 넣었으면 `쌀밥` 과 `흰쌀밥` 이 서로
    다른 재료가 되어 매칭이 갈라졌을 것이다. 결과가 이상하면 **LLM 을 의심하기
    전에 사전이 제대로 읽히는지** 먼저 보라 (`scripts/verify_ingredient_dict.py`).

쓰는 법:
    python scripts/auto_curate_dictionary.py                  # 미리보기
    python scripts/auto_curate_dictionary.py --write
    python scripts/auto_curate_dictionary.py --write --min-hits 10 --limit 200
"""

import argparse
import os
import sys
import time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
for p in (ROOT, os.path.join(ROOT, "backend")):
    if p not in sys.path:
        sys.path.insert(0, p)

import pymysql  # noqa: E402

# `dictionary_curation.suggest()` 가 `names[:30]` 으로 자른다. 40개를 보내면
# **10개가 조용히 사라진다** — 호출의 1/4 이 헛돌고, 진행이 로그에 찍히는
# 것보다 느리다. 사라진 이름은 목록에 남아 다음 날 다시 오므로 잃지는
# 않지만, 숫자를 맞춰 두는 편이 맞다.
BATCH = 30
DEFAULT_MIN_HITS = 6

# 하루에 쓸 LLM 호출 상한.
#
# 이 배치는 **챗봇·AI 식단·사진 인식과 같은 키**(`GEMINI_API_KEY_CHAT`)를 쓴다.
# 무료 티어는 하루 500회라, 여기서 다 써 버리면 낮에 사람이 챗봇을 못 쓴다.
# (재료 추출 배치는 `GEMINI_API_KEY` 로 따로 돌아 영향이 없다)
#
# 지금은 6회 이상이 1,364종이라 35회면 끝나지만, 크롤링이 몰리면 늘어난다.
# 상한을 두면 남은 것은 다음 날로 밀릴 뿐 사라지지 않는다.
MAX_CALLS = 60


def load_env():
    for path in (os.path.join(ROOT, "backend", ".env"), os.path.join(ROOT, ".env")):
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())


def get_db():
    return pymysql.connect(
        host=os.getenv("DB_HOST") or "caboose.proxy.rlwy.net",
        user=os.getenv("DB_USER") or "root",
        password=os.getenv("DB_PASSWORD") or "",
        db=os.getenv("DB_NAME") or "railway",
        port=int(os.getenv("DB_PORT") or 47779),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=30,
        read_timeout=120,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true", help="실제로 사전에 넣는다")
    ap.add_argument("--min-hits", type=int, default=DEFAULT_MIN_HITS,
                    help="레시피에서 이 횟수 이상 나온 이름만 (기본 %d)" % DEFAULT_MIN_HITS)
    ap.add_argument("--limit", type=int, default=0, help="한 번에 이만큼만 (0=전체)")
    ap.add_argument("--max-calls", type=int, default=MAX_CALLS,
                    help="하루에 쓸 LLM 호출 상한 (기본 %d)" % MAX_CALLS)
    args = ap.parse_args()

    load_env()
    import dictionary_curation  # noqa: E402  (env 를 읽은 뒤에 불러야 한다)

    db = get_db()
    cur = db.cursor()
    cur.execute("SHOW COLUMNS FROM ingredient_dictionary_misses LIKE 'dismissed'")
    where = "COALESCE(dismissed,0)=0 AND " if cur.fetchone() else ""
    cur.execute(
        "SELECT raw_name, recipe_hits FROM ingredient_dictionary_misses "
        f"WHERE {where}recipe_hits >= %s ORDER BY recipe_hits DESC",
        (args.min_hits,),
    )
    names = [r["raw_name"] for r in cur.fetchall()]
    cur.close()
    db.close()

    if args.limit:
        names = names[:args.limit]
    print("대상 %d종 (레시피에서 %d회 이상 나온 이름)" % (len(names), args.min_hits), flush=True)
    if not names:
        return 0

    tally = {"synonym": 0, "keyword": 0, "skip": 0, "error": 0}
    samples = {"synonym": [], "keyword": [], "skip": []}
    saved = 0

    calls = 0
    for i in range(0, len(names), BATCH):
        if calls >= args.max_calls:
            print("  호출 상한(%d회)에 닿아 멈춥니다. 남은 %d종은 내일 이어서 합니다."
                  % (args.max_calls, len(names) - i), flush=True)
            break
        chunk = names[i:i + BATCH]
        calls += 1
        try:
            suggestions = dictionary_curation.suggest(chunk)
        except Exception as e:  # noqa: BLE001
            tally["error"] += len(chunk)
            print("  호출 실패(%s) — 이 묶음은 건너뜁니다" % type(e).__name__, flush=True)
            time.sleep(6)
            continue

        keep = []
        for sug in suggestions:
            decision = str(sug.get("decision") or "skip")
            tally[decision] = tally.get(decision, 0) + 1
            bucket = samples.get(decision)
            if bucket is not None and len(bucket) < 12:
                bucket.append("%s → %s" % (sug.get("raw"), sug.get("keyword") or "-"))
            if decision in ("synonym", "keyword"):
                keep.append(sug)

        if args.write and keep:
            # `created_by` 는 사람 관리자 id 자리다. 자동 반영은 `None` 으로 남겨
            # 나중에 "이건 사람이 승인한 게 아니다" 를 구분할 수 있게 한다.
            saved += dictionary_curation.apply_items(get_db, keep, None)

        print("  %d/%d  (동의어 %d · 새 재료 %d · 제외 %d)"
              % (min(i + BATCH, len(names)), len(names),
                 tally["synonym"], tally["keyword"], tally["skip"]), flush=True)
        time.sleep(4)

    print("\n동의어 %d · 새 재료 %d · 재료 아님(제외) %d · 실패 %d"
          % (tally["synonym"], tally["keyword"], tally["skip"], tally["error"]))
    for kind, label in (("synonym", "동의어"), ("keyword", "새 재료"), ("skip", "제외")):
        if samples[kind]:
            print("  [%s] %s" % (label, ", ".join(samples[kind])))

    if args.write:
        print("\n사전에 넣은 항목 %d개. 다음 04:30 배치가 CSV 로 옮겨 커밋합니다." % saved)
    else:
        print("\n미리보기입니다. 반영하려면 --write")
    return 0


if __name__ == "__main__":
    sys.exit(main())
