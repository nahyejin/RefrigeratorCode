from flask import Flask, jsonify, request, redirect, session
from flask_cors import CORS
import pymysql
import os
from dotenv import load_dotenv
import requests
import jwt
import secrets
from datetime import datetime, timedelta

# 환경변수 로드
# - 개발환경에서만 현재 디렉토리의 .env를 로드
# - 배포환경(Railway 등)에서는 플랫폼이 주입한 환경변수 사용
# .env 파일이 있으면 로드 (기존 환경변수는 덮어쓰지 않음)
if os.getenv('FLASK_ENV', '').lower() == 'development' or not os.getenv('GOOGLE_CLIENT_ID'):
    load_dotenv(override=False)  # 기존 환경변수가 있으면 덮어쓰지 않음

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))

# 한글이 유니코드 이스케이프 시퀀스로 변환되지 않도록 설정
app.config['JSON_AS_ASCII'] = False

# CORS 설정 - 환경변수에서 허용할 origin 가져오기
default_origins = 'http://localhost:5173,http://localhost:5177,http://localhost:5178,https://refrigerator-code.vercel.app'
cors_origins = os.getenv('CORS_ORIGINS', default_origins).split(',')

# Railway 배포 환경에서는 Vercel 도메인 명시적으로 추가
if os.getenv('RAILWAY_ENVIRONMENT') or os.getenv('RAILWAY_ENVIRONMENT_NAME'):
    if 'https://refrigerator-code.vercel.app' not in cors_origins:
        cors_origins.append('https://refrigerator-code.vercel.app')
    # 모든 localhost 포트 허용
    for port in [5173, 5177, 5178, 3000, 8080]:
        localhost_origin = f'http://localhost:{port}'
        if localhost_origin not in cors_origins:
            cors_origins.append(localhost_origin)

# CORS 설정 - 와일드카드 대신 명시적 도메인 사용
CORS(app, 
     origins=[origin.strip() for origin in cors_origins if origin.strip()], 
     supports_credentials=True,
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'])

def get_db():
    host = (
        os.getenv('DB_HOST')
        or os.getenv('MYSQLHOST')
        or os.getenv('MYSQL_HOST')
        or 'localhost'
    )
    user = (
        os.getenv('DB_USER')
        or os.getenv('MYSQLUSER')
        or os.getenv('MYSQL_USER')
        or 'root'
    )
    password = (
        os.getenv('DB_PASSWORD')
        or os.getenv('MYSQLPASSWORD')
        or os.getenv('MYSQL_PASSWORD')
        or ''
    )
    db_name = (
        os.getenv('DB_NAME')
        or os.getenv('MYSQLDATABASE')
        or os.getenv('MYSQL_DATABASE')
        or 'refrigerator'
    )
    port = int(
        os.getenv('DB_PORT')
        or os.getenv('MYSQLPORT')
        or os.getenv('MYSQL_PORT')
        or 3306
    )

    return pymysql.connect(
        host=host,
        user=user,
        password=password,
        db=db_name,
        port=port,
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        # 네트워크 환경(원격 DB)에서 간헐적 타임아웃을 방지하기 위한 옵션
        connect_timeout=10,
        read_timeout=120,
        write_timeout=120,
        autocommit=False
    )

@app.route('/api/recipes')
def get_recipes():
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 20))
    offset = (page - 1) * size
    db = get_db()
    cursor = db.cursor()
    # 전체 개수 구하기
    cursor.execute("SELECT COUNT(*) as total FROM recipes")
    total = cursor.fetchone()['total']
    # 페이징 적용 쿼리
    cursor.execute("SELECT * FROM recipes ORDER BY id DESC LIMIT %s OFFSET %s", (size, offset))
    recipes = cursor.fetchall()
    db.close()
    return jsonify({
        'recipes': recipes,
        'total': total,
        'page': page,
        'size': size
    })

@app.route('/api/recipes/search')
def search_recipes():
    """키워드 기반 레시피 검색 (전체 데이터 대상)"""
    keyword = request.args.get('keyword', '').strip()
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 50))
    offset = (page - 1) * size
    
    if not keyword:
        return jsonify({'recipes': [], 'total': 0, 'page': page, 'size': size})
    
    db = get_db()
    cursor = db.cursor()
    
    # 키워드가 title 또는 content에 포함된 레시피 검색
    search_pattern = f'%{keyword}%'
    
    # 전체 개수 구하기
    cursor.execute(
        "SELECT COUNT(*) as total FROM recipes WHERE (title LIKE %s OR content LIKE %s)",
        (search_pattern, search_pattern)
    )
    total = cursor.fetchone()['total']
    
    # 페이징 적용 쿼리
    cursor.execute(
        """SELECT * FROM recipes 
           WHERE (title LIKE %s OR content LIKE %s)
           ORDER BY id DESC 
           LIMIT %s OFFSET %s""",
        (search_pattern, search_pattern, size, offset)
    )
    recipes = cursor.fetchall()
    
    db.close()
    return jsonify({
        'recipes': recipes,
        'total': total,
        'page': page,
        'size': size
    })

@app.route('/api/recipes/popular')
def get_popular_recipes():
    size = int(request.args.get('size', 30))
    period_type = request.args.get('period_type', 'month')  # today, week, month, custom
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    db = get_db()
    cursor = db.cursor()
    
    # 기간별 WHERE 조건 생성
    if period_type == 'custom' and start_date and end_date:
        where_clause = "WHERE post_time >= %s AND post_time <= %s"
        params = [start_date, end_date]
    else:
        # 기본 기간 설정
        if period_type == 'today':
            days = 1
        elif period_type == 'week':
            days = 7
        else:  # month
            days = 30
        
        where_clause = "WHERE post_time >= DATE_SUB(NOW(), INTERVAL %s DAY)"
        params = [days]
    
    # 유튜브 인기 레시피
    cursor.execute(
        f"""
        SELECT * FROM recipes
        {where_clause}
        AND platform LIKE %s
        ORDER BY (1.0 * COALESCE(likes, 0) + 2.0 * COALESCE(comments, 0) + 0.5 * COALESCE(hits, 0)) DESC
        LIMIT %s
        """, params + ['%youtube%', size]
    )
    youtube_recipes = cursor.fetchall()
    
    # 네이버 인기 레시피
    cursor.execute(
        f"""
        SELECT * FROM recipes
        {where_clause}
        AND platform LIKE %s
        ORDER BY (1.0 * COALESCE(likes, 0) + 2.0 * COALESCE(comments, 0)) DESC
        LIMIT %s
        """, params + ['%naver%', size]
    )
    naver_recipes = cursor.fetchall()
    
    db.close()
    return jsonify({
        'youtube': youtube_recipes, 
        'naver': naver_recipes, 
        'size': size, 
        'period_type': period_type,
        'start_date': start_date,
        'end_date': end_date
    })

@app.route('/api/recipes/filter')
def get_filtered_recipes():
    # 페이징
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 20))
    offset = (page - 1) * size

    # 필터/정렬 파라미터
    sort_by = request.args.get('sort_by', 'match_rate')  # match_rate, date, popularity, like, comment, hits
    platform = request.args.get('platform', '').strip().lower()
    keyword = request.args.get('keyword', '').strip()
    my_ingredients_raw = request.args.get('my_ingredients', '').strip()
    my_ingredients = [i.strip() for i in my_ingredients_raw.split(',') if i.strip()]
    
    # 재료 매칭도 필터
    match_rate_min = request.args.get('match_rate_min', None)
    match_rate_max = request.args.get('match_rate_max', None)
    if match_rate_min is not None:
        try:
            match_rate_min = int(match_rate_min)
        except:
            match_rate_min = None
    if match_rate_max is not None:
        try:
            match_rate_max = int(match_rate_max)
        except:
            match_rate_max = None
    
    # 필터 파라미터 추가
    include_ingredients_raw = request.args.get('include_ingredients', '').strip()
    include_ingredients = [i.strip() for i in include_ingredients_raw.split(',') if i.strip()]
    
    exclude_ingredients_raw = request.args.get('exclude_ingredients', '').strip()
    exclude_ingredients = [i.strip() for i in exclude_ingredients_raw.split(',') if i.strip()]
    
    # 카테고리 키워드 (JSON 형태로 전달)
    category_keywords_json = request.args.get('category_keywords', '').strip()
    category_keywords = {}
    if category_keywords_json:
        try:
            import json
            category_keywords = json.loads(category_keywords_json)
        except:
            pass

    # 임박재료 필터
    applied_expiry_ingredients_raw = request.args.get('applied_expiry_ingredients', '').strip()
    applied_expiry_ingredients = [i.strip() for i in applied_expiry_ingredients_raw.split(',') if i.strip()]

    db = get_db()
    cursor = db.cursor()

    # WHERE - 필터가 가장 우선적으로 적용
    where_clauses = ["1=1"]
    base_params = []
    
    # 채널 필터
    if platform:
        where_clauses.append("platform LIKE %s")
        base_params.append(f"%{platform}%")
    
    # 키워드 필터
    if keyword:
        where_clauses.append("(title LIKE %s OR content LIKE %s)")
        base_params.extend([f"%{keyword}%", f"%{keyword}%"])
    
    # 포함할 재료 필터 (OR 조건: 하나라도 포함)
    if include_ingredients:
        include_conditions = []
        for ing in include_ingredients:
            include_conditions.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0")
            base_params.append(ing)
        if include_conditions:
            where_clauses.append(f"({' OR '.join(include_conditions)})")
    
    # 제외할 재료 필터 (AND 조건: 모두 제외)
    if exclude_ingredients:
        for ing in exclude_ingredients:
            where_clauses.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) = 0")
            base_params.append(ing)
    
    # 카테고리 키워드 필터 (OR 조건: 하나라도 포함)
    if category_keywords:
        keyword_conditions = []
        for category, keywords in category_keywords.items():
            if keywords and len(keywords) > 0:
                for kw in keywords:
                    keyword_conditions.append("(title LIKE %s OR content LIKE %s)")
                    base_params.extend([f"%{kw}%", f"%{kw}%"])
        if keyword_conditions:
            where_clauses.append(f"({' OR '.join(keyword_conditions)})")
    
    # 임박재료 필터 (OR 조건: 하나라도 포함)
    if applied_expiry_ingredients:
        expiry_conditions = []
        for ing in applied_expiry_ingredients:
            expiry_conditions.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0")
            base_params.append(ing)
        if expiry_conditions:
            where_clauses.append(f"({' OR '.join(expiry_conditions)})")
    
    where_sql = " AND ".join(where_clauses)

    # match_rate 계산식
    total_ing_expr = """
      CASE WHEN used_ingredients IS NULL OR used_ingredients=''
           THEN 0
           ELSE LENGTH(REPLACE(used_ingredients,' ','')) - LENGTH(REPLACE(REPLACE(used_ingredients,' ',''),',','')) + 1
      END
    """
    if my_ingredients:
        match_count_parts = [
            "(CASE WHEN FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0 THEN 1 ELSE 0 END)"
            for _ in my_ingredients
        ]
        match_count_expr = " + ".join(match_count_parts)
        match_rate_expr = f"CASE WHEN ({total_ing_expr}) = 0 THEN 0 ELSE ROUND(({match_count_expr})/({total_ing_expr})*100) END"
    else:
        match_rate_expr = "0"

    # ORDER BY
    if sort_by == 'match_rate':
        order_by = "match_rate DESC, post_time DESC"
    elif sort_by == 'date':
        order_by = "post_time DESC"
    elif sort_by == 'popularity':
        order_by = "(COALESCE(hits,0) + 2*COALESCE(likes,0)) DESC"
    elif sort_by == 'hits':
        order_by = "COALESCE(hits,0) DESC"
    elif sort_by == 'like':
        order_by = "COALESCE(likes,0) DESC"
    elif sort_by == 'comment':
        order_by = "COALESCE(comments,0) DESC"
    else:
        order_by = "post_time DESC"

    # match_rate 필터를 위한 서브쿼리 (HAVING 절 사용)
    # total COUNT (match_rate 필터 포함)
    count_sql = f"""
      SELECT COUNT(*) AS total
      FROM (
        SELECT {match_rate_expr} AS match_rate
        FROM recipes
        WHERE {where_sql}
      ) AS subquery
    """
    count_params = (my_ingredients if my_ingredients else []) + base_params
    if match_rate_min is not None or match_rate_max is not None:
        having_clauses = []
        if match_rate_min is not None:
            count_sql = count_sql.replace(") AS subquery", f"HAVING match_rate >= %s) AS subquery")
            count_params = count_params + [match_rate_min]
        if match_rate_max is not None:
            if match_rate_min is not None:
                count_sql = count_sql.replace("HAVING match_rate >= %s", "HAVING match_rate >= %s AND match_rate <= %s")
            else:
                count_sql = count_sql.replace(") AS subquery", f"HAVING match_rate <= %s) AS subquery")
            count_params = count_params + [match_rate_max]
    cursor.execute(count_sql, count_params)
    total = cursor.fetchone()['total']

    # 메인 쿼리: 필요한 컬럼만 + LIMIT/OFFSET
    select_cols = "id, title, thumbnail, platform, likes, comments, hits, post_time, used_ingredients, content, link"
    main_sql = f"""
      SELECT {select_cols},
             {match_rate_expr} AS match_rate
      FROM recipes
      WHERE {where_sql}
    """
    main_params = (my_ingredients if my_ingredients else []) + base_params
    
    # HAVING 절 추가 (match_rate 필터)
    if match_rate_min is not None or match_rate_max is not None:
        having_clauses = []
        if match_rate_min is not None:
            having_clauses.append("match_rate >= %s")
            main_params = main_params + [match_rate_min]
        if match_rate_max is not None:
            having_clauses.append("match_rate <= %s")
            main_params = main_params + [match_rate_max]
        if having_clauses:
            main_sql += " HAVING " + " AND ".join(having_clauses)
    
    main_sql += f" ORDER BY {order_by} LIMIT %s OFFSET %s"
    main_params = main_params + [size, offset]
    cursor.execute(main_sql, main_params)
    rows = cursor.fetchall()

    db.close()
    return jsonify({"recipes": rows, "total": total, "page": page, "size": size})

# =====================
# 소셜 로그인 설정
# =====================

# OAuth 클라이언트 ID 및 시크릿 (환경변수에서 가져오기)
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET', '')
KAKAO_CLIENT_ID = os.getenv('KAKAO_CLIENT_ID', '')
KAKAO_CLIENT_SECRET = os.getenv('KAKAO_CLIENT_SECRET', '')
NAVER_CLIENT_ID = os.getenv('NAVER_CLIENT_ID', '')
NAVER_CLIENT_SECRET = os.getenv('NAVER_CLIENT_SECRET', '')

# 프론트엔드 URL (콜백용)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5178')
# 백엔드 URL (OAuth 콜백용)
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')

def generate_jwt_token(user_id, email, nickname, provider=None):
    """JWT 토큰 생성"""
    payload = {
        'user_id': user_id,
        'email': email,
        'nickname': nickname,
        'exp': datetime.utcnow() + timedelta(days=30),
        'iat': datetime.utcnow()
    }
    if provider:
        payload['provider'] = provider
    secret_key = os.getenv('JWT_SECRET_KEY', app.secret_key)
    return jwt.encode(payload, secret_key, algorithm='HS256')

def ensure_users_table():
    """users 테이블이 없으면 생성"""
    db = get_db()
    cursor = db.cursor()
    
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                nickname VARCHAR(255) NOT NULL,
                provider VARCHAR(50) NOT NULL,
                provider_id VARCHAR(255) NOT NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_provider_user (email, provider),
                INDEX idx_provider_id (provider, provider_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error creating users table: {e}")
    finally:
        db.close()

def get_or_create_user(email, nickname, provider, provider_id):
    """사용자 조회 또는 생성"""
    # 테이블이 없으면 생성
    ensure_users_table()
    
    db = get_db()
    cursor = db.cursor()
    
    try:
        # 기존 사용자 조회
        cursor.execute(
            "SELECT id, email, nickname FROM users WHERE email = %s AND provider = %s",
            (email, provider)
        )
        user = cursor.fetchone()
        
        if user:
            db.commit()
            return user
        
        # 새 사용자 생성
        cursor.execute(
            "INSERT INTO users (email, nickname, provider, provider_id, created_at) VALUES (%s, %s, %s, %s, NOW())",
            (email, nickname, provider, provider_id)
        )
        user_id = cursor.lastrowid
        db.commit()
        
        return {
            'id': user_id,
            'email': email,
            'nickname': nickname
        }
    except Exception as e:
        db.rollback()
        raise e
    finally:
        db.close()

# =====================
# 구글 로그인
# =====================

@app.route('/api/auth/google')
def google_login():
    """구글 로그인 시작 - 인증 URL로 리다이렉트"""
    if not GOOGLE_CLIENT_ID:
        return jsonify({'error': 'Google OAuth not configured'}), 500
    
    # CSRF 방지를 위한 state 생성
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['oauth_provider'] = 'google'
    
    redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"client_id={GOOGLE_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"scope=openid email profile&"
        f"state={state}"
    )
    
    return redirect(google_auth_url)

@app.route('/api/auth/google/callback')
def google_callback():
    """구글 로그인 콜백 처리"""
    code = request.args.get('code')
    state = request.args.get('state')
    
    print(f"[Google Callback] Code: {code[:20] if code else None}...")
    print(f"[Google Callback] State: {state}")
    print(f"[Google Callback] Session state: {session.get('oauth_state')}")
    
    # State 검증
    if state != session.get('oauth_state'):
        print(f"[Google Callback] State mismatch!")
        return jsonify({'error': 'Invalid state'}), 400
    
    if not code:
        print(f"[Google Callback] No code provided!")
        return jsonify({'error': 'Authorization code not provided'}), 400
    
    try:
        # 토큰 교환
        redirect_uri = f"{BACKEND_URL}/api/auth/google/callback"
        print(f"[Google Callback] Redirect URI: {redirect_uri}")
        print(f"[Google Callback] Client ID: {GOOGLE_CLIENT_ID[:20] if GOOGLE_CLIENT_ID else 'None'}...")
        
        token_response = requests.post('https://oauth2.googleapis.com/token', data={
            'client_id': GOOGLE_CLIENT_ID,
            'client_secret': GOOGLE_CLIENT_SECRET,
            'code': code,
            'grant_type': 'authorization_code',
            'redirect_uri': redirect_uri
        })
        
        print(f"[Google Callback] Token response status: {token_response.status_code}")
        token_data = token_response.json()
        print(f"[Google Callback] Token response: {token_data}")
        
        if 'access_token' not in token_data:
            return jsonify({'error': 'Failed to get access token', 'details': token_data}), 400
        
        # 사용자 정보 가져오기
        user_response = requests.get(
            'https://www.googleapis.com/oauth2/v2/userinfo',
            headers={'Authorization': f"Bearer {token_data['access_token']}"}
        )
        print(f"[Google Callback] User response status: {user_response.status_code}")
        user_data = user_response.json()
        print(f"[Google Callback] User data: {user_data}")
        
        # 사용자 조회 또는 생성
        user = get_or_create_user(
            email=user_data.get('email'),
            nickname=user_data.get('name', user_data.get('email', '').split('@')[0]),
            provider='google',
            provider_id=str(user_data.get('id'))
        )
        print(f"[Google Callback] User created/found: {user}")
        
        # JWT 토큰 생성
        token = generate_jwt_token(user['id'], user['email'], user['nickname'], provider='google')
        print(f"[Google Callback] JWT token generated")
        
        # 프론트엔드로 리다이렉트 (토큰을 쿼리 파라미터로 전달)
        return redirect(f"{FRONTEND_URL}/auth/success?token={token}")
        
    except Exception as e:
        import traceback
        print(f"[Google Callback] Error: {str(e)}")
        print(f"[Google Callback] Traceback: {traceback.format_exc()}")
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 500

# =====================
# 카카오 로그인
# =====================

@app.route('/api/auth/kakao')
def kakao_login():
    """카카오 로그인 시작"""
    if not KAKAO_CLIENT_ID:
        return jsonify({'error': 'Kakao OAuth not configured'}), 500
    
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['oauth_provider'] = 'kakao'
    
    redirect_uri = f"{BACKEND_URL}/api/auth/kakao/callback"
    # 카카오 로그인에서 이메일과 닉네임을 받기 위한 scope 설정
    kakao_auth_url = (
        f"https://kauth.kakao.com/oauth/authorize?"
        f"client_id={KAKAO_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"response_type=code&"
        f"state={state}&"
        f"scope=profile_nickname,account_email"
    )
    
    return redirect(kakao_auth_url)

@app.route('/api/auth/kakao/callback')
def kakao_callback():
    """카카오 로그인 콜백 처리"""
    code = request.args.get('code')
    state = request.args.get('state')
    
    if state != session.get('oauth_state'):
        return jsonify({'error': 'Invalid state'}), 400
    
    if not code:
        return jsonify({'error': 'Authorization code not provided'}), 400
    
    try:
        # 토큰 교환
        redirect_uri = f"{BACKEND_URL}/api/auth/kakao/callback"
        token_response = requests.post('https://kauth.kakao.com/oauth/token', data={
            'grant_type': 'authorization_code',
            'client_id': KAKAO_CLIENT_ID,
            'client_secret': KAKAO_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'code': code
        })
        
        token_data = token_response.json()
        if 'access_token' not in token_data:
            return jsonify({'error': 'Failed to get access token'}), 400
        
        # 사용자 정보 가져오기 (이메일과 닉네임을 받기 위해 property_keys 지정)
        user_response = requests.get(
            'https://kapi.kakao.com/v2/user/me',
            headers={'Authorization': f"Bearer {token_data['access_token']}"},
            params={'property_keys': '["kakao_account.email", "kakao_account.profile.nickname"]'}
        )
        user_data = user_response.json()
        
        print(f"[Kakao Callback] User data: {user_data}")  # 디버깅용
        
        kakao_account = user_data.get('kakao_account', {})
        email = kakao_account.get('email', '')
        profile = kakao_account.get('profile', {})
        nickname = profile.get('nickname', '') if profile else ''
        
        if not email:
            email = f"kakao_{user_data.get('id')}@kakao.com"
        if not nickname:
            nickname = f"카카오사용자_{user_data.get('id')}"
        
        # 사용자 조회 또는 생성
        user = get_or_create_user(
            email=email,
            nickname=nickname,
            provider='kakao',
            provider_id=str(user_data.get('id'))
        )
        
        # JWT 토큰 생성
        token = generate_jwt_token(user['id'], user['email'], user['nickname'], provider='kakao')
        
        return redirect(f"{FRONTEND_URL}/auth/success?token={token}")
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# =====================
# 네이버 로그인
# =====================

@app.route('/api/auth/naver')
def naver_login():
    """네이버 로그인 시작"""
    if not NAVER_CLIENT_ID:
        return jsonify({'error': 'Naver OAuth not configured'}), 500
    
    state = secrets.token_urlsafe(32)
    session['oauth_state'] = state
    session['oauth_provider'] = 'naver'
    
    redirect_uri = f"{BACKEND_URL}/api/auth/naver/callback"
    naver_auth_url = (
        f"https://nid.naver.com/oauth2.0/authorize?"
        f"response_type=code&"
        f"client_id={NAVER_CLIENT_ID}&"
        f"redirect_uri={redirect_uri}&"
        f"state={state}"
    )
    
    return redirect(naver_auth_url)

@app.route('/api/auth/naver/callback')
def naver_callback():
    """네이버 로그인 콜백 처리"""
    code = request.args.get('code')
    state = request.args.get('state')
    
    if state != session.get('oauth_state'):
        return jsonify({'error': 'Invalid state'}), 400
    
    if not code:
        return jsonify({'error': 'Authorization code not provided'}), 400
    
    try:
        # 토큰 교환
        redirect_uri = f"{BACKEND_URL}/api/auth/naver/callback"
        token_response = requests.post('https://nid.naver.com/oauth2.0/token', data={
            'grant_type': 'authorization_code',
            'client_id': NAVER_CLIENT_ID,
            'client_secret': NAVER_CLIENT_SECRET,
            'redirect_uri': redirect_uri,
            'code': code,
            'state': state
        })
        
        token_data = token_response.json()
        if 'access_token' not in token_data:
            return jsonify({'error': 'Failed to get access token'}), 400
        
        # 사용자 정보 가져오기
        user_response = requests.get(
            'https://openapi.naver.com/v1/nid/me',
            headers={'Authorization': f"Bearer {token_data['access_token']}"}
        )
        user_data = user_response.json()
        
        response_data = user_data.get('response', {})
        email = response_data.get('email', '')
        nickname = response_data.get('nickname', '')
        
        if not email:
            email = f"naver_{response_data.get('id')}@naver.com"
        if not nickname:
            nickname = f"네이버사용자_{response_data.get('id')}"
        
        # 사용자 조회 또는 생성
        user = get_or_create_user(
            email=email,
            nickname=nickname,
            provider='naver',
            provider_id=response_data.get('id')
        )
        
        # JWT 토큰 생성
        token = generate_jwt_token(user['id'], user['email'], user['nickname'], provider='naver')
        
        return redirect(f"{FRONTEND_URL}/auth/success?token={token}")
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'environment': os.getenv('FLASK_ENV', 'development'),
        'debug': os.getenv('FLASK_DEBUG', 'false')
    })

if __name__ == '__main__':
    debug_mode = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    app.run(host='0.0.0.0', port=5000, debug=debug_mode)