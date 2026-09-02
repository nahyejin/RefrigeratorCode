"""뽑아낸 조리 순서가 **원문의 수치를 얼마나 지켰는지** 센다.

왜 필요한가:
    조리 순서를 LLM 이 요약해 다시 쓴다. 문장이 짧아지는 건 좋은데, 그 과정에서
    `고추장 1과 1/2큰술` 이 `고추장` 이 되고 `두께 0.3cm 로 채 썬다` 가
    `채 썬다` 가 되면 **그걸 보고 요리를 할 수 없다.**

    한두 건을 눈으로 보고는 판단이 안 된다. 원문에서 수치 표현을 전부 긁어
    단계·재료상세에 살아남았는지 세면, 어떤 종류가 잘 날아가는지가 보인다.

쓰는 법:
    python scripts/check_cook_steps_quality.py            # 30건
    python scripts/check_cook_steps_quality.py --limit 60
    python scripts/check_cook_steps_quality.py --ids 1285,1288
"""

import argparse
import io
import os
import re
from collections import Counter

import pymysql

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 수치 표현을 종류별로 나눠 센다. 무엇이 날아가는지 알아야 프롬프트를 고칠 수 있다.
UNIT_GROUPS = {
    "분량(무게·부피)": r"(?:g|kg|ml|mL|L|리터|cc)",
    "분량(계량도구)": r"(?:큰술|작은술|티스푼|스푼|컵|종이컵|숟가락|국자|꼬집|줌)",
    "개수": r"(?:개|알|톨|쪽|장|대|줄기|포기|마리|봉지|팩|인분|조각|모)",
    "시간": r"(?:시간|분|초)",
    "온도": r"(?:도|℃)",
    "길이·두께": r"(?:cm|mm|센치|센티)",
}
# 숫자 앞자리: 3, 1/2, 1.5, 1과 1/2, 한/두/세…
NUM = r"(?:\d+(?:\.\d+)?(?:\s*과\s*\d+/\d+)?|\d+/\d+|한|두|세|네|다섯)"

# 숫자가 없어도 결과를 좌우하는 말
HEAT_WORDS = ["센불", "강불", "중불", "중약불", "약불", "약한 불", "센 불", "중간 불"]


def tokens_of(text):
    """수치 표현을 (종류, 정규화된 값) 집합으로 뽑는다."""
    text = text or ""
    found = set()
    for group, unit in UNIT_GROUPS.items():
        for m in re.finditer(NUM + r"\s*" + unit, text):
            value = re.sub(r"\s+", "", m.group(0))
            found.add((group, value))
    for word in HEAT_WORDS:
        if word.replace(" ", "") in text.replace(" ", ""):
            found.add(("불세기", word.replace(" ", "")))
    return found


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
        init_command="SET time_zone = '+09:00'",
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=30)
    parser.add_argument("--ids", help="콤마로 구분된 recipe id")
    parser.add_argument("--out", default="cook_steps_quality.txt")
    args = parser.parse_args()

    load_env()
    conn = db()
    try:
        cursor = conn.cursor()
        has_detail = True
        cursor.execute("SHOW COLUMNS FROM recipes LIKE 'ingredients_detail'")
        if not cursor.fetchone():
            has_detail = False
        detail_col = "ingredients_detail" if has_detail else "NULL AS ingredients_detail"
        if args.ids:
            ids = tuple(int(x) for x in args.ids.split(",") if x.strip())
            marks = ",".join(["%s"] * len(ids))
            cursor.execute(
                f"SELECT id, title, content, cook_steps, {detail_col} FROM recipes "
                f"WHERE id IN ({marks})", ids)
        else:
            cursor.execute(
                f"SELECT id, title, content, cook_steps, {detail_col} FROM recipes "
                f"WHERE cook_steps IS NOT NULL AND content IS NOT NULL "
                f"ORDER BY id LIMIT %s", (args.limit,))
        rows = cursor.fetchall()
    finally:
        conn.close()

    if not rows:
        print("조리 순서가 채워진 레시피가 없습니다.")
        return 1

    kept = Counter()
    lost = Counter()
    lost_examples = {}
    per_recipe = []

    for r in rows:
        src = tokens_of(r["content"])
        got = tokens_of((r["cook_steps"] or "") + "\n" + (r["ingredients_detail"] or ""))
        if not src:
            continue
        missing = src - got
        for group, value in src:
            if (group, value) in got:
                kept[group] += 1
            else:
                lost[group] += 1
                lost_examples.setdefault(group, []).append(value)
        per_recipe.append((r["id"], r["title"], len(src), len(src) - len(missing), missing))

    out = io.open(args.out, "w", encoding="utf-8")
    out.write(f"레시피 {len(per_recipe)}건 대조\n")
    out.write("=" * 62 + "\n\n")
    out.write("종류별 — 원문의 수치 표현이 조리 순서에 살아남은 비율\n\n")
    out.write(f"  {'종류':<16} {'남음':>6} {'날아감':>7} {'보존율':>7}\n")
    total_k = total_l = 0
    for group in list(UNIT_GROUPS) + ["불세기"]:
        k, l = kept[group], lost[group]
        total_k += k
        total_l += l
        if k + l == 0:
            continue
        out.write(f"  {group:<16} {k:>6} {l:>7} {k / (k + l) * 100:>6.0f}%\n")
    if total_k + total_l:
        out.write(f"  {'합계':<16} {total_k:>6} {total_l:>7} "
                  f"{total_k / (total_k + total_l) * 100:>6.0f}%\n")

    out.write("\n\n날아간 값의 예시 (종류별 최대 12개)\n\n")
    for group, values in lost_examples.items():
        out.write(f"  [{group}] " + ", ".join(values[:12]) + "\n")

    out.write("\n\n보존율이 낮은 레시피 10건\n\n")
    per_recipe.sort(key=lambda x: (x[3] / x[2]) if x[2] else 1)
    for rid, title, n_src, n_kept, missing in per_recipe[:10]:
        out.write(f"  [{rid}] {(title or '')[:40]}  {n_kept}/{n_src}\n")
        out.write("        놓친 것: " + ", ".join(v for _, v in list(missing)[:10]) + "\n")
    out.close()

    print(io.open(args.out, encoding="utf-8").read())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
