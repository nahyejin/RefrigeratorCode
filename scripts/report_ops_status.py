"""이 컴퓨터가 아는 운영 상태를 DB 에 적어 둔다. 어드민이 그걸 읽어 보여준다.

왜 이런 모양인가:
    어드민 화면은 Railway 에서 도는 서버가 그린다. 그런데 정작 알고 싶은 것들은
    **이 컴퓨터에만 있다**:

      - 수기로 관리하는 CSV 를 언제 마지막으로 고쳤는지 → git 이력. 서버에는 git 이 없다
      - 크롤러·배치가 몇 시에 도는지, 마지막에 성공했는지 → 윈도우 작업 스케줄러
      - 배치 로그의 마지막 줄

    그래서 매일 배치가 돌 때 이 스크립트가 상태를 모아 `ops_status` 표에 적고,
    서버는 그 표를 읽기만 한다. 커밋/푸시가 필요 없으니 항상 최신이다.

    적힌 시각(`generated_at`)을 화면에 함께 보여주므로, 이 스크립트가 며칠 안
    돌았으면 그것도 바로 보인다.

쓰는 법:
    python scripts/report_ops_status.py            # 미리보기
    python scripts/report_ops_status.py --write    # DB 에 기록
"""

import argparse
import csv
import io
import json
import os
import subprocess
from datetime import datetime, timezone, timedelta

import pymysql

KST = timezone(timedelta(hours=9))
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# 사람이 손으로 관리하는 자료들. "언제 마지막으로 손봤는지" 를 알아야 하는 것만 넣는다.
TRACKED = [
    {
        "path": "frontend/public/ingredient_profile_dict_with_substitutes.csv",
        "label": "재료 사전",
        "why": "레시피 매칭·사진 인식의 기준. 어드민 '사전' 탭에서 보태면 매일 04:30 여기로 옮겨진다",
    },
    {
        "path": "frontend/public/ingredient_substitute_table.csv",
        "label": "대체 재료 표",
        "why": "'대체 가능' 표시의 근거. 매일 04:30 사전에서 다시 만든다 (손댈 필요 없음)",
    },
    {
        "path": "frontend/public/Filter_Keywords.csv",
        "label": "필터 키워드",
        "why": "효능·영양분·대상·TPO 필터 목록",
    },
    {
        "path": "frontend/public/coupang_ads.csv",
        "label": "쿠팡 광고 링크",
        "why": "coupang_url 이 빈 행은 검색 링크로 넘어간다. 상위 재료부터 채우면 전환이 오른다",
    },
    {
        "path": "frontend/public/YouTube_Cooking_influencer.csv",
        "label": "유튜브 크롤링 대상 채널",
        "why": "여기 적힌 채널만 크롤링한다. 새 채널을 넣어야 레시피가 늘어난다",
    },
]

# 이 컴퓨터에서 도는 자동 작업들
TASKS = ["CookMatch-DailyLLMIngredients", "CookMatch-DictionarySync", "CookMatch-WeeklyCrawler"]


def git_last_commit(path):
    try:
        out = subprocess.run(
            ["git", "log", "-1", "--format=%cI\t%s", "--", path],
            cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=20,
        ).stdout.strip()
        if not out:
            return None, None
        when, _, subject = out.partition("\t")
        return when, subject
    except Exception:  # noqa: BLE001
        return None, None


def file_info(entry):
    full = os.path.join(ROOT, entry["path"].replace("/", os.sep))
    info = {**entry, "exists": os.path.exists(full)}
    if not info["exists"]:
        return info
    info["size"] = os.path.getsize(full)
    when, subject = git_last_commit(entry["path"])
    info["last_commit_at"] = when
    info["last_commit_subject"] = subject
    try:
        with io.open(full, encoding="utf-8-sig", newline="") as f:
            rows = list(csv.reader(f))
        info["rows"] = max(0, len(rows) - 1)
        # 쿠팡은 "링크가 실제로 채워진 비율" 이 중요하다. 행 수만으로는 알 수 없다.
        if entry["path"].endswith("coupang_ads.csv") and rows:
            header = rows[0]
            if "coupang_url" in header:
                idx = header.index("coupang_url")
                filled = sum(1 for r in rows[1:] if len(r) > idx and r[idx].strip())
                info["filled"] = filled
    except Exception as e:  # noqa: BLE001
        info["error"] = f"{type(e).__name__}"
    return info


def dictionary_health():
    """사전이 **대체재를 만들 수 있는 상태인가.**

    유사도는 `Feature` 로 계산한다. 어드민에서 새로 만든 대표어는 분류와 상위어만
    들어오고 Feature 는 비어 있어서, 그 재료는 분류가 비슷하다는 이유로만 묶인다
    (맛·식감이 아니라). 몇 개나 그런 상태인지 어드민에서 보여야 채워 넣을 수 있다.
    """
    path = os.path.join(ROOT, "frontend", "public",
                        "ingredient_profile_dict_with_substitutes.csv")
    if not os.path.exists(path):
        return None
    try:
        import csv as _csv
        with io.open(path, encoding="utf-8-sig", newline="") as f:
            rows = list(_csv.DictReader(f))
    except Exception:  # noqa: BLE001
        return None

    mats = [r for r in rows if (r.get("대분류") or "").strip() == "재료"]
    by = {(r.get("keyword") or "").strip(): r for r in rows}
    no_feature = []
    for r in mats:
        if (r.get("Feature") or "").strip():
            continue
        # 상위어에서 물려받을 수 있으면 괜찮다 (generate_substitutes 가 그렇게 한다)
        parent = by.get((r.get("hyperonym") or "").strip())
        if parent and (parent.get("Feature") or "").strip():
            continue
        no_feature.append((r.get("keyword") or "").strip())

    return {
        "ingredients": len(mats),
        "synonyms": sum(
            len([x for x in (r.get("synonyms") or "").split(",") if x.strip()])
            for r in mats
        ),
        "no_feature": no_feature,
    }


def recipe_pipeline():
    """레시피가 **앱에 나오기까지 어디쯤 와 있나.**

    2026-09-06 부터 재료가 다 채워지기 전(`llm_ingredients_at` 이 빈 행)에는
    앱에 안 띄운다. 그러면 어드민에서 "지금 몇 건이 기다리는가" 가 보여야
    한다 — 배치가 며칠 안 돌면 이 숫자가 늘어나는 것으로 먼저 드러난다.
    """
    try:
        conn = _connect()
    except Exception:  # noqa: BLE001
        return None
    try:
        cur = conn.cursor()
        cur.execute("SHOW COLUMNS FROM recipes LIKE 'llm_ingredients_at'")
        if not cur.fetchone():
            return None

        def one(sql):
            cur.execute(sql)
            row = cur.fetchone()
            return list(row.values())[0] if isinstance(row, dict) else row[0]

        return {
            "total": one("SELECT COUNT(*) FROM recipes"),
            "ready": one("SELECT COUNT(*) FROM recipes WHERE llm_ingredients_at IS NOT NULL"),
            "waiting": one("SELECT COUNT(*) FROM recipes WHERE llm_ingredients_at IS NULL"),
            # 재판정 예약분까지 포함한 "AI 가 아직 볼 것" — 하루 5,280건씩 준다.
            "llm_pending": one("SELECT COUNT(*) FROM recipes WHERE llm_ingredients_done = 0"),
            "with_steps": one("SELECT COUNT(*) FROM recipes "
                              "WHERE cook_steps IS NOT NULL AND cook_steps <> ''"),
        }
    except Exception:  # noqa: BLE001
        return None
    finally:
        try:
            conn.close()
        except Exception:  # noqa: BLE001
            pass


def scheduled_tasks():
    """윈도우 작업 스케줄러에서 우리 작업들의 상태를 읽는다.

    이 읽기는 **실패할 수 있다.** 새벽에 LLM 배치가 돌고 있는 동안 사전 배치가
    같이 이 스크립트를 부르면 PowerShell 이 60초 안에 안 끝나기도 한다. 그때
    빈 목록이나 오류 한 줄을 돌려주면, 부르는 쪽이 그것을 **멀쩡한 상태 위에
    덮어써서** 어드민에서 자동 작업 세 개가 통째로 사라진다. 그래서 여기서는
    실패를 실패라고 알리고(빈 목록/오류), 덮어쓸지 말지는 `collect()` 가 정한다.
    """
    script = (
        "Get-ScheduledTask | Where-Object { $_.TaskName -like 'CookMatch-*' } | "
        "ForEach-Object { $i = $_ | Get-ScheduledTaskInfo; "
        "[pscustomobject]@{ name=$_.TaskName; state=[string]$_.State; "
        "last_run=[string]$i.LastRunTime; last_result=$i.LastTaskResult; "
        "next_run=[string]$i.NextRunTime } } | ConvertTo-Json -Compress"
    )
    try:
        out = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True, text=True, encoding="utf-8", timeout=150,
        ).stdout.strip()
        if not out:
            return []
        data = json.loads(out)
        return data if isinstance(data, list) else [data]
    except Exception as e:  # noqa: BLE001
        return [{"error": f"{type(e).__name__}"}]


def log_tail(name, lines=3):
    path = os.path.join(ROOT, name)
    if not os.path.exists(path):
        return None
    try:
        with io.open(path, encoding="utf-8", errors="replace") as f:
            content = f.readlines()
        tail = [ln.rstrip() for ln in content[-40:] if ln.strip()]
        return {
            "file": name,
            "modified_at": datetime.fromtimestamp(os.path.getmtime(path), KST).isoformat(),
            "tail": tail[-lines:],
        }
    except Exception:  # noqa: BLE001
        return None


def previous_tasks():
    """지난번에 적어 둔 작업 상태. 이번 읽기가 실패했을 때 쓴다."""
    try:
        conn = _connect()
    except Exception:  # noqa: BLE001
        return []
    try:
        cursor = conn.cursor()
        cursor.execute("SHOW TABLES LIKE 'ops_status'")
        if not cursor.fetchone():
            return []
        cursor.execute("SELECT payload FROM ops_status WHERE name = 'local'")
        row = cursor.fetchone()
        if not row:
            return []
        data = json.loads(row[0] if isinstance(row, (list, tuple)) else row["payload"])
        tasks = data.get("tasks") or []
        return [t for t in tasks if t.get("name")]
    except Exception:  # noqa: BLE001
        return []
    finally:
        conn.close()


def collect():
    # 읽기가 실패하면 **지난번 것을 그대로 둔다.** 오류 한 줄로 덮어쓰면
    # 어드민에서 자동 작업이 통째로 사라진 것처럼 보인다 — 작업은 멀쩡한데.
    tasks = [t for t in scheduled_tasks() if t.get("name")]
    if not tasks:
        tasks = previous_tasks()
        for t in tasks:
            t["stale"] = True   # 이번엔 못 읽었다. 화면에서 그렇게 말해야 한다.
    return {
        "generated_at": datetime.now(KST).isoformat(),
        "files": [file_info(e) for e in TRACKED],
        "dictionary": dictionary_health(),
        "recipes": recipe_pipeline(),
        "tasks": tasks,
        "logs": [x for x in (log_tail("llm_ingredients.log"),
                             log_tail("scheduled_run.log"),
                             log_tail("dictionary_sync.log")) if x],
    }


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


def _connect():
    return pymysql.connect(
        host=os.getenv("DB_HOST") or "caboose.proxy.rlwy.net",
        user=os.getenv("DB_USER") or "root",
        password=os.getenv("DB_PASSWORD") or "",
        database=os.getenv("DB_NAME") or "railway",
        port=int(os.getenv("DB_PORT") or 47779),
        charset='utf8mb4',
        # 서버 시계가 UTC 라 세션 타임존을 KST 로 고정한다(backend/app.py 와 동일).
        # 빠뜨리면 이 스크립트가 쓰는 NOW() 만 9시간 느리게 찍힌다.
        init_command="SET time_zone = '+09:00'",
    )


def write(payload):
    conn = _connect()
    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS ops_status (
                name VARCHAR(40) PRIMARY KEY,
                payload MEDIUMTEXT NOT NULL,
                updated_at DATETIME NOT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            """
        )
        cursor.execute(
            "INSERT INTO ops_status (name, payload, updated_at) VALUES ('local', %s, NOW()) "
            "ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = NOW()",
            (json.dumps(payload, ensure_ascii=False),),
        )
        conn.commit()
    finally:
        conn.close()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="DB 에 기록한다")
    args = parser.parse_args()

    load_env()
    payload = collect()

    for f in payload["files"]:
        rows = f.get("rows")
        extra = f" (링크 채움 {f['filled']})" if "filled" in f else ""
        print(f"  {f['label']:<18} {str(rows):>6}행{extra:<16} 최근수정 {(f.get('last_commit_at') or '?')[:10]}")
    dh = payload.get("dictionary")
    if dh:
        print("")
        print(f"  재료 {dh['ingredients']}개 · 동의어 {dh['synonyms']}개"
              f" · Feature 없어 분류로만 묶이는 재료 {len(dh['no_feature'])}개"
              + (f" ({', '.join(dh['no_feature'][:6])})" if dh["no_feature"] else ""))

    rp = payload.get("recipes")
    if rp:
        print("")
        print(f"  레시피 {rp['total']}건 · 앱에 보이는 것 {rp['ready']}건"
              f" · 재료가 아직 안 채워져 숨는 것 {rp['waiting']}건")
        print(f"  AI 가 다시 볼 차례 {rp['llm_pending']}건 (하루 5,280건)"
              f" · 조리 순서 있는 것 {rp['with_steps']}건")

    print()
    for t in payload["tasks"]:
        mark = "  (이번엔 못 읽음 — 지난 값)" if t.get("stale") else ""
        print(f"  {t.get('name','?'):<32} {t.get('state','?'):<8} "
              f"마지막 {str(t.get('last_run'))[:16]} (결과 {t.get('last_result')}){mark}")

    if args.write:
        write(payload)
        print("\nDB 에 기록했습니다 (ops_status).")
    else:
        print("\n미리보기입니다. 기록하려면 --write 를 붙이세요.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
