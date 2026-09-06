"""어드민에서 승인한 사전 추가분을 **저장소 CSV 로 접어 넣는다.**

왜 따로 필요한가:
    서버가 도는 Railway 는 파일시스템이 임시라, 거기서 CSV 에 써도 다음 배포에
    사라지고 저장소에도 안 남는다. 그래서 승인분은 `ingredient_dictionary_additions`
    표에 쌓고 사전을 읽을 때 합쳐 쓴다(`backend/dictionary_curation.py`).

    다만 DB 에만 있으면 **저장소 CSV 가 진짜가 아니게 된다.** 배치 스크립트도,
    브라우저도 CSV 를 직접 읽으므로 언젠가는 CSV 로 옮겨야 한다. 그 일을 이 스크립트가
    한다 — 사람이 눈으로 보고 커밋하는 절차를 남겨 두려고 자동화하지 않았다.

쓰는 법:
    python scripts/apply_dictionary_additions.py            # 미리보기
    python scripts/apply_dictionary_additions.py --write    # CSV 수정
    python scripts/sync_ingredient_dict.py --write          # 백엔드 사본까지 맞추기
"""

import argparse
import csv
import io
import os

import pymysql

from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSV_PATH = os.path.join(ROOT, "frontend", "public", "ingredient_profile_dict_with_substitutes.csv")


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
        # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
        # 이걸 빠뜨리면 이 스크립트가 쓰는 NOW() 만 9시간 느리게 찍혀서, 앱이 쓴
        # 시각과 나란히 놓았을 때 앞뒤가 뒤집힌다 — 실제로 사전 반영 시각이 승인
        # 시각보다 먼저인 것처럼 보였다.
        init_command="SET time_zone = '+09:00'",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="CSV 를 실제로 고친다")
    args = parser.parse_args()

    load_env()
    conn = db()
    try:
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES LIKE 'ingredient_dictionary_additions'")
        if not cursor.fetchone():
            print("아직 승인된 추가분이 없습니다.")
            return 0
        cursor.execute(
            "SELECT * FROM ingredient_dictionary_additions WHERE applied_to_csv = 0 ORDER BY created_at"
        )
        additions = cursor.fetchall()
    finally:
        conn.close()

    if not additions:
        print("CSV 에 아직 안 넣은 추가분이 없습니다.")
        return 0

    with io.open(CSV_PATH, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        rows = list(reader)

    # `추가일자` 열이 없으면 만든다.
    #
    # 왜 CSV 에도 남기나: DB 만 보면 "이 재료가 언제 들어왔는지" 를 알려고 매번
    # DB 를 열어야 한다. 사전 파일 자체를 열었을 때도 보이는 편이 낫다 —
    # 사전은 사람이 직접 열어 보는 파일이다.
    # (프론트·배치 모두 열 **이름**으로 읽으므로 열을 더해도 안전하다)
    if "추가일자" not in fieldnames:
        fieldnames = list(fieldnames) + ["추가일자"]
        for row in rows:
            row.setdefault("추가일자", "")

    # 재료별 보관 일수 세 칸. 화면(`shelfLife.ts`)이 분류 표보다 먼저 본다.
    for col in ("보관냉동", "보관냉장", "보관실온"):
        if col not in fieldnames:
            fieldnames = list(fieldnames) + [col]
        for row in rows:
            row.setdefault(col, "")

    today = datetime.now().strftime("%Y-%m-%d")
    by_keyword = {r["keyword"].strip(): r for r in rows if r.get("keyword")}
    added, extended, skipped = [], [], []

    for item in additions:
        raw = item["raw_name"].strip()
        keyword = item["keyword"].strip()

        if item["kind"] == "synonym":
            target = by_keyword.get(keyword)
            if not target:
                skipped.append((raw, f"대표어 '{keyword}' 가 CSV 에 없음"))
                continue
            current = [s.strip() for s in (target.get("synonyms") or "").split(",") if s.strip()]
            if raw in current or raw == keyword:
                skipped.append((raw, "이미 들어 있음"))
                continue
            current.append(raw)
            target["synonyms"] = ", ".join(current)
            # 기존 행에 동의어만 보탠 경우에도 손댄 날짜를 남긴다
            target["추가일자"] = today
            extended.append((raw, keyword))
        else:  # 새 대표어
            if keyword in by_keyword:
                skipped.append((raw, f"'{keyword}' 는 이미 CSV 에 있음"))
                continue
            row = {name: "" for name in fieldnames}
            row["keyword"] = keyword
            row["대분류"] = "재료"
            for col in ("중분류", "소분류", "세분류", "세세분류"):
                row[col] = (item.get(col) or "").strip()
            row["hyperonym"] = (item.get("hyperonym") or "").strip()
            # 승인할 때 LLM 이 같이 정해 둔 보관 일수. 비어 있으면 화면이
            # 지금까지처럼 분류 표로 내려간다.
            for col in ("보관냉동", "보관냉장", "보관실온"):
                row[col] = str(item.get(col) or "").strip()
            row["추가일자"] = today
            if raw != keyword:
                row["synonyms"] = raw
            rows.append(row)
            by_keyword[keyword] = row
            added.append((raw, keyword))

    print(f"새 대표어 {len(added)} · 동의어 추가 {len(extended)} · 건너뜀 {len(skipped)}")
    for raw, keyword in added:
        print(f"  + 새 재료  {keyword}" + (f"  (동의어: {raw})" if raw != keyword else ""))
    for raw, keyword in extended:
        print(f"  + 동의어   {keyword} ← {raw}")
    for raw, why in skipped:
        print(f"  - 건너뜀   {raw}: {why}")

    if not args.write:
        print("\n미리보기입니다. 실제로 고치려면 --write 를 붙이세요.")
        return 0

    with io.open(CSV_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nCSV 를 고쳤습니다: {CSV_PATH}")

    # 성공한 것만 반영 표시하고, 못 넣은 것은 **이유를 남긴다.**
    # 그래야 관리자가 "왜 아직 대기지" 를 화면에서 알 수 있고, 원인을 고친 뒤
    # 다음 실행에 다시 시도된다(applied_to_csv 가 0 이면 계속 대상이다).
    conn = db()
    try:
        cursor = conn.cursor()
        # **"이미 들어 있음" 은 실패가 아니라 완료다.**
        #
        # 예전에는 이것도 `applied_to_csv = 0` 으로 남겨 매일 다시 시도했다.
        # 사전에 그 이름이 이미 있는데 다시 넣을 수는 없으니 영원히 안 끝나고,
        # 화면에는 "아직 반영 안 됨" 으로 49건이 쌓여 진짜 대기와 섞였다.
        already = [raw for raw, why in skipped if "이미" in why]
        skipped = [(raw, why) for raw, why in skipped if "이미" not in why]
        done = [raw for raw, _ in added] + [raw for raw, _ in extended] + already
        if done:
            placeholders = ",".join(["%s"] * len(done))
            cursor.execute(
                f"UPDATE ingredient_dictionary_additions "
                f"SET applied_to_csv = 1, applied_at = NOW(), apply_error = NULL "
                f"WHERE raw_name IN ({placeholders})",
                tuple(done),
            )
        for raw, why in skipped:
            cursor.execute(
                "UPDATE ingredient_dictionary_additions SET apply_error = %s "
                "WHERE raw_name = %s",
                (why[:255], raw),
            )
        conn.commit()
    finally:
        conn.close()

    print("이어서 `python scripts/sync_ingredient_dict.py --write` 로 백엔드 사본도 맞춰 주세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
