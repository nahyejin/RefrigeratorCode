"""Railway MySQL 'root' 비밀번호를 새로 바꾼다.

보안 정책상 이 비밀번호 변경은 자동화 도구(Claude)가 직접 실행할 수 없어서,
사용자가 직접 터미널에서 이 스크립트를 실행해야 한다.

쓰는 법 (PowerShell에서):
    python scripts\\rotate_db_password.py

끝나면 backend/.env 의 DB_PASSWORD 도 이 스크립트가 자동으로 새 값으로 바꿔 둔다.
그 다음 Railway 대시보드 두 곳(MySQL 서비스 Variables의 MYSQLPASSWORD,
백엔드 서비스 Variables의 DB_PASSWORD)도 같은 값으로 직접 바꿔야 한다.
"""

import os
import re
import secrets
import string
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ENV_PATH = os.path.join(ROOT, "backend", ".env")


def load_env():
    if not os.path.exists(ENV_PATH):
        raise SystemExit(f"backend/.env 를 찾을 수 없습니다: {ENV_PATH}")
    with open(ENV_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, value = line.split("=", 1)
                os.environ.setdefault(key.strip(), value.strip())


def generate_password(length=28):
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


def update_env_file(new_password):
    with open(ENV_PATH, encoding="utf-8") as f:
        content = f.read()
    new_content, n = re.subn(
        r"^DB_PASSWORD=.*$", f"DB_PASSWORD={new_password}", content, count=1, flags=re.MULTILINE
    )
    if n == 0:
        raise SystemExit("backend/.env 에서 DB_PASSWORD 줄을 찾지 못했습니다. 수동으로 반영해 주세요.")
    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write(new_content)


def main():
    load_env()
    try:
        import pymysql
    except ImportError:
        raise SystemExit("pymysql 이 필요합니다: pip install pymysql")

    host = os.environ["DB_HOST"]
    user = os.environ["DB_USER"]
    password = os.environ["DB_PASSWORD"]
    db = os.environ["DB_NAME"]
    port = int(os.environ["DB_PORT"])

    print(f"연결 대상: {host}:{port}/{db} (user={user})")
    conn = pymysql.connect(host=host, user=user, password=password, db=db, port=port, charset="utf8mb4")
    new_password = generate_password()
    try:
        with conn.cursor() as cur:
            cur.execute("ALTER USER %s@'%%' IDENTIFIED BY %s", (user, new_password))
            cur.execute("FLUSH PRIVILEGES")
        conn.commit()
    finally:
        conn.close()

    update_env_file(new_password)

    print("\n비밀번호를 바꿨습니다.")
    print(f"새 비밀번호: {new_password}")
    print("\nbackend/.env 의 DB_PASSWORD 도 자동으로 갱신했습니다.")
    print("이제 Railway 대시보드에서 아래 두 곳도 같은 값으로 바꿔 주세요:")
    print("  1) MySQL 서비스 -> Variables -> MYSQLPASSWORD")
    print("  2) 백엔드(Flask) 서비스 -> Variables -> DB_PASSWORD")


if __name__ == "__main__":
    sys.exit(main())
