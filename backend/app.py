from flask import Flask, jsonify, request
from flask_cors import CORS
import pymysql
import os
from dotenv import load_dotenv

# 환경변수 로드
# - 개발환경에서만 현재 디렉토리의 .env를 로드
# - 배포환경(Railway 등)에서는 플랫폼이 주입한 환경변수 사용
if os.getenv('FLASK_ENV', '').lower() == 'development':
    load_dotenv()

app = Flask(__name__)

# 한글이 유니코드 이스케이프 시퀀스로 변환되지 않도록 설정
app.config['JSON_AS_ASCII'] = False

# CORS 설정 - 환경변수에서 허용할 origin 가져오기
default_origins = 'http://localhost:5173,http://localhost:5177,http://localhost:5178'
cors_origins = os.getenv('CORS_ORIGINS', default_origins).split(',')

# Railway 배포 환경에서는 모든 도메인 허용 (프론트엔드가 다른 플랫폼에 있을 수 있음)
if os.getenv('RAILWAY_ENVIRONMENT'):
    cors_origins.append('https://*.up.railway.app')
    cors_origins.append('https://*.vercel.app')
    cors_origins.append('https://*.netlify.app')
    cors_origins.append('https://*.github.io')

CORS(app, origins=[origin.strip() for origin in cors_origins if origin.strip()], supports_credentials=True)

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

    db = get_db()
    cursor = db.cursor()

    # WHERE
    where_clauses = ["1=1"]
    base_params = []
    if platform:
        where_clauses.append("platform LIKE %s")
        base_params.append(f"%{platform}%")
    if keyword:
        where_clauses.append("(title LIKE %s OR content LIKE %s)")
        base_params.extend([f"%{keyword}%", f"%{keyword}%"])
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

    # total COUNT
    count_sql = f"SELECT COUNT(*) AS total FROM recipes WHERE {where_sql}"
    cursor.execute(count_sql, base_params)
    total = cursor.fetchone()['total']

    # 메인 쿼리: 필요한 컬럼만 + LIMIT/OFFSET
    select_cols = "id, title, thumbnail, platform, likes, comments, hits, post_time"
    main_sql = f"""
      SELECT {select_cols},
             {match_rate_expr} AS match_rate
      FROM recipes
      WHERE {where_sql}
      ORDER BY {order_by}
      LIMIT %s OFFSET %s
    """
    # my_ingredients가 있으면 매칭 파라미터가 먼저와야 하므로 결합 순서 주의
    params = (my_ingredients if my_ingredients else []) + base_params + [size, offset]
    cursor.execute(main_sql, params)
    rows = cursor.fetchall()

    db.close()
    return jsonify({"recipes": rows, "total": total, "page": page, "size": size})

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