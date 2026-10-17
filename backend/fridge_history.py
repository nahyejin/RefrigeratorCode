"""내냉장고 「재료 기록」 — 누가 무슨 재료를 언제 담고·빼고·옮기고·바꿨는지 (2026-10-17).

왜 따로 남기나:
    재료 저장은 "전부 지우고 다시 넣기" 라서, 저장이 끝나면 무엇이 바뀌었는지가 어디에도
    없다. 식구 그룹이면 냉장고 하나를 여럿이 쓰는데 "이 재료 누가 넣었지?" 를 알 길이 없었다.
    저장 직전 목록과 새 목록을 견줘 바뀐 것만 남긴다.

어드민 통계(user_events)와 다른 점:
    user_events 는 운영자가 보는 통계라 재료 **이름을 남기지 않는다.** 이 기록은 본인과
    같은 그룹 식구에게만 보여 주는 사용자 기능이라 이름을 남긴다. 어드민 화면에서 읽지 않는다.

보관: 90일 (사용자가 3달로 정함). 저장할 때 그 냉장고의 90일 넘은 기록을 지운다.
"""

import threading
import uuid
from collections import defaultdict
from datetime import datetime, timedelta

KEEP_DAYS = 90

# 앱이 저장할 때 함께 알려 주는 "어디서 바꿨나". 목록 밖 값은 버린다.
SOURCES = {
    "manual",    # 내냉장고에서 직접
    "photo",     # 사진(영수증·포장지·음식) 인식으로 담음
    "shopping",  # 장보기 목록에서 「샀어요」
    "cooked",    # 요리를 끝내고 다 쓴 재료 빼기
    "sync",      # 이 기기에만 있던 재료를 서버와 맞춤
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
                created_at DATETIME NOT NULL,
                INDEX idx_fridge_time (storage_user_id, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
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
                                "detail": _date_detail(o, n)})
            else:
                changes.append({"action": "update", "name": name, "box": n["box"], "from_box": None,
                                "detail": _date_detail(o, n)})
        # 3) 짝 없는 것
        for n in news:
            changes.append({"action": "add", "name": name, "box": n["box"], "from_box": None, "detail": None})
        for o in olds:
            changes.append({"action": "remove", "name": name, "box": o["box"], "from_box": None, "detail": None})
    return changes


def _date_detail(o, n):
    """무엇이 바뀌었는지 짧게. 유통기한이 바뀌었으면 그것을, 아니면 구매일을."""
    for key in ("expiry", "purchase"):
        if o[key] != n[key]:
            return f"{key}:{o[key] or ''}>{n[key] or ''}"[:120]
    return None


def record(cursor, storage_user_id, actor_user_id, changes, source=None):
    """바뀐 것을 저장한다. 호출한 쪽의 트랜잭션(commit)에 함께 실린다."""
    ensure_table(cursor)
    now = datetime.now()
    cursor.execute(
        "DELETE FROM fridge_history WHERE storage_user_id = %s AND created_at < %s",
        (storage_user_id, now - timedelta(days=KEEP_DAYS)),
    )
    if not changes:
        return 0
    batch = uuid.uuid4().hex
    src = source if source in SOURCES else None
    cursor.executemany(
        "INSERT INTO fridge_history "
        "(storage_user_id, actor_user_id, batch_id, action, name, box, from_box, detail, source, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)",
        [(storage_user_id, actor_user_id, batch, c["action"], c["name"][:255], c["box"], c["from_box"],
          c["detail"], src, now) for c in changes],
    )
    return len(changes)


def load(cursor, storage_user_id, limit=500):
    """그 냉장고의 최근 90일 기록. 바꾼 사람 닉네임을 붙인다(탈퇴했으면 '나간 식구')."""
    ensure_table(cursor)
    cursor.execute(
        """
        SELECT h.id, h.actor_user_id, h.batch_id, h.action, h.name, h.box, h.from_box, h.detail,
               h.source, h.created_at,
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
