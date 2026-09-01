"""AI 사용량(크레딧) 한도 — 챗봇과 사진 인식이 **함께** 쓰는 단 하나의 구현.

왜 이 모듈이 따로 있나:
    예전에는 `chat_service` 안에 전역 카운터 하나가 있었다.

        _rate_count = 0            # 프로세스 전역
        LLM_DAILY_LIMIT = 250      # 하루

    이게 챗봇과 사진 인식에 함께 걸려 있었는데, **사용자별이 아니라 서버 전체
    공용**이었다. 한 명이 250번 쓰면 나머지 전원이 차단됐고, 메모리에만 있어서
    배포할 때마다 0으로 리셋됐으며, 누가 얼마나 썼는지 알 방법이 아예 없었다.
    사용자가 9명이라 안 터지고 있었을 뿐이다.

설계 요점 (자세한 근거는 저장소 루트 `USAGE_QUOTA_PLAN.md`):

  * **주별 한도 + 일별 상한.** 냉장고 재료 등록은 장 본 날 하루에 몰린다.
    일별만 걸면 첫 사용이 차단으로 끝나고, 주별만 걸면 첫날 한 주치를 태운다.
  * **크레딧은 요청 수에 가깝게 매긴다.** 무료 티어 한도는 토큰이 아니라
    "요청 수"로 센다. 사진 5장도 한 요청이므로 장수만큼 매기면, 권장해야 할
    행동(여러 장을 한 번에 올려 호출을 아끼는 것)에 벌금을 매기는 꼴이 된다.
  * **카운터가 아니라 원장(`llm_usage`)을 쌓는다.** 집계 기준을 나중에 바꿀 수
    있고, 어드민 통계가 전부 여기 한 곳에서 나온다.
"""

import os
import threading
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

# 행동별 크레딧. 환산 근거는 USAGE_QUOTA_PLAN.md "3. 크레딧 환산" 참고.
CREDITS = {
    "chat": int(os.getenv("CREDITS_CHAT", "1")),
    "vision": int(os.getenv("CREDITS_VISION", "2")),
}


def _plans():
    """플랜별 (주 한도, 일 상한). 환경변수로 덮을 수 있다."""
    return {
        "guest": (
            int(os.getenv("QUOTA_GUEST_WEEKLY", "15")),
            int(os.getenv("QUOTA_GUEST_DAILY", "10")),
        ),
        "free": (
            int(os.getenv("QUOTA_FREE_WEEKLY", "100")),
            int(os.getenv("QUOTA_FREE_DAILY", "40")),
        ),
        "plus": (
            int(os.getenv("QUOTA_PLUS_WEEKLY", "400")),
            int(os.getenv("QUOTA_PLUS_DAILY", "100")),
        ),
    }


def caller_identity():
    """이번 요청을 누가 보냈는지 — (user_id, device_id).

    로그인했으면 `user_id`, 아니면 클라이언트가 만들어 보낸 `device_id`.
    비회원 식별은 캐시를 지우면 초기화되지만 **완벽할 필요가 없다** — 비회원
    한도는 남용 방지가 아니라 가입 유인이 목적이다(USAGE_QUOTA_PLAN.md 8절).

    JWT 검증을 여기서 다시 하는 이유: `app.verify_jwt_token` 을 가져다 쓰면
    app -> chat_service -> app 으로 import 가 돌아 순환이 된다. 서명 키만 같으면
    되므로 같은 규칙으로 직접 푼다.
    """
    from flask import request

    device_id = (
        request.headers.get('X-Device-Id')
        or (request.form.get('device_id') if request.form else None)
        or ((request.get_json(silent=True) or {}).get('device_id')
            if request.is_json else None)
        or ''
    ).strip()[:64] or None

    auth = request.headers.get('Authorization') or ''
    if not auth.startswith('Bearer '):
        return None, device_id

    secret = os.getenv('JWT_SECRET_KEY') or os.getenv('SECRET_KEY')
    if not secret:
        # 서명 키가 기동마다 바뀌는 난수라면 어차피 검증이 안 된다 -> 비회원 취급.
        return None, device_id
    try:
        import jwt

        payload = jwt.decode(auth.split(' ', 1)[1], secret, algorithms=['HS256'])
        user_id = payload.get('user_id')
        return (int(user_id) if user_id is not None else None), device_id
    except Exception:  # noqa: BLE001  (만료/위조 토큰은 그냥 비회원으로 본다)
        return None, device_id


# ── 실제 토큰 사용량 ──────────────────────────────────────────────
#
# 크레딧은 우리가 정한 환산값이고, 토큰은 **실제로 쓴 양**이다. 둘을 함께 남겨야
# "사진 2크레딧이 적정한가", "유료 티어로 넘어가면 얼마인가" 를 감이 아니라
# 근거로 판단할 수 있다.
#
# LLM 호출 함수는 응답의 usageMetadata 를 `note_tokens()` 로 흘려 두고, 호출이
# 끝난 쪽에서 `attach_tokens()` 로 원장 행에 붙인다. 호출 함수의 반환값을 바꾸면
# 호출부를 전부 고쳐야 해서, 같은 스레드 안에서만 보이는 자리를 하나 둔다.
_local = threading.local()


def note_tokens(prompt=None, output=None, total=None, model=None, images=None):
    _local.tokens = {
        "prompt_tokens": prompt,
        "output_tokens": output,
        "total_tokens": total,
        "model": model,
        "images": images,
    }


def note_gemini_usage(data, model=None, images=None):
    """Gemini 응답 JSON에서 usageMetadata 를 꺼내 기록한다."""
    meta = (data or {}).get("usageMetadata") or {}
    note_tokens(
        prompt=meta.get("promptTokenCount"),
        output=meta.get("candidatesTokenCount"),
        total=meta.get("totalTokenCount"),
        model=model,
        images=images,
    )


def attach_tokens(get_db, usage_id):
    """직전 호출의 토큰 실측치를 원장 행에 붙인다. 없으면 아무것도 안 한다."""
    tokens = getattr(_local, "tokens", None)
    _local.tokens = None
    if not usage_id or not tokens:
        return
    try:
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                "UPDATE llm_usage SET model=%s, images=%s, prompt_tokens=%s, "
                "output_tokens=%s, total_tokens=%s WHERE id=%s",
                (
                    (str(tokens.get("model"))[:48] if tokens.get("model") else None),
                    tokens.get("images"),
                    tokens.get("prompt_tokens"),
                    tokens.get("output_tokens"),
                    tokens.get("total_tokens"),
                    usage_id,
                ),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()
    except Exception as e:  # noqa: BLE001
        # 토큰 기록이 실패했다고 사용자 요청을 실패시키지는 않는다.
        print(f"[usage] 토큰 기록 실패(무시): {e}", flush=True)



class QuotaDenied(Exception):
    """한도 초과. `scope` 는 'weekly' 또는 'daily'."""

    def __init__(self, scope, status):
        super().__init__(scope)
        self.scope = scope
        self.status = status


def week_start(now=None):
    """이번 주 시작(월요일 00:00 KST).

    가입일 기준 롤링 7일이 아니라 **고정 요일**로 둔다. 사용자가 언제 리셋되는지
    예측할 수 있어야 "왜 아직 안 채워지냐"는 문의가 안 생긴다.
    """
    now = now or datetime.now(KST)
    monday = (now - timedelta(days=now.weekday())).replace(
        hour=0, minute=0, second=0, microsecond=0
    )
    return monday


def day_start(now=None):
    now = now or datetime.now(KST)
    return now.replace(hour=0, minute=0, second=0, microsecond=0)


def next_week_start(now=None):
    return week_start(now) + timedelta(days=7)


_ddl_lock = threading.Lock()
_ddl_done = False


def ensure_tables(get_db):
    """표가 없으면 만든다. 프로세스당 한 번만 실제로 돈다."""
    global _ddl_done
    with _ddl_lock:
        if _ddl_done:
            return
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS llm_usage (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NULL,
                    device_id VARCHAR(64) NULL,
                    kind VARCHAR(16) NOT NULL,
                    credits INT NOT NULL,
                    detail VARCHAR(64) NULL,
                    model VARCHAR(48) NULL,
                    images INT NULL,
                    prompt_tokens INT NULL,
                    output_tokens INT NULL,
                    total_tokens INT NULL,
                    created_at DATETIME NOT NULL,
                    INDEX idx_user_time (user_id, created_at),
                    INDEX idx_device_time (device_id, created_at),
                    INDEX idx_time (created_at)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS user_quota (
                    user_id INT PRIMARY KEY,
                    plan VARCHAR(16) NOT NULL DEFAULT 'free',
                    weekly_limit INT NULL,
                    daily_cap INT NULL,
                    note VARCHAR(255) NULL,
                    updated_by INT NULL,
                    updated_at DATETIME NOT NULL
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            # 이미 만들어진 llm_usage 에 토큰 컬럼이 없으면 채운다.
            # 크레딧만으로는 "환산이 맞는지"를 검증할 수 없다 — 실제로 몇 토큰을
            # 썼는지 남겨야 나중에 크레딧 가중치나 유료 전환 원가를 근거로 정할 수 있다.
            for col, ddl in (
                ("model", "VARCHAR(48) NULL"),
                ("images", "INT NULL"),
                ("prompt_tokens", "INT NULL"),
                ("output_tokens", "INT NULL"),
                ("total_tokens", "INT NULL"),
            ):
                cursor.execute(f"SHOW COLUMNS FROM llm_usage LIKE '{col}'")
                if not cursor.fetchone():
                    cursor.execute(f"ALTER TABLE llm_usage ADD COLUMN {col} {ddl}")

            # 어드민 구분. 이미 있으면 조용히 넘어간다.
            cursor.execute("SHOW COLUMNS FROM users LIKE 'is_admin'")
            if not cursor.fetchone():
                cursor.execute(
                    "ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0"
                )
            db.commit()
            _ddl_done = True
        finally:
            cursor.close()
            db.close()


def _limits_for(cursor, user_id):
    """이 사용자에게 적용할 (plan, 주 한도, 일 상한).

    `user_quota` 에 행이 없으면 free 기본값. 행이 있어도 `weekly_limit` 이
    NULL 이면 플랜 기본값을 쓴다 — 어드민이 "plus 로만 올리고 숫자는 기본값"
    같은 조합을 쓸 수 있게.
    """
    plans = _plans()
    if user_id is None:
        weekly, daily = plans["guest"]
        return "guest", weekly, daily

    cursor.execute(
        "SELECT plan, weekly_limit, daily_cap FROM user_quota WHERE user_id = %s",
        (user_id,),
    )
    row = cursor.fetchone()
    plan = "free"
    weekly = daily = None
    if row:
        # DictCursor / 튜플 커서 양쪽에서 동작하게 한다.
        if isinstance(row, dict):
            plan = (row.get("plan") or "free").strip() or "free"
            weekly, daily = row.get("weekly_limit"), row.get("daily_cap")
        else:
            plan = (row[0] or "free").strip() or "free"
            weekly, daily = row[1], row[2]

    base_weekly, base_daily = plans.get(plan, plans["free"])
    return plan, (weekly if weekly is not None else base_weekly), (
        daily if daily is not None else base_daily
    )


def _used(cursor, user_id, device_id, since):
    """`since` 이후 쓴 크레딧 합. 회원은 user_id, 비회원은 device_id 로 센다."""
    if user_id is not None:
        cursor.execute(
            "SELECT COALESCE(SUM(credits), 0) FROM llm_usage "
            "WHERE user_id = %s AND created_at >= %s",
            (user_id, since),
        )
    elif device_id:
        cursor.execute(
            "SELECT COALESCE(SUM(credits), 0) FROM llm_usage "
            "WHERE user_id IS NULL AND device_id = %s AND created_at >= %s",
            (device_id, since),
        )
    else:
        return 0
    row = cursor.fetchone()
    if row is None:
        return 0
    value = list(row.values())[0] if isinstance(row, dict) else row[0]
    return int(value or 0)


def status(get_db, user_id=None, device_id=None):
    """지금 남은 양. 화면 표시(`/api/usage`)와 차감 판정이 같은 함수를 쓴다."""
    ensure_tables(get_db)
    now = datetime.now(KST)
    db = get_db()
    cursor = db.cursor()
    try:
        plan, weekly_limit, daily_cap = _limits_for(cursor, user_id)
        naive_week = week_start(now).replace(tzinfo=None)
        naive_day = day_start(now).replace(tzinfo=None)
        weekly_used = _used(cursor, user_id, device_id, naive_week)
        daily_used = _used(cursor, user_id, device_id, naive_day)
    finally:
        cursor.close()
        db.close()

    return {
        "plan": plan,
        "weekly_limit": weekly_limit,
        "weekly_used": weekly_used,
        "weekly_remaining": max(0, weekly_limit - weekly_used),
        "daily_cap": daily_cap,
        "daily_used": daily_used,
        "daily_remaining": max(0, daily_cap - daily_used),
        "resets_at": next_week_start(now).isoformat(),
        "credits": dict(CREDITS),
        "is_guest": user_id is None,
    }


def consume(get_db, kind, user_id=None, device_id=None, detail=None):
    """한도를 확인하고 크레딧을 차감한다. 초과면 `QuotaDenied`.

    호출 **전에** 부른다. 차감해 놓고 LLM 호출이 실패하면 크레딧이 날아가지만,
    반대(먼저 호출하고 나중에 차감)는 한도를 넘겨 쓰게 두는 것이라 더 나쁘다.
    실패가 잦아지면 그때 환불(음수 행)을 넣는다.
    """
    cost = CREDITS.get(kind, 1)
    st = status(get_db, user_id=user_id, device_id=device_id)

    if st["daily_used"] + cost > st["daily_cap"]:
        raise QuotaDenied("daily", st)
    if st["weekly_used"] + cost > st["weekly_limit"]:
        raise QuotaDenied("weekly", st)

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "INSERT INTO llm_usage (user_id, device_id, kind, credits, detail, created_at) "
            "VALUES (%s, %s, %s, %s, %s, %s)",
            (
                user_id,
                (device_id or None) and str(device_id)[:64],
                str(kind)[:16],
                cost,
                (str(detail)[:64] if detail else None),
                datetime.now(KST).replace(tzinfo=None),
            ),
        )
        usage_id = cursor.lastrowid
        db.commit()
    finally:
        cursor.close()
        db.close()

    # 호출이 끝난 뒤 attach_tokens(get_db, usage_id) 로 실측 토큰을 붙인다.
    st["usage_id"] = usage_id
    st["weekly_used"] += cost
    st["daily_used"] += cost
    st["weekly_remaining"] = max(0, st["weekly_limit"] - st["weekly_used"])
    st["daily_remaining"] = max(0, st["daily_cap"] - st["daily_used"])
    return st


def denied_message(exc):
    """한도 초과 안내. 막다른 길로 끝내지 않고 다음 행동을 알려 준다."""
    st = exc.status
    if exc.scope == "daily":
        return f"오늘 쓸 수 있는 만큼을 다 쓰셨어요. 내일 다시 이어서 쓸 수 있어요. (하루 {st['daily_cap']})"
    if st.get("is_guest"):
        return (
            f"이번 주 무료 사용량({st['weekly_limit']})을 다 쓰셨어요. "
            "로그인하면 훨씬 넉넉하게 쓸 수 있어요."
        )
    return (
        f"이번 주 사용량({st['weekly_limit']})을 다 쓰셨어요. 월요일에 다시 채워져요. "
        "더 필요하시면 마이페이지에서 알려 주세요."
    )
