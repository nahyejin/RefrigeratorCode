# -*- coding: utf-8 -*-
"""LLM 원본이 남아 있는 레시피에 `llm_ingredients_at` 표식을 채운다.

왜 따로 필요한가:
    `renormalize_used_ingredients.py --restore` 는 **값이 실제로 달라진 행만**
    UPDATE 한다(같으면 건너뛴다). 그래서 룰베이스 결과가 우연히 LLM 결과와
    같았던 행은 표식이 안 붙는다. 표식이 없으면
      - 룰베이스 배치가 그 행을 계속 다시 덮고
      - 앱이 그 행을 "아직 안 끝난 글" 로 보고 숨긴다
    둘 다 틀렸다 — LLM 은 그 행을 이미 봤다.

    그래서 미리보기 CSV 에 원본이 남아 있는 id 전부에 표식을 채운다.
    (값은 안 건드린다. 표식만.)

쓰는 법:
    python scripts/mark_llm_restored.py            # 미리보기
    python scripts/mark_llm_restored.py --write
"""

import argparse
import csv
import glob
import os

import pymysql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PREVIEW_GLOB = os.path.join(ROOT, "ingredient_management",
                            "llm_used_ingredients_preview_*.csv")


def load_env():
    for path in (os.path.join(ROOT, "backend", ".env"), os.path.join(ROOT, ".env")):
        if not os.path.exists(path):
            continue
        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, value = line.split("=", 1)
                    os.environ.setdefault(key.strip(), value.strip())


def db():
    return pymysql.connect(
        host=os.getenv("DB_HOST") or "caboose.proxy.rlwy.net",
        user=os.getenv("DB_USER") or "root",
        password=os.getenv("DB_PASSWORD") or "",
        db=os.getenv("DB_NAME") or "railway",
        port=int(os.getenv("DB_PORT") or 47779),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        connect_timeout=30,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    ids = set()
    for path in glob.glob(PREVIEW_GLOB):
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if (row.get("error") or "").strip():
                    continue
                if not (row.get("llm_raw_ingredients") or "").strip():
                    continue
                try:
                    ids.add(int(row["id"]))
                except (KeyError, TypeError, ValueError):
                    continue
    print("LLM 원본이 남아 있는 id: %d" % len(ids))

    load_env()
    conn = db()
    cur = conn.cursor()
    ids = sorted(ids)
    marked = 0
    CHUNK = 800
    for i in range(0, len(ids), CHUNK):
        chunk = ids[i:i + CHUNK]
        marks = ",".join(["%s"] * len(chunk))
        if not args.write:
            cur.execute(
                "SELECT COUNT(*) c FROM recipes "
                f"WHERE llm_ingredients_at IS NULL AND id IN ({marks})", chunk)
            marked += cur.fetchone()["c"]
            continue
        cur.execute(
            "UPDATE recipes SET llm_ingredients_at = NOW() "
            f"WHERE llm_ingredients_at IS NULL AND id IN ({marks})", chunk)
        marked += cur.rowcount
        conn.commit()

    print(("표식을 채울 행: %d (미리보기)" if not args.write else "표식을 채운 행: %d") % marked)
    cur.execute("SELECT COUNT(*) c FROM recipes WHERE llm_ingredients_at IS NULL")
    print("표식 없는(=앱에서 숨는) 행: %d" % cur.fetchone()["c"])
    conn.close()


if __name__ == "__main__":
    main()
