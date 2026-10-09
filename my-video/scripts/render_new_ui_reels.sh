#!/bin/bash
# 새 UI 녹화로 바꾼 릴스(2·5·7편, v1·v2 후킹)를 다시 렌더한다.
cd "$(dirname "$0")/.."
for pair in "Reel2Match:reel2_match" "Reel2HookV2Fridge:reel2_hookv2_fridge" "Reel5ExpiryAlert:reel5_expiry" "Reel5HookV2Zucchini:reel5_hookv2_zucchini" "Reel7RealRecipe:reel7_recipe" "Reel7HookV2Salt:reel7_hookv2_salt"; do
  id="${pair%%:*}"; name="${pair##*:}"
  echo "=== $id -> out/$name.mp4 ($(date +%H:%M:%S))"
  npx remotion render "$id" "out/$name.mp4" --codec h264 --crf 18 --concurrency 4 2>&1 | tail -3
done
echo "=== done $(date +%H:%M:%S)"
