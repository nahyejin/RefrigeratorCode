#!/bin/bash
# 24편 모두에 배경음악 깔기 — 올리는 순서(벌마다 01,02,05,04,06,03,07,08)대로 곡 번호 0~23 을 하나씩 배정(2026-10-12)
cd "$(dirname "$0")/.."
export PYTHONUTF8=1
i=0
for rd in "1벌_처음8편:reel1_receipt reel2_match reel5_expiry reel4_diet reel6_chatbot reel3_cookmode reel7_recipe reel8_family_savings" \
          "2벌_새클립A_v4:reel1_hookv4_tofu reel2_hookv4_fridge reel5_hookv4_zucchini reel4_hookv4_greenonion reel6_hookv4_anything reel3_hookv4_dough reel7_hookv4_salt reel8_hookv4_takeout" \
          "3벌_새클립B_v3:reel1_hookv3_egg reel2_hookv3_lineup reel5_hookv3_milk reel4_hookv3_fridgedoor reel6_hookv3_mom reel3_hookv3_scroll reel7_hookv3_jjimdak reel8_hookv3_lobby"; do
  folder="${rd%%:*}"; names="${rd#*:}"
  mkdir -p "out/최종24편_음악/$folder"
  for n in $names; do
    dst="out/최종24편_음악/$folder/${n}_음악.mp4"
    if [ -f "$dst" ]; then echo "skip $n (track $i)"; else
      echo "=== $n -> track $i ($(date +%H:%M:%S))"
      python scripts/add_bgm.py "out/최종24편/$folder/$n.mp4" $i "$dst" 2>&1 | tail -1
    fi
    i=$((i+1))
  done
done
echo "=== ALLDONE $(date +%H:%M:%S)"
