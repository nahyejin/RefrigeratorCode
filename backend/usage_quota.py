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

import hashlib
import os
import threading
from datetime import datetime, timedelta, timezone

KST = timezone(timedelta(hours=9))

# 행동별 크레딧. 환산 근거는 USAGE_QUOTA_PLAN.md "3. 크레딧 환산" 참고.
CREDITS = {
    "chat": int(os.getenv("CREDITS_CHAT", "1")),
    "vision": int(os.getenv("CREDITS_VISION", "2")),
    # 식단 짜기. 셋 중 **가장 무겁다.**
    #  - 후보 300개를 DB 에서 추리고, 장보기가 가장 적어지는 조합을 그리디로 좁힌다
    #  - 그 목록을 프롬프트에 다 실어 보낸다(제목 + 재료 전체)
    #  - 받는 것도 일곱 끼 + 날짜별 이유 + 요약까지라 출력 토큰이 길다
    # 사진 한 장(vision=2)이나 짧은 한 턴(chat=1)과 같은 값을 매길 이유가 없다.
    "plan": int(os.getenv("CREDITS_PLAN", "3")),
}


# ── 크레딧 지급 정책 ──────────────────────────────────────────────
#
# **매주 채워 주는 방식에서 잔액 방식으로 바꿨다.**
#
# 매주 30개가 그냥 새로 생기면 다 쓸 일이 없다. 부족함을 못 느끼니 결제할 이유도
# 영영 안 생긴다. 잔액은 **소진된다** — 부족한 그 순간이 실제로 오고, 그때가
# 팔기 가장 좋은 순간이다.
#
# 그래도 매주 조금은 준다. 잔액이 완전히 0이 되면 앱을 아예 안 열게 되고,
# 앱을 안 열면 결제도 안 한다.

SIGNUP_CREDITS = int(os.getenv("CREDITS_SIGNUP", "30"))   # 가입할 때 한 번
WEEKLY_CREDITS = int(os.getenv("CREDITS_WEEKLY", "5"))    # 매주 월요일

# 비회원 체험분. **기기당 한 번**이고 다시 채워지지 않는다.
#
# 왜 0이 아니라 5인가:
#   "로그인하면 쓸 수 있어요" 만으로는 가입할 이유가 안 된다. 무엇이 좋은지
#   본 적이 없으니까. 5는 우연한 숫자가 아니라 **세 기능을 한 번씩 써 볼 수 있는
#   양**이다 — 사진 인식 2 + 식단 2 + 챗봇 1.
#
#   다 쓰고 나면 그때 "가입하면 30개" 라고 말한다. 그 순간이 가입 의사가 가장
#   높은 때다. 아무것도 안 써 본 사람에게 가입하라는 것보다 훨씬 낫다.
#
# 어뷰징: 앱을 지우면 기기 식별자가 새로 생겨 다시 5를 받는다. 막을 수 없고,
#   5개 때문에 그 수고를 할 사람도 적다.
GUEST_TRIAL_CREDITS = int(os.getenv("CREDITS_GUEST_TRIAL", "5"))


def _daily_caps():
    """플랜별 하루 상한. 잔액을 하루에 다 태우는 걸 막는 안전장치다.

    잔액이 있어도 하루에 몰아 쓰면 "어제 다 써 버려서 오늘 못 쓴다" 가 되는데,
    그 경험은 한도가 있다는 사실보다 앱을 더 나쁘게 기억하게 만든다.
    """
    return {
        # 비회원은 체험분(5)이 전부라 하루 상한이 따로 필요 없다.
        # 그래도 한 번에 다 태우지는 않게 3으로 둔다 — 사진 한 번(2)에 챗봇
        # 한 번(1)이면 그날 몫이고, 다음 날 식단을 써 볼 여지가 남는다.
        "guest": int(os.getenv("QUOTA_GUEST_DAILY", "3")),
        "free": int(os.getenv("QUOTA_FREE_DAILY", "15")),
        "plus": int(os.getenv("QUOTA_PLUS_DAILY", "50")),
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

    # ⚠️ 본문을 읽는 순서에 주의.
    # `request.form` 을 먼저 건드리면 werkzeug 가 본문을 폼으로 파싱하면서
    # **입력 스트림을 소비**한다. 그러면 뒤이어 부르는 `request.get_json()` 이
    # 빈 값을 돌려주고, 그걸 쓰는 엔드포인트가 조용히 아무것도 안 하게 된다
    # (실제로 이벤트 수집이 그렇게 "성공했는데 0건" 이 됐다).
    # 그래서 헤더를 먼저 보고, 본문은 형식에 맞는 쪽만 본다.
    device_id = request.headers.get('X-Device-Id') or ''
    if not device_id:
        if request.is_json:
            device_id = (request.get_json(silent=True) or {}).get('device_id') or ''
        elif request.mimetype in ('application/x-www-form-urlencoded', 'multipart/form-data'):
            device_id = request.form.get('device_id') or ''
    device_id = str(device_id).strip()[:64] or None

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

            # 한도를 더 달라는 요청. 결제 대신 **사람이 처리**하는 창구다
            # (USAGE_QUOTA_PLAN.md 6절 — 지금은 결제를 붙이지 않는다).
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS credit_grants (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    amount INT NOT NULL,
                    reason VARCHAR(16) NOT NULL,      -- signup / weekly / topup / admin
                    period_key VARCHAR(16) NOT NULL,  -- 'once' 또는 '2026-W36'
                    note VARCHAR(255) NULL,
                    created_at DATETIME NOT NULL,
                    -- 같은 사유·같은 기간의 지급은 한 번뿐이다.
                    -- 이게 없으면 화면을 새로고침할 때마다 주간 지급이 쌓인다.
                    UNIQUE KEY uniq_grant (user_id, reason, period_key),
                    INDEX idx_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS credit_identity_claims (
                    fingerprint VARCHAR(96) PRIMARY KEY,
                    user_id INT NOT NULL,
                    created_at DATETIME NOT NULL,
                    INDEX idx_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )
            cursor.execute(
                """
                CREATE TABLE IF NOT EXISTS usage_requests (
                    id BIGINT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT NOT NULL,
                    message VARCHAR(500) NULL,
                    status VARCHAR(16) NOT NULL DEFAULT 'open',  -- open | done | rejected
                    created_at DATETIME NOT NULL,
                    handled_by INT NULL,
                    handled_at DATETIME NULL,
                    INDEX idx_status_time (status, created_at),
                    INDEX idx_user (user_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
                """
            )

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


def _plan_of(cursor, user_id):
    """이 사용자의 (plan, 하루 상한).

    `user_quota` 에 행이 없으면 free. 행이 있어도 `daily_cap` 이 NULL 이면
    플랜 기본값을 쓴다 — 어드민이 "plus 로만 올리고 숫자는 기본값" 을 쓸 수 있게.
    """
    caps = _daily_caps()
    if user_id is None:
        return "guest", caps["guest"]

    cursor.execute(
        "SELECT plan, daily_cap FROM user_quota WHERE user_id = %s", (user_id,)
    )
    row = cursor.fetchone()
    plan, daily = "free", None
    if row:
        # DictCursor / 튜플 커서 양쪽에서 동작하게 한다.
        if isinstance(row, dict):
            plan = (row.get("plan") or "free").strip() or "free"
            daily = row.get("daily_cap")
        else:
            plan = (row[0] or "free").strip() or "free"
            daily = row[1]
    return plan, (daily if daily is not None else caps.get(plan, caps["free"]))


def _scalar(row):
    if row is None:
        return 0
    value = list(row.values())[0] if isinstance(row, dict) else row[0]
    return int(value or 0)


def _fingerprints(email=None, provider=None, provider_id=None, device_id=None):
    """이 사람을 알아볼 지문들.

    가입 크레딧을 **한 사람에게 한 번만** 주기 위한 것이다. 탈퇴하고 다시
    가입하거나 이메일만 바꿔 가입해도 같은 지문이 걸리면 다시 안 준다.

    완벽하게는 못 막는다 — 앱을 지우고 다른 이메일로 가입하면 뚫린다.
    목표는 "쉽게는 못 하게" 이고, 무료분이 30개라 그 수고를 들일 사람은 적다.
    """
    marks = []
    if provider and provider_id:
        # 소셜 로그인은 이게 제일 단단하다. 이메일을 바꿔도 provider_id 는 그대로다.
        marks.append(f"p:{str(provider).strip().lower()}:{str(provider_id).strip()}"[:96])
    if email:
        marks.append("e:" + _email_key(email))
    if device_id:
        marks.append(f"d:{str(device_id).strip()}"[:96])
    return marks


def _email_key(email):
    """이메일을 지문으로. 점·플러스 별칭으로 같은 주소를 여러 개처럼 쓰는 걸 막는다."""
    text = str(email or "").strip().lower()
    if "@" not in text:
        return hashlib.sha256(text.encode("utf-8")).hexdigest()[:40]
    local, domain = text.rsplit("@", 1)
    local = local.split("+", 1)[0]
    if domain in ("gmail.com", "googlemail.com"):
        local = local.replace(".", "")
    return hashlib.sha256(f"{local}@{domain}".encode("utf-8")).hexdigest()[:40]


def week_key(now=None):
    """주간 지급의 기간 키. 같은 주에 두 번 지급되지 않게 하는 열쇠다."""
    monday = week_start(now)
    return monday.strftime("%G-W%V")


def balance(cursor, user_id):
    """남은 크레딧 = 받은 것 − 쓴 것."""
    cursor.execute(
        "SELECT COALESCE(SUM(amount), 0) FROM credit_grants WHERE user_id = %s",
        (user_id,),
    )
    granted = _scalar(cursor.fetchone())
    cursor.execute(
        "SELECT COALESCE(SUM(credits), 0) FROM llm_usage WHERE user_id = %s",
        (user_id,),
    )
    used = _scalar(cursor.fetchone())
    return granted, used, granted - used


def _add_grant(cursor, user_id, amount, reason, period_key, note=None):
    """지급 한 건. 같은 사유·기간이 이미 있으면 아무 일도 안 한다."""
    cursor.execute(
        "INSERT IGNORE INTO credit_grants "
        "(user_id, amount, reason, period_key, note, created_at) "
        "VALUES (%s, %s, %s, %s, %s, %s)",
        (user_id, int(amount), str(reason)[:16], str(period_key)[:16],
         (str(note)[:255] if note else None),
         datetime.now(KST).replace(tzinfo=None)),
    )
    return cursor.rowcount > 0


def grant_signup(get_db, user_id, email=None, provider=None, provider_id=None,
                 device_id=None):
    """가입 크레딧을 한 번 준다. 이미 받은 적 있는 사람이면 건너뛴다.

    반환: (지급했는가, 사유)
    """
    ensure_tables(get_db)
    marks = _fingerprints(email, provider, provider_id, device_id)
    db = get_db()
    cursor = db.cursor()
    try:
        if marks:
            placeholders = ",".join(["%s"] * len(marks))
            cursor.execute(
                f"SELECT fingerprint, user_id FROM credit_identity_claims "
                f"WHERE fingerprint IN ({placeholders})",
                tuple(marks),
            )
            seen = cursor.fetchall() or []
            # 같은 사람이 다시 온 것. 이미 그 계정에 준 적이 있으니 또 주지 않는다.
            other = [r for r in seen
                     if (r["user_id"] if isinstance(r, dict) else r[1]) != user_id]
            if other:
                return False, "이미 크레딧을 받은 적이 있는 사용자예요."

        given = _add_grant(cursor, user_id, SIGNUP_CREDITS, "signup", "once",
                           "가입 축하")
        if given:
            now = datetime.now(KST).replace(tzinfo=None)
            for mark in marks:
                cursor.execute(
                    "INSERT IGNORE INTO credit_identity_claims "
                    "(fingerprint, user_id, created_at) VALUES (%s, %s, %s)",
                    (mark, user_id, now),
                )
        db.commit()
    finally:
        cursor.close()
        db.close()
    return (given, "지급했어요." if given else "이미 받은 계정이에요.")


def topup(get_db, user_id, amount, note=None, reason="topup", period_key=None):
    """크레딧을 보탠다. 결제가 붙기 전에는 어드민이 손으로 부른다."""
    ensure_tables(get_db)
    db = get_db()
    cursor = db.cursor()
    try:
        key = period_key or datetime.now(KST).strftime("%y%m%d%H%M%S")
        _add_grant(cursor, user_id, amount, reason, key, note)
        db.commit()
    finally:
        cursor.close()
        db.close()


def _ensure_weekly(cursor, user_id, now=None):
    """이번 주 몫을 아직 안 받았으면 준다. 표의 UNIQUE 가 중복을 막는다."""
    if not WEEKLY_CREDITS:
        return
    _add_grant(cursor, user_id, WEEKLY_CREDITS, "weekly", week_key(now), "주간 지급")


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
    """지금 남은 크레딧. 화면 표시(`/api/usage`)와 차감 판정이 같은 함수를 쓴다."""
    ensure_tables(get_db)
    now = datetime.now(KST)
    db = get_db()
    cursor = db.cursor()
    try:
        plan, daily_cap = _plan_of(cursor, user_id)
        if user_id is None:
            # 비회원 체험분. 지급 원장(credit_grants)은 회원용이라, 여기서는
            # **정해진 체험분에서 쓴 만큼 뺀다.** 기기 식별자 기준이다.
            granted = GUEST_TRIAL_CREDITS if device_id else 0
            used = _used(cursor, None, device_id, datetime(1970, 1, 1))
            left = granted - used
            daily_used = _used(cursor, None, device_id,
                               day_start(now).replace(tzinfo=None))
        else:
            # 화면을 열 때 이번 주 몫을 채워 준다. 따로 도는 배치를 두지 않는
            # 이유는, 안 쓰는 사람에게까지 매주 지급 행을 쌓을 이유가 없어서다.
            _ensure_weekly(cursor, user_id, now)
            db.commit()
            granted, used, left = balance(cursor, user_id)
            daily_used = _used(cursor, user_id, device_id,
                               day_start(now).replace(tzinfo=None))
    finally:
        cursor.close()
        db.close()

    return {
        "plan": plan,
        "is_guest": user_id is None,
        # 화면은 이 값 하나만 보면 된다.
        "can_use_ai": left > 0 and daily_used < daily_cap,
        "guest_trial": GUEST_TRIAL_CREDITS,
        "balance": max(0, left),
        "granted": granted,
        "used": used,
        "daily_cap": daily_cap,
        "daily_used": daily_used,
        "daily_remaining": max(0, daily_cap - daily_used),
        "weekly_credits": WEEKLY_CREDITS,
        "signup_credits": SIGNUP_CREDITS,
        "next_weekly_at": next_week_start(now).isoformat(),
        "credits": dict(CREDITS),
    }


def consume(get_db, kind, user_id=None, device_id=None, detail=None):
    """크레딧을 차감한다. 모자라면 `QuotaDenied`.

    호출 **전에** 부른다. 차감해 놓고 LLM 호출이 실패하면 크레딧이 날아가지만,
    반대(먼저 호출하고 나중에 차감)는 한도를 넘겨 쓰게 두는 것이라 더 나쁘다.
    실패가 잦아지면 그때 환불(음수 지급)을 넣는다.
    """
    cost = CREDITS.get(kind, 1)
    st = status(get_db, user_id=user_id, device_id=device_id)

    if st["daily_used"] + cost > st["daily_cap"]:
        raise QuotaDenied("daily", st)
    if cost > st["balance"]:
        raise QuotaDenied("balance", st)

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
    st["used"] += cost
    st["balance"] = max(0, st["balance"] - cost)
    st["daily_used"] += cost
    st["daily_remaining"] = max(0, st["daily_cap"] - st["daily_used"])
    st["can_use_ai"] = st["balance"] > 0 and st["daily_remaining"] > 0
    return st


def denied_message(exc):
    """막힌 이유와 **다음에 할 일**을 함께 말한다. 막다른 길로 끝내지 않는다."""
    st = exc.status
    guest = st.get("is_guest")
    if exc.scope == "daily":
        if guest:
            return (
                f"오늘 체험할 수 있는 만큼({st['daily_cap']})을 다 쓰셨어요. "
                f"가입하면 {SIGNUP_CREDITS}개를 바로 드려요."
            )
        return (
            f"오늘 쓸 수 있는 만큼({st['daily_cap']})을 다 쓰셨어요. "
            "내일 이어서 쓸 수 있어요."
        )
    if guest:
        # 체험을 다 쓴 **바로 그때**가 가입 의사가 가장 높은 순간이다.
        # "로그인하세요" 가 아니라 "얼마를 드린다" 로 말한다.
        return (
            f"체험 {GUEST_TRIAL_CREDITS}회를 다 쓰셨어요. "
            f"가입하면 {SIGNUP_CREDITS}개를 바로 드려요."
        )
    return (
        "크레딧을 다 쓰셨어요. 매주 월요일에 조금씩 채워지고, "
        "더 필요하시면 마이페이지에서 충전하거나 요청할 수 있어요."
    )


# ── 한도 추가 요청 ────────────────────────────────────────────────
#
# 결제를 붙이지 않기로 했으므로(USAGE_QUOTA_PLAN.md 6절), 더 필요한 사람은
# 관리자에게 말하고 관리자가 손으로 올려 준다. 이 표는 그 창구다.
#
# 부수 효과가 더 중요하다: **실제 수요가 있는지 측정된다.** 요청이 꾸준히
# 들어오기 시작하면 그때 결제를 붙일 근거가 생긴다.

def open_request(get_db, user_id):
    """이 사용자에게 아직 처리 안 된 요청이 있으면 그 행."""
    ensure_tables(get_db)
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "SELECT id, message, created_at FROM usage_requests "
            "WHERE user_id = %s AND status = 'open' ORDER BY created_at DESC LIMIT 1",
            (user_id,),
        )
        return cursor.fetchone()
    finally:
        cursor.close()
        db.close()


def create_request(get_db, user_id, message):
    """요청을 남긴다. 이미 대기 중이면 새로 만들지 않는다.

    같은 사람이 여러 번 눌러 목록이 지저분해지는 걸 막는다 — 관리자가 처리해야
    할 것은 "사람" 이지 "클릭 횟수" 가 아니다.
    """
    existing = open_request(get_db, user_id)
    if existing:
        return existing, False

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "INSERT INTO usage_requests (user_id, message, status, created_at) "
            "VALUES (%s, %s, 'open', %s)",
            (user_id, (str(message)[:500] if message else None),
             datetime.now(KST).replace(tzinfo=None)),
        )
        db.commit()
    finally:
        cursor.close()
        db.close()
    return open_request(get_db, user_id), True
