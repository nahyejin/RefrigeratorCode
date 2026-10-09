#!/bin/bash
# 후킹 v3 렌더(전달된 편만)
cd "$(dirname "$0")/.."
for pair in "$@"; do
  id="${pair%%:*}"; name="${pair##*:}"
  echo "=== $id -> out/$name.mp4 ($(date +%H:%M:%S))"
  npx remotion render "$id" "out/$name.mp4" --codec h264 --crf 18 --concurrency 4 2>&1 | tail -1
done
echo "=== ALLDONE $(date +%H:%M:%S)"
