"""
사전 보강분을 이미 처리된 레시피에 소급 적용하는 스크립트 (LLM 호출 0회).

왜 LLM 없이 되나:
  llm_ingredient_extraction.py 는 매 실행마다 미리보기 CSV에 LLM 원본 출력
  (llm_raw_ingredients 열)을 남긴다. 사전 정규화는 이 원본을 입력으로 하는
  100% 결정론적 단계이므로, 사전을 고친 뒤 저장된 원본만 다시 정규화하면
  LLM 을 다시 부르지 않고도 결과를 갱신할 수 있다.

기본은 미리보기(CSV)만 만들고 DB 는 건드리지 않는다. 반영은 --commit 명시.

사용 예:
  # 무엇이 어떻게 바뀌는지만 확인
  python -u ingredient_management/renormalize_used_ingredients.py

  # 실제 DB 반영
  python -u ingredient_management/renormalize_used_ingredients.py --commit
"""

import argparse
import csv
import glob
import os
import sys
from datetime import datetime

import pymysql

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.append(_PROJECT_ROOT)

from ingredient_management.llm_ingredient_extraction import (
    _load_env_files,
    load_alias_to_canonical,
    normalize_llm_ingredients,
)
from ingredient_management.update_used_ingredients_batch import (
    _connect_db,
    _used_ingredient_token_set,
)

_PREVIEW_GLOB = os.path.join(_PROJECT_ROOT, "ingredient_management",
                             "llm_used_ingredients_preview_*.csv")


def load_raw_by_id():
    """미리보기 CSV 전체에서 id -> LLM 원본 재료 목록을 모은다 (나중 파일이 최신)."""
    raw_by_id = {}
    # 파일명으로 정렬하면 `..._5400_20260826` 이 `..._5280_20260906` 보다 뒤에 온다
    # (건수 토큰이 먼저라 문자열 비교가 날짜를 앞지른다). 그러면 **옛 원본이
    # 새 원본을 덮는다.** 만든 시각으로 정렬해서 나중 파일이 이기게 한다.
    for path in sorted(glob.glob(_PREVIEW_GLOB), key=os.path.getmtime):
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if (row.get("error") or "").strip():
                    continue
                raw = (row.get("llm_raw_ingredients") or "").strip()
                if not raw:
                    continue
                try:
                    rid = int(row["id"])
                except (KeyError, TypeError, ValueError):
                    continue
                raw_by_id[rid] = [x.strip() for x in raw.split(",") if x.strip()]
    return raw_by_id


def allowed_removals(old_dict_path):
    """사전 변경으로 '사라져도 되는' 대표어 집합을 계산한다.

    보강 전 사전과 지금 사전을 비교해, 매핑이 바뀐 별칭들의 옛 대표어를 모은다.
    예) 옛 사전에서 올리브유 -> 엑스트라버진 이었으므로 '엑스트라버진'이 여기 들어간다.
    이 집합 밖의 재료가 사라지는 행은 사전 보강으로 설명되지 않는 변화이므로
    건드리지 않고 넘긴다 (룰베이스 값이 남아 있던 행에서 재료를 잃는 사고 방지).
    """
    new_alias = load_alias_to_canonical()
    old_alias = load_alias_to_canonical(old_dict_path)

    allowed = set()
    for key, old_canonical in old_alias.items():
        if new_alias.get(key) != old_canonical:
            allowed.add(old_canonical)
    return allowed


def run(*, commit, output_path, old_dict_path=None, restore=False):
    _load_env_files()
    alias_to_canonical = load_alias_to_canonical()
    raw_by_id = load_raw_by_id()
    print(f"미리보기 CSV에서 원본 확보: {len(raw_by_id)}건", flush=True)

    allowed = allowed_removals(old_dict_path) if old_dict_path else None
    if allowed is not None:
        print(f"사전 변경으로 대체가 허용된 대표어: {len(allowed)}종", flush=True)

    conn = _connect_db(read_timeout_sec=120)
    cursor = conn.cursor()
    # `--restore` 는 **룰베이스에 덮인 행까지** 되돌린다.
    #
    #   평소(사전 보강 소급)에는 `llm_ingredients_done = 1` 인 행만 보면 된다.
    #   그런데 2026-09-05 사고 때는 그 조건을 못 쓴다 — 재예약으로 done 이 전부
    #   0 이 된 상태에서 룰베이스가 덮어썼기 때문에, 되돌려야 할 행이 바로
    #   done = 0 인 행들이다. 그래서 조건을 빼고 **미리보기 CSV 에 원본이 남아
    #   있는 행 전부**를 대상으로 한다 (원본이 없는 행은 아래에서 건너뛴다).
    #   대상은 `llm_ingredients_at IS NULL` — **LLM 값이 지워진 행**이다.
    #   이미 표식이 있는 행(9/5~9/6 배치가 새로 채운 것)은 건드리지 않는다.
    #   그쪽은 더 나중 프롬프트로 뽑은 값이라, 8월 원본으로 되돌리면 오히려
    #   뒤로 간다.
    where = (" WHERE llm_ingredients_at IS NULL" if restore
             else " WHERE llm_ingredients_done = 1")
    cursor.execute("SELECT id, title, used_ingredients FROM recipes" + where)
    rows = cursor.fetchall()
    cursor.close()
    # 읽기 커넥션은 여기서 할 일이 끝났다. 쓰기 루프가 도는 동안 놀고 있으면
    # 원격 서버가 먼저 끊어버려 "Lost connection" 의 원인이 되므로 즉시 닫는다.
    conn.close()
    print(f"대상 행: {len(rows)}건"
          + (" (복구 모드: 전체)" if restore else " (llm_ingredients_done=1)"), flush=True)

    write_conn = _connect_db(read_timeout_sec=120) if commit else None
    write_cursor = write_conn.cursor() if write_conn else None

    fieldnames = ["id", "title", "old_used_ingredients", "new_used_ingredients",
                  "added_ingredients", "removed_ingredients", "still_unmapped"]
    changed = 0
    skipped_no_raw = 0
    skipped_unexplained = 0
    since_commit = 0

    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()

            for row in rows:
                rid = row["id"]
                raw = raw_by_id.get(rid)
                if not raw:
                    skipped_no_raw += 1
                    continue

                new_used, unmapped = normalize_llm_ingredients(raw, alias_to_canonical)
                old_used = row.get("used_ingredients")
                old_set = _used_ingredient_token_set(old_used)
                new_set = _used_ingredient_token_set(new_used)
                if old_set == new_set:
                    continue

                # 사전 보강은 매핑을 늘리기만 하므로 결과가 비는 일은 없어야 한다.
                # 혹시 비면 원본 파싱이 어긋난 경우이므로 기존 값을 보존하고 건너뛴다.
                if not new_set:
                    continue

                # 사전 변경으로 설명되지 않는 재료 소실이 있으면 이 행은 건너뛴다.
                # (LLM 결과가 옛 사전에서 전부 미매핑이라 룰베이스 값이 남아 있던 행이
                #  여기 해당한다 — 새 사전으로는 일부만 매핑돼 오히려 재료를 잃을 수 있다)
                removed = old_set - new_set
                if allowed is not None and not removed <= allowed:
                    skipped_unexplained += 1
                    continue

                writer.writerow({
                    "id": rid,
                    "title": row.get("title"),
                    "old_used_ingredients": old_used,
                    "new_used_ingredients": new_used,
                    "added_ingredients": ",".join(sorted(new_set - old_set)),
                    "removed_ingredients": ",".join(sorted(old_set - new_set)),
                    "still_unmapped": ", ".join(unmapped),
                })
                changed += 1

                if commit:
                    # 원격 DB 와 오래 붙어 있는 작업이라 중간에 연결이 끊길 수 있다.
                    # 끊기면 재연결해서 한 번 더 시도한다. 끊긴 트랜잭션에 있던
                    # 미커밋분(최대 200건)은 날아가지만, 이 스크립트는 멱등이라
                    # 다시 돌리면 그 행들만 다시 처리된다.
                    for attempt in range(2):
                        try:
                            # 되돌린 값도 **LLM 이 만든 값**이므로 표식을 남긴다.
                            # 이게 있어야 룰베이스 배치가 다시 덮어쓰지 않는다.
                            write_cursor.execute(
                                "UPDATE recipes SET used_ingredients = %s, "
                                "llm_ingredients_at = COALESCE(llm_ingredients_at, NOW()) "
                                "WHERE id = %s",
                                (new_used, rid),
                            )
                            break
                        except pymysql.err.OperationalError:
                            if attempt == 1:
                                raise
                            print("  연결이 끊겨 재연결합니다...", flush=True)
                            try:
                                write_conn.close()
                            except Exception:  # noqa: BLE001
                                pass
                            write_conn = _connect_db(read_timeout_sec=120)
                            write_cursor = write_conn.cursor()
                            since_commit = 0
                    since_commit += 1
                    if since_commit >= 200:
                        write_conn.commit()
                        since_commit = 0

                if changed % 500 == 0:
                    print(f"  변경 {changed}건...", flush=True)

        if commit and since_commit > 0:
            write_conn.commit()
    finally:
        # 읽기 커넥션(conn)은 위에서 이미 닫았다. 여기서 또 닫으면 pymysql 이
        # "Already closed" 를 던져 진짜 예외를 덮어버리므로 건드리지 않는다.
        if write_cursor:
            write_cursor.close()
        if write_conn:
            write_conn.close()

    print(
        f"완료. 재료 변경 {changed}건, 원본 없어 건너뜀 {skipped_no_raw}건, "
        f"설명 안 되는 소실로 건너뜀 {skipped_unexplained}건",
        flush=True,
    )
    print(f"미리보기 CSV: {output_path}", flush=True)
    print("DB에 반영했습니다 (used_ingredients)." if commit
          else "DB 미반영 (미리보기만). 반영하려면 --commit 을 추가하세요.", flush=True)


def main():
    parser = argparse.ArgumentParser(
        description="사전 보강분을 기존 LLM 처리 결과에 소급 적용 (LLM 호출 없음)"
    )
    parser.add_argument("--commit", action="store_true", help="DB에 실제로 반영")
    parser.add_argument("--output", help="CSV 저장 경로")
    parser.add_argument(
        "--restore",
        action="store_true",
        help="룰베이스에 덮인 행까지 LLM 원본으로 되돌린다 (llm_ingredients_done 조건 없음)",
    )
    parser.add_argument(
        "--old-dict",
        help="보강 전 사전 CSV 경로. 주면 사전 변경으로 설명되지 않는 재료 소실이 있는 행을 건너뛴다",
    )
    args = parser.parse_args()

    output_path = args.output or os.path.join(
        _PROJECT_ROOT, "ingredient_management",
        f"renormalize_preview_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv",
    )
    run(commit=args.commit, output_path=output_path,
        old_dict_path=args.old_dict, restore=args.restore)


if __name__ == "__main__":
    main()
