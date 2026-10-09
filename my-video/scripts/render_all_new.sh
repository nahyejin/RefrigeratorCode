#!/bin/bash
# 새 UI 데모(1·2·4·5·6·7·8편 교체분)로 4벌(원본·v2·v3·v4 후킹) 32편 전부 다시 렌더
cd "$(dirname "$0")/.."
mkdir -p out/_old_20261010
R() { id="$1"; name="$2"; echo "=== $id -> $name ($(date +%H:%M:%S))"; npx remotion render "$id" "out/$name.mp4" --codec h264 --crf 18 --concurrency 4 2>&1 | tail -1; }
R Reel1Receipt reel1_receipt; R Reel2Match reel2_match; R Reel3CookMode reel3_cookmode; R Reel4AiDiet reel4_diet
R Reel5ExpiryAlert reel5_expiry; R Reel6ChatbotDemo reel6_chatbot; R Reel7RealRecipe reel7_recipe; R Reel8FamilySavings reel8_family_savings
R Reel1HookV2Tofu reel1_hookv2_tofu; R Reel2HookV2Fridge reel2_hookv2_fridge; R Reel3HookV2DoughB reel3_hookv2_dough_b; R Reel4HookV2GreenOnion reel4_hookv2_greenonion
R Reel5HookV2Zucchini reel5_hookv2_zucchini; R Reel6HookV2Anything reel6_hookv2_anything; R Reel7HookV2Salt reel7_hookv2_salt; R Reel8HookV2Takeout reel8_hookv2_takeout
R Reel1HookV3Egg reel1_hookv3_egg; R Reel2HookV3Lineup reel2_hookv3_lineup; R Reel3HookV3Scroll reel3_hookv3_scroll; R Reel4HookV3FridgeDoor reel4_hookv3_fridgedoor
R Reel5HookV3Milk reel5_hookv3_milk; R Reel6HookV3Mom reel6_hookv3_mom; R Reel7HookV3Jjimdak reel7_hookv3_jjimdak; R Reel8HookV3Lobby reel8_hookv3_lobby
R Reel1HookV4Tofu reel1_hookv4_tofu; R Reel2HookV4Fridge reel2_hookv4_fridge; R Reel3HookV4Dough reel3_hookv4_dough; R Reel4HookV4GreenOnion reel4_hookv4_greenonion
R Reel5HookV4Zucchini reel5_hookv4_zucchini; R Reel6HookV4Anything reel6_hookv4_anything; R Reel7HookV4Salt reel7_hookv4_salt; R Reel8HookV4Takeout reel8_hookv4_takeout
echo "=== ALLDONE $(date +%H:%M:%S)"
