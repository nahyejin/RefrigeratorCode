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
                    UNIQUE KEY unique_raw (raw_name)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
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
- 요리 이름 (된장찌개, 비빔냉면, 간장계란밥) — 재료가 아니다
- 주류·음료 브랜드 (진로, 참이슬, 카스, 테라)
- 가게 이름, 할인/포인트/봉투 같은 영수증 항목
- 무엇인지 알 수 없는 글자

규칙:
- synonym 이면 keyword 는 **반드시 아래 "기존 대표어 후보" 에 있는 것**이어야 한다.
- keyword(새 재료)면 분류는 **반드시 아래 "쓸 수 있는 분류" 에 있는 조합**이어야 한다.
  없는 분류를 지어내지 마라.
- 확신이 없으면 skip 해라. 사전은 모든 사용자의 레시피 매칭 기준이라,
  틀리게 넣는 것보다 안 넣는 편이 낫다.
- reason 은 한국어 한 문장으로 짧게.

아래 JSON 배열만 출력해라. 다른 텍스트는 쓰지 마라.
[{"raw":"입력한 이름","decision":"synonym|keyword|skip","keyword":"대표어 또는 빈 문자열",
  "중분류":"","소분류":"","세분류":"","세세분류":"","hyperonym":"","reason":""}]
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


def suggest(names):
    """선택된 이름들에 대한 처리 제안. **쓰지는 않는다** — 사람이 승인해야 반영된다."""
    names = [str(n).strip() for n in names if str(n).strip()][:30]
    if not names:
        return []

    alias = get_alias_to_canonical()
    paths = material_paths()[:60]
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

    prompt = (
        _PROMPT
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

        # LLM 이 지어낸 값을 걸러 낸다. 사전은 지어낸 값이 들어가면 안 되는 곳이다.
        if decision == "synonym":
            if not keyword or normalize_key(keyword) not in alias:
                decision, keyword = "skip", ""
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
                decision = "skip"
                item["reason"] = "제안한 분류가 사전에 없는 조합이라 건너뜀"
            elif not keyword:
                keyword = name

        entry = {
            "raw": name,
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
            out.append({"raw": name, "decision": "skip", "keyword": "",
                        "중분류": "", "소분류": "", "세분류": "", "세세분류": "",
                        "hyperonym": "", "reason": "모델이 판단하지 못함"})
    return out


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
                     hyperonym, reason, created_by, created_at)
                VALUES (%s, %s, %s, '재료', %s, %s, %s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    kind=VALUES(kind), keyword=VALUES(keyword),
                    중분류=VALUES(중분류), 소분류=VALUES(소분류),
                    세분류=VALUES(세분류), 세세분류=VALUES(세세분류),
                    hyperonym=VALUES(hyperonym), reason=VALUES(reason),
                    created_by=VALUES(created_by), applied_to_csv=0
                """,
                (
                    raw[:120], decision, keyword[:120],
                    (item.get("중분류") or "")[:60], (item.get("소분류") or "")[:60],
                    (item.get("세분류") or "")[:60], (item.get("세세분류") or "")[:60],
                    (item.get("hyperonym") or "")[:120], (item.get("reason") or "")[:255],
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
