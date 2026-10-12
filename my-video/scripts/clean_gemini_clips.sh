#!/bin/bash
# 훅 클립 20개의 제미나이 ✦ 표식 제거 → public/<이름>_clean.mp4 (2026-10-12)
# 제외(표식 없음·처리 완료): reel1_hook_gemini.mov(이미 잘려 나간 632x1124), reel1_hook_v3_egg.mov(424x720), reel4_hook_v4_greenonion.mp4,
# reel8_hook_v3_lobby.mp4 (이 둘은 우하단에 표식이 없다 — 눈으로 확인), reel4_hook_gemini.mp4(처리 완료)
cd "$(dirname "$0")/.."
export PYTHONUTF8=1
for f in reel2_hook_gemini.mp4 reel3_hook_gemini.mp4 reel5_hook_gemini.mov reel6_hook_line_clean.mp4 reel6_hook_turn_clean.mp4 reel7_hook_gemini.mov reel8_hook_gemini.mp4 \
  reel1_hook_v4_tofu.mp4 reel2_hook_v4_fridge.mp4 reel3_hook_v4_dough.mov reel5_hook_v4_zucchini.mov reel6_hook_v4_anything.mp4 reel7_hook_v4_salt.mp4 reel8_hook_v4_takeout.mov \
  reel2_hook_v3_lineup.mp4 reel3_hook_v3_scroll.mp4 reel4_hook_v3_fridgedoor.mp4 reel5_hook_v3_milk.mp4 reel6_hook_v3_mom.mp4 reel7_hook_v3_jjimdak.mp4; do
  stem="${f%.*}"
  echo "=== $f ($(date +%H:%M:%S))"
  python scripts/remove_gemini_mark.py "public/$f" "public/${stem}_clean.mp4" 2>&1 | tail -2
done
echo "=== ALLDONE $(date +%H:%M:%S)"
