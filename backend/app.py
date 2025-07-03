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
cors_origins = os.getenv('CORS_ORIGINS', 'http://localhost:5173,http://localhost:5177').split(',')
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
    period = int(request.args.get('period', 30))  # 최근 30일
    db = get_db()
    cursor = db.cursor()
    # 유튜브 인기 레시피
    cursor.execute(
        """
        SELECT * FROM recipes
        WHERE post_time >= DATE_SUB(NOW(), INTERVAL %s DAY)
        AND platform LIKE %s
        ORDER BY (COALESCE(hits, 0) + COALESCE(likes, 0)*2) DESC
        LIMIT %s
        """, (period, '%youtube%', size)
    )
    youtube_recipes = cursor.fetchall()
    # 네이버 인기 레시피
    cursor.execute(
        """
        SELECT * FROM recipes
        WHERE post_time >= DATE_SUB(NOW(), INTERVAL %s DAY)
        AND platform LIKE %s
        ORDER BY (COALESCE(hits, 0) + COALESCE(likes, 0)*2) DESC
        LIMIT %s
        """, (period, '%naver%', size)
    )
    naver_recipes = cursor.fetchall()
    db.close()
    return jsonify({'youtube': youtube_recipes, 'naver': naver_recipes, 'size': size, 'period': period})

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
        order_by = "post_time DESC"  # DB에는 match_rate가 없으므로 최신순으로 대체
    elif sort_by == 'date':
        order_by = "post_time DESC"
    elif sort_by == 'popularity':
        order_by = "(COALESCE(hits, 0) + COALESCE(likes, 0)*2) DESC"
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