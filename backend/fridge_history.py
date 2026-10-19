"""내냉장고 「재료 기록」 — 누가 무슨 재료를 언제 담고·빼고·옮기고·바꿨는지 (2026-10-17).

왜 따로 남기나:
    재료 저장은 "전부 지우고 다시 넣기" 라서, 저장이 끝나면 무엇이 바뀌었는지가 어디에도
    없다. 식구 그룹이면 냉장고 하나를 여럿이 쓰는데 "이 재료 누가 넣었지?" 를 알 길이 없었다.
    저장 직전 목록과 새 목록을 견줘 바뀐 것만 남긴다.

어드민 통계(user_events)와 다른 점:
    user_events 는 운영자가 보는 통계라 재료 **이름을 남기지 않는다.** 이 기록은 본인과
    같은 그룹 식구에게만 보여 주는 사용자 기능이라 이름을 남긴다. 어드민 화면에서 읽지 않는다.

보관: 90일 (사용자가 3달로 정함). 저장할 때 그 냉장고의 90일 넘은 기록을 지운다.

되돌리기 (2026-10-19):
    기록 한 줄(한 번의 저장)을 「실행 취소」하거나, 그 저장 **직전** 상태로 「복원」할 수 있다.
    둘 다 지금 냉장고에 기록을 거꾸로 적용해서 만든다(스냅숏을 따로 두지 않는다).
    그래서 재료마다 그때의 유통기한·구매일(expiry/purchase)을 함께 남긴다 — 뺀 재료를
    되살릴 때 날짜까지 돌려놓으려고. 이 칸이 생기기 전 기록은 날짜 없이 이름·칸만 돌아온다.
    되돌린 것도 한 번의 저장으로 기록에 남으므로(source=undo/restore) 그것을 다시 취소할 수 있다.
"""

import threading
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

KEEP_DAYS = 90
# 「이 변경 전으로」 는 최근 14일 기록에만 (2026-10-19). 기록은 90일 보이지만, 오래된 시점으로 되돌리면
# 그 뒤 몇 주치 장보기·요리로 바뀐 냉장고가 통째로 옛날로 돌아가 오히려 실제와 어긋난다.
# 잘못 지워진 것을 알아채는 데는 보통 며칠이면 충분하다 — 주 1~2회 장보기 두 바퀴.
RESTORE_DAYS = 14

# 앱이 저장할 때 함께 알려 주는 "어디서 바꿨나". 목록 밖 값은 버린다.
SOURCES = {
    "manual",    # 내냉장고에서 직접
    "photo",     # 사진(영수증·포장지·음식) 인식으로 담음
    "shopping",  # 장보기 목록에서 「샀어요」
    "cooked",    # 요리를 끝내고 다 쓴 재료 빼기
    "sync",      # 이 기기에만 있던 재료를 서버와 맞춤
    "undo",      # 「재료 기록」에서 한 줄 실행 취소
    "restore",   # 「재료 기록」에서 그 저장 직전으로 복원
    "household", # 식구 그룹 만들기·참여(재료 합치기)·나가기
}

# 표가 처음 생긴 뒤에 붙인 칸들. 이미 있는 표에는 ALTER 로 더한다.
_EXTRA_COLUMNS = {
    "expiry": "DATE NULL",              # 그 재료의 유통기한(뺐으면 빼기 전 값)
    "purchase": "DATE NULL",            # 그 재료의 구매일
    "ref_batch": "CHAR(32) NULL",       # undo/restore 일 때 어느 저장을 되돌렸나
    "client": "VARCHAR(120) NULL",      # 저장을 보낸 기기(User-Agent 앞부분) — 원인 추적용, 화면엔 안 보인다
}

_ddl_lock = threading.Lock()
_ddl_done = False


def ensure_table(cursor):
    global _ddl_done
    with _ddl_lock:
        if _ddl_done:
            return
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS fridge_history (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                storage_user_id INT NOT NULL,      -- 냉장고 주인(그룹이면 그룹 냉장고 계정)
                actor_user_id INT NOT NULL,        -- 실제로 바꾼 사람
                batch_id CHAR(32) NOT NULL,        -- 한 번의 저장. 한꺼번에 담은 것을 한 줄로 묶는다
                action VARCHAR(10) NOT NULL,       -- add / remove / move / update
                name VARCHAR(255) NOT NULL,
                box VARCHAR(10) NULL,              -- 지금(뺐으면 빼기 전) 보관함
                from_box VARCHAR(10) NULL,         -- move 일 때 원래 보관함
                detail VARCHAR(120) NULL,          -- update 일 때 "expiry:2026-10-20>2026-10-26"
                source VARCHAR(12) NULL,
                expiry DATE NULL,
                purchase DATE NULL,
                ref_batch CHAR(32) NULL,
                client VARCHAR(120) NULL,
                created_at DATETIME NOT NULL,
                INDEX idx_fridge_time (storage_user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        cursor.execute("SHOW COLUMNS FROM fridge_history")
        have = {r["Field"] for r in cursor.fetchall()}
        for col, spec in _EXTRA_COLUMNS.items():
            if col not in have:
                cursor.execute(f"ALTER TABLE fridge_history ADD COLUMN {col} {spec}")
        _ddl_done = True


def _day(value):
    """날짜를 'YYYY-MM-DD' 로 맞춘다. DB 는 date, 앱은 'yyyy.mm.dd' 로 줘서 그대로 견주면 늘 달라 보인다."""
    if value is None or value == "":
        return None
    if hasattr(value, "strftime"):
        return value.strftime("%Y-%m-%d")
    text = str(value).strip().replace(".", "-").replace("/", "-")[:10]
    return text or None


def diff(before, after):
    """저장 전·후 목록(각각 {name, box, expiry, purchase} 의 리스트)을 견줘 바뀐 것을 돌려준다.

    같은 이름끼리 짝을 짓는다:
      1) 보관함·유통기한·구매일이 다 같으면 그대로 — 기록 없음
      2) 남은 짝 중 보관함이 다르면 옮김(move), 같으면 날짜를 바꾼 것(update)
      3) 짝이 없는 새 것은 담음(add), 짝이 없는 옛 것은 뺌(remove)
    같은 이름이 둘 이상이어도(계란 두 판) 개수대로 맞춘다.
    """
    def norm(it):
        return {"name": it["name"], "box": it.get("box"),
                "expiry": _day(it.get("expiry")), "purchase": _day(it.get("purchase"))}

    old_by, new_by = defaultdict(list), defaultdict(list)
    for it in before:
        old_by[it["name"]].append(norm(it))
    for it in after:
        new_by[it["name"]].append(norm(it))

    changes = []
    for name in list(dict.fromkeys([*old_by.keys(), *new_by.keys()])):
        olds, news = old_by.get(name, []), new_by.get(name, [])
        # 1) 완전히 같은 것끼리 먼저 지운다
        for n in news[:]:
            same = next((o for o in olds if o == n), None)
            if same is not None:
                olds.remove(same)
                news.remove(n)
        # 2) 남은 것끼리 짝 — 보관함이 같은 것부터
        for n in news[:]:
            if not olds:
                break
            o = next((o for o in olds if o["box"] == n["box"]), olds[0])
            olds.remove(o)
            news.remove(n)
            if o["box"] != n["box"]:
                changes.append({"action": "move", "name": name, "box": n["box"], "from_box": o["box"],
                                "detail": _date_detail(o, n), **_dates(n)})
            else:
                changes.append({"action": "update", "name": name, "box": n["box"], "from_box": None,
                                "detail": _date_detail(o, n), **_dates(n)})
        # 3) 짝 없는 것
        for n in news:
            changes.append({"action": "add", "name": name, "box": n["box"], "from_box": None, "detail": None,
                            **_dates(n)})
        for o in olds:
            changes.append({"action": "remove", "name": name, "box": o["box"], "from_box": None, "detail": None,
                            **_dates(o)})
    return changes


def _dates(it):
    return {"expiry": it.get("expiry"), "purchase": it.get("purchase")}


def _date_detail(o, n):
    """무엇이 바뀌었는지 짧게. 유통기한이 바뀌었으면 그것을, 아니면 구매일을."""
    for key in ("expiry", "purchase"):
        if o[key] != n[key]:
            return f"{key}:{o[key] or ''}>{n[key] or ''}"[:120]
    return None


def record(cursor, storage_user_id, actor_user_id, changes, source=None, ref_batch=None, client=None):
    """바뀐 것을 저장한다. 호출한 쪽의 트랜잭션(commit)에 함께 실린다. 남긴 batch_id 를 돌려준다."""
    ensure_table(cursor)
    now = datetime.now()
    cursor.execute(
        "DELETE FROM fridge_history WHERE storage_user_id = %s AND created_at < %s",
        (storage_user_id, now - timedelta(days=KEEP_DAYS)),
    )
    if not changes:
        return None
    batch = uuid.uuid4().hex
    src = source if source in SOURCES else None
    cursor.executemany(
        "INSERT INTO fridge_history "
        "(storage_user_id, actor_user_id, batch_id, action, name, box, from_box, detail, source,"
        " expiry, purchase, ref_batch, client, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        [(storage_user_id, actor_user_id, batch, c["action"], c["name"][:255], c["box"], c["from_box"],
          c["detail"], src, _day(c.get("expiry")), _day(c.get("purchase")), ref_batch,
          (client or None) and client[:120], now) for c in changes],
    )
    return batch


def load(cursor, storage_user_id, limit=500):
    """그 냉장고의 최근 90일 기록. 바꾼 사람 닉네임을 붙인다(탈퇴했으면 '나간 식구')."""
    ensure_table(cursor)
    cursor.execute(
        """
        SELECT h.id, h.actor_user_id, h.batch_id, h.action, h.name, h.box, h.from_box, h.detail,
               h.source, h.ref_batch, h.created_at,
               CASE WHEN u.deleted_at IS NULL THEN u.nickname ELSE NULL END AS actor_nickname
        FROM fridge_history h
        LEFT JOIN users u ON u.id = h.actor_user_id
        WHERE h.storage_user_id = %s AND h.created_at >= %s
        ORDER BY h.created_at DESC, h.id DESC
        LIMIT %s
        """,
        (storage_user_id, datetime.now() - timedelta(days=KEEP_DAYS), limit),
    )
    rows = cursor.fetchall()
    for r in rows:
        r["created_at"] = r["created_at"].isoformat() if r["created_at"] else None
    return rows


# ---------------------------------------------------------------------------
# 되돌리기
# ---------------------------------------------------------------------------

def _reverse(state, rows, skip_existing):
    """한 번의 저장(rows)을 state(지금 냉장고 목록) 위에서 거꾸로 적용한 새 목록.

    이름으로 짝을 짓는다(저장이 "전부 지우고 다시 넣기" 라 재료 id 가 남지 않는다).
    skip_existing: 뺀 재료를 되살릴 때 같은 칸에 같은 이름이 이미 있으면 건너뛴다 —
    한 줄만 취소할 때 쓴다(그새 다시 담았으면 두 개가 되지 않게).
    """
    out = [dict(it) for it in state]

    def find(name, box):
        same_box = [it for it in out if it["name"] == name and it["box"] == box]
        return (same_box or [it for it in out if it["name"] == name] or [None])[0]

    for r in rows:
        name, box = r["name"], r["box"]
        if r["action"] == "add":
            hit = find(name, box)
            if hit is not None:
                out.remove(hit)
        elif r["action"] == "remove":
            if skip_existing and any(it["name"] == name and it["box"] == box for it in out):
                continue
            out.append({"name": name, "box": box or "fridge",
                        "expiry": _day(r.get("expiry")), "purchase": _day(r.get("purchase"))})
        else:  # move / update — 지금 있는 칸에서 찾아 원래대로
            hit = find(name, box)
            if hit is None:
                continue
            if r["action"] == "move" and r.get("from_box"):
                hit["box"] = r["from_box"]
            if r.get("detail") and ":" in r["detail"]:
                key, rest = r["detail"].split(":", 1)
                old = rest.split(">", 1)[0]
                if key in ("expiry", "purchase"):
                    hit[key] = old or None
    return out


def plan_revert(cursor, storage_user_id, batch_id, mode):
    """mode='undo'  — 그 저장 하나만 취소한 목록
       mode='restore' — 그 저장 **직전** 상태(그 뒤의 저장까지 모두 거꾸로)

    돌려주는 값: (새 목록, 그 저장의 시각) — 기록이 없으면 None, RESTORE_DAYS 보다 오래됐으면 "too_old".
    """
    ensure_table(cursor)
    cursor.execute(
        "SELECT MIN(id) AS first_id, MIN(created_at) AS at FROM fridge_history "
        "WHERE storage_user_id = %s AND batch_id = %s",
        (storage_user_id, batch_id),
    )
    head = cursor.fetchone()
    if not head or head["first_id"] is None:
        return None
    if head["at"] < datetime.now() - timedelta(days=RESTORE_DAYS):
        return "too_old"

    cursor.execute(
        "SELECT name, storage_box, expiry_date, purchase_date FROM user_ingredients "
        "WHERE user_id = %s FOR UPDATE",
        (storage_user_id,),
    )
    state = [{"name": r["name"], "box": r["storage_box"],
              "expiry": _day(r["expiry_date"]), "purchase": _day(r["purchase_date"])}
             for r in cursor.fetchall()]

    if mode == "undo":
        cursor.execute(
            "SELECT * FROM fridge_history WHERE storage_user_id = %s AND batch_id = %s ORDER BY id",
            (storage_user_id, batch_id),
        )
        return _reverse(state, cursor.fetchall(), skip_existing=True), head["at"]

    # restore: 가장 최근 저장부터 그 저장까지 차례로 거꾸로 적용
    cursor.execute(
        "SELECT * FROM fridge_history WHERE storage_user_id = %s AND id >= %s ORDER BY id DESC",
        (storage_user_id, head["first_id"]),
    )
    batches = defaultdict(list)
    order = []
    for r in cursor.fetchall():
        if r["batch_id"] not in batches:
            order.append(r["batch_id"])
        batches[r["batch_id"]].append(r)
    for b in order:
        state = _reverse(state, batches[b], skip_existing=False)
    return state, head["at"]
