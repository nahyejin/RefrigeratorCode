"""
재료 사전 CSV 를 백엔드 배포본으로 복사한다.

왜 사본이 필요한가:
  원본은 `frontend/public/` 에 있다. 프론트가 브라우저에서 그 파일을 직접
  받아 쓰기 때문이다. 그런데 **백엔드 배포에는 frontend/ 가 올라가지 않아서**
  서버가 그 경로를 못 찾는다(실측: 배포에서 `재료 사전을 불러오지 못했어요` 503).
  그래서 `backend/` 에 같은 파일을 하나 더 둔다.

  ⚠️ 사전(frontend/public/...csv)을 고쳤으면 **이 스크립트를 돌려서 사본도 맞춰야
     한다.** 안 맞으면 화면(프론트)과 서버(사진 인식)가 서로 다른 사전을 쓰게 된다.

사용:
  python scripts/sync_ingredient_dict.py          # 차이만 확인
  python scripts/sync_ingredient_dict.py --write  # 사본 갱신
"""

import argparse
import hashlib
import os
import shutil
import sys

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_NAME = "ingredient_profile_dict_with_substitutes.csv"
SOURCE = os.path.join(_ROOT, "frontend", "public", _NAME)
COPY = os.path.join(_ROOT, "backend", _NAME)


def _digest(path):
    if not os.path.exists(path):
        return None
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


def main():
    parser = argparse.ArgumentParser(description="재료 사전 CSV 를 backend/ 로 동기화")
    parser.add_argument("--write", action="store_true", help="사본을 실제로 갱신")
    args = parser.parse_args()

    if not os.path.exists(SOURCE):
        print(f"원본이 없습니다: {SOURCE}")
        return 2

    src, dst = _digest(SOURCE), _digest(COPY)
    if src == dst:
        print("사본이 원본과 같습니다. 할 일 없음.")
        return 0

    print("원본과 사본이 다릅니다.")
    print(f"  원본: {SOURCE}")
    print(f"  사본: {COPY}" + ("" if dst else "  (아직 없음)"))
    if not args.write:
        print("\n--write 를 붙이면 사본을 갱신합니다.")
        return 1

    shutil.copyfile(SOURCE, COPY)
    print("사본을 갱신했습니다.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
