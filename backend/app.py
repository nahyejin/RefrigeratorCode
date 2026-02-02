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
        match_count_parts = [
            f"(CASE WHEN FIND_IN_SET(%s, REPLACE(used_ingredients,' ','')) > 0 THEN 1 ELSE 0 END)"
            for _ in my_ingredients
        ]
        match_count_expr = f"""
            CASE 
                WHEN {normalized_ingredients} REGEXP %s THEN ({' + '.join(match_count_parts)})
                ELSE 0
            END
        """
        
        # REGEXP 패턴을 첫 번째 파라미터로 추가, 그 다음 재료들 추가
        match_rate_params = [regex_pattern_param] + my_ingredients.copy()
        
        match_rate_expr = f"CASE WHEN ({total_ing_expr}) = 0 THEN 0 ELSE ROUND(({match_count_expr})/({total_ing_expr})*100) END"
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
    count_start = time.time()
    
    if match_rate_min is not None or match_rate_max is not None or need_match_rate:
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
            
            # Soft Delete: 실제 삭제 대신 deleted_at을 현재 시간으로 설정 (한국 시간대)
            # UTC+9 시간대 적용 (한국 시간)
            from datetime import datetime, timezone, timedelta
            
            # 한국 시간대 (KST, UTC+9)
            kst = timezone(timedelta(hours=9))
            current_time_kst = datetime.now(kst)
            
            cursor.execute(
                "UPDATE users SET deleted_at = %s WHERE id = %s AND email = %s AND provider = %s",
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
        
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Error creating user data tables: {e}")
    finally:
        db.close()

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
        db = get_db()
        cursor = db.cursor()
        
        try:
            cursor.execute(
                "SELECT id, name, storage_box, expiry_date, purchase_date FROM user_ingredients WHERE user_id = %s ORDER BY created_at DESC",
                (user_id,)
            )
            ingredients = cursor.fetchall()
            
            print(f"[get_user_ingredients] DB 조회 결과: user_id={user_id}, count={len(ingredients)}")
            
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
        db = get_db()
        cursor = db.cursor()
        
        try:
            # 저장 시점 기록
            saved_at = datetime.now()
            
            # 기존 재료 삭제
            cursor.execute("DELETE FROM user_ingredients WHERE user_id = %s", (user_id,))
            
            # 새 재료 저장
            for box in ['frozen', 'fridge', 'room']:
                box_ingredients = ingredients.get(box, [])
                for ing in box_ingredients:
                    expiry_date = ing.get('expiry') if ing.get('expiry') else None
                    purchase_date = ing.get('purchase') if ing.get('purchase') else None
                    
                    cursor.execute(
                        """INSERT INTO user_ingredients (user_id, name, storage_box, expiry_date, purchase_date, saved_at) 
                           VALUES (%s, %s, %s, %s, %s, %s)""",
                        (user_id, ing['name'], box, expiry_date, purchase_date, saved_at)
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
                """SELECT r.* FROM recipes r
                   INNER JOIN user_recorded_recipes urr ON r.id = urr.recipe_id
                   WHERE urr.user_id = %s
                   ORDER BY urr.created_at DESC""",
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
                """SELECT r.* FROM recipes r
                   INNER JOIN user_completed_recipes ucr ON r.id = ucr.recipe_id
                   WHERE ucr.user_id = %s
                   ORDER BY ucr.created_at DESC""",
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