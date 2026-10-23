#!/bin/bash
# 후킹 v6(2026-10-23) 살린 두 편 렌더 → 배경음악(add_bgm.py --engine 3, 대사·나레이션에 자동으로 낮아짐)
# 곡: 2·3벌 16편이 SONGS3 0~15 를 하나씩 썼다. 같은 기능 편과 겹치지 않게 02 매칭 = 4(마림바 소풍), 04 AI 식단 = 0(우쿨렐레 깡총).
cd "$(dirname "$0")/.."
export PYTHONUTF8=1
mkdir -p "out/후킹v6"
for t in "Reel2HookV6Cabbage:reel2_hookv6_cabbage:4" "Reel4HookV6Menu:reel4_hookv6_menu:0"; do
  IFS=: read id name song <<< "$t"
  echo "=== $id ($(date +%H:%M:%S))"
  npx remotion render "$id" "out/후킹v6/$name.mp4" --codec h264 --crf 18 --concurrency 4 2>&1 | tail -1
  python scripts/add_bgm.py "out/후킹v6/$name.mp4" $song "out/후킹v6/${name}_음악.mp4" --engine 3 2>&1 | tail -1
done
echo "=== ALLDONE $(date +%H:%M:%S)"
