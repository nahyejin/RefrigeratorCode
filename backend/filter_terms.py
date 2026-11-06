# -*- coding: utf-8 -*-
"""**냉장고요리 필터(맛·상황·효능 칩)용 「글마다 낱말이 몇 번 나오나」 미리 센 표.**

왜 만드나 (서버 비용)
---------------------
필터 칩은 `Filter_Keywords.csv` 에 정해진 낱말(키워드 + 동의어, 823개)뿐이다. 그런데 걸러낼 때마다
`title LIKE` + `content LIKE` 로 **본문 194MB 전체**를 읽었다. 본문은 한 줄 12KB 라 MySQL 이 따로 보관하는데,
필터를 한 번 쓸 때마다 전부 읽어 메모리(버퍼 풀)에 올려 둔다. 메모리는 Railway 에서 곧 돈이다.

낱말이 정해져 있으니 **글이 들어올 때 한 번만 세어 두면** 된다. 필터는 이 표에서 낱말로 찾는다.

    recipe_filter_terms(term, recipe_id, cnt)   PRIMARY KEY (term, recipe_id)

    cnt = 제목에서 센 횟수 + 본문에서 센 횟수 (대소문자 무시, 부분 문자열 — 예전 `LIKE '%낱말%'` 와 같은 뜻)
    term = '' 인 줄은 **이 글을 세어 두었다는 표식**(낱말이 하나도 안 나온 글도 처리된 것임을 알려 준다)

바깥에서 쓰는 쪽(`app.py`)은 표가 없거나 덜 채워졌으면 **예전 방식으로 돌아간다**(`table_ready`).
그래서 이 파일을 먼저 배포해도 안전하고, 표를 채우는 순서는 상관없다.

채우는 곳
---------
    scripts/build_filter_terms.py        표 만들기 + 처음 한 번 전부 채우기(--commit)
    ingredient_management/llm_ingredient_extraction.py   새 글이 AI 처리를 마치는 그 자리에서 `upsert`
        (글은 AI 가 값을 쓴 뒤에야 목록에 나오므로 — recipe_visibility.RECIPE_READY — 그 순간 이미 세어져 있다)
"""

import csv
import os
import re
import threading
import time

TABLE = "recipe_filter_terms"

CREATE_SQL = f"""
CREATE TABLE IF NOT EXISTS {TABLE} (
    term       VARCHAR(40)  NOT NULL,
    recipe_id  INT          NOT NULL,
    cnt        SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (term, recipe_id),
    KEY idx_recipe (recipe_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
"""

# 「처리했다」는 표식 줄의 낱말(필터 낱말은 비어 있을 수 없으므로 겹치지 않는다)
DONE_TERM = ""

_vocab = None
_vocab_lock = threading.Lock()


def _csv_candidates():
    here = os.path.dirname(os.path.abspath(__file__))
    return [
        os.path.join(here, "..", "frontend", "public", "Filter_Keywords.csv"),
        os.path.join(here, "Filter_Keywords.csv"),
    ]


def load_vocab():
    """필터 칩 낱말(키워드 + 동의어) 전부 — 소문자, 중복 없이, 긴 것부터. 프런트의 트리 만들기와 같은 규칙."""
    global _vocab
    if _vocab is not None:
        return _vocab
    with _vocab_lock:
        if _vocab is not None:
            return _vocab
        terms = set()
        for path in _csv_candidates():
            try:
                with open(path, encoding="utf-8-sig") as f:
                    for row in csv.DictReader(f):
                        kw = (row.get("키워드") or "").strip()
                        if kw:
                            terms.add(kw.lower())
                        syn = (row.get("동의어") or "").strip().strip("\"'")
                        for s in re.split(r"[,/|]", syn):
                            s = s.strip()
                            if s:
                                terms.add(s.lower())
                if terms:
                    break
            except (OSError, csv.Error):
                continue
        # 표의 term 칸 길이(40)를 넘는 낱말은 넣지 못하므로 뺀다(실제로는 9자가 최대)
        _vocab = tuple(sorted((t for t in terms if len(t) <= 40), key=lambda t: (-len(t), t)))
        return _vocab


def vocab_set():
    return frozenset(load_vocab())


def count_terms(title, content):
    """{낱말: 횟수} — 한 번이라도 나온 낱말만. 제목과 본문 횟수를 더한다."""
    text_t = (title or "").lower()
    text_c = (content or "").lower()
    out = {}
    for t in load_vocab():
        c = text_c.count(t) + text_t.count(t)
        if c:
            out[t] = min(c, 65535)
    return out


def rows_for(recipe_id, title, content):
    """INSERT 할 (term, recipe_id, cnt) 목록. 표식 줄을 포함한다."""
    rows = [(DONE_TERM, recipe_id, 0)]
    rows.extend((t, recipe_id, c) for t, c in count_terms(title, content).items())
    return rows


def upsert(cursor, recipe_id, title, content):
    """한 글의 줄을 지우고 다시 쓴다(내용이 바뀌었을 때도 맞도록). 표가 없으면 조용히 건너뛴다."""
    try:
        cursor.execute(f"DELETE FROM {TABLE} WHERE recipe_id = %s", (recipe_id,))
        cursor.executemany(
            f"INSERT INTO {TABLE} (term, recipe_id, cnt) VALUES (%s, %s, %s)",
            rows_for(recipe_id, title, content),
        )
        return True
    except Exception as e:  # noqa: BLE001 — 표가 아직 없으면(1146) 필터는 예전 방식으로 동작한다
        if getattr(e, "args", None) and e.args and e.args[0] == 1146:
            return False
        raise


# ── 필터 쪽 판단: 표를 써도 되는가 ─────────────────────────────────────────
# 표가 있고 **거의 다 채워져 있을 때만** 쓴다. 덜 채워진 표로 거르면 안 세어진 글이 필터에서 사라진다.
_READY_RATIO = 0.995
_ready = {"ok": False, "checked_at": 0.0}
_ready_lock = threading.Lock()
_RECHECK_FALSE_SEC = 60      # 아직 준비 안 됐으면 1분마다 다시 본다(채우는 중일 수 있다)
_RECHECK_TRUE_SEC = 3600     # 준비됐으면 한 시간에 한 번만 확인한다


def table_ready(cursor):
    now = time.time()
    with _ready_lock:
        ttl = _RECHECK_TRUE_SEC if _ready["ok"] else _RECHECK_FALSE_SEC
        if now - _ready["checked_at"] < ttl:
            return _ready["ok"]
    ok = False
    try:
        cursor.execute(f"SELECT COUNT(*) AS n FROM {TABLE} WHERE term = %s", (DONE_TERM,))
        done = _first_value(cursor.fetchone())
        cursor.execute("SELECT COUNT(*) AS n FROM recipes")
        total = _first_value(cursor.fetchone())
        ok = bool(total) and done >= total * _READY_RATIO
    except Exception:  # noqa: BLE001 — 표가 없으면 False
        ok = False
    with _ready_lock:
        _ready["ok"] = ok
        _ready["checked_at"] = now
    return ok


def _first_value(row):
    if row is None:
        return 0
    if isinstance(row, dict):
        return int(next(iter(row.values())) or 0)
    return int(row[0] or 0)
