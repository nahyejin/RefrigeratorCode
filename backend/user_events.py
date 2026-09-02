"""사용자가 어느 화면을 보고 무엇을 했는지 남긴다.

왜 지금 넣나:
    **나중에 넣으면 과거가 없다.** 광고를 뿌려 사람이 들어오기 시작한 뒤에 넣으면
    정작 가장 궁금한 "첫 유입자들이 어디서 나갔나" 를 영영 모른다.

왜 작게 넣나:
    소규모 서비스가 흔히 하는 실수가 도구를 잔뜩 붙여 놓고 아무도 안 보는 것이다.
    여기서는 **화면 진입 + 핵심 행동**만 남긴다. 그것만 있어도
      - 어디서 나갔나  → 그 방문의 마지막 화면
      - 얼마나 머물렀나 → 화면 진입 시각의 간격
    이 나온다. 체류 시간을 따로 남기지 않는 이유다.

무엇을 남기지 않나 (개인정보):
    이름·이메일·재료 이름 같은 **내용**은 남기지 않는다. 화면 이름과 행동 이름,
    그리고 누구인지 이어붙일 최소한의 식별자(user_id 또는 기기 id)만 남긴다.

A/B 테스트는 아직 하지 않는다:
    "A안이 B안보다 낫다" 를 우연이 아니라고 말하려면 한 안당 수백~수천 명이
    필요하다. 사용자가 몇 명인 지금 나누면 그 차이는 전부 우연이고, 오히려
    잘못된 결론을 확신하게 된다. 사람이 모인 뒤에 한다.
"""

import threading
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

# 한 번에 받을 수 있는 이벤트 수. 프론트가 모아서 보내되 무한정은 아니게.
MAX_BATCH = 50

# 허용하는 이벤트 이름. 목록에 없는 것은 버린다.
#
# 왜 목록을 두나: 자유롭게 받으면 오타난 이름("recipe_veiw")이 조용히 섞여
# 집계가 갈라진다. 새 이벤트를 넣을 땐 여기에도 추가한다.
ALLOWED = {
    "screen_view",      # 화면 진입 (screen 필수)
    "session_start",    # 방문 시작
    "ingredient_add",   # 재료 담기
    "vision_use",       # 사진 인식
    "chat_use",         # 챗봇 질문
    "recipe_open",      # 레시피 열기
    "recipe_action",    # 즐겨찾기/완료/기록 (detail 에 무엇인지)
    "coupang_click",    # 쿠팡 링크
    "signup",           # 가입 완료
    "login",            # 로그인
}

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
                CREATE TABLE IF NOT EXISTS user_events (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    device_id VARCHAR(64) NULL,
                    session_id VARCHAR(64) NULL,
                    name VARCHAR(40) NOT NULL,
                    screen VARCHAR(60) NULL,
                    detail VARCHAR(120) NULL,
                    source VARCHAR(60) NULL,     -- 어디서 들어왔나 (utm_source)
                    created_at DATETIME NOT NULL,
                    INDEX idx_time (created_at),
                    INDEX idx_session (session_id, created_at),
                    INDEX idx_user_time (user_id, created_at),
                    INDEX idx_name_time (name, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            db.commit()
            _ddl_done = True
        finally:
            cursor.close()
            db.close()


def _clip(value, limit):
    if value is None:
        return None
    text = str(value).strip()
    return text[:limit] if text else None


def record(get_db, events, user_id=None, device_id=None):
    """이벤트 묶음을 저장한다. 저장 실패가 앱을 막지 않도록 예외는 위에서 삼킨다."""
    ensure_table(get_db)

    rows = []
    now = datetime.now(KST).replace(tzinfo=None)
    for item in (events or [])[:MAX_BATCH]:
        if not isinstance(item, dict):
            continue
        name = _clip(item.get("name"), 40)
        if name not in ALLOWED:
            continue
        # 시각은 클라이언트가 준 것을 믿지 않는다(기기 시계가 틀릴 수 있다).
        # 대신 보낸 시점 기준의 상대 지연(ms)만 받아 되돌린다.
        try:
            ago_ms = int(item.get("ago_ms") or 0)
        except (TypeError, ValueError):
            ago_ms = 0
        ago_ms = max(0, min(ago_ms, 6 * 60 * 60 * 1000))  # 6시간을 넘으면 버림 취급
        rows.append((
            user_id,
            _clip(device_id, 64),
            _clip(item.get("session_id"), 64),
            name,
            _clip(item.get("screen"), 60),
            _clip(item.get("detail"), 120),
            _clip(item.get("source"), 60),
            now - timedelta(milliseconds=ago_ms),
        ))

    if not rows:
        return 0

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.executemany(
            "INSERT INTO user_events "
            "(user_id, device_id, session_id, name, screen, detail, source, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
            rows,
        )
        db.commit()
    finally:
        cursor.close()
        db.close()
    return len(rows)
