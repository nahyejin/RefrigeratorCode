#!/usr/bin/env bash
# 기능영상 v2(2026-11-08) 렌더 — 기능 하나씩 8개 + 묶음(그 밖에도 + 8개) + 쿠키 릴스 뒷부분.
# 결과: my-video/out/feature_v2/
set -e
cd "$(dirname "$0")/.."
OUT=out/feature_v2
mkdir -p "$OUT"
NAMES=(popular matching pick_plan coach photo expiry listen family)
for i in 1 2 3 4 5 6 7 8; do
  npx remotion render src/index.ts "FeatureV2-$i" "$OUT/feature_v2_${i}_${NAMES[$((i-1))]}.mp4" --log=error
done
npx remotion render src/index.ts FeatureTailV2 "$OUT/feature_tail_v2.mp4" --log=error
npx remotion render src/index.ts CookieTailV2 "$OUT/cookie_tail_v2_silent.mp4" --log=error
echo done
