"""재료 사전 CSV 가 멀쩡한지 확인한다. 깨졌으면 0 이 아닌 코드로 끝난다.

자동으로 CSV 를 고치고 커밋하는 흐름(`apply_dictionary_additions_daily.bat`)에서
**커밋 직전 관문**으로 쓴다. 사전은 레시피 매칭과 사진 인식의 기준이라, 깨진 채로
배포되면 모든 사용자에게 영향이 간다. 사람이 안 보는 사이에 나가는 변경일수록
나가기 전에 한 번은 막아야 한다.

무엇을 보나:
  1. 두 사본(frontend/public, backend)이 **바이트까지 같은가**
  2. 사전이 읽히는가, 별칭 수가 갑자기 줄지 않았는가
  3. 늘 있어야 할 기본 재료가 여전히 잡히는가
  4. 대표어가 자기 자신이 아닌 다른 대표어의 별칭으로 도는 고리가 없는가

쓰는 법:
    python scripts/verify_ingredient_dict.py
    python scripts/verify_ingredient_dict.py --min-aliases 1500
"""

import argparse
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "backend"))

FRONT = os.path.join(ROOT, "frontend", "public", "ingredient_profile_dict_with_substitutes.csv")
BACK = os.path.join(ROOT, "backend", "ingredient_profile_dict_with_substitutes.csv")

# 이게 안 잡히면 사전이 통째로 잘못된 것이다. 흔하고 확실한 것만 고른다.
MUST_RESOLVE = ["돼지고기", "양파", "달걀", "대파", "간장", "우유", "김치", "두부"]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--min-aliases", type=int, default=1500,
                        help="별칭이 이 수보다 적으면 실패로 본다")
    args = parser.parse_args()

    problems = []

    # 1. 두 사본이 같은가
    if not os.path.exists(FRONT) or not os.path.exists(BACK):
        problems.append("사전 CSV 가 두 곳에 다 있어야 합니다.")
    else:
        with open(FRONT, "rb") as f1, open(BACK, "rb") as f2:
            if f1.read() != f2.read():
                problems.append(
                    "frontend/public 과 backend 사본이 다릅니다. "
                    "scripts/sync_ingredient_dict.py --write 로 맞추세요."
                )

    # 2~4. 읽어서 확인
    try:
        import ingredient_dictionary as idic

        idic.reset_cache()
        alias = idic.load_alias_to_canonical(FRONT)
    except Exception as e:  # noqa: BLE001
        print(f"[실패] 사전을 읽지 못했습니다: {type(e).__name__}: {e}")
        return 1

    if len(alias) < args.min_aliases:
        problems.append(f"별칭이 {len(alias)}개뿐입니다 (최소 {args.min_aliases} 기대).")

    for name in MUST_RESOLVE:
        if not idic.resolve_canonical(name, alias):
            problems.append(f"기본 재료 '{name}' 가 사전에서 안 잡힙니다.")

    # 대표어가 다른 대표어의 별칭으로 도는 고리
    canonicals = set(alias.values())
    for canonical in canonicals:
        target = alias.get(idic.normalize_key(canonical))
        if target and target != canonical and target in canonicals:
            hop = alias.get(idic.normalize_key(target))
            if hop and hop == canonical:
                problems.append(f"대표어가 서로를 가리킵니다: {canonical} ↔ {target}")

    if problems:
        print("[실패] 사전에 문제가 있습니다:")
        for p in problems:
            print(f"  - {p}")
        return 1

    print(f"[정상] 별칭 {len(alias):,}개 · 대표어 {len(canonicals):,}개 · 두 사본 일치")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
