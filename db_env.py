"""
**DB 접속 정보는 코드에 적지 않는다.**

이 저장소는 공개다. 그런데 크롤러·점검 스크립트 열두 곳에 운영 DB 의 주소와
비밀번호가 그대로 적혀 있었다. 누구나 그 값으로 운영 DB 에 붙을 수 있었다는
뜻이다. 값은 전부 `backend/.env`(추적하지 않는 파일)에서 읽어 온다.

쓰는 법:

    from db_env import connect
    conn = connect()          # 세션 타임존까지 KST 로 맞춰 준다

`backend/app.py` 의 `get_db()` 와 같은 환경변수 이름을 본다. Railway 가 넣어
주는 `MYSQL*` 이름도 함께 받아 준다 — 그 위에서 그대로 돌 수 있어야 한다.
"""

import os
from pathlib import Path

import pymysql
import pymysql.cursors

_ROOT = Path(__file__).resolve().parent


def _load_env() -> None:
    """`backend/.env` 를 읽는다. 이미 들어와 있는 환경변수는 덮지 않는다."""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    for name in ('backend/.env', '.env'):
        p = _ROOT / name
        if p.exists():
            load_dotenv(p, override=False)


def db_settings() -> dict:
    _load_env()
    password = (os.getenv('DB_PASSWORD') or os.getenv('MYSQLPASSWORD')
                or os.getenv('MYSQL_PASSWORD'))
    if not password:
        raise RuntimeError(
            'DB 비밀번호가 없습니다. `backend/.env` 에 DB_PASSWORD 를 넣어 주세요. '
            '(예전에는 코드에 박혀 있었지만, 공개 저장소라 걷어냈습니다)'
        )
    return dict(
        host=(os.getenv('DB_HOST') or os.getenv('MYSQLHOST')
              or os.getenv('MYSQL_HOST') or 'localhost'),
        user=(os.getenv('DB_USER') or os.getenv('MYSQLUSER')
              or os.getenv('MYSQL_USER') or 'root'),
        password=password,
        db=(os.getenv('DB_NAME') or os.getenv('MYSQLDATABASE')
            or os.getenv('MYSQL_DATABASE') or 'railway'),
        port=int(os.getenv('DB_PORT') or os.getenv('MYSQLPORT')
                 or os.getenv('MYSQL_PORT') or 3306),
    )


def connect(**overrides):
    """
    운영 DB 에 붙는다.

    서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(`backend/app.py` 와 동일).
    이걸 빠뜨리면 이 연결로 쓴 `NOW()` 만 9시간 느리게 찍혀서, 앱이 쓴 시각과
    나란히 놓았을 때 앞뒤가 뒤집힌다.
    """
    settings = db_settings()
    settings.update(overrides)
    return pymysql.connect(
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor,
        init_command="SET time_zone = '+09:00'",
        **settings,
    )
