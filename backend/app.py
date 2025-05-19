from flask import Flask, jsonify
from flask_cors import CORS
import pymysql

app = Flask(__name__)
CORS(app)  # CORS 허용

def get_db():
    return pymysql.connect(
        host='localhost',
        user='root',
        password='sk784512!!',
        db='refrigerator',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

@app.route('/api/recipes')
def get_recipes():
    db = get_db()
    cursor = db.cursor()
    cursor.execute("SELECT * FROM recipes ORDER BY id DESC LIMIT 20")
    recipes = cursor.fetchall()
    db.close()
    return jsonify(recipes)

if __name__ == '__main__':
    app.run(port=5000, debug=True)