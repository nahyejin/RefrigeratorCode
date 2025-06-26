from flask import Flask, jsonify
from flask_cors import CORS
import pymysql
import os
from dotenv import load_dotenv

# 환경변수 로드
load_dotenv('env.development' if os.getenv('FLASK_ENV') == 'development' else 'env.production')

app = Flask(__name__)

# CORS 설정 - 환경변수에서 허용할 origin 가져오기
cors_origins = os.getenv('CORS_ORIGIN', 'http://localhost:5173,http://localhost:5177').split(',')
CORS(app, origins=cors_origins)

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
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM recipes ORDER BY id DESC")
    recipes = cursor.fetchall()
    db.close()
    return jsonify(recipes)

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