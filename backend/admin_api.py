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
                       COALESCE(q.plan, 'free')  AS plan,
                       q.weekly_limit, q.daily_cap, q.note,
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
                'today_credits': int(r['today_credits'] or 0),
            })
        # 한도 정책을 화면에 같이 내려준다.
        #
        # 화면에 숫자를 하드코딩하면 환경변수로 값을 바꿨을 때 **화면만 옛 숫자를
        # 말하게 된다.** 관리자가 그걸 보고 정책을 정하면 어긋난다.
        # 그래서 서버가 지금 실제로 쓰는 값을 그대로 내려보낸다.
        plans = usage_quota._plans()
        policy = {
            'plans': [
                {'key': key, 'weekly': weekly, 'daily': daily}
                for key, (weekly, daily) in plans.items()
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
            cursor.execute(
                "SELECT raw_name, hit_count, last_mode, first_seen, last_seen "
                "FROM ingredient_dictionary_misses ORDER BY hit_count DESC, last_seen DESC LIMIT 200"
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
        return jsonify({'misses': out})

    @app.route('/api/admin/dictionary/suggest', methods=['POST'])
    def admin_dictionary_suggest():
        """고른 이름들을 어떻게 처리할지 LLM 에게 물어본다. **쓰지는 않는다.**"""
        _, err = guard()
        if err:
            return err
        names = (request.get_json(silent=True) or {}).get('names') or []
        try:
            import dictionary_curation

            return jsonify({'suggestions': dictionary_curation.suggest(names)})
        except RuntimeError as e:
            print(f"[dictionary] 설정 오류: {e}", flush=True)
            return jsonify({'error': 'LLM 키가 설정되지 않았습니다.'}), 503
        except Exception as e:  # noqa: BLE001
            import traceback

            traceback.print_exc()
            return jsonify({'error': f'제안을 받지 못했어요: {type(e).__name__}'}), 502

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
        """사전에 넣지 않기로 한 이름을 목록에서 지운다.

        요리 이름·주류 브랜드처럼 **일부러 안 넣는 것**이 계속 목록에 남아 있으면
        볼 때마다 다시 판단하게 된다.
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
            deleted = cursor.execute(
                f"DELETE FROM ingredient_dictionary_misses WHERE raw_name IN ({placeholders})",
                tuple(names),
            )
            db.commit()
        finally:
            cursor.close()
            db.close()
        return jsonify({'deleted': deleted})

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
                "SELECT raw_name, kind, keyword, 중분류, 소분류, reason, created_at, applied_to_csv "
                "FROM ingredient_dictionary_additions ORDER BY created_at DESC LIMIT 200"
            )
            rows = cursor.fetchall()
        finally:
            cursor.close()
            db.close()
        return jsonify({'additions': [
            {**r, 'created_at': r['created_at'].isoformat() if r['created_at'] else None}
            for r in rows
        ]})

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
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("SELECT COUNT(*) n FROM users WHERE deleted_at IS NULL")
            total = cursor.fetchone()['n'] or 0

            def count(sql):
                cursor.execute(sql)
                return cursor.fetchone()['n'] or 0

            steps = [
                ('가입', total, '탈퇴하지 않은 계정'),
                ('재료 등록', count(
                    "SELECT COUNT(DISTINCT i.user_id) n FROM user_ingredients i "
                    "JOIN users u ON u.id = i.user_id AND u.deleted_at IS NULL"),
                 '냉장고에 재료를 하나라도 넣은 사람'),
                ('레시피 반응', count(
                    "SELECT COUNT(DISTINCT user_id) n FROM ("
                    "  SELECT user_id FROM user_favorite_recipes"
                    "  UNION SELECT user_id FROM user_completed_recipes"
                    "  UNION SELECT user_id FROM user_recorded_recipes) x "
                    "JOIN users u ON u.id = x.user_id AND u.deleted_at IS NULL"),
                 '즐겨찾기·완료·기록 중 하나라도 한 사람'),
                ('AI 사용', count(
                    "SELECT COUNT(DISTINCT l.user_id) n FROM llm_usage l "
                    "JOIN users u ON u.id = l.user_id AND u.deleted_at IS NULL"),
                 '챗봇이나 사진 인식을 써 본 사람'),
                ('식구 그룹', count(
                    "SELECT COUNT(*) n FROM users WHERE household_id IS NOT NULL AND deleted_at IS NULL"),
                 '다른 사람과 냉장고를 공유하는 사람'),
            ]

            cursor.execute("SELECT COUNT(*) n FROM users WHERE deleted_at IS NOT NULL "
                           "AND email NOT LIKE 'merged+%%'")
            churned = cursor.fetchone()['n'] or 0

            # 기능별 사용량
            cursor.execute(
                "SELECT kind, COUNT(*) calls, COALESCE(SUM(credits),0) credits, "
                "COUNT(DISTINCT COALESCE(user_id, 0)) users FROM llm_usage GROUP BY kind"
            )
            features = cursor.fetchall()

            # 사람별 활동. "누가 실제로 쓰고 있나" 를 한눈에 본다.
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
                WHERE u.deleted_at IS NULL
                ORDER BY last_active DESC
                LIMIT 100
                """
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
            'blind_spots': [
                '어느 화면에서 나갔는지 — 화면 진입 기록이 없다',
                '레시피를 열어 봤는지 — 조회 기록이 없다(즐겨찾기·완료·기록만 남는다)',
                '비회원이 무엇을 했는지 — 계정이 없어 이어붙일 수 없다',
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

            # 사전 미매칭은 '사전' 탭 전용이다. 대시보드는 사용자 현황을 보는
            # 자리라, 손댈 수도 없는 목록을 여기 두면 초점이 흐려진다.
        finally:
            cursor.close()
            db.close()

        return jsonify(out)
