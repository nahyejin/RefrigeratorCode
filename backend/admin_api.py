"""어드민 API — `/api/admin/*`.

왜 별도 파일이고 왜 경로 앞머리를 따로 두나:
    지금은 사용자 앱과 **같은 서버·같은 프론트**에 얹혀 있다(관리자 1명, 사용자
    9명 규모에서 별도 어드민 앱은 과하다). 다만 나중에 떼어내기 쉬운 모양은
    처음부터 지킨다 — 어드민 엔드포인트를 `/api/admin/*` 로 몰아 두면 나중에
    프론트만 분리하거나 그 경로만 IP 제한/VPN 뒤로 넣을 수 있다.

    떼어내야 할 때의 신호는 사용자 수가 아니라 **관리자 수와 위험도**다.
    관리자가 여러 명이 되고, 되돌리기 어려운 작업(환불·계정 삭제)이 늘면
    그때 분리 + 감사 로그를 붙인다.

권한:
    `users.is_admin = 1` 인 계정만. 토큰은 사용자 앱과 같은 JWT 를 쓴다.
    권한 검사를 **모든 엔드포인트에서 서버가** 한다 — 프론트에서 메뉴를 숨기는
    것은 UI 편의일 뿐 보안이 아니다.
"""

import os
from datetime import datetime, timedelta

from flask import jsonify, request

import usage_quota


def _bearer_payload():
    auth = request.headers.get('Authorization') or ''
    if not auth.startswith('Bearer '):
        return None
    secret = os.getenv('JWT_SECRET_KEY') or os.getenv('SECRET_KEY')
    if not secret:
        return None
    try:
        import jwt

        return jwt.decode(auth.split(' ', 1)[1], secret, algorithms=['HS256'])
    except Exception:  # noqa: BLE001
        return None


def _bootstrap_emails():
    """언제나 관리자로 보는 이메일 목록 (환경변수 `ADMIN_EMAILS`, 쉼표 구분).

    왜 필요한가: 관리자 표시는 `users.is_admin` 한 곳에만 있어서, **그 계정이
    탈퇴하면 어드민에 들어갈 수 있는 사람이 아무도 없어진다.** 새로 지정하려면
    DB 를 직접 만져야 하는데, 그럴 수 없는 상황이 오면 손을 쓸 수 없다.
    환경변수로 열어 두면 그 이메일로 가입/로그인하는 것만으로 되돌릴 수 있다.

    ⚠️ 비밀번호가 아니라 **이메일 목록**이다. 그 이메일 계정에 로그인할 수 있는
    사람만 통과하므로, 값이 새어도 그 자체로는 권한이 되지 않는다.
    """
    raw = os.getenv('ADMIN_EMAILS') or ''
    return {e.strip().lower() for e in raw.split(',') if e.strip()}


def current_admin(get_db):
    """관리자면 (user_id, nickname), 아니면 None.

    토큰만 믿지 않고 **DB 의 is_admin 을 매번 확인**한다. 권한을 뺏은 뒤에도
    이미 발급된 토큰이 30일간 살아 있기 때문이다.
    """
    payload = _bearer_payload()
    if not payload:
        return None
    user_id = payload.get('user_id')
    if user_id is None:
        return None
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "SELECT id, nickname, email, is_admin FROM users WHERE id = %s AND deleted_at IS NULL",
            (user_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None

        if not row['is_admin']:
            # 비상 통로: ADMIN_EMAILS 에 있으면 통과시키고 표시도 붙여 둔다.
            # (다음부터는 DB 만 봐도 되게)
            if (row['email'] or '').lower() not in _bootstrap_emails():
                return None
            cursor.execute("UPDATE users SET is_admin = 1 WHERE id = %s", (row['id'],))
            db.commit()
            print(f"[admin] ADMIN_EMAILS 로 관리자 승격: id={row['id']} {row['email']}")

        return (row['id'], row['nickname'])
    finally:
        cursor.close()
        db.close()


def _clean_email(email):
    """탈퇴 계정의 `deleted+{id}+` 접두어를 떼어 원래 이메일을 보여준다.

    탈퇴할 때 이메일을 덮어쓰는 건 **의도된 동작**이다(같은 이메일로 다시 가입할
    수 있어야 해서 유니크 키를 풀어 준다). 원본을 따로 저장하지는 않으므로
    화면에서만 접두어를 벗겨 보여준다.
    """
    text = str(email or '')
    # `deleted+` = 사용자가 직접 탈퇴 / `merged+` = 중복 계정을 합치면서 닫음.
    # 둘 다 원래 주소를 보여줘야 어드민에서 누구인지 알 수 있다.
    if text.startswith('deleted+') or text.startswith('merged+'):
        parts = text.split('+', 2)
        if len(parts) == 3:
            return parts[2]
    return text


def _iso(value):
    """DATETIME 을 문자열로. 값이 없으면 None (화면에서 '아직 없음' 으로 처리)."""
    return value.isoformat() if value else None


# 방문 하나의 **유입 출처**. 그 방문에서 처음 본 utm_source 를 대표로 삼는다.
#
# 왜 "처음": 한 방문 안에서 출처가 바뀌는 경우(앱 안에서 링크를 또 타는 등)에도
# "이 사람을 데려온 건 무엇인가" 는 맨 처음 것이다. 나중 것으로 세면 광고 효과가
# 엉뚱한 곳으로 옮겨 붙는다.
#
# 출처가 아예 없는 방문은 버리지 않고 `(직접)` 으로 묶는다. 버리면 표의 합이
# 전체 방문과 안 맞아 "나머지는 어디 갔지" 를 매번 되짚게 된다.
_SESSION_SOURCE = """
  SELECT session_id,
         COALESCE(SUBSTRING_INDEX(GROUP_CONCAT(source ORDER BY created_at), ',', 1), '(직접)') src
  FROM user_events WHERE session_id IS NOT NULL GROUP BY session_id
"""


def _stats_range():
    """대시보드가 볼 기간 — `(시작, 끝)`. 둘 다 None 이면 전체 기간.

    `?days=7` 또는 `?from=2026-09-01&to=2026-09-03` 로 받는다.
    화면 위 한 곳에서 고르고 **모든 카드가 같은 기간을 본다** — 카드마다 기간이
    다르면 숫자를 나란히 놓고 비교할 수가 없다.
    """
    args = request.args
    days = args.get('days')
    if days:
        try:
            n = max(1, int(days))
        except (TypeError, ValueError):
            return None, None
        start = (datetime.now() - timedelta(days=n - 1)).replace(
            hour=0, minute=0, second=0, microsecond=0)
        return start, None

    def parse(text):
        if not text:
            return None
        try:
            return datetime.strptime(text[:10], '%Y-%m-%d')
        except ValueError:
            return None

    start = parse(args.get('from'))
    end = parse(args.get('to'))
    if end:
        # 끝 날짜는 **그날을 포함**한다. 사용자는 "9/3까지" 라고 하면 9/3 저녁까지를
        # 말하는 것이지 9/3 0시를 말하는 게 아니다.
        end = end.replace(hour=23, minute=59, second=59)
    return start, end


def _excluded(get_db):
    """집계에서 뺄 계정과 기기.

    왜 지우지 않고 빼나:
        만든 사람 본인의 계정이 여러 개고(테스트하며 만든 것들), 그 활동이
        통계를 통째로 덮는다. 그렇다고 **데이터를 지우면 되돌릴 수 없다** —
        나중에 "그때 그 세션이 뭐였지" 를 물어볼 수 없게 된다.
        표시만 해 두고 볼 때 빼는 편이 안전하다.

    기기까지 빼는 이유:
        로그인 전에 남은 기록은 `user_id` 가 없다. 계정만 빼면 그 사람이
        비회원으로 돌아다닌 기록이 그대로 남는다.
    """
    # 화면에서 "내 활동 빼고 보기" 를 끄면 아무것도 빼지 않는다.
    # 표시는 그대로 두고 **보는 방식만** 바꾸는 것이라, 껐다 켰다 해도 안전하다.
    if request.args.get('keep_excluded'):
        return [], []

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("SHOW COLUMNS FROM users LIKE 'exclude_from_stats'")
        if not cursor.fetchone():
            return [], []
        cursor.execute("SELECT id FROM users WHERE exclude_from_stats = 1")
        ids = [r['id'] for r in cursor.fetchall()]
        devices = []
        if ids:
            cursor.execute("SHOW TABLES LIKE 'user_events'")
            if cursor.fetchone():
                marks = ",".join(["%s"] * len(ids))
                cursor.execute(
                    f"SELECT DISTINCT device_id FROM user_events "
                    f"WHERE user_id IN ({marks}) AND device_id IS NOT NULL",
                    tuple(ids),
                )
                devices = [r['device_id'] for r in cursor.fetchall()]
    finally:
        cursor.close()
        db.close()
    return ids, devices


def _where(column, start, end, ids=None, devices=None,
           user_col='user_id', device_col=None):
    """`(조건문, 값들)` 을 만든다. 조건이 없으면 빈 문자열.

    질의마다 손으로 이어 붙이면 한 군데를 빠뜨리게 된다 — 그러면 어떤 카드만
    필터가 안 걸려서, 같은 화면의 숫자끼리 앞뒤가 안 맞는다.
    """
    parts, params = [], []
    if start:
        parts.append(f"{column} >= %s")
        params.append(start)
    if end:
        parts.append(f"{column} <= %s")
        params.append(end)
    if ids:
        marks = ",".join(["%s"] * len(ids))
        parts.append(f"({user_col} IS NULL OR {user_col} NOT IN ({marks}))")
        params.extend(ids)
    if devices and device_col:
        marks = ",".join(["%s"] * len(devices))
        parts.append(f"({device_col} IS NULL OR {device_col} NOT IN ({marks}))")
        params.extend(devices)
    return (" AND " + " AND ".join(parts) if parts else ""), params


def register(app, get_db):
    """앱에 어드민 라우트를 붙인다. app.py 에서 한 번 호출한다."""

    def guard():
        admin = current_admin(get_db)
        if not admin:
            return None, (jsonify({'error': '권한이 없습니다.'}), 403)
        return admin, None

    @app.route('/api/admin/me', methods=['GET'])
    def admin_me():
        """관리자인지 확인. 프론트가 /admin 진입 여부를 정할 때 쓴다."""
        admin = current_admin(get_db)
        if not admin:
            return jsonify({'is_admin': False}), 200
        return jsonify({'is_admin': True, 'user_id': admin[0], 'nickname': admin[1]})

    @app.route('/api/admin/users', methods=['GET'])
    def admin_users():
        """사용자 목록 — 가입/탈퇴/재료 수/식구 그룹/이번 주 사용량/플랜.

        재료 수와 사용량은 다른 표에 있어 **조인해야** 나온다. 목록에서 이게
        안 보이면 "이 사람이 실제로 쓰고 있는지"를 알 수 없어서 어드민의 쓸모가
        절반으로 준다.
        """
        _, err = guard()
        if err:
            return err

        usage_quota.ensure_tables(get_db)
        week_start = usage_quota.week_start().replace(tzinfo=None)
        day_start = usage_quota.day_start().replace(tzinfo=None)
        keyword = (request.args.get('q') or '').strip()
        include_deleted = (request.args.get('deleted') or '') == '1'

        where = [] if include_deleted else ['u.deleted_at IS NULL']
        # 주 한도와 일 상한은 **따로** 걸린다. 주간만 보여주면 "주간은 남았는데
        # 왜 막히지?" 를 설명할 수 없다 — 오늘 쓴 양도 함께 본다.
        params = [week_start, week_start, day_start]
        if keyword:
            where.append('(u.email LIKE %s OR u.nickname LIKE %s)')
            like = f'%{keyword}%'
            params += [like, like]
        where_sql = ('WHERE ' + ' AND '.join(where)) if where else ''

        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                f"""
                SELECT u.id, u.email, u.nickname, u.provider, u.created_at,
                       u.deleted_at, u.household_id, u.is_admin,
                       COALESCE(u.exclude_from_stats, 0) AS exclude_from_stats,
                       COALESCE(q.plan, 'free')  AS plan,
                       q.daily_cap, q.note,
                       (SELECT COALESCE(SUM(g.amount), 0) FROM credit_grants g
                         WHERE g.user_id = u.id) AS granted,
                       (SELECT COALESCE(SUM(l.credits), 0) FROM llm_usage l
                         WHERE l.user_id = u.id) AS used_total,
                       (SELECT COUNT(*) FROM user_ingredients i WHERE i.user_id = u.id)
                           AS ingredient_count,
                       (SELECT COALESCE(SUM(l.credits), 0) FROM llm_usage l
                         WHERE l.user_id = u.id AND l.created_at >= %s)
                           AS week_credits,
                       (SELECT COALESCE(SUM(l.total_tokens), 0) FROM llm_usage l
                         WHERE l.user_id = u.id AND l.created_at >= %s)
                           AS week_tokens,
                       (SELECT COALESCE(SUM(l.credits), 0) FROM llm_usage l
                         WHERE l.user_id = u.id AND l.created_at >= %s)
                           AS today_credits
                FROM users u
                LEFT JOIN user_quota q ON q.user_id = u.id
                {where_sql}
                ORDER BY u.created_at DESC
                LIMIT 300
                """,
                tuple(params),
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()
            db.close()

        caps = usage_quota._daily_caps()
        users = []
        for r in rows:
            plan = r['plan'] or 'free'
            base_daily = caps.get(plan, caps['free'])
            users.append({
                'id': r['id'],
                'email': _clean_email(r['email']),
                'nickname': r['nickname'],
                'provider': r['provider'],
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'deleted_at': r['deleted_at'].isoformat() if r['deleted_at'] else None,
                'household_id': r['household_id'],
                'is_admin': bool(r['is_admin']),
                'exclude_from_stats': bool(r['exclude_from_stats']),
                'plan': plan,
                'daily_cap': r['daily_cap'] if r['daily_cap'] is not None else base_daily,
                'granted': int(r['granted'] or 0),
                'used_total': int(r['used_total'] or 0),
                'balance': int(r['granted'] or 0) - int(r['used_total'] or 0),
                'note': r['note'],
                'ingredient_count': int(r['ingredient_count'] or 0),
                'week_credits': int(r['week_credits'] or 0),
                'week_tokens': int(r['week_tokens'] or 0),
                'today_credits': int(r['today_credits'] or 0),
            })
        # 한도 정책을 화면에 같이 내려준다.
        #
        # 화면에 숫자를 하드코딩하면 환경변수로 값을 바꿨을 때 **화면만 옛 숫자를
        # 말하게 된다.** 관리자가 그걸 보고 정책을 정하면 어긋난다.
        # 그래서 서버가 지금 실제로 쓰는 값을 그대로 내려보낸다.
        policy = {
            'signup_credits': usage_quota.SIGNUP_CREDITS,
            'weekly_credits': usage_quota.WEEKLY_CREDITS,
            'plans': [
                {'key': key, 'daily': daily}
                for key, daily in usage_quota._daily_caps().items()
            ],
            'credits': dict(usage_quota.CREDITS),
            'resets_at': usage_quota.next_week_start().isoformat(),
        }
        return jsonify({'users': users, 'week_start': week_start.isoformat(), 'policy': policy})

    @app.route('/api/admin/users/<int:user_id>/quota', methods=['PUT'])
    def admin_set_quota(user_id):
        """한도를 수동으로 조정한다.

        `note` 를 **필수**로 받는다. 왜 올려줬는지 안 적으면 몇 달 뒤에 이 사람만
        왜 400인지 아무도 모른다. 누가 바꿨는지도 `updated_by` 에 남긴다.
        """
        admin, err = guard()
        if err:
            return err

        body = request.get_json(silent=True) or {}
        plan = (body.get('plan') or 'free').strip()
        if plan not in ('free', 'plus'):
            return jsonify({'error': "plan 은 'free' 또는 'plus' 여야 합니다."}), 400
        note = (body.get('note') or '').strip()
        if not note:
            return jsonify({'error': '왜 바꾸는지 메모를 남겨 주세요.'}), 400

        def as_int(value):
            if value in (None, '', 'null'):
                return None
            try:
                n = int(value)
            except (TypeError, ValueError):
                return None
            return n if n >= 0 else None

        daily = as_int(body.get('daily_cap'))
        # 크레딧은 한도가 아니라 **잔액**이라 "설정" 이 아니라 "지급" 이다.
        # 숫자를 덮어쓰게 두면 실수로 남의 잔액을 깎을 수 있다. 보태기만 한다.
        grant = as_int(body.get('grant_credits'))

        usage_quota.ensure_tables(get_db)
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO user_quota
                    (user_id, plan, daily_cap, note, updated_by, updated_at)
                VALUES (%s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    plan = VALUES(plan), daily_cap = VALUES(daily_cap),
                    note = VALUES(note),
                    updated_by = VALUES(updated_by), updated_at = NOW()
                """,
                (user_id, plan, daily, note[:255], admin[0]),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()

        if grant:
            usage_quota.topup(get_db, user_id, grant, note=note[:255], reason='admin')

        return jsonify(usage_quota.status(get_db, user_id=user_id))

    @app.route('/api/admin/users/<int:user_id>/stats-exclude', methods=['PUT'])
    def admin_set_stats_exclude(user_id):
        """이 계정을 대시보드 집계에서 뺄지.

        **데이터는 그대로 둔다.** 만든 사람 본인 계정이 여러 개라 통계를 덮는데,
        지우면 되돌릴 수 없다. 표시만 해 두고 볼 때 뺀다.
        """
        _, err = guard()
        if err:
            return err
        exclude = bool((request.get_json(silent=True) or {}).get('exclude'))

        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("SHOW COLUMNS FROM users LIKE 'exclude_from_stats'")
            if not cursor.fetchone():
                cursor.execute(
                    "ALTER TABLE users ADD COLUMN exclude_from_stats TINYINT(1) NOT NULL DEFAULT 0"
                )
            cursor.execute(
                "UPDATE users SET exclude_from_stats = %s WHERE id = %s",
                (1 if exclude else 0, user_id),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()
        return jsonify({'ok': True, 'exclude_from_stats': exclude})

    @app.route('/api/admin/users/<int:user_id>/admin', methods=['PUT'])
    def admin_set_admin(user_id):
        """다른 사용자를 관리자로 지정하거나 해제한다.

        왜 필요한가: 관리자 표시가 계정 하나에만 있으면 **그 계정이 탈퇴할 때
        어드민에 들어갈 사람이 없어진다.** 떠나기 전에 후임을 지정할 수 있어야 한다.

        마지막 관리자는 스스로를 내릴 수 없다 — 내리는 순간 아무도 못 들어간다.
        (환경변수 ADMIN_EMAILS 로 되살릴 수는 있지만, 그건 비상 통로지 정상 절차가
         아니다. 실수로 잠기는 상황 자체를 만들지 않는다)
        """
        admin, err = guard()
        if err:
            return err

        make_admin = bool((request.get_json(silent=True) or {}).get('is_admin'))
        db = get_db()
        cursor = db.cursor()
        try:
            if not make_admin:
                cursor.execute(
                    "SELECT COUNT(*) n FROM users WHERE is_admin = 1 AND deleted_at IS NULL"
                )
                if (cursor.fetchone()['n'] or 0) <= 1:
                    return jsonify({
                        'error': '마지막 관리자는 해제할 수 없어요. 다른 사람을 먼저 지정해 주세요.'
                    }), 400

            cursor.execute(
                "UPDATE users SET is_admin = %s WHERE id = %s AND deleted_at IS NULL",
                (1 if make_admin else 0, user_id),
            )
            db.commit()
            print(f"[admin] {admin[0]} 가 사용자 {user_id} 의 관리자 권한을 "
                  f"{'부여' if make_admin else '해제'}")
        finally:
            cursor.close()
            db.close()
        return jsonify({'ok': True, 'is_admin': make_admin})

    @app.route('/api/admin/users/<int:user_id>/usage', methods=['GET'])
    def admin_user_usage(user_id):
        """한 사용자의 최근 사용 이력. 크레딧과 **실제 토큰**을 함께 본다."""
        _, err = guard()
        if err:
            return err

        usage_quota.ensure_tables(get_db)
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                SELECT kind, credits, detail, model, images,
                       prompt_tokens, output_tokens, total_tokens, created_at
                FROM llm_usage WHERE user_id = %s
                ORDER BY created_at DESC LIMIT 100
                """,
                (user_id,),
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()
            db.close()

        return jsonify({
            'usage': usage_quota.status(get_db, user_id=user_id),
            'history': [
                {**r, 'created_at': r['created_at'].isoformat() if r['created_at'] else None}
                for r in rows
            ],
        })

    @app.route('/api/admin/requests', methods=['GET'])
    def admin_requests():
        """한도 추가 요청 목록. 기본은 대기 중인 것만."""
        _, err = guard()
        if err:
            return err

        usage_quota.ensure_tables(get_db)
        status = (request.args.get('status') or 'open').strip()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                SELECT r.id, r.user_id, r.message, r.status, r.created_at,
                       r.handled_by, r.handled_at,
                       u.email, u.nickname, u.provider,
                       COALESCE(q.plan, 'free') AS plan
                FROM usage_requests r
                JOIN users u ON u.id = r.user_id
                LEFT JOIN user_quota q ON q.user_id = r.user_id
                WHERE (%s = 'all' OR r.status = %s)
                ORDER BY r.created_at DESC LIMIT 200
                """,
                (status, status),
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()
            db.close()

        return jsonify({'requests': [
            {
                **r,
                'email': _clean_email(r['email']),
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'handled_at': r['handled_at'].isoformat() if r['handled_at'] else None,
            }
            for r in rows
        ]})

    @app.route('/api/admin/requests/<int:request_id>', methods=['PUT'])
    def admin_handle_request(request_id):
        """요청을 처리 완료/거절로 닫는다. 한도 조정 자체는 별도 API 로 한다 —
        "올려 줬다" 와 "요청을 닫았다" 는 다른 일이라 섞지 않는다."""
        admin, err = guard()
        if err:
            return err

        body = request.get_json(silent=True) or {}
        status = (body.get('status') or '').strip()
        if status not in ('done', 'rejected', 'open'):
            return jsonify({'error': "status 는 'done' / 'rejected' / 'open' 이어야 합니다."}), 400

        usage_quota.ensure_tables(get_db)
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                "UPDATE usage_requests SET status=%s, handled_by=%s, "
                "handled_at=CASE WHEN %s='open' THEN NULL ELSE NOW() END WHERE id=%s",
                (status, admin[0], status, request_id),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()
        return jsonify({'ok': True, 'status': status})

    # ── 재료 사전 보강 ────────────────────────────────────────
    #
    # 사진에서 읽혔지만 사전에 없던 이름을 LLM 이 **제안**하고 관리자가 **승인**한다.
    # 바로 넣지 않는 이유는 사진 인식과 같다 — LLM 은 틀리고, 사전은 모든 사용자의
    # 레시피 매칭 기준이라 한 번 잘못 들어가면 영향이 넓다.

    @app.route('/api/admin/dictionary/misses', methods=['GET'])
    def admin_dictionary_misses():
        _, err = guard()
        if err:
            return err
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("SHOW TABLES LIKE 'ingredient_dictionary_misses'")
            if not cursor.fetchone():
                return jsonify({'misses': []})
            # 사진과 레시피 본문 양쪽을 합친 횟수로 줄을 세운다.
            #
            # 물량은 레시피 본문 쪽이 압도적이다(사진 수십 건 vs 본문 수만 건).
            # 사진 것만 보고 있으면 정작 고쳐야 할 이름은 화면에 뜨지도 않는다.
            # 몇 회 이상만 볼지. 한 번만 나온 이름이 전체의 3분의 2였는데,
            # 그건 대개 오타이거나 어쩌다 한 번 쓰인 말이라 볼 값어치가 없다.
            try:
                min_hits = max(1, int(request.args.get('min_hits', 2)))
            except ValueError:
                min_hits = 2

            # 몇 개가 남아 있는지 **먼저** 센다. 화면은 300개만 보여 주는데,
            # 그 사실을 안 알려 주면 "처리해도 계속 300개가 나온다" 로 보인다.
            cursor.execute(
                "SELECT COUNT(*) n, "
                "  SUM(hit_count + COALESCE(recipe_hits,0) >= %s) shown "
                "FROM ingredient_dictionary_misses WHERE COALESCE(dismissed, 0) = 0",
                (min_hits,),
            )
            counts = cursor.fetchone() or {}

            cursor.execute(
                "SELECT raw_name, hit_count, COALESCE(recipe_hits, 0) recipe_hits, "
                "       hit_count + COALESCE(recipe_hits, 0) AS total_hits, "
                "       last_mode, first_seen, last_seen "
                "FROM ingredient_dictionary_misses "
                "WHERE COALESCE(dismissed, 0) = 0 "
                "  AND hit_count + COALESCE(recipe_hits, 0) >= %s "
                "ORDER BY total_hits DESC, last_seen DESC LIMIT 300",
                (min_hits,),
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()
            db.close()

        # 그 사이 사전이 보강돼 이제는 잡히는 것도 있다. 구분해 줘야 헛일을 안 한다.
        try:
            from ingredient_dictionary import get_alias_to_canonical, resolve_canonical

            alias = get_alias_to_canonical()
        except Exception:  # noqa: BLE001
            alias = None

        out = []
        for r in rows:
            resolved = None
            if alias:
                try:
                    resolved = resolve_canonical(r['raw_name'], alias)
                except Exception:  # noqa: BLE001
                    resolved = None
            out.append({
                'raw_name': r['raw_name'],
                'hit_count': r['hit_count'],
                'last_mode': r['last_mode'],
                'last_seen': r['last_seen'].isoformat() if r['last_seen'] else None,
                'now_resolves_to': resolved,
            })
        return jsonify({
            'misses': out,
            # 화면이 "지금 무엇을 보고 있는지" 말할 수 있게 같이 내려 준다.
            'total': int(counts.get('n') or 0),          # 치우지 않은 것 전부
            'matching': int(counts.get('shown') or 0),   # 그중 이 기준에 드는 것
            'shown': len(out),                            # 실제로 보내는 줄 수
            'min_hits': min_hits,
        })

    @app.route('/api/admin/dictionary/suggest', methods=['POST'])
    def admin_dictionary_suggest():
        """고른 이름들을 어떻게 처리할지 LLM 에게 물어본다. **쓰지는 않는다.**"""
        _, err = guard()
        if err:
            return err
        body = request.get_json(silent=True) or {}
        names = body.get('names') or []
        force = body.get('force')
        if force not in ('keyword', 'synonym'):
            force = None
        try:
            import dictionary_curation

            return jsonify({'suggestions': dictionary_curation.suggest(names, force_decision=force)})
        except RuntimeError as e:
            print(f"[dictionary] 설정 오류: {e}", flush=True)
            return jsonify({'error': 'LLM 키가 설정되지 않았습니다.'}), 503
        except Exception as e:  # noqa: BLE001
            import traceback

            traceback.print_exc()
            # `HTTPError` 같은 예외 이름을 그대로 보여주면 관리자는 무엇을
            # 해야 할지 알 수 없다. 무엇이 잘못됐고 어떻게 하면 되는지를 말한다.
            status = getattr(getattr(e, 'response', None), 'status_code', None)
            if status == 429:
                message = '요청이 몰렸거나 오늘 한도를 다 썼어요. 잠시 뒤에 다시 눌러 주세요.'
            elif status and 500 <= status < 600:
                message = 'AI 쪽이 잠시 불안정해요. 잠시 뒤에 다시 눌러 주세요.'
            elif status:
                message = f'AI 호출이 거부됐어요 ({status}). 키 설정을 확인해 주세요.'
            else:
                message = f'제안을 받지 못했어요 ({type(e).__name__}). 잠시 뒤에 다시 눌러 주세요.'
            return jsonify({'error': message}), 502

    @app.route('/api/admin/dictionary/options', methods=['GET'])
    def admin_dictionary_options():
        """화면에서 판단을 고칠 때 쓸 선택지 — 쓸 수 있는 분류와 대표어 목록.

        관리자가 LLM 의 제안을 고칠 수 있어야 하는데, 그러려면 **무엇을 고를 수
        있는지**가 화면에 있어야 한다. 없으면 결국 제안을 그대로 승인하게 된다.
        """
        _, err = guard()
        if err:
            return err
        try:
            import dictionary_curation

            return jsonify(dictionary_curation.options())
        except Exception as e:  # noqa: BLE001
            print(f"[dictionary] 선택지 조회 실패: {e}", flush=True)
            return jsonify({'paths': [], 'keywords': []})

    @app.route('/api/admin/dictionary/apply', methods=['POST'])
    def admin_dictionary_apply():
        """승인된 제안을 사전에 반영한다 (DB 에 쌓고 즉시 사전에 합쳐진다)."""
        admin, err = guard()
        if err:
            return err
        items = (request.get_json(silent=True) or {}).get('items') or []
        try:
            import dictionary_curation

            saved = dictionary_curation.apply_items(get_db, items, admin[0])
            return jsonify({'saved': saved})
        except Exception as e:  # noqa: BLE001
            print(f"[dictionary] 반영 실패: {e}", flush=True)
            return jsonify({'error': '반영하지 못했어요.'}), 502

    @app.route('/api/admin/dictionary/misses', methods=['DELETE'])
    def admin_dictionary_drop_misses():
        """사전에 넣지 않기로 한 이름을 목록에서 치운다.

        요리 이름·주류 브랜드처럼 **일부러 안 넣는 것**이 계속 목록에 남아 있으면
        볼 때마다 다시 판단하게 된다.

        예전엔 여기서 행을 **물리적으로 DELETE**했는데, 레시피 배치가 매일
        수만 건을 새로 훑다 보니 지운 이름을 며칠 안에 또 만나기 마련이고,
        그러면 `record_recipe_misses`의 INSERT ... ON DUPLICATE KEY가 새
        행으로 되살려 놨다 — 지운 게 계속 부활하는 것처럼 보였다.
        이제는 지우는 대신 `dismissed=1`만 세워 둔다. 같은 이름이 다시
        잡혀도 ON DUPLICATE KEY UPDATE는 hit_count/last_seen만 갱신하고
        dismissed는 그대로 두므로, 한 번 치운 이름은 계속 안 보인다.
        """
        _, err = guard()
        if err:
            return err
        names = (request.get_json(silent=True) or {}).get('names') or []
        names = [str(n).strip() for n in names if str(n).strip()][:200]
        if not names:
            return jsonify({'deleted': 0})
        db = get_db()
        cursor = db.cursor()
        try:
            placeholders = ','.join(['%s'] * len(names))
            dismissed = cursor.execute(
                f"UPDATE ingredient_dictionary_misses SET dismissed = 1 "
                f"WHERE raw_name IN ({placeholders})",
                tuple(names),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()
        return jsonify({'deleted': dismissed})

    @app.route('/api/admin/dictionary/additions', methods=['GET'])
    def admin_dictionary_additions():
        """지금까지 사전에 보탠 것들. 저장소 CSV 로 접어 넣었는지도 함께 본다."""
        _, err = guard()
        if err:
            return err
        try:
            import dictionary_curation

            dictionary_curation.ensure_table(get_db)
        except Exception:  # noqa: BLE001
            return jsonify({'additions': []})
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                "SELECT raw_name, kind, keyword, 중분류, 소분류, reason, created_at, "
                "applied_to_csv, applied_at, apply_error "
                "FROM ingredient_dictionary_additions ORDER BY created_at DESC LIMIT 200"
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()
            db.close()
        return jsonify({'additions': [
            {**r,
             'created_at': r['created_at'].isoformat() if r['created_at'] else None,
             'applied_at': r['applied_at'].isoformat() if r.get('applied_at') else None}
            for r in rows
        ]})

    @app.route('/api/admin/dictionary/additions', methods=['DELETE'])
    def admin_dictionary_cancel_addition():
        """사전에 보탠 것을 되돌린다.

        잘못 넣었거나 사전 파일 반영이 계속 실패하는 항목을 치우기 위한 것이다.
        DB 에서 지우면 사전에서도 즉시 빠진다. 이미 사전 **파일**에 들어간 것은
        파일을 직접 고쳐야 하므로, 그 경우는 안내만 하고 지우지 않는다.
        """
        _, err = guard()
        if err:
            return err
        name = ((request.get_json(silent=True) or {}).get('raw_name') or '').strip()
        if not name:
            return jsonify({'error': '무엇을 되돌릴지 알려 주세요.'}), 400

        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                "SELECT applied_to_csv FROM ingredient_dictionary_additions WHERE raw_name = %s",
                (name,),
            )
            row = cursor.fetchone()
            if not row:
                return jsonify({'error': '이미 없는 항목이에요.'}), 404
            if row['applied_to_csv']:
                return jsonify({
                    'error': '이미 사전 파일에 들어간 항목이라 여기서는 못 지워요. '
                             '사전 CSV 를 직접 고쳐 주세요.'
                }), 400
            cursor.execute(
                "DELETE FROM ingredient_dictionary_additions WHERE raw_name = %s", (name,)
            )
            db.commit()
        finally:
            cursor.close()
            db.close()

        import ingredient_dictionary

        ingredient_dictionary.reset_cache()
        return jsonify({'ok': True})

    @app.route('/api/admin/maintenance', methods=['GET'])
    def admin_maintenance():
        """운영 상태 — 수기 관리 자료 · 자동 작업 · 배치 로그.

        서버는 이 값을 **만들지 않고 읽기만** 한다. 알고 싶은 것들(파일을 언제
        마지막으로 고쳤는지 = git 이력, 크롤러가 몇 시에 도는지 = 윈도우 작업
        스케줄러)이 전부 **개발 컴퓨터에만** 있기 때문이다.
        그쪽에서 매일 `scripts/report_ops_status.py --write` 로 적어 둔다.

        `generated_at` 을 함께 돌려주므로, 그 스크립트가 며칠 안 돌았으면
        화면에서 바로 보인다.
        """
        _, err = guard()
        if err:
            return err
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("SHOW TABLES LIKE 'ops_status'")
            if not cursor.fetchone():
                return jsonify({'status': None})
            cursor.execute("SELECT payload, updated_at FROM ops_status WHERE name = 'local'")
            row = cursor.fetchone()
        finally:
            cursor.close()
            db.close()
        if not row:
            return jsonify({'status': None})
        import json as _json

        try:
            payload = _json.loads(row['payload'])
        except Exception:  # noqa: BLE001
            return jsonify({'status': None})
        payload['recorded_at'] = row['updated_at'].isoformat() if row['updated_at'] else None
        return jsonify({'status': payload})

    @app.route('/api/admin/activity', methods=['GET'])
    def admin_activity():
        """사용자가 어디까지 오고 어디서 멈추는지.

        **지금 데이터로 알 수 있는 것과 없는 것을 구분해 둔다.**
        화면 진입·이탈 같은 것은 기록이 없어서 알 수 없다(그러려면 이벤트 로깅이
        따로 필요하다). 대신 이미 쌓이는 것들 — 재료를 넣었는지, 레시피에
        반응했는지, AI 를 써 봤는지 — 로 **단계별 도달률**을 만든다.
        어느 단계에서 사람이 줄어드는지가 곧 고쳐야 할 곳이다.
        """
        _, err = guard()
        if err:
            return err

        usage_quota.ensure_tables(get_db)
        start, end = _stats_range()
        ex_ids, ex_devices = _excluded(get_db)

        # 질의마다 손으로 이어 붙이면 한 군데를 빠뜨리게 되고, 그러면 어떤 카드만
        # 필터가 안 걸려 같은 화면의 숫자끼리 앞뒤가 안 맞는다. 조각을 미리 만든다.
        ev_cond, ev_params = _where('created_at', start, end, ex_ids, ex_devices,
                                    device_col='device_id')
        use_cond, use_params = _where('created_at', start, end, ex_ids, ex_devices,
                                      device_col='device_id')
        # 퍼널은 **그 기간에 가입한 사람**을 따라간다.
        #
        # 누적으로 세면 기간을 아무리 좁혀도 다섯 숫자가 안 움직여서, 화면 위쪽
        # 숫자만 바뀌고 아래는 그대로인 이상한 화면이 된다. 가입 코호트로 보면
        # "이 주에 들어온 사람 중 몇 명이 재료를 넣었나" 라는 답이 나온다.
        uid_cond = ""
        uid_params = []
        if start:
            uid_cond += " AND u.created_at >= %s"
            uid_params.append(start)
        if end:
            uid_cond += " AND u.created_at <= %s"
            uid_params.append(end)
        if ex_ids:
            marks = ",".join(["%s"] * len(ex_ids))
            uid_cond += f" AND u.id NOT IN ({marks})"
            uid_params.extend(ex_ids)

        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                f"SELECT COUNT(*) n FROM users u WHERE u.deleted_at IS NULL{uid_cond}",
                tuple(uid_params),
            )
            total = cursor.fetchone()['n'] or 0

            def count(sql, params=()):
                cursor.execute(sql, tuple(params))
                return cursor.fetchone()['n'] or 0

            steps = [
                ('가입', total, '탈퇴하지 않은 계정'),
                ('재료 등록', count(
                    "SELECT COUNT(DISTINCT i.user_id) n FROM user_ingredients i "
                    f"JOIN users u ON u.id = i.user_id AND u.deleted_at IS NULL{uid_cond}",
                    uid_params),
                 '냉장고에 재료를 하나라도 넣은 사람'),
                ('레시피 반응', count(
                    "SELECT COUNT(DISTINCT x.user_id) n FROM ("
                    "  SELECT user_id FROM user_favorite_recipes"
                    "  UNION SELECT user_id FROM user_completed_recipes"
                    "  UNION SELECT user_id FROM user_recorded_recipes) x "
                    f"JOIN users u ON u.id = x.user_id AND u.deleted_at IS NULL{uid_cond}",
                    uid_params),
                 '즐겨찾기·완료·기록 중 하나라도 한 사람'),
                ('AI 사용', count(
                    "SELECT COUNT(DISTINCT l.user_id) n FROM llm_usage l "
                    f"JOIN users u ON u.id = l.user_id AND u.deleted_at IS NULL{uid_cond}",
                    uid_params),
                 '챗봇이나 사진 인식을 써 본 사람'),
                ('식구 그룹', count(
                    "SELECT COUNT(*) n FROM users u "
                    f"WHERE u.household_id IS NOT NULL AND u.deleted_at IS NULL{uid_cond}",
                    uid_params),
                 '다른 사람과 냉장고를 공유하는 사람'),
            ]

            cursor.execute(
                "SELECT COUNT(*) n FROM users u WHERE u.deleted_at IS NOT NULL "
                f"AND u.email NOT LIKE 'merged+%%'{uid_cond}",
                tuple(uid_params),
            )
            churned = cursor.fetchone()['n'] or 0

            # 기능별 사용량
            cursor.execute(
                "SELECT kind, COUNT(*) calls, COALESCE(SUM(credits),0) credits, "
                "COUNT(DISTINCT COALESCE(user_id, 0)) users FROM llm_usage "
                f"WHERE 1=1{use_cond} GROUP BY kind",
                tuple(use_params),
            )
            features = cursor.fetchall()

            # 사람별 활동. "누가 실제로 쓰고 있나" 를 한눈에 본다.
            # 화면 기록 — 어디를 보고 어디서 나갔나.
            screens, exits, sessions, sources = [], [], {}, []
            screen_series, exit_series = [], []
            events_range = {'a': None, 'b': None}
            cursor.execute("SHOW TABLES LIKE 'user_events'")
            if cursor.fetchone():
                cursor.execute(
                    "SELECT screen, COUNT(*) views, COUNT(DISTINCT session_id) sessions "
                    "FROM user_events WHERE name = 'screen_view' AND screen IS NOT NULL "
                    f"{ev_cond} GROUP BY screen ORDER BY views DESC LIMIT 20",
                    tuple(ev_params),
                )
                screens = cursor.fetchall()

                # 각 방문의 **마지막 화면** = 그 사람이 나간 자리.
                cursor.execute(
                    """
                    SELECT last_screen AS screen, COUNT(*) n FROM (
                      SELECT e.session_id,
                             SUBSTRING_INDEX(GROUP_CONCAT(e.screen ORDER BY e.created_at), ',', -1)
                               AS last_screen
                      FROM user_events e
                      WHERE e.name = 'screen_view' AND e.screen IS NOT NULL
                        AND e.session_id IS NOT NULL
                      """ + ev_cond.replace('created_at', 'e.created_at')
                            .replace('user_id', 'e.user_id')
                            .replace('device_id', 'e.device_id') + """
                      GROUP BY e.session_id
                    ) x GROUP BY last_screen ORDER BY n DESC LIMIT 12
                    """,
                    tuple(ev_params),
                )
                exits = cursor.fetchall()

                cursor.execute(
                    "SELECT COUNT(DISTINCT session_id) n FROM user_events "
                    f"WHERE session_id IS NOT NULL{ev_cond}",
                    tuple(ev_params),
                )
                sessions['total'] = cursor.fetchone()['n'] or 0
                cursor.execute(
                    "SELECT COUNT(*) n FROM (SELECT COALESCE(user_id, device_id) who, "
                    "COUNT(DISTINCT session_id) c FROM user_events "
                    f"WHERE session_id IS NOT NULL{ev_cond} GROUP BY who HAVING c > 1) x",
                    tuple(ev_params),
                )
                sessions['returning'] = cursor.fetchone()['n'] or 0
                cursor.execute(
                    "SELECT COUNT(*) n FROM (SELECT COALESCE(user_id, device_id) who "
                    f"FROM user_events WHERE 1=1{ev_cond} GROUP BY who) x",
                    tuple(ev_params),
                )
                sessions['people'] = cursor.fetchone()['n'] or 0

                cursor.execute(
                    f"SELECT MIN(created_at) a, MAX(created_at) b FROM user_events "
                    f"WHERE 1=1{ev_cond}",
                    tuple(ev_params),
                )
                events_range = cursor.fetchone() or {'a': None, 'b': None}

                # 화면 진입을 **날짜별로** 남긴다.
                #
                # 월별·연도별은 따로 묻지 않고 화면에서 이 날짜를 접어 쓴다. 단위를
                # 바꿀 때마다 서버에 다시 묻지 않아 드롭다운이 즉시 반응한다.
                cursor.execute(
                    "SELECT DATE(created_at) d, screen, COUNT(*) views "
                    "FROM user_events "
                    "WHERE name = 'screen_view' AND screen IS NOT NULL "
                    "  AND created_at >= (CURDATE() - INTERVAL 400 DAY) "
                    f"{ev_cond} GROUP BY d, screen ORDER BY d",
                    tuple(ev_params),
                )
                screen_series = [
                    {'date': r['d'].isoformat(), 'screen': r['screen'], 'views': r['views']}
                    for r in cursor.fetchall()
                ]

                # 나간 자리도 같은 방식으로. 날짜는 그 방문이 **끝난** 날로 잡는다.
                cursor.execute(
                    """
                    SELECT DATE(ended_at) d, last_screen AS screen, COUNT(*) views FROM (
                      SELECT e.session_id,
                             MAX(e.created_at) AS ended_at,
                             SUBSTRING_INDEX(GROUP_CONCAT(e.screen ORDER BY e.created_at), ',', -1)
                               AS last_screen
                      FROM user_events e
                      WHERE e.name = 'screen_view' AND e.screen IS NOT NULL
                        AND e.session_id IS NOT NULL
                        AND e.created_at >= (CURDATE() - INTERVAL 400 DAY)
                      """ + ev_cond.replace('created_at', 'e.created_at')
                            .replace('user_id', 'e.user_id')
                            .replace('device_id', 'e.device_id') + """
                      GROUP BY e.session_id
                    ) x GROUP BY d, last_screen ORDER BY d
                    """,
                    tuple(ev_params),
                )
                exit_series = [
                    {'date': r['d'].isoformat(), 'screen': r['screen'], 'views': r['views']}
                    for r in cursor.fetchall()
                ]

                # 유입 출처별 **성적표**.
                #
                # 방문 수만 세면 "인스타에서 300명 왔다" 로 끝난다. 정작 알아야 할 건
                # 그 300명이 재료를 담아 봤는지, 가입까지 갔는지다. 광고를 어디에 더
                # 쓸지는 그 비율로 정한다.
                cursor.execute(
                    """
                    SELECT s.src AS source,
                           COUNT(DISTINCT e.session_id) sessions,
                           COUNT(DISTINCT COALESCE(CONCAT('u', e.user_id),
                                                   CONCAT('d', e.device_id))) people,
                           SUM(e.name = 'screen_view') views,
                           COUNT(DISTINCT CASE WHEN e.name = 'ingredient_add'
                                               THEN e.session_id END) added,
                           COUNT(DISTINCT CASE WHEN e.name IN ('vision_use', 'chat_use')
                                               THEN e.session_id END) ai,
                           COUNT(DISTINCT CASE WHEN e.name = 'signup'
                                               THEN e.session_id END) signups,
                           COUNT(DISTINCT CASE WHEN e.name = 'coupang_click'
                                               THEN e.session_id END) coupang,
                           MIN(e.created_at) first_at,
                           MAX(e.created_at) last_at
                    FROM user_events e
                    JOIN (""" + _SESSION_SOURCE + """) s ON s.session_id = e.session_id
                    WHERE 1=1 """ + ev_cond.replace('created_at', 'e.created_at')
                                          .replace('user_id', 'e.user_id')
                                          .replace('device_id', 'e.device_id') + """
                    GROUP BY s.src ORDER BY sessions DESC LIMIT 20
                    """,
                    tuple(ev_params),
                )
                sources = cursor.fetchall()

                # 출처별로 **처음 닿은 화면**. 광고 링크가 엉뚱한 데로 떨어지고 있진
                # 않은지, 그 화면이 첫인상으로 괜찮은지를 여기서 본다.
                cursor.execute(
                    """
                    SELECT src, first_screen, COUNT(*) n FROM (
                      SELECT s.src AS src,
                             SUBSTRING_INDEX(GROUP_CONCAT(e.screen ORDER BY e.created_at), ',', 1)
                               AS first_screen
                      FROM user_events e
                      JOIN (""" + _SESSION_SOURCE + """) s ON s.session_id = e.session_id
                      WHERE e.name = 'screen_view' AND e.screen IS NOT NULL
                      GROUP BY e.session_id, s.src
                    ) x GROUP BY src, first_screen ORDER BY n DESC
                    """
                )
                landing = {}
                for r in cursor.fetchall():
                    landing.setdefault(r['src'], r['first_screen'])

                for r in sources:
                    r['views'] = int(r['views'] or 0)
                    r['landing'] = landing.get(r['source'])
                    r['first_at'] = r['first_at'].isoformat() if r['first_at'] else None
                    r['last_at'] = r['last_at'].isoformat() if r['last_at'] else None

            cursor.execute("SELECT MIN(created_at) a, MAX(created_at) b FROM users")
            users_range = cursor.fetchone() or {'a': None, 'b': None}
            cursor.execute("SELECT MIN(created_at) a, MAX(created_at) b FROM llm_usage")
            usage_range = cursor.fetchone() or {'a': None, 'b': None}

            cursor.execute(
                """
                SELECT u.id, u.nickname, u.email, u.created_at,
                       (SELECT COUNT(*) FROM user_ingredients WHERE user_id=u.id) ingredients,
                       (SELECT COUNT(*) FROM user_favorite_recipes WHERE user_id=u.id) favorites,
                       (SELECT COUNT(*) FROM user_completed_recipes WHERE user_id=u.id) completed,
                       (SELECT COUNT(*) FROM user_recorded_recipes WHERE user_id=u.id) recorded,
                       (SELECT COALESCE(SUM(credits),0) FROM llm_usage WHERE user_id=u.id) credits,
                       GREATEST(
                         COALESCE((SELECT MAX(updated_at) FROM user_ingredients WHERE user_id=u.id), u.created_at),
                         COALESCE((SELECT MAX(created_at) FROM user_completed_recipes WHERE user_id=u.id), u.created_at),
                         COALESCE((SELECT MAX(created_at) FROM user_recorded_recipes WHERE user_id=u.id), u.created_at),
                         COALESCE((SELECT MAX(created_at) FROM llm_usage WHERE user_id=u.id), u.created_at)
                       ) AS last_active
                FROM users u
                WHERE u.deleted_at IS NULL""" + uid_cond + """
                ORDER BY last_active DESC
                LIMIT 100
                """,
                tuple(uid_params),
            )
            people = cursor.fetchall()
        finally:
            cursor.close()
            db.close()

        return jsonify({
            'total': total,
            'churned': churned,
            'steps': [{'label': a, 'count': b, 'why': c} for a, b, c in steps],
            'features': features,
            'people': [
                {**r,
                 'email': _clean_email(r['email']),
                 'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                 'last_active': r['last_active'].isoformat() if r['last_active'] else None}
                for r in people
            ],
            # 지금 데이터로는 못 보는 것. 화면에 함께 적어 오해를 막는다.
            'screens': screens,
            'exits': exits,
            'sessions': sessions,
            'sources': sources,
            'screen_series': screen_series,
            'exit_series': exit_series,
            # 카드마다 집계 구간이 다르다. 화면에 그대로 적기 위해 함께 내려준다.
            'filters': {
                'from': start.isoformat() if start else None,
                'to': end.isoformat() if end else None,
                'excluded_users': len(ex_ids),
                'ranged': bool(start or end),
            },
            'periods': {
                'now': datetime.now().isoformat(),
                'users_from': _iso(users_range['a']),
                'usage_from': _iso(usage_range['a']),
                'usage_to': _iso(usage_range['b']),
                'events_from': _iso(events_range['a']),
                'events_to': _iso(events_range['b']),
            },
            'blind_spots': [
                '앱을 지우고 다시 깐 비회원 — 기기 식별자가 새로 만들어져 다른 사람으로 보인다',
                '왜 나갔는지 — 화면과 순서는 알아도 이유는 물어봐야 안다',
            ],
        })

    @app.route('/api/admin/dashboard', methods=['GET'])
    def admin_dashboard():
        """대시보드 — 가입/탈퇴, 사용량, 쿠팡 클릭, 사전 미매칭 상위.

        숫자를 한 화면에 모아 두는 이유: 정책 숫자(주 100 / 일 40)를 **감이 아니라
        이 값들을 보고** 조정하기 위해서다.
        """
        _, err = guard()
        if err:
            return err

        usage_quota.ensure_tables(get_db)
        start, end = _stats_range()
        ex_ids, ex_devices = _excluded(get_db)
        use_cond, use_params = _where('created_at', start, end, ex_ids, ex_devices,
                                      device_col='device_id')
        uid_cond = ""
        uid_params = []
        if ex_ids:
            marks = ",".join(["%s"] * len(ex_ids))
            uid_cond = f" AND id NOT IN ({marks})"
            uid_params = list(ex_ids)

        # **가입한 때**로 거른다. 기간을 골랐으면 '한눈에' 타일도 그 기간에
        # 가입한 사람을 센다 — 위는 최근 7일인데 아래는 누적이면 두 숫자를
        # 나란히 놓고 읽을 수가 없다.
        sign_cond, sign_params = _where('created_at', start, end, ex_ids, None, user_col='id')
        # 탈퇴는 **탈퇴한 때**가 기준이다. 가입한 때로 세면 "이 기간에 몇 명이
        # 떠났나" 를 못 본다.
        gone_cond, gone_params = _where('deleted_at', start, end, ex_ids, None, user_col='id')

        # 가입 추이·쿠팡은 기간을 고르지 않았으면 최근 30일을 본다 (예전 기본값).
        since = start or (datetime.now() - timedelta(days=30)).replace(
            hour=0, minute=0, second=0, microsecond=0)
        week_start = usage_quota.week_start().replace(tzinfo=None)

        db = get_db()
        cursor = db.cursor()
        out = {}
        try:
            cursor.execute(
                "SELECT COUNT(*) total, "
                f"SUM(household_id IS NOT NULL) in_household FROM users WHERE 1=1{sign_cond}",
                tuple(sign_params),
            )
            out['users'] = cursor.fetchone()
            cursor.execute(
                f"SELECT COUNT(*) n FROM users WHERE deleted_at IS NOT NULL{gone_cond}",
                tuple(gone_params),
            )
            out['users']['deleted'] = cursor.fetchone()['n'] or 0

            cursor.execute(
                "SELECT DATE(created_at) d, COUNT(*) n FROM users "
                f"WHERE created_at >= %s{uid_cond}"
                + (" AND created_at <= %s" if end else "")
                + " GROUP BY d ORDER BY d",
                tuple([since] + uid_params + ([end] if end else [])),
            )
            out['signups'] = [
                {'date': r['d'].isoformat(), 'count': r['n']} for r in cursor.fetchall()
            ]

            # 30일이 아니라 400일을 준다. 화면에서 일별·월별·연도별로 접어 쓰는데,
            # 30일치만 주면 월별은 한두 칸, 연도별은 한 칸밖에 안 그려진다.
            cursor.execute(
                "SELECT DATE(created_at) d, kind, SUM(credits) credits, "
                "COUNT(*) calls, COALESCE(SUM(total_tokens),0) tokens "
                "FROM llm_usage WHERE created_at >= (CURDATE() - INTERVAL 400 DAY) "
                f"{use_cond} GROUP BY d, kind ORDER BY d",
                tuple(use_params),
            )
            out['usage_daily'] = [
                {'date': r['d'].isoformat(), 'kind': r['kind'], 'credits': int(r['credits'] or 0),
                 'calls': r['calls'], 'tokens': int(r['tokens'] or 0)}
                for r in cursor.fetchall()
            ]

            # 크레딧 환산이 맞는지 — 종류별 크레딧당 실제 토큰
            cursor.execute(
                "SELECT kind, COUNT(*) n, ROUND(AVG(total_tokens)) avg_tokens, "
                "ROUND(AVG(total_tokens / credits)) tokens_per_credit "
                f"FROM llm_usage WHERE total_tokens IS NOT NULL{use_cond} GROUP BY kind",
                tuple(use_params),
            )
            out['credit_check'] = cursor.fetchall()

            # 기간을 골랐으면 **그 기간**을, 안 골랐으면 이번 주를 센다.
            # 고른 기간과 다른 구간의 숫자를 같은 화면에 두면 잘못 읽힌다.
            if start or end:
                cursor.execute(
                    "SELECT COALESCE(SUM(credits),0) credits, COUNT(*) calls "
                    f"FROM llm_usage WHERE 1=1{use_cond}",
                    tuple(use_params),
                )
            else:
                cursor.execute(
                    "SELECT COALESCE(SUM(credits),0) credits, COUNT(*) calls "
                    f"FROM llm_usage WHERE created_at >= %s{use_cond}",
                    tuple([week_start] + use_params),
                )
            out['this_week'] = cursor.fetchone()

            cursor.execute("SHOW TABLES LIKE 'coupang_clicks'")
            if cursor.fetchone():
                cursor.execute(
                    "SELECT COUNT(*) n FROM coupang_clicks WHERE created_at >= %s"
                    + (" AND created_at <= %s" if end else ""),
                    tuple([since] + ([end] if end else [])),
                )
                out['coupang_clicks_30d'] = cursor.fetchone()['n']

            cursor.execute("SELECT MIN(created_at) a, MAX(created_at) b FROM llm_usage")
            usage_range = cursor.fetchone() or {'a': None, 'b': None}
            cursor.execute("SELECT MIN(created_at) a FROM users")
            users_range = cursor.fetchone() or {'a': None}
            out['filters'] = {
                'from': start.isoformat() if start else None,
                'to': end.isoformat() if end else None,
                'excluded_users': len(ex_ids),
                'ranged': bool(start or end),
            }
            out['periods'] = {
                'now': datetime.now().isoformat(),
                'since_30d': since.isoformat(),        # 가입 추이·쿠팡 클릭의 시작점
                'week_start': week_start.isoformat(),  # '이번 주' 의 기준 (월요일 0시 KST)
                'users_from': _iso(users_range['a']),
                'usage_from': _iso(usage_range['a']),
                'usage_to': _iso(usage_range['b']),
            }

            # 사전 미매칭은 '사전' 탭 전용이다. 대시보드는 사용자 현황을 보는
            # 자리라, 손댈 수도 없는 목록을 여기 두면 초점이 흐려진다.
        finally:
            cursor.close()
            db.close()

        return jsonify(out)
