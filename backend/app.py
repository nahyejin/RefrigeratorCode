from flask import Flask, jsonify, request, redirect, session
from flask_cors import CORS
import pymysql
import os
from dotenv import load_dotenv
import requests
import jwt
import secrets
from datetime import datetime, timedelta
from werkzeug.security import generate_password_hash, check_password_hash
import random
import string
import smtplib
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# 환경변수 로드
# - 개발환경에서만 현재 디렉토리의 .env를 로드
# - 배포환경(Railway 등)에서는 플랫폼이 주입한 환경변수 사용
# .env 파일이 있으면 로드 (기존 환경변수는 덮어쓰지 않음)
if os.getenv('FLASK_ENV', '').lower() == 'development' or not os.getenv('GOOGLE_CLIENT_ID'):
    load_dotenv(override=False)  # 기존 환경변수가 있으면 덮어쓰지 않음

# SMTP 설정 확인 (디버깅용)
print(f"[환경변수 로드 확인] SMTP_HOST: {os.getenv('SMTP_HOST', 'NOT SET')}")
print(f"[환경변수 로드 확인] SMTP_USER: {os.getenv('SMTP_USER', 'NOT SET')}")
print(f"[환경변수 로드 확인] SMTP_PASSWORD: {'SET' if os.getenv('SMTP_PASSWORD') else 'NOT SET'}")

# OAuth 환경변수 확인 (디버깅용)
print(f"[환경변수 로드 확인] GOOGLE_CLIENT_ID: {'SET' if os.getenv('GOOGLE_CLIENT_ID') else 'NOT SET'}")
print(f"[환경변수 로드 확인] KAKAO_CLIENT_ID: {'SET' if os.getenv('KAKAO_CLIENT_ID') else 'NOT SET'}")
print(f"[환경변수 로드 확인] NAVER_CLIENT_ID: {'SET' if os.getenv('NAVER_CLIENT_ID') else 'NOT SET'}")
print(f"[환경변수 로드 확인] FLASK_ENV: {os.getenv('FLASK_ENV', 'NOT SET')}")
print(f"[환경변수 로드 확인] RAILWAY_ENVIRONMENT: {os.getenv('RAILWAY_ENVIRONMENT', 'NOT SET')}")

app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY', secrets.token_hex(32))

# 재료 매칭률 계산에서 조미료는 낮은 가중치, 나머지 식재료는 높은 가중치를 준다.
# chat_service.py의 _load_seasoning_set() / frontend/src/utils/recipeUtils.ts의
# SEASONING_INGREDIENTS 와 반드시 같은 재료·같은 가중치로 맞춘다 — 셋 중 하나만
# 고치면 챗봇/냉장고요리·요즘인기 서버 정렬/카드 표시 매칭률이 서로 달라진다.
# (재료 사전엔 이 분류가 287개 있지만, 여긴 사용자가 가진 재료 수만큼만 반복하므로
# chat_service.py 와 달리 성능 문제는 없다 — 그래도 세 곳의 숫자를 갈라지게 두지
# 않으려고 일부러 같은 15개로 맞췄다)
SEASONING_WEIGHT = 0.3
CORE_WEIGHT = 1.0
SEASONING_INGREDIENTS = {
    '소금', '후추', '설탕', '식용유', '참기름', '들기름', '맛술', '미림',
    '식초', '물', '간장', '올리고당', '굴소스', '다시다', '미원',
}

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
     methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'])

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
        autocommit=False,
        # Railway MySQL 서버 시계가 UTC라, 세션 타임존을 KST로 고정해 둔다.
        # 이걸 안 하면 NOW()/CURRENT_TIMESTAMP로 채워지는 모든 created_at/updated_at이
        # 한국 시간보다 9시간 느리게 찍혀서 SELECT로 직접 봐도, 날짜별로 묶는 화면
        # (요리 캘린더 등)에서도 자정~오전9시 기록이 하루 전으로 새는 문제가 있었다.
        init_command="SET time_zone = '+09:00'"
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
    
    # 중요: 재료 파라미터를 먼저 저장 (match_rate 계산식에서 먼저 사용됨)
    # match_rate 계산식이 SELECT 절에 있으므로, 재료 파라미터가 먼저 와야 함
    match_rate_params = []
    if my_ingredients:
        match_rate_params = my_ingredients.copy()
    
    # 채널 필터
    if platform:
        where_clauses.append("platform LIKE %s")
        base_params.append(f"%{platform}%")
    
    # 키워드 필터
    if keyword:
        where_clauses.append("(title LIKE %s OR content LIKE %s)")
        base_params.extend([f"%{keyword}%", f"%{keyword}%"])
    
    # 포함할 재료 필터 (AND 조건: 모두 포함)
    if include_ingredients:
        for ing in include_ingredients:
            where_clauses.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0")
            base_params.append(ing)
    
    # 제외할 재료 필터 (AND 조건: 모두 제외)
    if exclude_ingredients:
        for ing in exclude_ingredients:
            where_clauses.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) = 0")
            base_params.append(ing)
    
    # 카테고리 키워드 필터 (FULLTEXT 인덱스 사용으로 성능 최적화)
    # FULLTEXT 인덱스 존재 여부는 한 번만 확인하고 캐싱 (성능 최적화)
    if category_keywords:
        fulltext_keywords = []
        for category, keywords in category_keywords.items():
            if keywords and len(keywords) > 0:
                fulltext_keywords.extend(keywords)
        
        if fulltext_keywords:
            # FULLTEXT 인덱스 존재 여부 확인 (캐싱하여 매번 쿼리하지 않음)
            # 전역 변수로 인덱스 존재 여부 캐싱 (앱 시작 시 한 번만 확인)
            if not hasattr(get_filtered_recipes, '_fulltext_index_checked'):
                try:
                    check_index_sql = """
                        SELECT COUNT(*) as cnt 
                        FROM information_schema.statistics 
                        WHERE table_schema = DATABASE() 
                        AND table_name = 'recipes' 
                        AND index_name = 'ft_title_content'
                    """
                    cursor.execute(check_index_sql)
                    result = cursor.fetchone()
                    get_filtered_recipes._fulltext_index_exists = result['cnt'] > 0
                    get_filtered_recipes._fulltext_index_checked = True
                    print(f"[필터링] FULLTEXT 인덱스 확인: {result['cnt']}개 발견, 존재 여부: {get_filtered_recipes._fulltext_index_exists}")
                except Exception as e:
                    get_filtered_recipes._fulltext_index_exists = False
                    get_filtered_recipes._fulltext_index_checked = True
                    print(f"[필터링] FULLTEXT 인덱스 확인 중 오류: {e}")
            
            # FULLTEXT 인덱스 사용 (성능 최적화)
            # 4자 미만 단어는 LIKE로 처리하고, 4자 이상은 FULLTEXT로 처리
            use_fulltext = getattr(get_filtered_recipes, '_fulltext_index_exists', False)
            
            if use_fulltext:
                # MySQL FULLTEXT 검색은 기본적으로 4자 미만 단어를 무시함
                # 따라서 4자 이상 키워드는 FULLTEXT로, 4자 미만은 LIKE로 처리
                fulltext_keywords_long = [kw for kw in fulltext_keywords if len(kw.strip()) >= 4]
                fulltext_keywords_short = [kw for kw in fulltext_keywords if len(kw.strip()) < 4]
                
                keyword_conditions = []
                
                # 4자 이상 키워드는 FULLTEXT 검색 사용
                if fulltext_keywords_long:
                    # FULLTEXT BOOLEAN MODE에서 공백은 OR를 의미
                    # 공백이 포함된 키워드는 따옴표로 감싸기
                    formatted_keywords = []
                    for kw in fulltext_keywords_long:
                        kw_clean = kw.strip()
                        if ' ' in kw_clean:
                            # 공백이 있으면 따옴표로 감싸기
                            formatted_keywords.append(f'"{kw_clean}"')
                        else:
                            formatted_keywords.append(kw_clean)
                    keyword_string = ' '.join(formatted_keywords)
                    keyword_conditions.append("MATCH(title, content) AGAINST(%s IN BOOLEAN MODE)")
                    base_params.append(keyword_string)
                    print(f"[필터링] FULLTEXT 인덱스 사용 (4자 이상): {keyword_string}")
                
                # 4자 미만 키워드는 LIKE 검색 사용
                if fulltext_keywords_short:
                    like_conditions = []
                    for kw in fulltext_keywords_short:
                        kw_clean = kw.strip()
                        if kw_clean:
                            like_conditions.append("(title LIKE %s OR content LIKE %s)")
                            base_params.extend([f"%{kw_clean}%", f"%{kw_clean}%"])
                    if like_conditions:
                        keyword_conditions.append(f"({' OR '.join(like_conditions)})")
                        print(f"[필터링] LIKE 검색 사용 (4자 미만): {len(like_conditions)}개 키워드")
                
                # FULLTEXT와 LIKE 조건을 OR로 연결
                if keyword_conditions:
                    final_keyword_condition = f"({' OR '.join(keyword_conditions)})"
                    where_clauses.append(final_keyword_condition)
                    print(f"[필터링] 최종 키워드 조건: {final_keyword_condition}")
                else:
                    print(f"[필터링] 경고: 키워드 조건이 생성되지 않음")
            else:
                # LIKE로 폴백 - 모든 키워드를 LIKE로 검색
                keyword_conditions = []
                for kw in fulltext_keywords:
                    kw_clean = kw.strip()
                    if kw_clean:
                        keyword_conditions.append("(title LIKE %s OR content LIKE %s)")
                        base_params.extend([f"%{kw_clean}%", f"%{kw_clean}%"])
                if keyword_conditions:
                    # OR 조건으로 변경: 하나라도 매칭되면 통과
                    final_condition = f"({' OR '.join(keyword_conditions)})"
                    where_clauses.append(final_condition)
    
    # 임박재료 필터 (OR 조건: 하나라도 포함)
    if applied_expiry_ingredients:
        expiry_conditions = []
        for ing in applied_expiry_ingredients:
            expiry_conditions.append("FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0")
            base_params.append(ing)
        if expiry_conditions:
            where_clauses.append(f"({' OR '.join(expiry_conditions)})")
    
    where_sql = " AND ".join(where_clauses) if where_clauses else "1=1"

    # match_rate 계산식 최적화
    # 성능 최적화: 재료마다 FIND_IN_SET을 반복하지 않고, OR 조건으로 묶어서 한 번에 처리
    total_ing_expr = """
      CASE WHEN used_ingredients IS NULL OR used_ingredients=''
           THEN 0
           ELSE LENGTH(REPLACE(used_ingredients,' ','')) - LENGTH(REPLACE(REPLACE(used_ingredients,' ',''),',','')) + 1
      END
    """

    # 조미료만 지운 문자열(재료 가중치 계산용). 콤마로 앞뒤를 감싸서(",a,b,")
    # 정확히 그 항목만 지운다 — 부분 문자열로 다른 재료 이름 일부가 잘리지 않게.
    # SEASONING_INGREDIENTS는 고정 상수(사용자 입력 아님)라 SQL에 직접 넣어도
    # 인젝션 위험이 없다.
    _seasoning_free_expr = "CONCAT(',', REPLACE(used_ingredients,' ',''), ',')"
    for _seasoning in SEASONING_INGREDIENTS:
        _quoted = "'" + _seasoning.replace("\\", "\\\\").replace("'", "\\'") + "'"
        _seasoning_free_expr = f"REPLACE({_seasoning_free_expr}, CONCAT(',', {_quoted}, ','), ',')"
    non_seasoning_ing_expr = f"""
      CASE WHEN used_ingredients IS NULL OR used_ingredients=''
                OR {_seasoning_free_expr} = ',,'
           THEN 0
           ELSE LENGTH({_seasoning_free_expr})
                - LENGTH(REPLACE({_seasoning_free_expr}, ',', '')) - 1
      END
    """
    # 가중치 적용 분모 = 조미료 아닌 개수*CORE_WEIGHT + 조미료 개수*SEASONING_WEIGHT
    #                = 전체*SEASONING_WEIGHT + (조미료 아닌 개수)*(CORE_WEIGHT - SEASONING_WEIGHT)
    weighted_total_ing_expr = (
        f"(({total_ing_expr}) * {SEASONING_WEIGHT} "
        f"+ ({non_seasoning_ing_expr}) * {CORE_WEIGHT - SEASONING_WEIGHT})"
    )
    
    # match_rate 계산은 정렬이 match_rate이거나 match_rate 필터가 있을 때만 수행
    need_match_rate = (sort_by == 'match_rate' or match_rate_min is not None or match_rate_max is not None)
    
    # 성능 최적화: match_rate 계산이 필요 없으면 WHERE 절에서 재료 필터링도 생략 가능
    # 하지만 include_ingredients나 exclude_ingredients는 여전히 필요하므로 유지
    
    if my_ingredients and need_match_rate:
        # 성능 최적화: 모든 재료를 REGEXP로 묶어서 한 번의 정규식 검색으로 처리
        # 각 재료마다 FIND_IN_SET을 반복하지 않고, 하나의 REGEXP 패턴으로 모든 재료를 한 번에 검색
        # 정확한 단어 매칭을 위해 쉼표로 감싸서 검색
        normalized_ingredients = "CONCAT(',', REPLACE(used_ingredients,' ',''), ',')"
        
        # 모든 재료를 OR로 묶은 정규식 패턴 생성 (예: ,(재료1|재료2|재료3),)
        # 이스케이프가 필요한 특수문자 처리
        escaped_ingredients = [ing.replace('\\', '\\\\').replace('|', '\\|').replace('(', '\\(').replace(')', '\\)').replace('[', '\\[').replace(']', '\\]').replace('.', '\\.') for ing in my_ingredients]
        regex_pattern = ',' + '|'.join(escaped_ingredients) + ','
        
        # REGEXP로 한 번에 모든 재료를 검색하고, 매칭된 개수를 계산
        # REGEXP_REPLACE나 LENGTH를 사용하여 매칭 개수 계산
        # MySQL 8.0+에서는 REGEXP_REPLACE를 사용할 수 있지만, 호환성을 위해 다른 방법 사용
        # 대신 각 재료가 매칭되면 1씩 더하는 방식 사용
        # 하지만 이렇게 하면 여전히 반복이 발생하므로, 더 효율적인 방법 사용
        
        # 방법: REGEXP로 매칭 여부를 확인하고, 매칭된 재료 개수를 계산
        # REGEXP로 매칭되면 최소 1개 이상 매칭된 것이므로, 개별 계산 필요
        # 실제로는 각 재료를 체크해야 하므로, REGEXP로 필터링 후 개별 계산
        
        # 최적화: REGEXP로 한 번 필터링한 후, 매칭된 재료만 개별 계산
        # 하지만 이는 서브쿼리가 필요하므로 복잡함
        
        # 실용적인 최적화: 모든 재료를 하나의 정규식으로 묶어서 매칭 여부 확인
        # 매칭 개수는 여전히 각 재료를 체크해야 하므로, 최적화된 FIND_IN_SET 사용
        # 또는 LENGTH와 REPLACE를 사용하여 매칭 개수 계산
        
        # 가장 효율적인 방법: 모든 재료를 OR 조건으로 묶어서 한 번의 REGEXP 검색
        # 매칭 개수는 REGEXP로 매칭된 후, 각 재료를 개별적으로 체크 (하지만 이미 필터링된 결과에 대해서만)
        
        # 실용적 접근: REGEXP로 전체 매칭 여부를 확인하고, 매칭된 경우에만 개별 계산
        # 하지만 이는 복잡하므로, 더 간단한 방법 사용
        
        # 최종 방법: 모든 재료를 하나의 문자열로 합쳐서 한 번의 LIKE 검색
        # 하지만 이는 정확도가 떨어지므로, REGEXP 사용
        
        # REGEXP를 사용한 최적화된 방법
        # 모든 재료를 OR로 묶은 정규식 패턴으로 한 번에 검색
        match_conditions = []
        for ing in my_ingredients:
            # 정확한 단어 매칭을 위해 쉼표로 감싸서 검색
            match_conditions.append(f"{normalized_ingredients} LIKE CONCAT('%,', %s, ',%')")
        
        # 모든 조건을 OR로 묶어서 한 번에 처리
        # 하지만 여전히 각 재료마다 LIKE를 반복하므로, REGEXP 사용
        regex_escaped = [ing.replace('\\', '\\\\').replace('|', '\\|').replace('(', '\\(').replace(')', '\\)').replace('[', '\\[').replace(']', '\\]').replace('.', '\\.') for ing in my_ingredients]
        regex_pattern_param = ',' + '|'.join(regex_escaped) + ','
        
        # REGEXP로 매칭 여부 확인 (한 번의 검색)
        # 매칭 개수는 여전히 각 재료를 체크해야 하므로, 최적화된 방법 사용
        # REGEXP로 매칭되면 최소 1개 이상 매칭된 것이므로, 개별 계산 필요
        
        # 실용적인 최적화: REGEXP로 전체 매칭 여부를 확인하고, 매칭된 경우에만 개별 계산
        # 하지만 이는 복잡하므로, 더 간단한 방법 사용
        
        # 최적화: REGEXP로 한 번에 모든 재료를 검색하고, 매칭된 경우에만 개별 계산
        # 이렇게 하면 매칭되지 않은 레시피는 개별 체크를 생략하여 성능 향상
        # 정규식 패턴: ,(재료1|재료2|재료3), 형태로 모든 재료를 OR 조건으로 묶음
        regex_pattern_param = ',' + '|'.join(escaped_ingredients) + ','
        
        # REGEXP로 한 번에 모든 재료를 검색 (매칭 여부만 확인)
        # 매칭 개수는 REGEXP로 매칭된 경우에만 각 재료를 개별적으로 체크
        # 매칭되지 않은 레시피는 개별 체크를 생략하여 성능 향상
        # 재료마다 가중치를 다르게 준다: 조미료는 SEASONING_WEIGHT, 나머지는 CORE_WEIGHT
        match_count_parts = [
            f"(CASE WHEN FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0 "
            f"THEN {SEASONING_WEIGHT if ing in SEASONING_INGREDIENTS else CORE_WEIGHT} ELSE 0 END)"
            for ing in my_ingredients
        ]
        match_count_expr = f"""
            CASE
                WHEN {normalized_ingredients} REGEXP %s THEN ({' + '.join(match_count_parts)})
                ELSE 0
            END
        """

        # REGEXP 패턴을 첫 번째 파라미터로 추가, 그 다음 재료들 추가
        match_rate_params = [regex_pattern_param] + my_ingredients.copy()

        # weighted_total_ing_expr(가중치 적용 분모)는 used_ingredients가 있으면
        # SEASONING_WEIGHT > 0 이라 항상 0보다 크다 — "0인지" 재확인 대신 이미 계산해
        # 둔 total_ing_expr의 0/공백 체크를 그대로 재사용해서, 무거운 조미료 제외
        # 문자열(weighted_total_ing_expr 안의 REPLACE 체인)을 한 번만 평가한다.
        match_rate_expr = f"CASE WHEN used_ingredients IS NULL OR used_ingredients='' THEN 0 ELSE ROUND(({match_count_expr})/({weighted_total_ing_expr})*100) END"
    else:
        # match_rate가 필요 없을 때는 계산 생략하여 성능 향상
        match_rate_expr = "0"
        match_rate_params = []

    # ORDER BY
    if sort_by == 'match_rate':
        # 재료 매칭률 기준으로만 정렬 (match_rate가 모두 같을 때도 match_rate 기준 유지)
        order_by = "match_rate DESC"
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

    # COUNT 쿼리 최적화: match_rate 필터가 없으면 간단한 COUNT만 실행
    # match_rate 필터가 있을 때만 서브쿼리 사용
    #
    # 추가 최적화: 프론트(RecipeList.tsx)는 1페이지만 total을 실제로 쓰고
    # 백그라운드로 이어받는 2페이지 이후는 total을 아예 무시한다(같은 필터
    # 조건이라 1페이지에서 이미 받았으므로). 그런데도 이 COUNT 서브쿼리는
    # match_rate 계산식을 전체 매칭 행에 대해 다시 실행하는 무거운 연산이라,
    # 페이지마다 매번 다시 돌리면 "페이지가 늘어날수록 다음 페이지가 점점
    # 느려진다" — 매 요청이 거의 전체 재계산과 맞먹는 비용을 다시 치르기
    # 때문. page>1이면 이 무거운 COUNT를 건너뛰고 이전에 이미 받은 total을
    # 그대로 쓰게 한다(0으로 반환 — 프론트가 어차피 안 씀).
    count_start = time.time()

    if page > 1:
        total = 0
        count_time = time.time() - count_start
        print(f"[필터링] COUNT 쿼리 생략(page={page} > 1, 프론트가 total을 안 씀)")
    elif match_rate_min is not None or match_rate_max is not None or need_match_rate:
        # match_rate 필터가 있거나 match_rate 계산이 필요한 경우에만 서브쿼리 사용
        count_params = match_rate_params + base_params
        count_sql = f"""
          SELECT COUNT(*) AS total 
          FROM (
            SELECT {match_rate_expr} AS match_rate
            FROM recipes
            WHERE {where_sql}
        """
        
        # HAVING 절 추가 (match_rate 필터) - 서브쿼리 안에 추가
        if match_rate_min is not None or match_rate_max is not None:
            having_clauses = []
            if match_rate_min is not None:
                having_clauses.append("match_rate >= %s")
                count_params = count_params + [match_rate_min]
            if match_rate_max is not None:
                having_clauses.append("match_rate <= %s")
                count_params = count_params + [match_rate_max]
            if having_clauses:
                count_sql += " HAVING " + " AND ".join(having_clauses)
        
        count_sql += " ) AS subquery"
        cursor.execute(count_sql, count_params)
    else:
        # match_rate 계산이 필요 없으면 간단한 COUNT만 실행 (훨씬 빠름)
        count_sql = f"SELECT COUNT(*) AS total FROM recipes WHERE {where_sql}"
        cursor.execute(count_sql, base_params)

    if page <= 1:
        total = cursor.fetchone()['total']
        count_time = time.time() - count_start
        print(f"[필터링] COUNT 쿼리 실행 시간: {count_time:.3f}초, 필터링된 전체 개수 (total): {total}")

    # 메인 쿼리 최적화: content는 큰 TEXT 컬럼이므로 선택적으로 가져오기
    # 프론트엔드에서 content를 사용하는지 확인 필요 (일단 제외하여 성능 향상)
    # 필요하면 별도 API로 가져오거나, 페이징된 결과에만 포함
    select_cols = "id, title, thumbnail, platform, likes, comments, hits, post_time, used_ingredients, link"
    # content는 제외하여 네트워크 전송량과 메모리 사용량 감소
    main_sql = f"""
      SELECT {select_cols},
             {match_rate_expr} AS match_rate
      FROM recipes
      WHERE {where_sql}
    """
    # 파라미터 순서: 재료 파라미터(match_rate 계산용) → WHERE 절 파라미터(키워드 등)
    # match_rate 계산식이 SELECT 절에 먼저 나오므로, 재료 파라미터가 먼저 와야 함
    main_params = match_rate_params + base_params
    
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
    
    # 쿼리 실행 시간 측정 (성능 모니터링)
    query_start = time.time()
    
    cursor.execute(main_sql, main_params)
    rows = cursor.fetchall()
    query_time = time.time() - query_start
    print(f"[필터링] 메인 쿼리 실행 시간: {query_time:.3f}초, 결과 개수: {len(rows)}")

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

# 환경변수 로드 확인 (디버깅용)
print(f"[OAuth 환경변수 확인] GOOGLE_CLIENT_ID: {'SET (' + str(len(GOOGLE_CLIENT_ID)) + ' chars)' if GOOGLE_CLIENT_ID else 'NOT SET'}")
print(f"[OAuth 환경변수 확인] KAKAO_CLIENT_ID: {'SET (' + str(len(KAKAO_CLIENT_ID)) + ' chars)' if KAKAO_CLIENT_ID else 'NOT SET'}")
print(f"[OAuth 환경변수 확인] NAVER_CLIENT_ID: {'SET (' + str(len(NAVER_CLIENT_ID)) + ' chars)' if NAVER_CLIENT_ID else 'NOT SET'}")
print(f"[OAuth 환경변수 확인] FRONTEND_URL: {os.getenv('FRONTEND_URL', 'NOT SET')}")
print(f"[OAuth 환경변수 확인] BACKEND_URL: {os.getenv('BACKEND_URL', 'NOT SET')}")

# 프론트엔드 URL (콜백용)
FRONTEND_URL = os.getenv('FRONTEND_URL', 'http://localhost:5178')
# 백엔드 URL (OAuth 콜백용)
BACKEND_URL = os.getenv('BACKEND_URL', 'http://localhost:5000')

# 요리 캘린더 절약액 추정의 기본 "한 끼당 절약액"(원). households/users의
# savings_per_meal이 NULL(직접 설정 안 함)일 때만 이 기본값을 쓴다.
ESTIMATED_SAVINGS_PER_MEAL_DEFAULT = 8000

# JWT 서명 키가 없으면 app.secret_key(기동할 때마다 새로 만드는 난수)로 떨어진다.
# 이 경우 서버를 재시작하는 순간 **이미 발급한 토큰이 전부 무효**가 되는데,
# 프론트는 토큰을 서버에 확인하지 않고 payload 만 읽어 쓰기 때문에
# 화면에는 여전히 로그인 상태로 보이고, 인증이 필요한 동작에서만
# "유효하지 않은 토큰입니다" 가 뜬다. 원인을 찾기 매우 어려운 형태라 기동 시 경고한다.
if not os.getenv('JWT_SECRET_KEY'):
    print('[경고] JWT_SECRET_KEY 가 설정되지 않았습니다. '
          '서버를 재시작하면 발급된 로그인 토큰이 모두 무효가 됩니다.')


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

def verify_jwt_token(token):
    """JWT 토큰 검증"""
    try:
        secret_key = os.getenv('JWT_SECRET_KEY', app.secret_key)
        payload = jwt.decode(token, secret_key, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def ensure_users_table():
    """users 테이블이 없으면 생성하고, password 필드가 없으면 추가"""
    db = get_db()
    cursor = db.cursor()
    
    try:
        # 테이블 생성
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                email VARCHAR(255) NOT NULL,
                nickname VARCHAR(255) NOT NULL,
                provider VARCHAR(50) NOT NULL,
                provider_id VARCHAR(255) NOT NULL,
                password VARCHAR(255) NULL,
                deleted_at DATETIME NULL,
                created_at DATETIME NOT NULL,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                UNIQUE KEY unique_provider_user (email, provider),
                INDEX idx_provider_id (provider, provider_id),
                INDEX idx_deleted_at (deleted_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.commit()
        
        # password 필드가 없으면 추가 (기존 테이블 마이그레이션)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN password VARCHAR(255) NULL")
            db.commit()
        except Exception as e:
            # 필드가 이미 존재하면 무시
            if 'Duplicate column name' not in str(e):
                print(f"Error adding password column: {e}")
            db.rollback()
        
        # deleted_at 필드가 없으면 추가 (기존 테이블 마이그레이션)
        try:
            cursor.execute("ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL")
            cursor.execute("ALTER TABLE users ADD INDEX idx_deleted_at (deleted_at)")
            db.commit()
        except Exception as e:
            # 필드가 이미 존재하면 무시
            if 'Duplicate column name' not in str(e):
                print(f"Error adding deleted_at column: {e}")
            db.rollback()
    except Exception as e:
        db.rollback()
        print(f"Error creating users table: {e}")
    finally:
        db.close()

def get_or_create_user(email, nickname, provider, provider_id):
    """사용자 조회 또는 생성 (탈퇴한 사용자 제외)"""
    # 테이블이 없으면 생성
    ensure_users_table()
    
    db = get_db()
    cursor = db.cursor()
    
    try:
        # 기존 사용자 조회 (탈퇴하지 않은 사용자만)
        cursor.execute(
            "SELECT id, email, nickname FROM users WHERE email = %s AND provider = %s AND deleted_at IS NULL",
            (email, provider)
        )
        user = cursor.fetchone()
        
        if user:
            db.commit()
            return user
        
        # 탈퇴한 사용자가 있는지 확인
        cursor.execute(
            "SELECT id, email, nickname FROM users WHERE email = %s AND provider = %s AND deleted_at IS NOT NULL",
            (email, provider)
        )
        deleted_user = cursor.fetchone()
        
        if deleted_user:
            # 탈퇴한 사용자가 있으면 새로 생성 (이메일 재사용 가능)
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
        # 네이버는 별명을 '9208****' 처럼 마스킹해서 내려주는 경우가 있어 그대로 쓰면 안 됨
        if not nickname or '*' in nickname:
            nickname = email.split('@')[0] or f"네이버사용자_{response_data.get('id')}"
        
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

# =====================
# 일반 회원가입/로그인
# =====================

@app.route('/api/auth/signup', methods=['POST'])
def signup():
    """일반 회원가입"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        nickname = data.get('nickname', '').strip()
        
        # 유효성 검사
        if not email or not password:
            return jsonify({'error': '이메일과 비밀번호를 입력해주세요.'}), 400
        
        if not nickname:
            return jsonify({'error': '닉네임을 입력해주세요.'}), 400
        
        # 이메일 형식 검사 (간단한 검사)
        if '@' not in email:
            return jsonify({'error': '올바른 이메일 형식이 아닙니다.'}), 400
        
        # 비밀번호 길이 검사
        if len(password) < 4:
            return jsonify({'error': '비밀번호는 최소 4자 이상이어야 합니다.'}), 400
        
        # 이메일 인증 확인 (운영 환경에서만 필수, 개발 환경에서는 선택)
        require_email_verification = os.getenv('REQUIRE_EMAIL_VERIFICATION', 'false').lower() == 'true'
        if require_email_verification:
            if email not in email_verification_codes:
                return jsonify({'error': '이메일 인증이 필요합니다.'}), 400
            
            verification_data = email_verification_codes[email]
            if not verification_data.get('verified', False):
                return jsonify({'error': '이메일 인증이 완료되지 않았습니다.'}), 400
            
            # 인증 완료 후 코드 삭제
            del email_verification_codes[email]
        
        ensure_users_table()
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 이미 존재하는 사용자 확인 (같은 이메일, 같은 provider, 탈퇴하지 않은 사용자만)
            cursor.execute(
                "SELECT id FROM users WHERE email = %s AND provider = 'local' AND deleted_at IS NULL",
                (email,)
            )
            existing_user = cursor.fetchone()
            
            if existing_user:
                return jsonify({'error': '이미 가입된 이메일입니다.'}), 400
            
            # 탈퇴한 사용자가 있는지 확인
            cursor.execute(
                "SELECT id FROM users WHERE email = %s AND provider = 'local' AND deleted_at IS NOT NULL",
                (email,)
            )
            deleted_user = cursor.fetchone()
            
            # 비밀번호 해싱
            password_hash = generate_password_hash(password)
            print(f"[회원가입] 이메일: {email}, 비밀번호 해시 생성 완료, 해시 길이: {len(password_hash)}")
            
            if deleted_user:
                # 탈퇴한 사용자가 있으면 재활성화 (deleted_at을 NULL로 설정하고 정보 업데이트)
                # 이렇게 하면 같은 user_id를 유지하여 관련 데이터(user_ingredients 등) 연결 유지
                cursor.execute(
                    "UPDATE users SET nickname = %s, password = %s, deleted_at = NULL, updated_at = NOW() WHERE id = %s",
                    (nickname, password_hash, deleted_user['id'])
                )
                user_id = deleted_user['id']
                db.commit()
                print(f"[회원가입] 탈퇴한 사용자 재활성화 완료, ID: {user_id}")
            else:
                # 새 사용자 생성
                cursor.execute(
                    "INSERT INTO users (email, nickname, provider, provider_id, password, created_at) VALUES (%s, %s, 'local', %s, %s, NOW())",
                    (email, nickname, email, password_hash)  # provider_id는 이메일 사용
                )
                user_id = cursor.lastrowid
                db.commit()
                print(f"[회원가입] 사용자 생성 완료, ID: {user_id}")
            
            # JWT 토큰 생성
            token = generate_jwt_token(user_id, email, nickname, provider='local')
            
            return jsonify({
                'message': '회원가입이 완료되었습니다.',
                'token': token,
                'user': {
                    'id': user_id,
                    'email': email,
                    'nickname': nickname
                }
            }), 201
            
        except Exception as e:
            db.rollback()
            print(f"Signup error: {e}")
            return jsonify({'error': '회원가입 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Signup error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    """일반 로그인"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        password = data.get('password', '').strip()
        
        # 유효성 검사
        if not email or not password:
            return jsonify({'error': '이메일과 비밀번호를 입력해주세요.'}), 400
        
        ensure_users_table()
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 사용자 조회
            cursor.execute(
                "SELECT id, email, nickname, password FROM users WHERE email = %s AND provider = 'local' AND deleted_at IS NULL",
                (email,)
            )
            user = cursor.fetchone()
            
            if not user:
                return jsonify({'error': '이메일 또는 비밀번호가 올바르지 않습니다.'}), 401
            
            # DictCursor를 사용하므로 딕셔너리로 접근
            user_id = user['id']
            user_email = user['email']
            user_nickname = user['nickname']
            password_hash = user['password']
            
            # 디버깅 로그
            print(f"[로그인 시도] 이메일: {email}, 비밀번호 해시 존재: {bool(password_hash)}, 해시 길이: {len(str(password_hash)) if password_hash else 0}, 해시 값: {str(password_hash)[:20] if password_hash else 'None'}...")
            
            # 비밀번호 확인
            if not password_hash:
                print(f"[로그인 실패] 비밀번호 해시가 없습니다.")
                return jsonify({'error': '이메일 또는 비밀번호가 올바르지 않습니다.'}), 401
            
            password_match = check_password_hash(password_hash, password)
            print(f"[비밀번호 검증] 결과: {password_match}, 입력 비밀번호 길이: {len(password)}")
            
            if not password_match:
                print(f"[로그인 실패] 비밀번호가 일치하지 않습니다.")
                return jsonify({'error': '이메일 또는 비밀번호가 올바르지 않습니다.'}), 401
            
            # JWT 토큰 생성
            token = generate_jwt_token(user_id, user_email, user_nickname, provider='local')
            
            return jsonify({
                'message': '로그인되었습니다.',
                'token': token,
                'user': {
                    'id': user_id,
                    'email': user_email,
                    'nickname': user_nickname
                }
            }), 200
            
        except Exception as e:
            print(f"Login error: {e}")
            return jsonify({'error': '로그인 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

# =====================
# 이메일 중복 체크 및 인증
# =====================

# 인증 코드 저장소 (실제 운영에서는 Redis 등을 사용하는 것이 좋습니다)
email_verification_codes = {}

def generate_verification_code():
    """6자리 인증 코드 생성"""
    return ''.join(random.choices(string.digits, k=6))

def send_verification_email(email, code):
    """인증 코드 이메일 발송"""
    try:
        smtp_host = os.getenv('SMTP_HOST', '')
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_user = os.getenv('SMTP_USER', '')
        smtp_password = os.getenv('SMTP_PASSWORD', '')
        smtp_from = os.getenv('SMTP_FROM', smtp_user)
        
        print(f"[이메일 발송 시도] SMTP_HOST: {smtp_host}, SMTP_USER: {smtp_user}, 이메일: {email}")
        
        # SMTP 설정이 없으면 콘솔에 출력 (개발용)
        if not smtp_host or not smtp_user:
            print(f"[이메일 인증 코드 - SMTP 미설정] {email}: {code}")
            return True
        
        print(f"[이메일 발송 시작] {email}로 인증 코드 발송 시도...")
        
        # 이메일 발송
        msg = MIMEMultipart('alternative')
        msg['Subject'] = '[Cookmatch] 이메일 인증 코드'
        msg['From'] = smtp_from
        msg['To'] = email
        
        html_content = f"""
        <html>
          <body>
            <h2>이메일 인증 코드</h2>
            <p>안녕하세요,</p>
            <p>Cookmatch 인증 코드입니다.</p>
            <p style="font-size: 24px; font-weight: bold; color: #3c3c3c; letter-spacing: 4px;">{code}</p>
            <p>이 코드는 10분간 유효합니다.</p>
            <p>본인이 요청하지 않은 경우 이 이메일을 무시하세요.</p>
          </body>
        </html>
        """
        
        text_content = f"""
이메일 인증 코드

안녕하세요,

Cookmatch 인증 코드입니다.

{code}

이 코드는 10분간 유효합니다.

본인이 요청하지 않은 경우 이 이메일을 무시하세요.
        """
        
        part1 = MIMEText(text_content, 'plain', 'utf-8')
        part2 = MIMEText(html_content, 'html', 'utf-8')
        
        msg.attach(part1)
        msg.attach(part2)
        
        print(f"[SMTP 연결 시도] {smtp_host}:{smtp_port}")
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            print(f"[TLS 시작]")
            server.starttls()
            print(f"[로그인 시도] 사용자: {smtp_user}")
            server.login(smtp_user, smtp_password)
            print(f"[이메일 발송] {email}로 메시지 전송 중...")
            server.send_message(msg)
            print(f"[이메일 발송 성공] {email}로 인증 코드 발송 완료")
        
        return True
    except smtplib.SMTPAuthenticationError as e:
        print(f"[이메일 발송 오류 - 인증 실패] {e}")
        print(f"[개발 모드] 이메일 인증 코드: {email}: {code}")
        return False
    except smtplib.SMTPException as e:
        print(f"[이메일 발송 오류 - SMTP 오류] {e}")
        print(f"[개발 모드] 이메일 인증 코드: {email}: {code}")
        return False
    except Exception as e:
        import traceback
        print(f"[이메일 발송 오류] {e}")
        print(f"[트레이스백] {traceback.format_exc()}")
        print(f"[개발 모드] 이메일 인증 코드: {email}: {code}")
        # 개발 환경에서는 오류가 나도 계속 진행
        if os.getenv('FLASK_ENV', '').lower() == 'development':
            return True
        return False

@app.route('/api/auth/check-email', methods=['POST'])
def check_email():
    """이메일 중복 체크"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        
        if not email:
            return jsonify({'error': '이메일을 입력해주세요.'}), 400
        
        if '@' not in email:
            return jsonify({'error': '올바른 이메일 형식이 아닙니다.'}), 400
        
        ensure_users_table()
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 일반 회원가입 사용자 확인 (탈퇴하지 않은 사용자만)
            cursor.execute(
                "SELECT id FROM users WHERE email = %s AND provider = 'local' AND deleted_at IS NULL",
                (email,)
            )
            existing_user = cursor.fetchone()
            
            if existing_user:
                return jsonify({
                    'available': False,
                    'message': '이미 사용 중인 이메일입니다.'
                }), 200
            
            return jsonify({
                'available': True,
                'message': '사용 가능한 이메일입니다.'
            }), 200
            
        except Exception as e:
            print(f"Check email error: {e}")
            return jsonify({'error': '이메일 확인 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Check email error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/send-verification-code', methods=['POST'])
def send_verification_code():
    """이메일 인증 코드 발송"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        
        if not email:
            return jsonify({'error': '이메일을 입력해주세요.'}), 400
        
        if '@' not in email:
            return jsonify({'error': '올바른 이메일 형식이 아닙니다.'}), 400
        
        # 인증 코드 생성
        code = generate_verification_code()
        
        # 인증 코드 저장 (10분 유효)
        email_verification_codes[email] = {
            'code': code,
            'expires_at': datetime.utcnow() + timedelta(minutes=10),
            'verified': False
        }
        
        # 이메일 발송
        print(f"[인증 코드 발송 API] 이메일: {email}, 코드 생성 완료: {code}")
        send_result = send_verification_email(email, code)
        print(f"[인증 코드 발송 API] 이메일 발송 결과: {send_result}")
        
        # 개발 환경에서는 인증 코드를 응답에 포함
        is_development = os.getenv('FLASK_ENV', '').lower() == 'development'
        smtp_configured = bool(os.getenv('SMTP_HOST', '') and os.getenv('SMTP_USER', ''))
        
        print(f"[인증 코드 발송 API] 개발 모드: {is_development}, SMTP 설정됨: {smtp_configured}")
        
        response_data = {
            'message': '인증 코드가 발송되었습니다.',
            'email': email
        }
        
        # 개발 환경이고 SMTP가 설정되지 않았으면 코드를 응답에 포함
        if is_development and not smtp_configured:
            response_data['dev_code'] = code  # 개발용: 인증 코드를 응답에 포함
            response_data['dev_message'] = '개발 모드: 인증 코드가 화면에 표시됩니다.'
        
        # 개발 환경에서는 이메일 발송 실패해도 코드를 응답에 포함
        if is_development:
            if not send_result:
                print(f"[인증 코드 발송 API] 개발 모드: 이메일 발송 실패했지만 코드를 응답에 포함")
                response_data['dev_code'] = code
                response_data['dev_message'] = '개발 모드: 이메일 발송 실패, 인증 코드가 화면에 표시됩니다.'
            return jsonify(response_data), 200
        
        if send_result:
            return jsonify(response_data), 200
        else:
            return jsonify({'error': '이메일 발송에 실패했습니다.'}), 500
            
    except Exception as e:
        import traceback
        print(f"[인증 코드 발송 API] 오류 발생: {e}")
        print(f"[인증 코드 발송 API] 트레이스백:\n{traceback.format_exc()}")
        return jsonify({'error': f'서버 오류가 발생했습니다: {str(e)}'}), 500

@app.route('/api/auth/verify-email-code', methods=['POST'])
def verify_email_code():
    """이메일 인증 코드 검증"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        code = data.get('code', '').strip()
        
        if not email or not code:
            return jsonify({'error': '이메일과 인증 코드를 입력해주세요.'}), 400
        
        # 인증 코드 확인
        if email not in email_verification_codes:
            return jsonify({'error': '인증 코드가 만료되었거나 존재하지 않습니다.'}), 400
        
        verification_data = email_verification_codes[email]
        
        # 만료 확인
        if datetime.utcnow() > verification_data['expires_at']:
            del email_verification_codes[email]
            return jsonify({'error': '인증 코드가 만료되었습니다.'}), 400
        
        # 코드 확인
        if verification_data['code'] != code:
            return jsonify({'error': '인증 코드가 올바르지 않습니다.'}), 400
        
        # 인증 완료 표시
        email_verification_codes[email]['verified'] = True
        
        return jsonify({
            'message': '이메일 인증이 완료되었습니다.',
            'verified': True
        }), 200
        
    except Exception as e:
        print(f"Verify email code error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

# =====================
# 사용자 정보 관리
# =====================

@app.route('/api/auth/check-nickname', methods=['POST'])
def check_nickname():
    """닉네임 중복 체크"""
    try:
        data = request.get_json()
        nickname = data.get('nickname', '').strip()
        
        if not nickname:
            return jsonify({'error': '닉네임을 입력해주세요.'}), 400
        
        ensure_users_table()
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 닉네임 중복 확인 (탈퇴하지 않은 사용자만)
            cursor.execute(
                "SELECT id FROM users WHERE nickname = %s AND deleted_at IS NULL",
                (nickname,)
            )
            existing_user = cursor.fetchone()
            
            if existing_user:
                return jsonify({
                    'available': False,
                    'message': '이미 사용 중인 닉네임입니다.'
                }), 200
            
            return jsonify({
                'available': True,
                'message': '사용 가능한 닉네임입니다.'
            }), 200
            
        except Exception as e:
            print(f"Check nickname error: {e}")
            return jsonify({'error': '닉네임 확인 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Check nickname error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/delete-account', methods=['POST'])
def delete_account():
    """회원탈퇴"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        user_id = payload.get('user_id')
        email = payload.get('email')
        provider = payload.get('provider', 'local')

        ensure_users_table()
        ensure_households_table()
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()

        try:
            # 사용자 존재 확인 (탈퇴하지 않은 사용자만)
            cursor.execute(
                "SELECT id FROM users WHERE id = %s AND email = %s AND provider = %s AND deleted_at IS NULL",
                (user_id, email, provider)
            )
            user = cursor.fetchone()

            if not user:
                return jsonify({'error': '사용자를 찾을 수 없습니다.'}), 404

            # 그룹에 속해 있는데 그룹을 나가지 않고 바로 탈퇴하면, 이 사람이
            # 그룹의 재료 저장 계정(storage_user_id)이었을 경우 그룹 재료가
            # 탈퇴한 계정에 그대로 남아 아무도 못 보게 된다 — leave_household()와
            # 같은 방식으로 남은 멤버에게 저장 위치를 넘겨준다(데이터는 복사).
            # 남은 멤버가 없으면(그룹에 혼자였으면) 그룹 자체를 정리한다.
            household = get_household_by_user(cursor, user_id)
            if household and household['storage_user_id'] == user_id:
                cursor.execute(
                    "SELECT id FROM users WHERE household_id = %s AND id != %s ORDER BY id ASC LIMIT 1",
                    (household['id'], user_id)
                )
                next_owner = cursor.fetchone()
                if next_owner:
                    _copy_ingredients(cursor, user_id, next_owner['id'], datetime.now())
                    cursor.execute(
                        "UPDATE households SET storage_user_id = %s WHERE id = %s",
                        (next_owner['id'], household['id'])
                    )
                else:
                    cursor.execute("DELETE FROM households WHERE id = %s", (household['id'],))

            # Soft Delete: 실제 삭제 대신 deleted_at을 현재 시간으로 설정 (한국 시간대)
            # UTC+9 시간대 적용 (한국 시간)
            # (datetime/timedelta는 파일 상단에서 이미 import됨 — 여기서 다시
            # `from datetime import datetime, ...`을 하면 그 순간부터 datetime이
            # 이 함수 전체에서 지역 변수 취급돼, 위에서 먼저 쓴 datetime.now()가
            # UnboundLocalError로 터진다. timezone만 추가로 가져온다.)
            from datetime import timezone

            # 한국 시간대 (KST, UTC+9)
            kst = timezone(timedelta(hours=9))
            current_time_kst = datetime.now(kst)

            cursor.execute(
                "UPDATE users SET deleted_at = %s, household_id = NULL, ingredients_merged = 0 WHERE id = %s AND email = %s AND provider = %s",
                (current_time_kst.strftime('%Y-%m-%d %H:%M:%S'), user_id, email, provider)
            )

            db.commit()
            
            return jsonify({
                'message': '회원탈퇴가 완료되었습니다.'
            }), 200
            
        except Exception as e:
            db.rollback()
            print(f"Delete account error: {e}")
            return jsonify({'error': '회원탈퇴 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Delete account error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/find-email', methods=['POST'])
def find_email():
    """이메일 찾기 (닉네임으로)"""
    try:
        data = request.get_json()
        nickname = data.get('nickname', '').strip()
        
        if not nickname:
            return jsonify({'error': '닉네임을 입력해주세요.'}), 400
        
        ensure_users_table()
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 일반 로그인 사용자만 조회 (소셜 로그인은 이메일 찾기 불필요, 탈퇴하지 않은 사용자만)
            cursor.execute(
                "SELECT email FROM users WHERE nickname = %s AND provider = 'local' AND deleted_at IS NULL",
                (nickname,)
            )
            user = cursor.fetchone()
            
            if not user:
                return jsonify({'error': '해당 닉네임으로 등록된 이메일을 찾을 수 없습니다.'}), 404
            
            email = user[0]
            # 이메일 일부 마스킹 (예: abc@example.com -> ab***@example.com)
            email_parts = email.split('@')
            if len(email_parts[0]) > 2:
                masked_email = email_parts[0][:2] + '*' * (len(email_parts[0]) - 2) + '@' + email_parts[1]
            else:
                masked_email = '*' * len(email_parts[0]) + '@' + email_parts[1]
            
            return jsonify({
                'email': masked_email,
                'full_email': email  # 실제 이메일도 반환 (보안상 주의 필요)
            }), 200
            
        except Exception as e:
            print(f"Find email error: {e}")
            return jsonify({'error': '이메일 찾기 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Find email error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/me', methods=['GET'])
def get_me():
    """토큰이 아직 유효한지 확인하고 현재 사용자 정보를 돌려준다.

    프론트는 저장된 JWT 의 payload 만 base64 로 풀어 화면을 그리기 때문에,
    서명이 깨진(=서버가 거부하는) 토큰을 들고도 로그인 상태로 보인다.
    앱을 열 때 이 엔드포인트로 한 번 확인해서 죽은 세션을 정리하도록 한다.
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': '인증이 필요합니다.'}), 401

    payload = verify_jwt_token(auth_header.split(' ')[1])
    if not payload:
        return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401

    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute(
            "SELECT id, email, nickname, provider FROM users WHERE id = %s AND deleted_at IS NULL",
            (payload.get('user_id'),)
        )
        user = cursor.fetchone()
    finally:
        db.close()

    # 토큰은 멀쩡한데 계정이 사라진 경우(탈퇴 등)도 로그인 상태로 두면 안 된다
    if not user:
        return jsonify({'error': '존재하지 않는 계정입니다.'}), 401

    return jsonify({'user': {
        'id': user['id'],
        'email': user['email'],
        'nickname': user['nickname'],
        'provider': user['provider'],
    }}), 200


@app.route('/api/auth/update-profile', methods=['POST'])
def update_profile():
    """사용자 프로필 업데이트 (닉네임, 비밀번호)"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload:
            return jsonify({'error': '유효하지 않은 토큰입니다.'}), 401
        
        user_id = payload.get('user_id')
        email = payload.get('email')
        provider = payload.get('provider', 'local')
        
        data = request.get_json()
        nickname = data.get('nickname', '').strip()
        password = data.get('password', '').strip()
        
        if not nickname:
            return jsonify({'error': '닉네임을 입력해주세요.'}), 400
        
        ensure_users_table()
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 닉네임 중복 확인 (현재 사용자 제외, 탈퇴하지 않은 사용자만)
            cursor.execute(
                "SELECT id FROM users WHERE nickname = %s AND id != %s AND deleted_at IS NULL",
                (nickname, user_id)
            )
            existing_user = cursor.fetchone()
            
            if existing_user:
                return jsonify({
                    'error': '이미 사용 중인 닉네임입니다.'
                }), 400
            
            # 업데이트할 필드 구성
            update_fields = []
            update_values = []
            
            # 닉네임 업데이트
            update_fields.append("nickname = %s")
            update_values.append(nickname)
            
            # 비밀번호 업데이트 (일반 로그인 사용자만, 비밀번호가 제공된 경우만)
            if provider == 'local' and password:
                if len(password) < 4:
                    return jsonify({'error': '비밀번호는 최소 4자 이상이어야 합니다.'}), 400
                from werkzeug.security import generate_password_hash
                password_hash = generate_password_hash(password)
                update_fields.append("password = %s")
                update_values.append(password_hash)
            
            # 업데이트 실행
            update_values.append(user_id)
            update_query = f"UPDATE users SET {', '.join(update_fields)} WHERE id = %s"
            cursor.execute(update_query, update_values)
            db.commit()
            
            return jsonify({
                'success': True,
                'message': '프로필이 업데이트되었습니다.',
                'user': {
                    'id': user_id,
                    'email': email,
                    'nickname': nickname,
                    'provider': provider
                }
            }), 200
            
        except Exception as e:
            db.rollback()
            print(f"Update profile error: {e}")
            return jsonify({'error': '프로필 업데이트 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Update profile error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    """비밀번호 재설정"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip()
        code = data.get('code', '').strip()
        new_password = data.get('new_password', '').strip()
        
        if not email or not code or not new_password:
            return jsonify({'error': '이메일, 인증 코드, 새 비밀번호를 모두 입력해주세요.'}), 400
        
        # 비밀번호 길이 검사
        if len(new_password) < 4:
            return jsonify({'error': '비밀번호는 최소 4자 이상이어야 합니다.'}), 400
        
        # 인증 코드 확인
        if email not in email_verification_codes:
            return jsonify({'error': '인증 코드가 만료되었거나 존재하지 않습니다.'}), 400
        
        verification_data = email_verification_codes[email]
        
        # 만료 시간 확인
        if datetime.utcnow() > verification_data['expires_at']:
            del email_verification_codes[email]
            return jsonify({'error': '인증 코드가 만료되었습니다.'}), 400
        
        # 인증 코드 확인
        if verification_data['code'] != code:
            return jsonify({'error': '인증 코드가 올바르지 않습니다.'}), 400
        
        # 인증 완료 확인
        if not verification_data.get('verified', False):
            return jsonify({'error': '이메일 인증이 완료되지 않았습니다.'}), 400
        
        ensure_users_table()
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 사용자 확인 (일반 로그인 사용자만, 탈퇴하지 않은 사용자만)
            cursor.execute(
                "SELECT id FROM users WHERE email = %s AND provider = 'local' AND deleted_at IS NULL",
                (email,)
            )
            user = cursor.fetchone()
            
            if not user:
                return jsonify({'error': '해당 이메일로 등록된 사용자를 찾을 수 없습니다.'}), 404
            
            # 비밀번호 해싱 및 업데이트
            password_hash = generate_password_hash(new_password)
            print(f"[비밀번호 재설정] 이메일: {email}, 새 비밀번호 해시 생성 완료, 해시 길이: {len(password_hash)}")
            cursor.execute(
                "UPDATE users SET password = %s WHERE email = %s AND provider = 'local'",
                (password_hash, email)
            )
            db.commit()
            print(f"[비밀번호 재설정] 비밀번호 업데이트 완료")
            
            # 인증 코드 삭제
            del email_verification_codes[email]
            
            return jsonify({
                'message': '비밀번호가 성공적으로 변경되었습니다.'
            }), 200
            
        except Exception as e:
            db.rollback()
            print(f"Reset password error: {e}")
            return jsonify({'error': '비밀번호 재설정 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Reset password error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

# =====================
# 사용자 재료 및 레시피 관리
# =====================

def ensure_user_data_tables():
    """사용자 재료 및 레시피 테이블 생성"""
    db = get_db()
    cursor = db.cursor()
    
    try:
        # 사용자 재료 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_ingredients (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(255) NOT NULL,
                storage_box ENUM('frozen', 'fridge', 'room') NOT NULL,
                expiry_date DATE NULL,
                purchase_date DATE NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                saved_at DATETIME NULL COMMENT '사용자가 저장 버튼을 눌러 저장한 시점',
                INDEX idx_user_id (user_id),
                INDEX idx_storage_box (storage_box),
                INDEX idx_saved_at (saved_at),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        
        # 기존 테이블에 saved_at 컬럼이 없으면 추가
        try:
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM INFORMATION_SCHEMA.COLUMNS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'user_ingredients' 
                AND COLUMN_NAME = 'saved_at'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                print("[ensure_user_data_tables] saved_at 컬럼 추가 시작")
                cursor.execute("""
                    ALTER TABLE user_ingredients 
                    ADD COLUMN saved_at DATETIME NULL COMMENT '사용자가 저장 버튼을 눌러 저장한 시점' AFTER updated_at
                """)
                # 인덱스가 이미 존재하는지 확인 후 추가
                try:
                    cursor.execute("""
                        SELECT COUNT(*) as count 
                        FROM INFORMATION_SCHEMA.STATISTICS 
                        WHERE TABLE_SCHEMA = DATABASE() 
                        AND TABLE_NAME = 'user_ingredients' 
                        AND INDEX_NAME = 'idx_saved_at'
                    """)
                    idx_result = cursor.fetchone()
                    if not idx_result or idx_result['count'] == 0:
                        cursor.execute("""
                            ALTER TABLE user_ingredients 
                            ADD INDEX idx_saved_at (saved_at)
                        """)
                except Exception as idx_error:
                    print(f"[ensure_user_data_tables] 인덱스 추가 중 오류 (무시 가능): {idx_error}")
                db.commit()
                print("[ensure_user_data_tables] saved_at 컬럼 추가 완료")
        except Exception as e:
            print(f"[ensure_user_data_tables] saved_at 컬럼 추가 중 오류: {e}")
            db.rollback()
        
        # 사용자 기록한 레시피 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_recorded_recipes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                recipe_id INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_recipe (user_id, recipe_id),
                INDEX idx_user_id (user_id),
                INDEX idx_recipe_id (recipe_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        
        # 사용자 완료한 레시피 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_completed_recipes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                recipe_id INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_recipe (user_id, recipe_id),
                INDEX idx_user_id (user_id),
                INDEX idx_recipe_id (recipe_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)

        # 사용자 즐겨찾기 레시피 테이블
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_favorite_recipes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                recipe_id INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_user_recipe (user_id, recipe_id),
                INDEX idx_user_id (user_id),
                INDEX idx_recipe_id (recipe_id),
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error creating user data tables: {e}")
    finally:
        db.close()


# =====================
# 가족 그룹(household) / 초대 코드
#
# 같은 냉장고를 쓰는 가족이 각자 계정으로 접속해도 재료를 공유할 수 있게
# 하는 기능. 스키마를 크게 바꾸는 대신, "그룹에 속한 사용자의 냉장고 재료는
# 그룹을 만든 사람(storage_user_id)의 user_ingredients 행을 그대로 읽고
# 쓴다"는 리다이렉션 방식을 쓴다 — user_ingredients 테이블 구조도, 기존
# get/save 엔드포인트를 부르는 프론트 코드도 전혀 바꿀 필요가 없다.
#
# 즐겨찾기/완료/기록 레시피는 의도적으로 그룹과 무관하게 계정별로 그대로
# 둔다 — 취향 데이터라 합치면 "누가 좋아했는지"가 사라지기 때문. 그룹
# 화면에서 "OO님이 즐겨찾기함" 배지로 보여주는 건 범위 밖으로 남겨둔다.
# =====================

def ensure_households_table():
    """households 테이블 생성 + users.household_id 컬럼 추가"""
    db = get_db()
    cursor = db.cursor()

    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS households (
                id INT AUTO_INCREMENT PRIMARY KEY,
                invite_code VARCHAR(12) NOT NULL,
                storage_user_id INT NOT NULL COMMENT '이 그룹의 냉장고 재료가 실제로 저장되는 계정',
                created_by INT NOT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE KEY unique_invite_code (invite_code),
                INDEX idx_storage_user_id (storage_user_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.commit()

        # 새로 참여하는 사람이 자기 재료를 그룹 재료에 합칠 수 있는지.
        # 기존 그룹원 입장에서는 낯선 사람의 재료가 마음대로 섞이는 게 싫을 수
        # 있으므로, 그룹 차원에서 아예 막아 둘 수 있게 한다(그룹원 누구나 변경 가능
        # — "모두 동등" 원칙). 꺼두면 참여자가 뭘 선택하든 항상 개인 재료를
        # 보존한 채로 참여하게 된다.
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'households'
                AND COLUMN_NAME = 'allow_ingredient_merge'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE households ADD COLUMN allow_ingredient_merge TINYINT(1) NOT NULL DEFAULT 1")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] allow_ingredient_merge 컬럼 추가 중 오류: {e}")
            db.rollback()

        # 기존 users 테이블에 household_id 컬럼이 없으면 추가
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'household_id'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE users ADD COLUMN household_id INT NULL")
                cursor.execute("ALTER TABLE users ADD INDEX idx_household_id (household_id)")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] household_id 컬럼 추가 중 오류: {e}")
            db.rollback()

        # 그룹에서 내 즐겨찾기/완료/기록을 다른 멤버에게도 보여줄지(배지 표시용).
        # 참여할 때 사용자가 고를 수 있고, 기본값은 보여주기(1).
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'share_recipe_actions'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE users ADD COLUMN share_recipe_actions TINYINT(1) NOT NULL DEFAULT 1")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] share_recipe_actions 컬럼 추가 중 오류: {e}")
            db.rollback()

        # 그룹 참여 시 "내 재료를 그룹에 합쳤는지" 기록.
        # 합친 적이 없으면(merge_ingredients=false로 참여), 그룹을 나갈 때 그룹의
        # 현재 재료가 아니라 참여 전 내 개인 재료를 그대로 돌려받아야 한다 —
        # 한 번도 섞이지 않았던 재료이므로 원래 그대로 보존해 주는 게 맞다.
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'ingredients_merged'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE users ADD COLUMN ingredients_merged TINYINT(1) NOT NULL DEFAULT 0")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] ingredients_merged 컬럼 추가 중 오류: {e}")
            db.rollback()

        # 요리 캘린더의 "이번 달 목표" 달성률용. 처음부터 설정해야 하는 건
        # 번거로우니 기본값(월 20회)을 채워 둔다.
        # users.monthly_cooking_goal: 그룹이 없을 때(혼자) 쓰는 개인 목표.
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'monthly_cooking_goal'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE users ADD COLUMN monthly_cooking_goal INT NOT NULL DEFAULT 20")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] monthly_cooking_goal 컬럼 추가 중 오류: {e}")
            db.rollback()

        # households.monthly_cooking_goal: 그룹에 속해 있을 때는 이 값이
        # 목표다 — 개인별로 따로 갖는 게 아니라 그룹 전체가 공유하는 하나의
        # 목표. 그룹원 누구나 바꿀 수 있다("모두 동등" 원칙, allow_ingredient_merge와
        # 같은 방식).
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'households'
                AND COLUMN_NAME = 'monthly_cooking_goal'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE households ADD COLUMN monthly_cooking_goal INT NOT NULL DEFAULT 20")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] households.monthly_cooking_goal 컬럼 추가 중 오류: {e}")
            db.rollback()

        # 절약액 추정에 쓰는 "실제 같이 먹는 인원수". 계정 수(연동된 멤버 수)와
        # 다를 수 있다 — 아이가 있으면 계정은 없어도 같이 먹으니까. NULL이면
        # 계정 수(그룹) 또는 1(혼자)을 기본값으로 대신 쓴다.
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'households'
                AND COLUMN_NAME = 'family_size'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE households ADD COLUMN family_size INT NULL")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] households.family_size 컬럼 추가 중 오류: {e}")
            db.rollback()

        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'family_size'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE users ADD COLUMN family_size INT NULL")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] users.family_size 컬럼 추가 중 오류: {e}")
            db.rollback()

        # 절약액 추정에 쓰는 "한 끼당 절약액". 기본은 8,000원이지만 지역/식습관에
        # 따라 체감이 다를 수 있어 식구 수처럼 직접 조정 가능하게 한다. NULL이면
        # ESTIMATED_SAVINGS_PER_MEAL_DEFAULT(8,000원)를 대신 쓴다.
        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'households'
                AND COLUMN_NAME = 'savings_per_meal'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE households ADD COLUMN savings_per_meal INT NULL")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] households.savings_per_meal 컬럼 추가 중 오류: {e}")
            db.rollback()

        try:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM INFORMATION_SCHEMA.COLUMNS
                WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
                AND COLUMN_NAME = 'savings_per_meal'
            """)
            result = cursor.fetchone()
            if result and result['count'] == 0:
                cursor.execute("ALTER TABLE users ADD COLUMN savings_per_meal INT NULL")
                db.commit()
        except Exception as e:
            print(f"[ensure_households_table] users.savings_per_meal 컬럼 추가 중 오류: {e}")
            db.rollback()

        # 즐겨찾기/완료/기록 비공개인 멤버에게 "공유해 달라"고 요청하는 기능용.
        # 앱을 완전히 꺼도 오는 푸시 알림까지는 아니고, 앱을 열었을 때(마이페이지
        # 진입 시) 대기 중인 요청이 있으면 팝업으로 물어보는 정도로 범위를 좁혔다.
        try:
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS household_share_requests (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    household_id INT NOT NULL,
                    requester_id INT NOT NULL,
                    target_id INT NOT NULL,
                    status VARCHAR(20) NOT NULL DEFAULT 'pending',
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    responded_at DATETIME NULL,
                    INDEX idx_target_status (target_id, status),
                    INDEX idx_household (household_id)
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """)
            db.commit()
        except Exception as e:
            print(f"[ensure_households_table] household_share_requests 생성 중 오류: {e}")
            db.rollback()
    except Exception as e:
        db.rollback()
        print(f"Error creating households table: {e}")
    finally:
        db.close()


def generate_invite_code():
    """0/O, 1/I/L처럼 헷갈리기 쉬운 문자를 뺀 8자리 초대 코드"""
    alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
    return ''.join(secrets.choice(alphabet) for _ in range(8))


def get_household_by_user(cursor, user_id):
    """user_id가 속한 household row (없으면 None)"""
    cursor.execute(
        """SELECT h.* FROM households h
           INNER JOIN users u ON u.household_id = h.id
           WHERE u.id = %s""",
        (user_id,)
    )
    return cursor.fetchone()


def resolve_ingredient_storage_user_id(cursor, user_id):
    """이 user의 냉장고 재료를 실제로 읽고 쓸 user_id.
    그룹에 속해 있으면 그룹의 storage_user_id, 아니면 자기 자신."""
    household = get_household_by_user(cursor, user_id)
    return household['storage_user_id'] if household else user_id


def _issue_unique_invite_code(cursor):
    invite_code = generate_invite_code()
    for _ in range(5):
        cursor.execute("SELECT id FROM households WHERE invite_code = %s", (invite_code,))
        if not cursor.fetchone():
            break
        invite_code = generate_invite_code()
    return invite_code


@app.route('/api/households/me', methods=['GET'])
def get_my_household():
    """내가 속한 그룹 정보. 그룹이 없으면 in_household: false"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'in_household': False}), 200

            cursor.execute(
                """SELECT id, nickname, share_recipe_actions, ingredients_merged FROM users
                   WHERE household_id = %s AND deleted_at IS NULL ORDER BY id ASC""",
                (household['id'],)
            )
            members = cursor.fetchall()
            my_row = next((m for m in members if m['id'] == user_id), None)
            return jsonify({
                'in_household': True,
                'invite_code': household['invite_code'],
                'allow_ingredient_merge': bool(household.get('allow_ingredient_merge', 1)),
                'my_ingredients_merged': bool(my_row['ingredients_merged']) if my_row else False,
                'members': [
                    {'id': m['id'], 'nickname': m['nickname'], 'share_recipe_actions': bool(m['share_recipe_actions'])}
                    for m in members
                ],
            }), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Get my household error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households', methods=['POST'])
def create_household():
    """새 그룹 만들기. 이미 그룹에 속해 있으면 에러.

    keep_ingredients(기본 true): 지금 내 재료를 그대로 그룹 재료로 쓸지.
    false면 빈 상태로 시작한다(내 재료를 비운다 — 그룹의 저장 계정이 곧
    내 계정이라, "가져가지 않기"는 곧 지금 재료를 없애는 것과 같다).
    share_recipe_actions(기본 true): 내 즐겨찾기·완료·기록을 그룹원에게
    보여줄지."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json(silent=True) or {}
        keep_ingredients = data.get('keep_ingredients', True)
        share_recipe_actions = data.get('share_recipe_actions', True)

        ensure_households_table()
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("SELECT household_id FROM users WHERE id = %s", (user_id,))
            row = cursor.fetchone()
            if row and row['household_id']:
                return jsonify({'error': '이미 그룹에 속해 있습니다. 먼저 그룹에서 나가주세요.'}), 400

            invite_code = _issue_unique_invite_code(cursor)
            cursor.execute(
                "INSERT INTO households (invite_code, storage_user_id, created_by, created_at) VALUES (%s, %s, %s, NOW())",
                (invite_code, user_id, user_id)
            )
            household_id = cursor.lastrowid
            cursor.execute(
                "UPDATE users SET household_id = %s, share_recipe_actions = %s WHERE id = %s",
                (household_id, 1 if share_recipe_actions else 0, user_id)
            )
            if not keep_ingredients:
                cursor.execute("DELETE FROM user_ingredients WHERE user_id = %s", (user_id,))
            db.commit()
            return jsonify({'invite_code': invite_code}), 201
        except Exception as e:
            db.rollback()
            print(f"Create household error: {e}")
            return jsonify({'error': '그룹 생성 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Create household error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/join', methods=['POST'])
def join_household():
    """초대 코드로 그룹 참여.

    두 가지를 참여자가 직접 고를 수 있다:
    - merge_ingredients(기본 true): 지금 갖고 있던 개인 재료를 그룹 재료로
      합칠지. 합치면 이름+보관위치가 같은 항목은 하나로 취급하고, 유통기한이
      있는 쪽(둘 다 있으면 더 임박한 날짜)을 남긴다. false면 내 개인 재료는
      건드리지 않고 그룹의 기존 재료만 그대로 보게 된다.
    - share_recipe_actions(기본 true): 내 즐겨찾기·완료·기록을 다른
      그룹원이 배지로 볼 수 있게 할지. 실제 데이터를 합치는 게 아니라
      계정별 기록은 그대로 두고 조회 시점에만 표시 여부를 결정한다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        invite_code = (data.get('invite_code') or '').strip().upper()
        if not invite_code:
            return jsonify({'error': '초대 코드를 입력해주세요.'}), 400
        merge_ingredients = data.get('merge_ingredients', True)
        share_recipe_actions = data.get('share_recipe_actions', True)

        ensure_households_table()
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("SELECT household_id FROM users WHERE id = %s", (user_id,))
            row = cursor.fetchone()
            if row and row['household_id']:
                return jsonify({'error': '이미 그룹에 속해 있습니다. 먼저 그룹에서 나가주세요.'}), 400

            cursor.execute("SELECT * FROM households WHERE invite_code = %s", (invite_code,))
            household = cursor.fetchone()
            if not household:
                return jsonify({'error': '유효하지 않은 초대 코드입니다.'}), 404

            # 그룹이 "새로 들어오는 사람 재료 합치기"를 아예 막아 뒀으면, 참여자가
            # 뭘 골랐든 무시하고 항상 보존(merge 안 함)으로 강제한다 — 기존
            # 그룹원 동의 없이 낯선 재료가 섞이는 걸 막기 위함.
            merge_denied_by_policy = merge_ingredients and not household.get('allow_ingredient_merge', 1)
            if merge_denied_by_policy:
                merge_ingredients = False

            storage_user_id = household['storage_user_id']

            if merge_ingredients:
                cursor.execute(
                    "SELECT name, storage_box, expiry_date, purchase_date FROM user_ingredients WHERE user_id = %s",
                    (user_id,)
                )
                # pymysql은 결과가 0건이면 fetchall()이 list가 아니라 빈 tuple을
                # 돌려준다 — 그 상태로 아래에서 group_ings + personal 을 하면
                # "새 계정이라 개인 재료가 0개"인 아주 흔한 경우에 list+tuple
                # TypeError로 죽는다. list()로 감싸 항상 list를 보장한다.
                personal = list(cursor.fetchall())
                cursor.execute(
                    "SELECT name, storage_box, expiry_date, purchase_date FROM user_ingredients WHERE user_id = %s",
                    (storage_user_id,)
                )
                group_ings = list(cursor.fetchall())

                def better(a, b):
                    if a['expiry_date'] and b['expiry_date']:
                        return a if a['expiry_date'] <= b['expiry_date'] else b
                    return a if a['expiry_date'] else b

                merged = {}
                for ing in group_ings + personal:
                    key = (ing['name'], ing['storage_box'])
                    merged[key] = better(merged[key], ing) if key in merged else ing

                saved_at = datetime.now()
                cursor.execute("DELETE FROM user_ingredients WHERE user_id = %s", (storage_user_id,))
                for ing in merged.values():
                    cursor.execute(
                        """INSERT INTO user_ingredients (user_id, name, storage_box, expiry_date, purchase_date, saved_at)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (storage_user_id, ing['name'], ing['storage_box'], ing['expiry_date'], ing['purchase_date'], saved_at)
                    )
            # merge_ingredients가 false면 내 개인 재료는 그대로 두고 아무것도
            # 옮기지 않는다 — 그룹에 들어가는 순간부터는 어차피 storage_user_id로
            # 리다이렉션되어 그룹의 기존 재료를 보게 된다.

            cursor.execute(
                "UPDATE users SET household_id = %s, share_recipe_actions = %s, ingredients_merged = %s WHERE id = %s",
                (household['id'], 1 if share_recipe_actions else 0, 1 if merge_ingredients else 0, user_id)
            )
            db.commit()
            return jsonify({
                'message': '그룹에 참여했습니다.',
                'merge_denied_by_policy': merge_denied_by_policy,
            }), 200
        except Exception as e:
            db.rollback()
            print(f"Join household error: {e}")
            return jsonify({'error': '그룹 참여 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Join household error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


def _copy_ingredients(cursor, from_user_id, to_user_id, saved_at):
    """from_user_id의 현재 재료를 그대로 to_user_id 소유로 복사(덮어쓰기)."""
    cursor.execute(
        "SELECT name, storage_box, expiry_date, purchase_date FROM user_ingredients WHERE user_id = %s",
        (from_user_id,)
    )
    rows = cursor.fetchall()
    cursor.execute("DELETE FROM user_ingredients WHERE user_id = %s", (to_user_id,))
    for row in rows:
        cursor.execute(
            """INSERT INTO user_ingredients (user_id, name, storage_box, expiry_date, purchase_date, saved_at)
               VALUES (%s, %s, %s, %s, %s, %s)""",
            (to_user_id, row['name'], row['storage_box'], row['expiry_date'], row['purchase_date'], saved_at)
        )


@app.route('/api/households/leave', methods=['POST'])
def leave_household():
    """그룹에서 나가기.

    - 참여할 때 내 재료를 그룹에 합쳤던 사람(ingredients_merged=1): 나가는 시점의
      **그룹 재료 스냅샷**을 그대로 들고 나간다 — 가족과 냉장고를 나눠 쓰다가
      분가하면서 지금 있는 재료를 챙겨 나가는 것과 같은 그림.
    - 합친 적이 없는 사람(merge_ingredients=false로 참여): 애초에 자기 재료를
      그룹에 섞은 적이 없으므로, **참여 전 개인 재료**가 그대로 보존돼 있다가
      그대로 돌아온다 — 나갈 때 그룹의 최신 상태로 덮어쓰지 않는다.
    - 그룹을 만든 사람(그룹의 storage_user_id 본인)이 나가는 경우: 남은 멤버가
      있으면 그 사람 쪽으로 저장 위치를 옮겨준다(데이터는 그대로 복사) — 남은
      사람들이 계속 같은 데이터를 보게 하기 위함. 내 몫은 원래 있던 자리에
      그대로 남으므로(같은 행이었으므로) 따로 처리할 게 없다.

    즐겨찾기/완료/기록은 애초에 그룹과 무관하게 항상 계정별 개인 기록이었으므로
    나가도 전혀 바뀌지 않는다.
    """
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        ensure_households_table()
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400

            cursor.execute("SELECT ingredients_merged FROM users WHERE id = %s", (user_id,))
            row = cursor.fetchone()
            ingredients_merged = bool(row and row['ingredients_merged'])

            storage_user_id = household['storage_user_id']
            saved_at = datetime.now()

            if storage_user_id == user_id:
                # 내가 이 그룹의 저장 계정이었던 경우, 남은 멤버가 있으면
                # 그 사람 쪽으로 저장 위치를 옮겨준다(데이터는 그대로 복사).
                cursor.execute(
                    "SELECT id FROM users WHERE household_id = %s AND id != %s ORDER BY id ASC LIMIT 1",
                    (household['id'], user_id)
                )
                next_owner = cursor.fetchone()
                if next_owner:
                    _copy_ingredients(cursor, storage_user_id, next_owner['id'], saved_at)
                    cursor.execute(
                        "UPDATE households SET storage_user_id = %s WHERE id = %s",
                        (next_owner['id'], household['id'])
                    )
                # 남은 멤버가 없으면 내 재료가 곧 그룹 재료였으므로 따로 복사할 것도 없다.
            elif ingredients_merged:
                # 예전에 내 재료를 그룹에 합쳤다면, 지금 그룹 재료를 그대로 복사해 온다.
                _copy_ingredients(cursor, storage_user_id, user_id, saved_at)
            # else: 합친 적이 없으면 내 user_ingredients 행은 참여 이후 한 번도
            # 건드리지 않았으므로 — 참여 전 재료가 이미 그대로 보존돼 있다.

            cursor.execute(
                "UPDATE users SET household_id = NULL, ingredients_merged = 0 WHERE id = %s",
                (user_id,)
            )
            db.commit()
            return jsonify({'message': '그룹에서 나갔습니다.'}), 200
        except Exception as e:
            db.rollback()
            print(f"Leave household error: {e}")
            return jsonify({'error': '그룹 나가기 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Leave household error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/regenerate-code', methods=['POST'])
def regenerate_household_code():
    """초대 코드 재발급 (코드가 원치 않는 곳에 퍼졌을 때 등). 그룹원 누구나 가능."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400

            invite_code = _issue_unique_invite_code(cursor)
            cursor.execute("UPDATE households SET invite_code = %s WHERE id = %s", (invite_code, household['id']))
            db.commit()
            return jsonify({'invite_code': invite_code}), 200
        except Exception as e:
            db.rollback()
            print(f"Regenerate household code error: {e}")
            return jsonify({'error': '초대 코드 재발급 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Regenerate household code error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/settings', methods=['POST'])
def update_household_settings():
    """그룹 설정 변경. 지금은 allow_ingredient_merge 하나뿐 — 새로 들어오는
    사람이 자기 재료를 그룹 재료에 합칠 수 있게 허용할지. 그룹원 누구나 바꿀 수
    있다("모두 동등" 원칙)."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        if 'allow_ingredient_merge' not in data:
            return jsonify({'error': '변경할 설정이 없습니다.'}), 400
        allow_ingredient_merge = bool(data.get('allow_ingredient_merge'))

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400

            cursor.execute(
                "UPDATE households SET allow_ingredient_merge = %s WHERE id = %s",
                (1 if allow_ingredient_merge else 0, household['id'])
            )
            db.commit()
            return jsonify({'allow_ingredient_merge': allow_ingredient_merge}), 200
        except Exception as e:
            db.rollback()
            print(f"Update household settings error: {e}")
            return jsonify({'error': '설정 변경 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update household settings error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/members/<int:member_id>/stats', methods=['GET'])
def get_household_member_stats(member_id):
    """같은 그룹원의 즐겨찾기/완료/기록 개수 요약. 공유 요청 팝업에서
    "이 사람 활동이 이 정도예요" 를 보여주는 용도라 개수만 준다(목록 아님)."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        ensure_households_table()
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400
            cursor.execute(
                "SELECT id, nickname FROM users WHERE id = %s AND household_id = %s",
                (member_id, household['id'])
            )
            member = cursor.fetchone()
            if not member:
                return jsonify({'error': '같은 그룹의 멤버가 아닙니다.'}), 403

            counts = {}
            for key, table in _HOUSEHOLD_ACTION_TABLES.items():
                cursor.execute(f"SELECT COUNT(*) as c FROM {table} WHERE user_id = %s", (member_id,))
                counts[key] = cursor.fetchone()['c']

            return jsonify({'nickname': member['nickname'], **counts}), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Get household member stats error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/share-requests', methods=['POST'])
def create_share_request():
    """"내 즐겨찾기 등을 그룹에 공유해 달라" 요청 보내기. 대상이 이미
    공유 중이면(share_recipe_actions=1) 보낼 이유가 없으니 막는다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        target_id = data.get('target_id')
        if not target_id:
            return jsonify({'error': 'target_id가 필요합니다.'}), 400

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400

            cursor.execute(
                "SELECT id, share_recipe_actions FROM users WHERE id = %s AND household_id = %s",
                (target_id, household['id'])
            )
            target = cursor.fetchone()
            if not target:
                return jsonify({'error': '같은 그룹의 멤버가 아닙니다.'}), 403
            if target['share_recipe_actions']:
                return jsonify({'error': '이미 공유 중인 멤버예요.'}), 400

            cursor.execute(
                """SELECT id FROM household_share_requests
                   WHERE household_id = %s AND requester_id = %s AND target_id = %s AND status = 'pending'""",
                (household['id'], user_id, target_id)
            )
            if cursor.fetchone():
                return jsonify({'error': '이미 요청을 보냈어요. 응답을 기다려주세요.'}), 400

            cursor.execute(
                """INSERT INTO household_share_requests (household_id, requester_id, target_id, created_at)
                   VALUES (%s, %s, %s, NOW())""",
                (household['id'], user_id, target_id)
            )
            db.commit()
            return jsonify({'message': '공유 요청을 보냈어요.'}), 201
        except Exception as e:
            db.rollback()
            print(f"Create share request error: {e}")
            return jsonify({'error': '요청 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Create share request error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/share-requests/pending', methods=['GET'])
def get_pending_share_requests():
    """내가 응답해야 할(target_id=나) 대기 중인 공유 요청. 앱을 열 때(마이페이지
    진입 시) 이걸 확인해서 팝업으로 물어본다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """SELECT r.id, r.requester_id, u.nickname AS requester_nickname, r.created_at
                   FROM household_share_requests r
                   INNER JOIN users u ON u.id = r.requester_id
                   WHERE r.target_id = %s AND r.status = 'pending'
                   ORDER BY r.created_at ASC""",
                (user_id,)
            )
            rows = cursor.fetchall()
            for row in rows:
                row['created_at'] = row['created_at'].isoformat()
            return jsonify({'requests': rows}), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Get pending share requests error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/share-requests/<int:request_id>/respond', methods=['POST'])
def respond_share_request(request_id):
    """공유 요청 수락/거절. 수락하면 내(target) share_recipe_actions를 켠다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        accept = bool(data.get('accept'))

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                "SELECT * FROM household_share_requests WHERE id = %s AND target_id = %s AND status = 'pending'",
                (request_id, user_id)
            )
            req = cursor.fetchone()
            if not req:
                return jsonify({'error': '요청을 찾을 수 없습니다.'}), 404

            cursor.execute(
                "UPDATE household_share_requests SET status = %s, responded_at = NOW() WHERE id = %s",
                ('accepted' if accept else 'declined', request_id)
            )
            if accept:
                cursor.execute("UPDATE users SET share_recipe_actions = 1 WHERE id = %s", (user_id,))
            db.commit()
            return jsonify({'accepted': accept}), 200
        except Exception as e:
            db.rollback()
            print(f"Respond share request error: {e}")
            return jsonify({'error': '응답 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Respond share request error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/my-sharing', methods=['POST'])
def update_my_sharing():
    """내 즐겨찾기·완료·기록 공유 여부를 내가 직접 켜고 끈다.

    전에는 끄고 나면 다른 그룹원이 "공유 요청"을 보내고 내가 수락해야만
    다시 켜지는 경로만 있었다 — 정작 본인이 스스로 켜고 싶을 때 그럴
    방법이 없었다. 그룹 여부와 무관하게(그룹을 나중에 만들 수도 있으니)
    항상 허용한다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        share = bool(data.get('share_recipe_actions'))

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("UPDATE users SET share_recipe_actions = %s WHERE id = %s", (1 if share else 0, user_id))
            db.commit()
            return jsonify({'share_recipe_actions': share}), 200
        except Exception as e:
            db.rollback()
            print(f"Update my sharing error: {e}")
            return jsonify({'error': '설정 변경 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update my sharing error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


_HOUSEHOLD_ACTION_TABLES = {
    'favorite': 'user_favorite_recipes',
    'completed': 'user_completed_recipes',
    'recorded': 'user_recorded_recipes',
}


def _get_household_action_recipes(user_id, action):
    """그룹원 전체(+나 자신은 항상 포함)의 즐겨찾기/완료/기록 레시피를
    하나로 합친 목록. 같은 레시피를 여러 명이 했으면 한 장으로 합치고
    'acted_by'에 누가 했는지 닉네임을 전부 담아 준다.

    실제로 레코드를 합치는 게 아니라 조회 시점에만 모으는 것이라, 계정별
    user_favorite_recipes 등은 그대로 유지된다(개인 기록 원칙). 그룹이
    없으면 자연스럽게 "내 기록만 있는 목록"이 된다.

    share_recipe_actions=0인 멤버는 **다른 사람에게는** 안 보이지만, 본인
    자신에게는 항상 보여야 하므로 요청한 user_id는 그 값과 무관하게 포함한다.
    """
    table = _HOUSEHOLD_ACTION_TABLES[action]
    ensure_households_table()
    ensure_user_data_tables()
    db = get_db()
    cursor = db.cursor()
    try:
        household = get_household_by_user(cursor, user_id)
        if household:
            cursor.execute(
                """SELECT id FROM users WHERE household_id = %s AND deleted_at IS NULL
                   AND (share_recipe_actions = 1 OR id = %s)""",
                (household['id'], user_id)
            )
            member_ids = [r['id'] for r in cursor.fetchall()]
        else:
            member_ids = []
        if user_id not in member_ids:
            member_ids.append(user_id)

        placeholders = ','.join(['%s'] * len(member_ids))
        cursor.execute(
            f"""SELECT r.*, MAX(action.created_at) AS user_saved_at,
                       GROUP_CONCAT(DISTINCT u.nickname ORDER BY u.nickname SEPARATOR '||') AS acted_by_raw
                FROM recipes r
                INNER JOIN {table} action ON r.id = action.recipe_id
                INNER JOIN users u ON u.id = action.user_id
                WHERE action.user_id IN ({placeholders})
                GROUP BY r.id
                ORDER BY user_saved_at DESC, r.id DESC""",
            member_ids
        )
        rows = cursor.fetchall()
        for row in rows:
            raw = row.pop('acted_by_raw', None) or ''
            row['acted_by'] = raw.split('||') if raw else []
        return rows
    finally:
        db.close()


def _household_action_recipes_endpoint(action):
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        recipes = _get_household_action_recipes(user_id, action)
        return jsonify({'recipes': recipes}), 200
    except Exception as e:
        print(f"Get household {action} recipes error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/me/favorite-recipes', methods=['GET'])
def get_household_favorite_recipes():
    """그룹원 전체(+나)의 즐겨찾기 레시피를 합친 목록. 마이페이지의
    '내가 즐겨찾는 레시피' 영역이 그룹에 속해 있을 때 이 엔드포인트를 쓴다."""
    return _household_action_recipes_endpoint('favorite')


@app.route('/api/households/me/completed-recipes', methods=['GET'])
def get_household_completed_recipes():
    """그룹원 전체(+나)의 완료 레시피를 합친 목록."""
    return _household_action_recipes_endpoint('completed')


@app.route('/api/households/me/recorded-recipes', methods=['GET'])
def get_household_recorded_recipes():
    """그룹원 전체(+나)의 기록 레시피를 합친 목록."""
    return _household_action_recipes_endpoint('recorded')


@app.route('/api/households/me/completed-calendar', methods=['GET'])
def get_household_completed_calendar():
    """요리 캘린더용: 날짜별로 누가 어떤 레시피를 완료했는지.

    `/completed-recipes`(레시피별로 묶어서 한 장씩)와 달리, 여기서는 레시피
    단위로 합치지 않는다 — 같은 레시피를 여러 명이 다른 날 완료했으면 각각
    별도 행으로 준다(달력에 날짜별로 찍어야 하므로 날짜 정보를 뭉개면 안 됨).

    쿼리 파라미터: start, end (YYYY-MM-DD, 둘 다 포함). 기본값은 이번 달."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        today = datetime.now().date()
        start_str = request.args.get('start') or today.replace(day=1).isoformat()
        end_str = request.args.get('end') or today.isoformat()
        try:
            start_date = datetime.strptime(start_str, '%Y-%m-%d').date()
            end_date = datetime.strptime(end_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': 'start/end는 YYYY-MM-DD 형식이어야 합니다.'}), 400

        ensure_households_table()
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if household:
                cursor.execute(
                    """SELECT id, nickname FROM users WHERE household_id = %s
                       AND deleted_at IS NULL AND (share_recipe_actions = 1 OR id = %s)""",
                    (household['id'], user_id)
                )
                # fetchall()이 0건일 때 tuple을 돌려주는 pymysql 특성 때문에
                # 아래 member_rows.append(me)가 터질 수 있어 list로 감싼다.
                member_rows = list(cursor.fetchall())
            else:
                member_rows = []
            member_ids = [r['id'] for r in member_rows]
            if user_id not in member_ids:
                cursor.execute("SELECT id, nickname FROM users WHERE id = %s", (user_id,))
                me = cursor.fetchone()
                if me:
                    member_rows.append(me)
                    member_ids.append(user_id)

            # 그룹이 있으면 목표는 그룹 전체가 공유하는 하나의 값(개인별로 따로
            # 안 둠). 그룹이 없으면 내 개인 목표.
            if household:
                group_goal = household['monthly_cooking_goal']
                my_personal_goal = None
                household_size = len(member_ids)
                raw_family_size = household.get('family_size')
                family_size = raw_family_size if raw_family_size else household_size
                raw_savings_per_meal = household.get('savings_per_meal')
                savings_per_meal = raw_savings_per_meal if raw_savings_per_meal else ESTIMATED_SAVINGS_PER_MEAL_DEFAULT
            else:
                cursor.execute("SELECT monthly_cooking_goal, family_size, savings_per_meal FROM users WHERE id = %s", (user_id,))
                row = cursor.fetchone()
                group_goal = None
                my_personal_goal = row['monthly_cooking_goal'] if row else 20
                household_size = 1
                raw_family_size = row.get('family_size') if row else None
                family_size = raw_family_size if raw_family_size else 1
                raw_savings_per_meal = row.get('savings_per_meal') if row else None
                savings_per_meal = raw_savings_per_meal if raw_savings_per_meal else ESTIMATED_SAVINGS_PER_MEAL_DEFAULT

            # DB 커넥션 자체를 KST(+09:00)로 고정해 두고(get_db() 참고), 과거 데이터도
            # 한 번 KST로 보정해 뒀기 때문에 created_at은 이미 KST 기준 값이다.
            # (예전엔 서버 시계가 UTC라 여기서 매번 +9시간을 더해야 했다 — 이제는 저장값
            # 자체가 KST라 이 쿼리에서 따로 보정할 필요가 없다.)
            placeholders = ','.join(['%s'] * len(member_ids))
            cursor.execute(
                f"""SELECT DATE(action.created_at) AS day,
                           action.created_at AS created_at,
                           r.id AS recipe_id, r.title, r.thumbnail, action.user_id, u.nickname
                    FROM user_completed_recipes action
                    INNER JOIN recipes r ON r.id = action.recipe_id
                    INNER JOIN users u ON u.id = action.user_id
                    WHERE action.user_id IN ({placeholders})
                      AND DATE(action.created_at) BETWEEN %s AND %s
                    ORDER BY action.created_at ASC""",
                member_ids + [start_date, end_date]
            )
            rows = cursor.fetchall()
            for row in rows:
                row['day'] = row['day'].isoformat()
                row['created_at'] = row['created_at'].isoformat()

            return jsonify({
                'entries': rows,
                'group_goal': group_goal,
                'my_personal_goal': my_personal_goal,
                'household_size': household_size,
                'family_size': family_size,
                'family_size_is_custom': bool(raw_family_size),
                'savings_per_meal': savings_per_meal,
                'savings_per_meal_is_custom': bool(raw_savings_per_meal),
            }), 200
        finally:
            db.close()
    except Exception as e:
        print(f"Get household completed calendar error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/users/<int:user_id>/monthly-goal', methods=['POST'])
def update_monthly_cooking_goal(user_id):
    """요리 캘린더의 이번 달 목표(완료 횟수) 변경 — 그룹이 없을 때(혼자)
    쓰는 개인 목표. 그룹에 속해 있으면 이 값 대신 households.monthly_cooking_goal
    (공동 목표, POST /api/households/goal)이 쓰인다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403

        data = request.get_json() or {}
        goal = data.get('monthly_cooking_goal')
        if not isinstance(goal, int) or goal < 0 or goal > 200:
            return jsonify({'error': '목표는 0~200 사이의 숫자여야 합니다.'}), 400

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("UPDATE users SET monthly_cooking_goal = %s WHERE id = %s", (goal, user_id))
            db.commit()
            return jsonify({'monthly_cooking_goal': goal}), 200
        except Exception as e:
            db.rollback()
            print(f"Update monthly cooking goal error: {e}")
            return jsonify({'error': '목표 저장 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update monthly cooking goal error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/goal', methods=['POST'])
def update_household_goal():
    """그룹의 이번 달 공동 목표 변경. 개인별로 따로 있는 게 아니라 그룹
    전체가 공유하는 하나의 값이라, 그룹원 누구나 바꿀 수 있다("모두 동등")."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        goal = data.get('monthly_cooking_goal')
        if not isinstance(goal, int) or goal < 0 or goal > 200:
            return jsonify({'error': '목표는 0~200 사이의 숫자여야 합니다.'}), 400

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400
            cursor.execute(
                "UPDATE households SET monthly_cooking_goal = %s WHERE id = %s",
                (goal, household['id'])
            )
            db.commit()
            return jsonify({'monthly_cooking_goal': goal}), 200
        except Exception as e:
            db.rollback()
            print(f"Update household goal error: {e}")
            return jsonify({'error': '목표 저장 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update household goal error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/family-size', methods=['POST'])
def update_household_family_size():
    """절약액 추정에 쓰는 "실제 같이 먹는 식구 수". 연동 계정 수와 다를 수
    있어(아이가 있으면 계정 없이도 같이 먹음) 그룹원이 직접 조정할 수 있게
    한다. family_size에 null/0을 보내면 다시 계정 수 기준 자동값으로 돌아간다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        family_size = data.get('family_size')
        if family_size is not None:
            if not isinstance(family_size, int) or family_size < 1 or family_size > 20:
                return jsonify({'error': '식구 수는 1~20 사이의 숫자여야 합니다.'}), 400

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400
            cursor.execute(
                "UPDATE households SET family_size = %s WHERE id = %s",
                (family_size, household['id'])
            )
            db.commit()
            return jsonify({'family_size': family_size}), 200
        except Exception as e:
            db.rollback()
            print(f"Update household family size error: {e}")
            return jsonify({'error': '저장 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update household family size error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/users/<int:user_id>/family-size', methods=['POST'])
def update_user_family_size(user_id):
    """혼자(그룹 미가입) 쓰는 식구 수 — households.family_size와 같은 용도의
    개인용 버전."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403

        data = request.get_json() or {}
        family_size = data.get('family_size')
        if family_size is not None:
            if not isinstance(family_size, int) or family_size < 1 or family_size > 20:
                return jsonify({'error': '식구 수는 1~20 사이의 숫자여야 합니다.'}), 400

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("UPDATE users SET family_size = %s WHERE id = %s", (family_size, user_id))
            db.commit()
            return jsonify({'family_size': family_size}), 200
        except Exception as e:
            db.rollback()
            print(f"Update user family size error: {e}")
            return jsonify({'error': '저장 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update user family size error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/households/savings-per-meal', methods=['POST'])
def update_household_savings_per_meal():
    """절약액 추정에 쓰는 "한 끼당 절약액"을 그룹 전체가 공유하는 값으로
    변경. family_size와 같은 패턴 — 그룹원 누구나 바꿀 수 있고, null을
    보내면 기본값(ESTIMATED_SAVINGS_PER_MEAL_DEFAULT)으로 되돌아간다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload:
            return jsonify({'error': '권한이 없습니다.'}), 403
        user_id = payload.get('user_id')

        data = request.get_json() or {}
        savings_per_meal = data.get('savings_per_meal')
        if savings_per_meal is not None:
            if not isinstance(savings_per_meal, int) or savings_per_meal < 0 or savings_per_meal > 100000:
                return jsonify({'error': '한 끼 추정액은 0~100,000원 사이의 숫자여야 합니다.'}), 400

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            household = get_household_by_user(cursor, user_id)
            if not household:
                return jsonify({'error': '속한 그룹이 없습니다.'}), 400
            cursor.execute(
                "UPDATE households SET savings_per_meal = %s WHERE id = %s",
                (savings_per_meal, household['id'])
            )
            db.commit()
            return jsonify({'savings_per_meal': savings_per_meal}), 200
        except Exception as e:
            db.rollback()
            print(f"Update household savings per meal error: {e}")
            return jsonify({'error': '저장 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update household savings per meal error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/users/<int:user_id>/savings-per-meal', methods=['POST'])
def update_user_savings_per_meal(user_id):
    """혼자(그룹 미가입) 쓰는 한 끼당 절약액 — households.savings_per_meal과
    같은 용도의 개인용 버전."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        payload = verify_jwt_token(auth_header.split(' ')[1])
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403

        data = request.get_json() or {}
        savings_per_meal = data.get('savings_per_meal')
        if savings_per_meal is not None:
            if not isinstance(savings_per_meal, int) or savings_per_meal < 0 or savings_per_meal > 100000:
                return jsonify({'error': '한 끼 추정액은 0~100,000원 사이의 숫자여야 합니다.'}), 400

        ensure_households_table()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute("UPDATE users SET savings_per_meal = %s WHERE id = %s", (savings_per_meal, user_id))
            db.commit()
            return jsonify({'savings_per_meal': savings_per_meal}), 200
        except Exception as e:
            db.rollback()
            print(f"Update user savings per meal error: {e}")
            return jsonify({'error': '저장 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
    except Exception as e:
        print(f"Update user savings per meal error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500


@app.route('/api/users/<int:user_id>/ingredients', methods=['GET'])
def get_user_ingredients(user_id):
    """사용자 재료 조회"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            print(f"[get_user_ingredients] 인증 실패: Authorization 헤더 없음, user_id={user_id}")
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            print(f"[get_user_ingredients] 권한 없음: user_id={user_id}, payload={payload}")
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        print(f"[get_user_ingredients] 재료 조회 시작: user_id={user_id}")

        ensure_user_data_tables()
        ensure_households_table()
        db = get_db()
        cursor = db.cursor()

        try:
            # 그룹에 속해 있으면 그룹의 공유 재료를 읽는다.
            storage_user_id = resolve_ingredient_storage_user_id(cursor, user_id)
            cursor.execute(
                "SELECT id, name, storage_box, expiry_date, purchase_date FROM user_ingredients WHERE user_id = %s ORDER BY created_at DESC",
                (storage_user_id,)
            )
            ingredients = cursor.fetchall()

            print(f"[get_user_ingredients] DB 조회 결과: user_id={user_id}, storage_user_id={storage_user_id}, count={len(ingredients)}")
            
            # storage_box별로 그룹화
            result = {
                'frozen': [],
                'fridge': [],
                'room': []
            }
            
            for ing in ingredients:
                box = ing['storage_box']
                result[box].append({
                    'id': str(ing['id']),
                    'name': ing['name'],
                    'expiry': ing['expiry_date'].strftime('%Y-%m-%d') if ing['expiry_date'] else None,
                    'purchase': ing['purchase_date'].strftime('%Y-%m-%d') if ing['purchase_date'] else None,
                })
            
            print(f"[get_user_ingredients] 재료 조회 완료: user_id={user_id}, frozen={len(result['frozen'])}, fridge={len(result['fridge'])}, room={len(result['room'])}")
            
            return jsonify(result), 200
            
        except Exception as e:
            print(f"Get user ingredients error: {e}")
            return jsonify({'error': '재료 조회 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Get user ingredients error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/ingredients', methods=['POST'])
def save_user_ingredients(user_id):
    """사용자 재료 저장"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        data = request.get_json()
        ingredients = data.get('ingredients', {})

        ensure_user_data_tables()
        ensure_households_table()
        db = get_db()
        cursor = db.cursor()

        try:
            # 그룹에 속해 있으면 그룹의 공유 재료에 쓴다.
            storage_user_id = resolve_ingredient_storage_user_id(cursor, user_id)

            # 저장 시점 기록
            saved_at = datetime.now()

            # 기존 재료 삭제
            cursor.execute("DELETE FROM user_ingredients WHERE user_id = %s", (storage_user_id,))

            # 새 재료 저장
            for box in ['frozen', 'fridge', 'room']:
                box_ingredients = ingredients.get(box, [])
                for ing in box_ingredients:
                    expiry_date = ing.get('expiry') if ing.get('expiry') else None
                    purchase_date = ing.get('purchase') if ing.get('purchase') else None

                    cursor.execute(
                        """INSERT INTO user_ingredients (user_id, name, storage_box, expiry_date, purchase_date, saved_at)
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (storage_user_id, ing['name'], box, expiry_date, purchase_date, saved_at)
                    )
            
            db.commit()
            return jsonify({'message': '재료가 저장되었습니다.', 'saved_at': saved_at.strftime('%Y-%m-%d %H:%M:%S')}), 200
            
        except Exception as e:
            db.rollback()
            print(f"Save user ingredients error: {e}")
            return jsonify({'error': '재료 저장 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Save user ingredients error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/recorded-recipes', methods=['GET'])
def get_user_recorded_recipes(user_id):
    """사용자 기록한 레시피 조회"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        
        try:
            cursor.execute(
                """SELECT r.*, urr.created_at AS user_saved_at FROM recipes r
                   INNER JOIN user_recorded_recipes urr ON r.id = urr.recipe_id
                   WHERE urr.user_id = %s
                   ORDER BY urr.created_at DESC, urr.id DESC""",
                (user_id,)
            )
            recipes = cursor.fetchall()
            
            return jsonify({'recipes': recipes}), 200
            
        except Exception as e:
            print(f"Get user recorded recipes error: {e}")
            return jsonify({'error': '레시피 조회 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Get user recorded recipes error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/recorded-recipes', methods=['POST'])
def add_user_recorded_recipe(user_id):
    """사용자 기록한 레시피 추가"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        data = request.get_json()
        recipe_id = data.get('recipe_id')
        
        if not recipe_id:
            return jsonify({'error': '레시피 ID가 필요합니다.'}), 400
        
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        
        try:
            cursor.execute(
                """INSERT INTO user_recorded_recipes (user_id, recipe_id) 
                   VALUES (%s, %s)
                   ON DUPLICATE KEY UPDATE created_at = created_at""",
                (user_id, recipe_id)
            )
            db.commit()
            return jsonify({'message': '레시피가 기록되었습니다.'}), 200
            
        except Exception as e:
            db.rollback()
            print(f"Add user recorded recipe error: {e}")
            return jsonify({'error': '레시피 기록 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Add user recorded recipe error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/recorded-recipes/<int:recipe_id>', methods=['DELETE'])
def remove_user_recorded_recipe(user_id, recipe_id):
    """사용자 기록한 레시피 삭제"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        
        try:
            cursor.execute(
                "DELETE FROM user_recorded_recipes WHERE user_id = %s AND recipe_id = %s",
                (user_id, recipe_id)
            )
            db.commit()
            return jsonify({'message': '레시피 기록이 삭제되었습니다.'}), 200
            
        except Exception as e:
            db.rollback()
            print(f"Remove user recorded recipe error: {e}")
            return jsonify({'error': '레시피 삭제 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Remove user recorded recipe error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/completed-recipes', methods=['GET'])
def get_user_completed_recipes(user_id):
    """사용자 완료한 레시피 조회"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        
        try:
            cursor.execute(
                """SELECT r.*, ucr.created_at AS user_saved_at FROM recipes r
                   INNER JOIN user_completed_recipes ucr ON r.id = ucr.recipe_id
                   WHERE ucr.user_id = %s
                   ORDER BY ucr.created_at DESC, ucr.id DESC""",
                (user_id,)
            )
            recipes = cursor.fetchall()
            
            return jsonify({'recipes': recipes}), 200
            
        except Exception as e:
            print(f"Get user completed recipes error: {e}")
            return jsonify({'error': '레시피 조회 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Get user completed recipes error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/completed-recipes', methods=['POST'])
def add_user_completed_recipe(user_id):
    """사용자 완료한 레시피 추가"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        data = request.get_json()
        recipe_id = data.get('recipe_id')
        
        if not recipe_id:
            return jsonify({'error': '레시피 ID가 필요합니다.'}), 400
        
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        
        try:
            cursor.execute(
                """INSERT INTO user_completed_recipes (user_id, recipe_id) 
                   VALUES (%s, %s)
                   ON DUPLICATE KEY UPDATE created_at = created_at""",
                (user_id, recipe_id)
            )
            db.commit()
            return jsonify({'message': '레시피가 완료되었습니다.'}), 200
            
        except Exception as e:
            db.rollback()
            print(f"Add user completed recipe error: {e}")
            return jsonify({'error': '레시피 완료 처리 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Add user completed recipe error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/completed-recipes/<int:recipe_id>', methods=['DELETE'])
def remove_user_completed_recipe(user_id, recipe_id):
    """사용자 완료한 레시피 삭제"""
    try:
        # JWT 토큰 확인
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401
        
        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)
        
        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403
        
        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()
        
        try:
            cursor.execute(
                "DELETE FROM user_completed_recipes WHERE user_id = %s AND recipe_id = %s",
                (user_id, recipe_id)
            )
            db.commit()
            return jsonify({'message': '레시피 완료가 취소되었습니다.'}), 200
            
        except Exception as e:
            db.rollback()
            print(f"Remove user completed recipe error: {e}")
            return jsonify({'error': '레시피 삭제 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()
            
    except Exception as e:
        print(f"Remove user completed recipe error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/completed-recipes/<int:recipe_id>/date', methods=['PATCH'])
def update_user_completed_recipe_date(user_id, recipe_id):
    """완료 기록의 날짜만 수정한다(시각은 기존 값 유지).

    완료 버튼을 실제로 요리한 날 바로 안 누르고 나중에(예: 하루 지나서) 누르면
    캘린더에 엉뚱한 날짜로 찍힌다 — 이 엔드포인트로 사용자가 직접 날짜를
    바로잡을 수 있게 한다."""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401

        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)

        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403

        data = request.get_json() or {}
        new_date_str = (data.get('date') or '').strip()

        try:
            new_date = datetime.strptime(new_date_str, '%Y-%m-%d').date()
        except ValueError:
            return jsonify({'error': '날짜 형식이 올바르지 않습니다(YYYY-MM-DD).'}), 400

        if new_date > datetime.now().date():
            return jsonify({'error': '미래 날짜로는 수정할 수 없습니다.'}), 400

        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()

        try:
            cursor.execute(
                "SELECT created_at FROM user_completed_recipes WHERE user_id = %s AND recipe_id = %s",
                (user_id, recipe_id)
            )
            row = cursor.fetchone()
            if not row:
                return jsonify({'error': '완료 기록을 찾을 수 없습니다.'}), 404

            # 시각은 원래 완료 버튼을 누른 시각을 그대로 두고 날짜만 바꾼다.
            existing_time = row['created_at'].time()
            new_created_at = datetime.combine(new_date, existing_time)

            cursor.execute(
                "UPDATE user_completed_recipes SET created_at = %s WHERE user_id = %s AND recipe_id = %s",
                (new_created_at, user_id, recipe_id)
            )
            db.commit()
            return jsonify({'message': '완료 날짜가 수정되었습니다.', 'created_at': new_created_at.isoformat()}), 200

        except Exception as e:
            db.rollback()
            print(f"Update completed recipe date error: {e}")
            return jsonify({'error': '날짜 수정 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()

    except Exception as e:
        print(f"Update completed recipe date error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/favorite-recipes', methods=['GET'])
def get_user_favorite_recipes(user_id):
    """사용자 즐겨찾기 레시피 조회"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401

        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)

        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403

        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()

        try:
            cursor.execute(
                """SELECT r.*, ufr.created_at AS user_saved_at FROM recipes r
                   INNER JOIN user_favorite_recipes ufr ON r.id = ufr.recipe_id
                   WHERE ufr.user_id = %s
                   ORDER BY ufr.created_at DESC, ufr.id DESC""",
                (user_id,)
            )
            recipes = cursor.fetchall()

            return jsonify({'recipes': recipes}), 200

        except Exception as e:
            print(f"Get user favorite recipes error: {e}")
            return jsonify({'error': '레시피 조회 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()

    except Exception as e:
        print(f"Get user favorite recipes error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/favorite-recipes', methods=['POST'])
def add_user_favorite_recipe(user_id):
    """사용자 즐겨찾기 레시피 추가"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401

        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)

        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403

        data = request.get_json()
        recipe_id = data.get('recipe_id')

        if not recipe_id:
            return jsonify({'error': '레시피 ID가 필요합니다.'}), 400

        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()

        try:
            cursor.execute(
                """INSERT INTO user_favorite_recipes (user_id, recipe_id)
                   VALUES (%s, %s)
                   ON DUPLICATE KEY UPDATE created_at = CURRENT_TIMESTAMP""",
                (user_id, recipe_id)
            )
            db.commit()
            return jsonify({'message': '레시피가 즐겨찾기에 추가되었습니다.'}), 200

        except Exception as e:
            db.rollback()
            print(f"Add user favorite recipe error: {e}")
            return jsonify({'error': '레시피 즐겨찾기 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()

    except Exception as e:
        print(f"Add user favorite recipe error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/users/<int:user_id>/favorite-recipes/<int:recipe_id>', methods=['DELETE'])
def remove_user_favorite_recipe(user_id, recipe_id):
    """사용자 즐겨찾기 레시피 삭제"""
    try:
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({'error': '인증이 필요합니다.'}), 401

        token = auth_header.split(' ')[1]
        payload = verify_jwt_token(token)

        if not payload or payload.get('user_id') != user_id:
            return jsonify({'error': '권한이 없습니다.'}), 403

        ensure_user_data_tables()
        db = get_db()
        cursor = db.cursor()

        try:
            cursor.execute(
                "DELETE FROM user_favorite_recipes WHERE user_id = %s AND recipe_id = %s",
                (user_id, recipe_id)
            )
            db.commit()
            return jsonify({'message': '레시피 즐겨찾기가 취소되었습니다.'}), 200

        except Exception as e:
            db.rollback()
            print(f"Remove user favorite recipe error: {e}")
            return jsonify({'error': '레시피 삭제 중 오류가 발생했습니다.'}), 500
        finally:
            db.close()

    except Exception as e:
        print(f"Remove user favorite recipe error: {e}")
        return jsonify({'error': '서버 오류가 발생했습니다.'}), 500

@app.route('/api/chat', methods=['POST'])
def chat_with_recipes():
    """냉장고 재료 + 대화 의도로 레시피 DB를 검색해 링크를 돌려준다."""
    from chat_service import handle_chat
    return handle_chat(get_db)


@app.route('/api/ingredients/recognize', methods=['POST'])
def recognize_ingredients_from_image():
    """사진(영수증/재료)에서 재료를 인식해 담을 후보를 돌려준다.

    담는 것까지 하지 않고 후보만 돌려준다 — OCR 은 반드시 틀리므로 사용자가
    확인한 뒤에 담아야 한다. 재료명은 레시피와 같은 사전으로 정규화되므로
    여기서 담은 재료는 그대로 레시피 매칭에 쓰인다.
    """
    # 이미지 인식 모듈은 pandas 와 재료 사전 CSV 를 쓴다. 배포 환경에서 그 중
    # 하나라도 없으면 import 자체가 터지는데, 그대로 두면 라우트가 500 을 내며
    # 원인이 응답에 전혀 안 남는다(실제로 그렇게 한 번 헤맸다). 여기서 잡아
    # 로그를 남기고 사용자에게는 "설정이 안 됐다"고 알려 준다.
    try:
        import chat_service
        from ingredient_vision import (
            ALLOWED_MIME, MAX_IMAGE_BYTES, MAX_IMAGES, MAX_TOTAL_BYTES,
            QuotaExceeded, recognize,
        )
    except Exception as e:
        import traceback
        print(f"[recognize] 모듈 로드 실패: {e}")
        traceback.print_exc()
        return jsonify({'error': '이미지 인식이 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.'}), 503

    uploads = request.files.getlist('image')
    if not uploads:
        return jsonify({'error': '이미지가 없습니다.'}), 400
    if len(uploads) > MAX_IMAGES:
        return jsonify({'error': f'사진은 한 번에 {MAX_IMAGES}장까지 올릴 수 있어요.'}), 413

    images = []
    total = 0
    for upload in uploads:
        image_bytes = upload.read()
        if not image_bytes:
            return jsonify({'error': '이미지가 비어 있습니다.'}), 400
        if len(image_bytes) > MAX_IMAGE_BYTES:
            return jsonify({'error': '이미지가 너무 큽니다. 8MB 이하로 올려 주세요.'}), 413
        total += len(image_bytes)
        if total > MAX_TOTAL_BYTES:
            return jsonify({'error': '사진 용량이 너무 커요. 장수를 줄여 주세요.'}), 413
        mime_type = (upload.mimetype or '').lower()
        if mime_type not in ALLOWED_MIME:
            return jsonify({'error': '지원하지 않는 이미지 형식입니다.'}), 415
        images.append((image_bytes, mime_type))

    # 챗봇과 같은 하루 한도를 공유한다 (같은 무료 키를 쓰므로).
    # 여러 장이어도 LLM 호출은 1회라 한도도 1만 쓴다.
    if not chat_service._consume_quota():
        return jsonify({
            'error': f'오늘 무료 한도({chat_service._daily_limit()}회)를 다 썼어요. 내일 다시 시도해 주세요.',
        }), 429

    mode = (request.form.get('mode') or 'receipt').strip()
    try:
        result = recognize(images, mode=mode)
    except QuotaExceeded:
        return jsonify({'error': '지금 요청이 몰려 있어요. 잠시 후 다시 시도해 주세요.'}), 429
    except RuntimeError as e:
        print(f"Recognize ingredients config error: {e}")
        return jsonify({'error': '이미지 인식이 아직 설정되지 않았습니다.'}), 503
    except Exception as e:
        print(f"Recognize ingredients error: {e}")
        return jsonify({'error': '이미지를 읽지 못했어요. 다시 찍어 주세요.'}), 502

    return jsonify(result)


# =====================
# 쿠팡 링크 클릭 측정
# =====================

def ensure_coupang_click_table():
    """쿠팡 클릭 로그 테이블 생성 (없을 때만)"""
    db = get_db()
    cursor = db.cursor()
    try:
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS coupang_clicks (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                source VARCHAR(20) NOT NULL,        -- 'pill' | 'card_cta'
                ingredient VARCHAR(100) NULL,       -- 어떤 재료를 눌렀는지
                lacking_count INT NULL,             -- 그 카드의 부족 재료 개수
                recipe_id INT NULL,
                page VARCHAR(120) NULL,             -- 어느 화면에서 눌렀는지
                created_at DATETIME NOT NULL,
                INDEX idx_created_at (created_at),
                INDEX idx_source (source),
                INDEX idx_ingredient (ingredient)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        """)
        db.commit()
    finally:
        db.close()


@app.route('/api/track/coupang-click', methods=['POST'])
def track_coupang_click():
    """쿠팡 링크 클릭을 기록한다.

    광고 자리를 늘리기 전에 "어떤 경로가 실제로 눌리는지"를 알기 위한 것.
    측정 실패가 사용자 동작을 막으면 안 되므로 어떤 경우에도 200 을 반환한다.
    """
    try:
        data = request.get_json(silent=True) or {}
        source = (data.get('source') or '')[:20]
        if source not in ('pill', 'card_cta'):
            return jsonify({'ok': True}), 200

        ensure_coupang_click_table()
        db = get_db()
        cursor = db.cursor()
        try:
            cursor.execute(
                """INSERT INTO coupang_clicks
                   (source, ingredient, lacking_count, recipe_id, page, created_at)
                   VALUES (%s, %s, %s, %s, %s, NOW())""",
                (
                    source,
                    (data.get('ingredient') or '')[:100] or None,
                    data.get('lackingCount') if isinstance(data.get('lackingCount'), int) else None,
                    data.get('recipeId') if isinstance(data.get('recipeId'), int) else None,
                    (data.get('page') or '')[:120] or None,
                ),
            )
            db.commit()
        finally:
            db.close()
        return jsonify({'ok': True}), 200
    except Exception as e:
        print(f"[track_coupang_click] {e}", flush=True)
        return jsonify({'ok': True}), 200


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