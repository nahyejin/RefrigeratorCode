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
            "SELECT id, nickname, is_admin FROM users WHERE id = %s AND deleted_at IS NULL",
            (user_id,),
        )
        row = cursor.fetchone()
    finally:
        cursor.close()
        db.close()
    if not row:
        return None
    is_admin = row['is_admin'] if isinstance(row, dict) else row[2]
    if not is_admin:
        return None
    return (
        (row['id'], row['nickname']) if isinstance(row, dict) else (row[0], row[1])
    )


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
        keyword = (request.args.get('q') or '').strip()
        include_deleted = (request.args.get('deleted') or '') == '1'

        where = [] if include_deleted else ['u.deleted_at IS NULL']
        params = [week_start, week_start]
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
                       COALESCE(q.plan, 'free')  AS plan,
                       q.weekly_limit, q.daily_cap, q.note,
                       (SELECT COUNT(*) FROM user_ingredients i WHERE i.user_id = u.id)
                           AS ingredient_count,
                       (SELECT COALESCE(SUM(l.credits), 0) FROM llm_usage l
                         WHERE l.user_id = u.id AND l.created_at >= %s)
                           AS week_credits,
                       (SELECT COALESCE(SUM(l.total_tokens), 0) FROM llm_usage l
                         WHERE l.user_id = u.id AND l.created_at >= %s)
                           AS week_tokens
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

        plans = usage_quota._plans()
        users = []
        for r in rows:
            plan = r['plan'] or 'free'
            base_weekly, base_daily = plans.get(plan, plans['free'])
            users.append({
                'id': r['id'],
                'email': _clean_email(r['email']),
                'nickname': r['nickname'],
                'provider': r['provider'],
                'created_at': r['created_at'].isoformat() if r['created_at'] else None,
                'deleted_at': r['deleted_at'].isoformat() if r['deleted_at'] else None,
                'household_id': r['household_id'],
                'is_admin': bool(r['is_admin']),
                'plan': plan,
                'weekly_limit': r['weekly_limit'] if r['weekly_limit'] is not None else base_weekly,
                'daily_cap': r['daily_cap'] if r['daily_cap'] is not None else base_daily,
                'note': r['note'],
                'ingredient_count': int(r['ingredient_count'] or 0),
                'week_credits': int(r['week_credits'] or 0),
                'week_tokens': int(r['week_tokens'] or 0),
            })
        return jsonify({'users': users, 'week_start': week_start.isoformat()})

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

        weekly = as_int(body.get('weekly_limit'))
        daily = as_int(body.get('daily_cap'))

        usage_quota.ensure_tables(get_db)
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """
                INSERT INTO user_quota
                    (user_id, plan, weekly_limit, daily_cap, note, updated_by, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, NOW())
                ON DUPLICATE KEY UPDATE
                    plan = VALUES(plan), weekly_limit = VALUES(weekly_limit),
                    daily_cap = VALUES(daily_cap), note = VALUES(note),
                    updated_by = VALUES(updated_by), updated_at = NOW()
                """,
                (user_id, plan, weekly, daily, note[:255], admin[0]),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()

        return jsonify(usage_quota.status(get_db, user_id=user_id))

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
        since = (datetime.now() - timedelta(days=30)).replace(hour=0, minute=0, second=0, microsecond=0)
        week_start = usage_quota.week_start().replace(tzinfo=None)

        db = get_db()
        cursor = db.cursor()
        out = {}
        try:
            cursor.execute(
                "SELECT COUNT(*) total, SUM(deleted_at IS NOT NULL) deleted, "
                "SUM(household_id IS NOT NULL) in_household FROM users"
            )
            out['users'] = cursor.fetchone()

            cursor.execute(
                "SELECT DATE(created_at) d, COUNT(*) n FROM users "
                "WHERE created_at >= %s GROUP BY d ORDER BY d",
                (since,),
            )
            out['signups'] = [
                {'date': r['d'].isoformat(), 'count': r['n']} for r in cursor.fetchall()
            ]

            cursor.execute(
                "SELECT DATE(created_at) d, kind, SUM(credits) credits, "
                "COUNT(*) calls, COALESCE(SUM(total_tokens),0) tokens "
                "FROM llm_usage WHERE created_at >= %s GROUP BY d, kind ORDER BY d",
                (since,),
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
                "FROM llm_usage WHERE total_tokens IS NOT NULL GROUP BY kind"
            )
            out['credit_check'] = cursor.fetchall()

            cursor.execute(
                "SELECT COALESCE(SUM(credits),0) credits, COUNT(*) calls "
                "FROM llm_usage WHERE created_at >= %s",
                (week_start,),
            )
            out['this_week'] = cursor.fetchone()

            cursor.execute("SHOW TABLES LIKE 'coupang_clicks'")
            if cursor.fetchone():
                cursor.execute("SELECT COUNT(*) n FROM coupang_clicks WHERE created_at >= %s", (since,))
                out['coupang_clicks_30d'] = cursor.fetchone()['n']

            cursor.execute("SHOW TABLES LIKE 'ingredient_dictionary_misses'")
            if cursor.fetchone():
                cursor.execute(
                    "SELECT raw_name, hit_count, last_seen FROM ingredient_dictionary_misses "
                    "ORDER BY hit_count DESC, last_seen DESC LIMIT 15"
                )
                out['dictionary_misses'] = [
                    {**r, 'last_seen': r['last_seen'].isoformat() if r['last_seen'] else None}
                    for r in cursor.fetchall()
                ]
        finally:
            cursor.close()
            db.close()

        return jsonify(out)
