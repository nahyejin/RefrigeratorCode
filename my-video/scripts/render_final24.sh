#!/bin/bash
# 최종 24편 재렌더(2026-10-12) — 끝 화면 검색 연출 + 훅 ✦ 표식 제거(+ 01 편 사진 3종 컷). 결과는 out/_new/ 에 쌓고 최종24편에는 검수 후 복사.
cd "$(dirname "$0")/.."
mkdir -p out/_new
R() { id="$1"; name="$2"; echo "=== $id -> out/_new/$name.mp4 ($(date +%H:%M:%S))"; npx remotion render "$id" "out/_new/$name.mp4" --codec h264 --crf 18 --concurrency 4 2>&1 | tail -1; }
# 1벌(처음 8편) — 1·4번은 이미 최종
R Reel2Match reel2_match; R Reel3CookMode reel3_cookmode; R Reel5ExpiryAlert reel5_expiry; R Reel6ChatbotDemo reel6_chatbot; R Reel7RealRecipe reel7_recipe; R Reel8FamilySavings reel8_family_savings
# 2벌(새 클립 A v4)
R Reel1HookV4Tofu reel1_hookv4_tofu; R Reel2HookV4Fridge reel2_hookv4_fridge; R Reel3HookV4Dough reel3_hookv4_dough; R Reel4HookV4GreenOnion reel4_hookv4_greenonion
R Reel5HookV4Zucchini reel5_hookv4_zucchini; R Reel6HookV4Anything reel6_hookv4_anything; R Reel7HookV4Salt reel7_hookv4_salt; R Reel8HookV4Takeout reel8_hookv4_takeout
# 3벌(새 클립 B v3)
R Reel1HookV3Egg reel1_hookv3_egg; R Reel2HookV3Lineup reel2_hookv3_lineup; R Reel3HookV3Scroll reel3_hookv3_scroll; R Reel4HookV3FridgeDoor reel4_hookv3_fridgedoor
R Reel5HookV3Milk reel5_hookv3_milk; R Reel6HookV3Mom reel6_hookv3_mom; R Reel7HookV3Jjimdak reel7_hookv3_jjimdak; R Reel8HookV3Lobby reel8_hookv3_lobby
echo "=== ALLDONE $(date +%H:%M:%S)"
