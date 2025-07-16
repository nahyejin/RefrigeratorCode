from flask import Flask, jsonify, request
from flask_cors import CORS
import pymysql
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv('env.development' if os.getenv('FLASK_ENV') == 'development' else 'env.production')

app = Flask(__name__)

# 한글이 유니코드 이스케이프 시퀀스로 변환되지 않도록 설정
app.config['JSON_AS_ASCII'] = False

# CORS 설정 - 환경변수에서 허용할 origin 가져오기
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5177,http://localhost:5178').split(',')
CORS(app, origins=[origin.strip() for origin in cors_origins if origin.strip()], supports_credentials=True)

def get_db():
    return pymysql.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        user=os.getenv('DB_USER', 'root'),
        password=os.getenv('DB_PASSWORD', 'sk784512!!'),
        db=os.getenv('DB_NAME', 'refrigerator'),
        port=int(os.getenv('DB_PORT', 3306)),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
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
    page = int(request.args.get('page', 1))
    size = int(request.args.get('size', 20))
    match_rate_min = float(request.args.get('match_rate_min', 30))
    match_rate_max = float(request.args.get('match_rate_max', 100))
    sort_by = request.args.get('sort_by', 'match_rate')  # match_rate, date, popularity, like, comment
    platform = request.args.get('platform', '')  # youtube, naver, or empty for all
    
    offset = (page - 1) * size
    db = get_db()
    cursor = db.cursor()
    
    # 기본 WHERE 조건
    where_conditions = ["1=1"]  # 항상 참인 조건으로 시작
    params = []
    
    # 플랫폼 필터링
    if platform:
        if platform.lower() == 'youtube':
            where_conditions.append("platform LIKE %s")
            params.append('%youtube%')
        elif platform.lower() == 'naver':
            where_conditions.append("platform LIKE %s")
            params.append('%naver%')
    
    # 정렬 조건
    if sort_by == 'match_rate':
        # 매칭률 순으로 정렬 (재료 정보가 없는 경우 하위로)
        order_by = """
        CASE 
            WHEN used_ingredients IS NULL OR used_ingredients = '' OR used_ingredients = 'null' THEN 1
            ELSE 0
        END,
        post_time DESC
        """
    elif sort_by == 'date':
        order_by = "post_time DESC"
    elif sort_by == 'popularity':
        order_by = "(COALESCE(hits, 0) + COALESCE(likes, 0)*2) DESC"
    elif sort_by == 'hits':
        # 조회수순: 유튜브는 hits DESC, 네이버는 likes DESC로 정렬
        order_by = """
        CASE 
            WHEN platform LIKE '%youtube%' THEN 1
            ELSE 2
        END,
        CASE 
            WHEN platform LIKE '%youtube%' THEN COALESCE(hits, 0)
            ELSE 0
        END DESC,
        CASE 
            WHEN platform NOT LIKE '%youtube%' THEN COALESCE(likes, 0)
            ELSE 0
        END DESC
        """
    elif sort_by == 'like':
        order_by = "likes DESC"
    elif sort_by == 'comment':
        order_by = "comments DESC"
    else:
        order_by = "post_time DESC"
    
    # 전체 개수 구하기
    count_query = f"SELECT COUNT(*) as total FROM recipes WHERE {' AND '.join(where_conditions)}"
    cursor.execute(count_query, params)
    total = cursor.fetchone()['total']
    
    # 필터링된 레시피 가져오기
    query = f"""
        SELECT * FROM recipes 
        WHERE {' AND '.join(where_conditions)}
        ORDER BY {order_by}
        LIMIT %s OFFSET %s
    """
    cursor.execute(query, params + [size, offset])
    recipes = cursor.fetchall()
    
    db.close()
    
    return jsonify({
        'recipes': recipes,
        'total': total,
        'page': page,
        'size': size,
        'filters': {
            'match_rate_min': match_rate_min,
            'match_rate_max': match_rate_max,
            'sort_by': sort_by,
            'platform': platform
        }
    })

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