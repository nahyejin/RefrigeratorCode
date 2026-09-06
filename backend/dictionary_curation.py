"""사전에 없던 이름을 LLM 의 도움을 받아 재료 사전에 넣는다.

무엇을 푸는 문제인가:
    사진에서 읽혔는데 사전에 없어 담지 못한 이름이 `ingredient_dictionary_misses`
    에 쌓인다. 그중 진짜 재료인 것을 사전에 넣어야 인식 품질이 올라가는데,
    "이걸 어느 분류에 넣지? 기존 재료의 다른 이름 아닌가?" 를 사람이 매번
    판단하려면 2,946행짜리 사전을 뒤져야 한다. 그 판단을 LLM 이 **제안**하고
    사람이 **승인**한다.

왜 CSV 에 바로 쓰지 않고 DB 에 쌓나 — 이게 이 모듈의 핵심 제약이다:
    사전 원본은 저장소의 CSV 다(`frontend/public/...csv`). 그런데 서버가 도는
    Railway 는 **파일시스템이 임시**라, 거기에 쓴 내용은 다음 배포에 사라지고
    저장소에도 안 남는다. 그래서 승인된 항목은 `ingredient_dictionary_additions`
    표에 넣고, 사전을 읽을 때 CSV + DB 를 **합쳐서** 쓴다.

    저장소 CSV 로 접어 넣는 것은 사람이 할 일이다:
        python scripts/apply_dictionary_additions.py --write
    그 뒤 `scripts/sync_ingredient_dict.py --write` 로 백엔드 사본까지 맞춘다.

승인 없이 바로 반영하지 않는 이유:
    사진 인식과 같다. LLM 은 틀린다. 사전은 레시피 매칭의 기준이라 한 번 잘못
    들어가면 **모든 사용자의 추천 품질**에 영향을 준다. 되돌리기도 번거롭다.
"""

import json
import os
import re
import threading

import requests

from ingredient_dictionary import (
    INGREDIENT_CSV,
    _find_csv,
    get_alias_to_canonical,
    normalize_key,
)

_ddl_lock = threading.Lock()
_ddl_done = False


def ensure_table(get_db):
    global _ddl_done
    with _ddl_lock:
        if _ddl_done:
            return
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS ingredient_dictionary_additions (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    raw_name VARCHAR(120) NOT NULL,
                    kind VARCHAR(16) NOT NULL,        -- synonym | keyword
                    keyword VARCHAR(120) NOT NULL,    -- 붙일(또는 새로 만들) 대표어
                    대분류 VARCHAR(40) NULL,
                    중분류 VARCHAR(60) NULL,
                    소분류 VARCHAR(60) NULL,
                    세분류 VARCHAR(60) NULL,
                    세세분류 VARCHAR(60) NULL,
                    hyperonym VARCHAR(120) NULL,
                    reason VARCHAR(255) NULL,
                    created_by INT NULL,
                    created_at DATETIME NOT NULL,
                    applied_to_csv TINYINT(1) NOT NULL DEFAULT 0,
                    applied_at DATETIME NULL,          -- 사전 파일에 실제로 들어간 시각
                    apply_error VARCHAR(255) NULL,     -- 못 넣었으면 왜
                    UNIQUE KEY unique_raw (raw_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            # 이미 만들어진 표에 없으면 채운다.
            # "언제 반영됐는지 / 왜 실패했는지" 를 못 보면 관리자는 승인해 놓고
            # 그게 실제로 들어갔는지 확인할 방법이 없다.
            # `보관*` 셋은 재료별 유통기한 짐작에 쓴다. 분류 하나에 성격이
            # 다른 것이 섞여(두부가 마른 콩과 한 칸) 생기던 문제를 재료 단위로
            # 푼다 — 새 재료가 들어올 때 함께 정해 둔다.
            for col, ddl in (("applied_at", "DATETIME NULL"),
                             ("apply_error", "VARCHAR(255) NULL"),
                             ("보관냉동", "VARCHAR(8) NULL"),
                             ("보관냉장", "VARCHAR(8) NULL"),
                             ("보관실온", "VARCHAR(8) NULL")):
                cursor.execute(
                    f"SHOW COLUMNS FROM ingredient_dictionary_additions LIKE '{col}'"
                )
                if not cursor.fetchone():
                    cursor.execute(
                        f"ALTER TABLE ingredient_dictionary_additions ADD COLUMN {col} {ddl}"
                    )
            db.commit()
            _ddl_done = True
        finally:
            cursor.close()
            db.close()


def load_additions(get_db):
    """DB 에 쌓인 추가분 → {별칭: 대표어}. 사전을 읽을 때 CSV 와 합친다."""
    try:
        ensure_table(get_db)
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("SELECT raw_name, keyword FROM ingredient_dictionary_additions")
            rows = cursor.fetchall()
        finally:
            cursor.close()
            db.close()
    except Exception as e:  # noqa: BLE001
        print(f"[dictionary] 추가분 조회 실패(무시): {e}", flush=True)
        return {}

    out = {}
    for row in rows:
        raw = normalize_key(row["raw_name"])
        keyword = str(row["keyword"]).strip()
        if raw and keyword:
            out[raw] = keyword
            out[normalize_key(keyword)] = keyword
    return out


# ── 분류 후보 ────────────────────────────────────────────────────
# LLM 에게 "아무 분류나 지어내지 말고 **이 중에서 고르라**"고 시키려면 실제로
# 쓰이는 분류 조합을 줘야 한다. 지어내면 사전이 조용히 오염된다.

_paths_cache = None


def material_paths():
    """사전에서 실제로 쓰이는 재료 분류 조합 [(중,소,세,세세), ...]"""
    global _paths_cache
    if _paths_cache is not None:
        return _paths_cache

    import csv

    seen = {}
    with open(_find_csv(), encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            if (row.get("대분류") or "").strip() != "재료":
                continue
            key = (
                (row.get("중분류") or "").strip(),
                (row.get("소분류") or "").strip(),
                (row.get("세분류") or "").strip(),
                (row.get("세세분류") or "").strip(),
            )
            seen[key] = seen.get(key, 0) + 1
    # 많이 쓰이는 조합부터. 프롬프트 길이를 아끼면서 대표적인 것을 먼저 보여준다.
    _paths_cache = [k for k, _ in sorted(seen.items(), key=lambda kv: -kv[1])]
    return _paths_cache


def similar_keywords(name, limit=25):
    """이름과 글자가 겹치는 기존 대표어들. "이미 있는 재료의 다른 이름인가?" 판단용."""
    alias = get_alias_to_canonical()
    key = normalize_key(name)
    canonicals = set(alias.values())
    scored = []
    for canonical in canonicals:
        c = normalize_key(canonical)
        if not c:
            continue
        overlap = len(set(key) & set(c))
        if overlap == 0:
            continue
        # 부분 문자열이면 강하게 밀어 준다 ("가브리살" ↔ "삼겹살" 같은 관계)
        bonus = 3 if (c in key or key in c) else 0
        scored.append((overlap + bonus, canonical))
    scored.sort(reverse=True)
    return [c for _, c in scored[:limit]]


_keyword_path_cache = None


def keyword_paths():
    """대표어 -> 분류 경로 {keyword: (대분류, 중분류, 소분류, 세분류, 세세분류)}

    동의어로 붙일 때 **그 대표어가 어느 분류에 있는지**를 화면에 보여주기 위해
    필요하다. "청상추를 상추의 동의어로" 만 보여주면 관리자는 그게 어디로 들어가는지
    모른 채 승인하게 된다.
    """
    global _keyword_path_cache
    if _keyword_path_cache is not None:
        return _keyword_path_cache

    import csv

    out = {}
    with open(_find_csv(), encoding="utf-8", newline="") as f:
        for row in csv.DictReader(f):
            keyword = (row.get("keyword") or "").strip()
            if not keyword:
                continue
            out[keyword] = (
                (row.get("대분류") or "").strip(),
                (row.get("중분류") or "").strip(),
                (row.get("소분류") or "").strip(),
                (row.get("세분류") or "").strip(),
                (row.get("세세분류") or "").strip(),
            )
    _keyword_path_cache = out
    return out


def path_of(keyword):
    """대표어의 분류를 화면에 보여줄 형태로. 못 찾으면 None."""
    row = keyword_paths().get(str(keyword or "").strip())
    if not row:
        return None
    return {"대분류": row[0], "중분류": row[1], "소분류": row[2],
            "세분류": row[3], "세세분류": row[4]}


def options():
    """화면에서 고칠 때 쓸 선택지 — 쓸 수 있는 분류 조합과 대표어 목록.

    `keywordPaths` 도 함께 준다. 관리자가 동의어 대상을 바꾸면 화면이 **그
    대표어의 분류를 바로 보여줘야** 하는데, 그때마다 서버에 물으면 느리다.
    """
    alias = get_alias_to_canonical()
    paths = keyword_paths()
    keywords = sorted({v for v in alias.values()})
    return {
        "paths": [
            {"중분류": p[0], "소분류": p[1], "세분류": p[2], "세세분류": p[3]}
            for p in material_paths()
        ],
        "keywords": keywords,
        "keywordPaths": {
            k: {"중분류": paths[k][1], "소분류": paths[k][2],
                "세분류": paths[k][3], "세세분류": paths[k][4]}
            for k in keywords if k in paths
        },
    }


_PROMPT = """너는 한국 요리 앱의 재료 사전을 관리한다.
사용자가 영수증·음식 사진에서 읽혔지만 사전에 없던 이름들을 넘긴다.
각 이름을 어떻게 처리할지 판단해라.

가능한 판단은 셋뿐이다.
1) "synonym"  — 이미 사전에 있는 재료의 **다른 이름**이다. 그 대표어를 keyword 에 적어라.
2) "keyword"  — 사전에 없는 **새 재료**다. 분류를 골라 적어라.
3) "skip"     — 재료가 아니다. 사전에 넣으면 안 된다.

skip 해야 하는 것들:
- 그 자체로 한 끼가 되고 **다른 요리에 넣지는 않는** 요리 이름
  (된장찌개, 비빔냉면, 간장계란밥, 제육볶음)
- 주류·음료 브랜드 (진로, 참이슬, 카스, 테라)
- 가게 이름, 할인/포인트/봉투 같은 영수증 항목
- 무엇인지 알 수 없는 글자

**요리 이름이라고 무조건 버리지 마라.** 만들어진 음식이라도 **사서 냉장고에
두거나 다른 요리에 넣는 것**이면 재료다. 이런 것은 keyword(새 재료)로 받아라.
  김치 · 어묵 · 만두 · 순대 · 아이스크림 · 계란말이 · 단무지 · 라면사리 · 잼
가르는 기준은 "요리인가" 가 아니라 **"이걸 사다가 다른 요리에 넣는가"** 다.

규칙:
- synonym 이면 keyword 는 **반드시 아래 "기존 대표어 후보" 에 있는 것**이어야 한다.
- **격이 다르면 동의어로 묶지 마라.** 값도 쓰임도 다른 것을 한 이름으로 합치면
  그 정보가 영영 사라진다. 이런 것은 synonym 이 아니라 **keyword(새 재료)** 다.
    트러플오일 != 올리브유    한우 양지 != 양지    갈비살 != 등심
    발사믹글레이즈 != 글레이즈  샤인머스캣 != 포도   자연산 광어 != 광어
  "무엇으로 만들었나" 가 같아도 **사는 물건이 다르면** 다른 재료다.
- keyword(새 재료)면 분류는 **반드시 아래 "쓸 수 있는 분류" 에 있는 조합**이어야 한다.
  없는 분류를 지어내지 마라.
- 확신이 없으면 skip 해라. 사전은 모든 사용자의 레시피 매칭 기준이라,
  틀리게 넣는 것보다 안 넣는 편이 낫다.
- reason 은 한국어 한 문장으로 짧게.

keyword(새 재료)일 때는 **보관 일수**도 함께 적어라. 가정에서 며칠쯤 쓸 수 있는지다.
  - frozen : 냉동실. 상하는 날이 아니라 **맛이 떨어지기 시작하는 날**. 보통 1~6개월.
  - fridge : 냉장실. **안전과 직결된다.** 애매하면 짧게.
  - room   : 실온(서늘한 곳).
  그 방법으로 보관하지 않으면 null (생선·생고기의 room, 우유의 frozen 등).
  기준 예 — 생고기 4 / 생선 2 / 두부 5 / 콩나물 3 / 밥 3 / 잎채소 7 / 감자 30(냉장)
             김치 90 / 마른 미역 180(실온) / 간장·소금 365

아래 JSON 배열만 출력해라. 다른 텍스트는 쓰지 마라.
[{"raw":"입력한 이름","decision":"synonym|keyword|skip","keyword":"대표어 또는 빈 문자열",
  "중분류":"","소분류":"","세분류":"","세세분류":"","hyperonym":"","reason":"",
  "frozen":90,"fridge":5,"room":null}]
"""


def _api_key():
    return (
        os.getenv("GEMINI_API_KEY_CURATION")
        or os.getenv("GEMINI_API_KEY_CHAT")
        or os.getenv("GEMINI_API_KEY")
        or ""
    ).strip()


def _call_llm(prompt):
    api_key = _api_key()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY가 없습니다.")
    model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    res = requests.post(
        url,
        json={
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.1, "responseMimeType": "application/json"},
        },
        timeout=60,
    )
    res.raise_for_status()
    data = res.json()
    parts = data.get("candidates", [{}])[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts)


def _parse(text):
    cleaned = (text or "").strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", cleaned)
    if fenced:
        cleaned = fenced.group(1).strip()
    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        match = re.search(r"\[[\s\S]*\]", cleaned)
        if not match:
            return []
        try:
            data = json.loads(match.group(0))
        except json.JSONDecodeError:
            return []
    return data if isinstance(data, list) else []


# **이 말이 이름에 있으면 그 정보를 잃으면 안 된다.**
#
# 2026-09-07 자동 큐레이션 첫 실행에서 `트러플오일 -> 올리브유`,
# `한우 양지 -> 양지`, `갈비살 -> 등심` 같은 합병이 나왔다. 동의어로 붙으면
# `used_ingredients` 에는 대표어만 남으므로 **트러플·한우가 통째로 사라진다** —
# 「특별한 날 특별한 음식」이 그 재료로 고르는데 찾을 수가 없게 된다.
#
# 프롬프트에도 적었지만 말로만 시키면 가끔 어긴다. 이름에 이 말이 있는데
# 대표어에는 없으면 **동의어로 받지 않는다.**
KEEP_DISTINCT = (
    # 격·값이 다른 것
    "한우", "와규", "트러플", "캐비어", "푸아그라", "랍스터", "킹크랩",
    "전복", "발사믹", "샴페인", "송이버섯", "능이", "샤인머스",
    # 부위 — 뭉치면 어느 부위인지 사라진다
    "채끝", "안심", "등심", "갈비살", "차돌", "토시살", "우삼겹", "양지",
)
# `국내산`·`유기농`·`자연산` 같은 **표시 문구는 넣지 않았다.** 그 말이 사라지는
# 합병(`국내산 대파` -> `대파`)이야말로 사전이 해야 할 일이라, 여기 넣으면
# 멀쩡한 합병까지 전부 `건너뜀` 이 되어 그 이름이 아예 매칭되지 않는다.


def loses_distinction(alias_name, keyword):
    """`alias_name` 을 `keyword` 로 합치면 잃어버리는 말. 없으면 None."""
    a = (alias_name or "").replace(" ", "")
    k = (keyword or "").replace(" ", "")
    for word in KEEP_DISTINCT:
        if word in a and word not in k:
            return word
    return None


def suggest(names, force_decision=None):
    """선택된 이름들에 대한 처리 제안. **쓰지는 않는다** — 사람이 승인해야 반영된다.

    `force_decision` 이 주어지면 그 판단으로 강제하고 **나머지만 채우게** 한다.
    관리자가 "이건 새 재료야" 라고 판단을 바꿨을 때, 분류까지 손으로 고르게 하면
    329개 목록에서 찾아야 한다. 판단만 사람이 정하고 분류는 다시 물어보는 게 맞다.
    """
    names = [str(n).strip() for n in names if str(n).strip()][:30]
    if not names:
        return []

    alias = get_alias_to_canonical()
    # 분류도 **전체**를 준다.
    #
    # 처음엔 많이 쓰이는 60개만 보여줬는데, 검증은 329개 전체로 하고 있었다.
    # 그래서 모델이 61번째 이후에 있는 알맞은 분류를 골라도 "목록에 없는 조합"
    # 으로 걸러졌고, 화면에는 분류가 빈 채로 "직접 골라 주세요" 만 떴다.
    # **보여준 것과 받아들이는 것이 달라서 모델이 이길 수 없는 구조였다.**
    paths = material_paths()
    # 재료 대표어 **전체**를 준다.
    #
    # 처음에는 글자가 겹치는 것만 후보로 줬는데, 그러면 뜻은 같은데 글자가 다른
    # 관계를 놓친다 — "포항초"(시금치의 한 품종)에 "시금치" 가 후보로 안 들어가
    # 모델이 판단을 못 했다. 목록이 길어도(1,300여 개) 관리자가 가끔 누르는
    # 기능이라 토큰을 조금 더 쓰는 편이 낫다.
    all_keywords = sorted({v for v in alias.values()})
    path_lines = "\n".join(
        f"- 중분류={p[0]} / 소분류={p[1]}" + (f" / 세분류={p[2]}" if p[2] else "")
        + (f" / 세세분류={p[3]}" if p[3] else "")
        for p in paths
    )

    candidate_block = []
    for name in names:
        cands = similar_keywords(name)
        candidate_block.append(f"- {name} → 후보: {', '.join(cands) if cands else '(비슷한 것 없음)'}")

    forced = ""
    if force_decision == "keyword":
        forced = ("\n\n[중요] 아래 이름들은 **반드시 decision=\"keyword\"(새 재료)** 로 판단해라.\n"
                  "skip 이나 synonym 으로 내리지 말고, 가장 알맞은 분류를 골라 채워라.")
    elif force_decision == "synonym":
        forced = ("\n\n[중요] 아래 이름들은 **반드시 decision=\"synonym\"** 으로 판단해라.\n"
                  "가장 가까운 기존 대표어를 골라 keyword 에 채워라. skip 하지 마라.")

    prompt = (
        _PROMPT
        + forced
        + "\n\n[쓸 수 있는 분류]\n" + path_lines
        + "\n\n[사전에 이미 있는 재료 대표어 — synonym 은 반드시 이 중에서 골라라]\n"
        + ", ".join(all_keywords)
        + "\n\n[판단할 이름 (글자가 비슷한 것을 참고로 붙여 둔다)]\n"
        + "\n".join(candidate_block)
    )

    raw = _call_llm(prompt)
    out = []
    valid_paths = {p for p in material_paths()}
    for item in _parse(raw):
        if not isinstance(item, dict):
            continue
        name = str(item.get("raw") or "").strip()
        if name not in names:
            continue
        decision = str(item.get("decision") or "skip").strip()
        keyword = str(item.get("keyword") or "").strip()
        if force_decision:
            decision = force_decision

        # LLM 이 지어낸 값을 걸러 낸다. 사전은 지어낸 값이 들어가면 안 되는 곳이다.
        # 지어낸 값은 받아들이지 않는다. 다만 **사람이 판단을 정해 준 경우**
        # (force_decision)에는 판단까지 되돌리지 않는다 — 관리자가 "이건 새 재료야"
        # 라고 했는데 분류를 못 골랐다고 `건너뜀` 으로 바꿔 버리면, 관리자는
        # 자기가 고른 게 왜 사라졌는지 알 수 없다. 못 채운 칸만 비워 두고
        # 화면에서 직접 고르게 한다.
        if decision == "synonym":
            # 격을 잃는 합병은 동의어로 받지 않는다 (위 `KEEP_DISTINCT` 참고).
            # 관리자가 일부러 `synonym` 을 강제한 경우는 그 뜻을 존중한다.
            lost = None if force_decision else loses_distinction(name, keyword)
            if lost:
                decision = "skip"
                keyword = ""
                item["reason"] = "`%s` 가 사라져서 동의어로 안 묶음 — 새 재료로 볼 것" % lost
            elif not keyword or normalize_key(keyword) not in alias:
                keyword = ""
                if force_decision:
                    item["reason"] = "가까운 대표어를 못 찾았어요. 직접 골라 주세요"
                else:
                    decision = "skip"
                    item["reason"] = "제안한 대표어가 사전에 없어 건너뜀"
            else:
                keyword = alias[normalize_key(keyword)]
        elif decision == "keyword":
            path = (
                str(item.get("중분류") or "").strip(),
                str(item.get("소분류") or "").strip(),
                str(item.get("세분류") or "").strip(),
                str(item.get("세세분류") or "").strip(),
            )
            if path not in valid_paths:
                # 분류를 못 골랐을 때의 차선책 — **가장 가까운 기존 재료의 자리**를 쓴다.
                #
                # "새 재료로 추가" 로 강제하면 모델이 분류는 비운 채 가까운 기존
                # 이름(대저토마토 → "토마토")만 돌려주는 일이 잦다. 그런데 그게 곧
                # 답이다: 품종·부위가 다른 새 재료는 **원래 재료와 같은 칸**에 들어간다.
                # 그 자리를 그대로 빌려 쓰고, 새 대표어 이름은 원래 이름으로 둔다.
                borrowed = None
                for candidate in ([keyword] if keyword else []) + similar_keywords(name, limit=5):
                    found = path_of(candidate)
                    if found and found.get("대분류") == "재료":
                        borrowed = found
                        break

                if borrowed:
                    for col in ("중분류", "소분류", "세분류", "세세분류"):
                        item[col] = borrowed.get(col) or ""
                    keyword = name
                    item["reason"] = (item.get("reason") or "").strip() or "가까운 재료와 같은 분류로 넣어요"
                else:
                    for col in ("중분류", "소분류", "세분류", "세세분류"):
                        item[col] = ""
                    if force_decision:
                        keyword = keyword or name
                        item["reason"] = "알맞은 분류를 못 찾았어요. 직접 골라 주세요"
                    else:
                        decision = "skip"
                        item["reason"] = "제안한 분류가 사전에 없는 조합이라 건너뜀"
            elif not keyword:
                keyword = name

        entry = {
            "raw": name,
            # 보관 일수 — 새 재료일 때만 뜻이 있다. 사전 CSV 의
            # `보관냉동`·`보관냉장`·`보관실온` 칸으로 들어간다.
            **{k: item.get(k) for k in ("frozen", "fridge", "room")},
            "decision": decision,
            "keyword": keyword,
            "중분류": str(item.get("중분류") or "").strip(),
            "소분류": str(item.get("소분류") or "").strip(),
            "세분류": str(item.get("세분류") or "").strip(),
            "세세분류": str(item.get("세세분류") or "").strip(),
            "hyperonym": str(item.get("hyperonym") or "").strip(),
            "reason": str(item.get("reason") or "").strip()[:255],
        }
        # 동의어로 붙일 때는 **그 대표어가 있는 분류**를 채워 준다.
        # 이게 없으면 관리자가 "어디로 들어가는지 모른 채" 승인하게 된다.
        if decision == "synonym":
            found = path_of(keyword)
            if found:
                entry.update({k: v for k, v in found.items() if k != "대분류"})
        out.append(entry)

    handled = {o["raw"] for o in out}
    for name in names:
        if name not in handled:
            out.append({"raw": name, "decision": force_decision or "skip", "keyword": "",
                        "중분류": "", "소분류": "", "세분류": "", "세세분류": "",
                        "hyperonym": "", "reason": "모델이 판단하지 못했어요. 직접 골라 주세요"})
    return out


def _days(value):
    """보관 일수 한 칸. `None` 은 "그 방법으로는 보관 안 함" 이라 `-` 로 남긴다.

    빈 문자열은 "안 정했음" 이고, 그때는 화면이 분류 표로 내려간다 — 셋을
    구분해야 해서 숫자/`-`/빈칸 세 가지를 쓴다.
    """
    if value is None:
        return "-"
    try:
        n = int(value)
    except (TypeError, ValueError):
        return ""
    return str(n) if 0 < n <= 3650 else ""


def apply_items(get_db, items, admin_id):
    """승인된 제안을 DB 에 넣는다. 사전을 읽을 때 CSV 와 합쳐진다."""
    ensure_table(get_db)
    saved = 0
    db = get_db()
    cursor = db.cursor()
    try:
        for item in items:
            raw = str(item.get("raw") or "").strip()
            keyword = str(item.get("keyword") or "").strip()
            decision = str(item.get("decision") or "").strip()
            if not raw or not keyword or decision not in ("synonym", "keyword"):
                continue
            cursor.execute(
                """
                INSERT INTO ingredient_dictionary_additions
                    (raw_name, kind, keyword, 대분류, 중분류, 소분류, 세분류, 세세분류,
                     hyperonym, reason, 보관냉동, 보관냉장, 보관실온, created_by, created_at)
                VALUES (%s, %s, %s, '재료', %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    kind=VALUES(kind), keyword=VALUES(keyword),
                    중분류=VALUES(중분류), 소분류=VALUES(소분류),
                    세분류=VALUES(세분류), 세세분류=VALUES(세세분류),
                    hyperonym=VALUES(hyperonym), reason=VALUES(reason),
                    보관냉동=VALUES(보관냉동), 보관냉장=VALUES(보관냉장),
                    보관실온=VALUES(보관실온),
                    created_by=VALUES(created_by), applied_to_csv=0
                """,
                (
                    raw[:120], decision, keyword[:120],
                    (item.get("중분류") or "")[:60], (item.get("소분류") or "")[:60],
                    (item.get("세분류") or "")[:60], (item.get("세세분류") or "")[:60],
                    (item.get("hyperonym") or "")[:120], (item.get("reason") or "")[:255],
                    _days(item.get("frozen")), _days(item.get("fridge")), _days(item.get("room")),
                    admin_id,
                ),
            )
            saved += 1
            # 사전에 들어갔으므로 "못 찾은 이름" 목록에서는 빼 준다.
            cursor.execute("DELETE FROM ingredient_dictionary_misses WHERE raw_name = %s", (raw,))
        db.commit()
    finally:
        cursor.close()
        db.close()

    # 다음 조회부터 새 항목이 잡히도록 캐시를 비운다.
    import ingredient_dictionary

    ingredient_dictionary.reset_cache()
    global _keyword_path_cache, _paths_cache
    _keyword_path_cache = None
    _paths_cache = None
    return saved
