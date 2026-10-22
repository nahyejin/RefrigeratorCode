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
    "ingredient_add",     # 재료 담기 (서버 기록은 detail 에 개수)
    "ingredient_remove",  # 재료 빼기 (서버 기록은 detail 에 개수) — 2026-10-16 추가
    "vision_use",         # 사진 인식
    "chat_use",           # 챗봇 질문
    "recipe_open",        # 레시피 열기
    "recipe_action",      # 즐겨찾기/완료/기록/식단 (detail 에 무엇인지 — RECIPE_ACTIONS)
    "coupang_click",    # 쿠팡 링크
    "signup",           # 가입 완료
    "login",            # 로그인
    # 비회원 로그인 유도(2026-10-22). detail 은 어느 확인창인지: ingredient_limit / favorite_limit /
    # write_limit / done_limit / ai_out / return_visit. 「본 것 → 누른 것 → 닫은 것」으로 전환을 본다.
    "cta_view",         # 확인창이 떴다
    "cta_click",        # 「로그인하기」를 눌렀다
    "cta_dismiss",      # 취소·나중에·X 로 닫았다
    # 비회원 냉장고 편집(서버는 로그인 사용자의 재료만 알기 때문에 앱이 보낸다). detail: manual / photo / seed_trim
    "fridge_edit",
}

# recipe_action 의 detail 값. 서버가 남기는 것(favorite_*/complete_*/record_*)과
# 앱이 남기는 것(plan_*)이 섞여 있다. 어드민 「사람별 활동」이 이 값으로 칸을 나눈다.
RECIPE_ACTIONS = (
    "favorite_add", "favorite_remove",
    "complete_add", "complete_remove",
    "record_add", "record_remove",
    "plan_add", "plan_remove", "plan_apply",
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
                CREATE TABLE IF NOT EXISTS user_events (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    device_id VARCHAR(64) NULL,
                    session_id VARCHAR(64) NULL,
                    name VARCHAR(40) NOT NULL,
                    screen VARCHAR(60) NULL,
                    detail VARCHAR(120) NULL,
                    source VARCHAR(60) NULL,     -- 어디서 들어왔나 (utm_source)
                    platform VARCHAR(12) NULL,   -- android / ios / web (2026-10-12 추가, 이전 기록은 NULL)
                    created_at DATETIME NOT NULL,
                    INDEX idx_time (created_at),
                    INDEX idx_session (session_id, created_at),
                    INDEX idx_user_time (user_id, created_at),
                    INDEX idx_name_time (name, created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            # 이미 만들어진 표에는 platform 칸을 한 번만 덧붙인다(앱·웹 구분 — 2026-10-12).
            cursor.execute("SHOW COLUMNS FROM user_events LIKE 'platform'")
            if not cursor.fetchone():
                cursor.execute("ALTER TABLE user_events ADD COLUMN platform VARCHAR(12) NULL AFTER source")
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


def platform_from_headers(origin, user_agent):
    """요청 머리글로 앱/웹을 가려낸다 — 앱을 새로 빌드해 스토어에 올리지 않아도 지금 깔린 앱부터 구분된다.

    Capacitor 앱의 웹뷰는 자기 주소가 고정이다: 이 프로젝트는 안드로이드·iOS 모두 `https://localhost`(iOS 기본값 `capacitor://localhost` 도 처리).
    웹(쿡매치 사이트)은 vercel 주소. 그 밖(개발 중 localhost:포트 등)은 구분하지 않는다.
    """
    o = (origin or "").strip().lower()
    if o.startswith("capacitor://") or o.startswith("ionic://"):
        return "ios"
    if o in ("https://localhost", "http://localhost"):
        # capacitor.config.ts 가 androidScheme·iosScheme 둘 다 https 라서 두 앱의 Origin 이 같다 → 웹뷰의 UA 로 가른다.
        ua = (user_agent or "").lower()
        if "android" in ua:
            return "android"
        if "iphone" in ua or "ipad" in ua or "ipod" in ua:
            return "ios"
        return None
    if o.endswith(".vercel.app") or "cookmatch" in o or o.startswith("https://refrigerator-code"):
        return "web"
    return None


def record(get_db, events, user_id=None, device_id=None, platform_hint=None):
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
            (platform if (platform := _clip(item.get("platform"), 12) or platform_hint) in ("android", "ios", "web") else None),
            now - timedelta(milliseconds=ago_ms),
        ))

    if not rows:
        return 0

    db = get_db()
    cursor = db.cursor()
    try:
        # 같은 방문의 앞선 기록에서 **누구인지 물려받는다.**
        #
        # 나가는 순간의 기록은 `sendBeacon` 으로 오는데, beacon 은 헤더를 못 붙여서
        # 로그인 토큰이 안 온다. 그대로 두면 회원의 이탈 기록만 비회원처럼 남아,
        # 한 사람이 둘로 세어진다. 방문(session)은 한 사람의 것이므로 그 방문에
        # 이미 붙어 있는 값을 쓴다.
        if user_id is None:
            session_ids = {r[2] for r in rows if r[2]}
            if session_ids:
                marks = ",".join(["%s"] * len(session_ids))
                cursor.execute(
                    f"SELECT session_id, MAX(user_id) uid, MAX(device_id) did "
                    f"FROM user_events WHERE session_id IN ({marks}) GROUP BY session_id",
                    tuple(session_ids),
                )
                known = {r["session_id"]: r for r in cursor.fetchall()}
                rows = [
                    (
                        r[0] if r[0] is not None else (known.get(r[2]) or {}).get("uid"),
                        r[1] or (known.get(r[2]) or {}).get("did"),
                        *r[2:],
                    )
                    for r in rows
                ]

        cursor.executemany(
            "INSERT INTO user_events "
            "(user_id, device_id, session_id, name, screen, detail, source, platform, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)",
            rows,
        )
        db.commit()
    finally:
        cursor.close()
        db.close()
    return len(rows)


def log_action(get_db, user_id, name, detail=None):
    """서버가 처리한 행동을 **서버에서** 남긴다 (2026-10-16).

    왜 서버에서 남기나:
        재료 담기·즐겨찾기·완료·기록은 앱이 보내기로 해 놓고 실제로는 보내는 코드가
        없었다. 앱에서 고치면 스토어 심사를 거쳐 새 버전이 깔려야 비로소 쌓이기
        시작하지만, 서버에서 남기면 **지금 깔린 앱부터 바로** 쌓인다. 이 행동들은
        어차피 서버 API 를 거치므로 빠지는 것도 없다.

    방문(session_id)은 모른다 — 서버 요청에는 실려 오지 않는다. 그래서 이 기록은
    「사람별 활동」에는 잡히지만 유입 출처별 성적표(방문 단위)에는 안 잡힌다.

    기록 실패가 원래 요청을 망치면 안 되므로 예외는 모두 삼킨다.
    """
    if not user_id:
        return
    try:
        device_id, hint = None, None
        try:
            from flask import request
            device_id = request.headers.get("X-Device-Id") or None
            hint = platform_from_headers(request.headers.get("Origin"),
                                         request.headers.get("User-Agent"))
        except RuntimeError:
            pass  # 요청 밖(배치 등)에서 불렸다
        record(get_db, [{"name": name, "detail": detail}],
               user_id=user_id, device_id=device_id, platform_hint=hint)
    except Exception as e:  # noqa: BLE001
        print(f"[events] 서버 기록 실패(무시): {name} {detail} {e}", flush=True)
