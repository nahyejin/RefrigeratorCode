import sqlite3

def check_database():
    conn = sqlite3.connect('recipes.db')
    cursor = conn.cursor()
    
    # 테이블 목록 확인
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print("Tables in database:", tables)
    
    # recipes 테이블의 스키마 확인
    cursor.execute("PRAGMA table_info(recipes);")
    columns = cursor.fetchall()
    print("\nRecipes table schema:")
    for col in columns:
        print(col)
    
    # 저장된 레시피 수 확인
    cursor.execute("SELECT COUNT(*) FROM recipes;")
    count = cursor.fetchone()[0]
    print(f"\nNumber of recipes in database: {count}")
    
    # 저장된 레시피 샘플 확인
    cursor.execute("SELECT title, link, author, platform FROM recipes LIMIT 5;")
    recipes = cursor.fetchall()
    print("\nSample recipes:")
    for recipe in recipes:
        print(recipe)
    
    conn.close()

if __name__ == "__main__":
    check_database() 