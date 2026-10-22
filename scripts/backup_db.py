"""운영 DB(Railway MySQL) 전체를 이 PC 에 .sql 파일로 백업한다. **읽기 전용** — 서비스에 영향이 없다.

    python scripts\\backup_db.py            # 기본 위치(프로젝트 밖)에 오늘 날짜 폴더로 저장, 오래된 것 정리
    python scripts\\backup_db.py --keep 14  # 최근 14개만 남긴다(기본 7)
    python scripts\\backup_db.py --out D:\\Backups   # 저장 위치를 바꾼다

왜 필요한가(2026-10-22 사용자 요청): 서버·DB 를 한 업체(Railway)에 두고 있어, 그쪽이 장애가 나면 데이터를 꺼낼 길이 없다.
이 PC 에 날짜별 복사본을 두어 두면 최악의 경우에도 복구할 수 있다.

- mysqldump 가 없어도 돈다(pymysql 로 같은 일을 한다). 접속 정보는 `backend/.env` 에서만 읽는다(`db_env`).
- 한 번의 일관된 스냅샷(START TRANSACTION WITH CONSISTENT SNAPSHOT) 안에서 모든 테이블을 읽는다.
- 테이블마다 파일 하나(<테이블>.sql: CREATE TABLE + 500행씩 INSERT). 사용자 데이터가 먼저, 레시피 계열이 마지막.
- 끝나면 manifest.json 에 테이블별 (스냅샷 때 행 수, 쓴 행 수, 일치 여부)를 남긴다. 하나라도 어긋나면 종료 코드 1.
- 저장 위치는 **프로젝트(공개 저장소) 밖**이다. 백업에는 회원 이메일 같은 개인정보가 들어 있다 — 클라우드 동기화 폴더(OneDrive 등)나
  GitHub 에 올리지 말 것.
- 복원: 해당 날짜 폴더의 .sql 을 MySQL 에 불러오면 된다(테이블 생성문 포함, DROP TABLE IF EXISTS 로 시작하니 빈 DB 나 복구용 DB 에 쓸 것).
"""
import argparse
import json
import os
import shutil
import sys
import time
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)

import pymysql  # noqa: E402
from db_env import db_settings  # noqa: E402

DEFAULT_OUT = os.path.join(os.path.expanduser("~"), "CookMatchBackups")
BIG_TABLES = {"recipes", "recipe_ingredient"}


def dump(out_dir):
    st = db_settings()
    dbname = st.get("db") or st.get("database")
    conn = pymysql.connect(**{**st, "charset": "utf8mb4", "cursorclass": pymysql.cursors.SSCursor,
                              "read_timeout": 900, "write_timeout": 900})
    meta = pymysql.connect(**{**st, "charset": "utf8mb4", "cursorclass": pymysql.cursors.DictCursor})
    try:
        mc = meta.cursor()
        mc.execute(
            "SELECT table_name t, (data_length+index_length) b FROM information_schema.tables "
            "WHERE table_schema=%s AND table_type='BASE TABLE'", (dbname,))
        tables = sorted(mc.fetchall(), key=lambda x: (x["t"] in BIG_TABLES, int(x["b"] or 0)))

        cur = conn.cursor()
        cur.execute("SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ")
        cur.execute("START TRANSACTION WITH CONSISTENT SNAPSHOT")
        started = datetime.now().isoformat()
        manifest = {"started": started, "database": dbname, "tables": {}}

        for t in tables:
            name = t["t"]
            t0 = time.time()
            cur.execute(f"SELECT COUNT(*) FROM `{name}`")
            total = cur.fetchone()[0]
            cur.execute(f"SHOW CREATE TABLE `{name}`")
            create = cur.fetchone()[1]
            cur.execute(f"SELECT * FROM `{name}`")
            cols = [d[0] for d in cur.description]
            col_sql = ", ".join(f"`{c}`" for c in cols)
            written = 0
            path = os.path.join(out_dir, f"{name}.sql")
            with open(path, "w", encoding="utf-8", newline="\n") as f:
                f.write(f"-- table {name} · snapshot {started}\nSET NAMES utf8mb4;\n"
                        f"DROP TABLE IF EXISTS `{name}`;\n{create};\n\n")
                while True:
                    rows = cur.fetchmany(500)
                    if not rows:
                        break
                    vals = ",\n".join(
                        "(" + ", ".join(
                            "0x" + bytes(v).hex() if isinstance(v, (bytes, bytearray)) else conn.escape(v)
                            for v in r) + ")"
                        for r in rows)
                    f.write(f"INSERT INTO `{name}` ({col_sql}) VALUES\n{vals};\n")
                    written += len(rows)
            manifest["tables"][name] = {
                "rows_in_db_at_snapshot": total, "rows_written": written, "ok": total == written,
                "bytes": os.path.getsize(path), "seconds": round(time.time() - t0, 1)}
            print(f"{name}: {written}/{total} rows, {os.path.getsize(path)/1024/1024:.1f} MB", flush=True)

        cur.execute("ROLLBACK")
        manifest["finished"] = datetime.now().isoformat()
        manifest["all_ok"] = all(v["ok"] for v in manifest["tables"].values())
        with open(os.path.join(out_dir, "manifest.json"), "w", encoding="utf-8") as f:
            json.dump(manifest, f, ensure_ascii=False, indent=2)
        return manifest
    finally:
        conn.close()
        meta.close()


def prune(base, keep):
    """db_YYYYMMDD(_HHMM) 폴더 중 최근 keep 개만 남긴다. 이 스크립트가 만든 이름만 지운다."""
    dirs = sorted(d for d in os.listdir(base)
                  if d.startswith("db_") and os.path.isdir(os.path.join(base, d))
                  and os.path.exists(os.path.join(base, d, "manifest.json")))
    for old in dirs[:-keep] if keep > 0 else []:
        shutil.rmtree(os.path.join(base, old), ignore_errors=True)
        print(f"오래된 백업 삭제: {old}", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=DEFAULT_OUT, help="백업을 둘 폴더(프로젝트 밖)")
    ap.add_argument("--keep", type=int, default=7, help="남길 백업 개수(기본 7)")
    a = ap.parse_args()

    base = os.path.abspath(a.out)
    if os.path.commonpath([base, ROOT]) == ROOT:
        raise SystemExit("백업 폴더가 프로젝트 안입니다. 개인정보가 GitHub 에 올라갈 수 있으니 프로젝트 밖을 쓰세요.")
    os.makedirs(base, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d")
    out_dir = os.path.join(base, f"db_{stamp}")
    if os.path.exists(os.path.join(out_dir, "manifest.json")):
        out_dir = os.path.join(base, f"db_{stamp}_{datetime.now().strftime('%H%M')}")   # 같은 날 두 번째
    os.makedirs(out_dir, exist_ok=True)

    m = dump(out_dir)
    print(f"완료: {out_dir} · all_ok={m['all_ok']}", flush=True)
    if not m["all_ok"]:
        print("행 수가 어긋난 테이블이 있습니다 — manifest.json 확인", flush=True)
        sys.exit(1)
    prune(base, a.keep)


if __name__ == "__main__":
    main()
