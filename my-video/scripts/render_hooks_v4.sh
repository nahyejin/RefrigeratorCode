#!/bin/bash
# 후킹 v4(2026-10-10 새 제미나이 클립) 8편 렌더
cd "$(dirname "$0")/.."
for pair in "Reel1HookV4Tofu:reel1_hookv4_tofu" "Reel2HookV4Fridge:reel2_hookv4_fridge" "Reel3HookV4Dough:reel3_hookv4_dough" "Reel4HookV4GreenOnion:reel4_hookv4_greenonion" "Reel5HookV4Zucchini:reel5_hookv4_zucchini" "Reel6HookV4Anything:reel6_hookv4_anything" "Reel7HookV4Salt:reel7_hookv4_salt" "Reel8HookV4Takeout:reel8_hookv4_takeout"; do
  id="${pair%%:*}"; name="${pair##*:}"
  echo "=== $id -> out/$name.mp4 ($(date +%H:%M:%S))"
  npx remotion render "$id" "out/$name.mp4" --codec h264 --crf 18 --concurrency 4 2>&1 | tail -1
done
echo "=== ALLDONE $(date +%H:%M:%S)"
