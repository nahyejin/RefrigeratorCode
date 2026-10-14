#!/bin/bash
# 2·3벌 16편에 밝은 배경음악(make_bgm2.SONGS3)을 깐다(2026-10-14, 「v2 가 너무 비장하다」 사용자 피드백).
# 1벌 8편은 이미 올렸으므로 그대로 둔다. 결과: out/최종24편_음악_v3/
cd "$(dirname "$0")/.."
export PYTHONUTF8=1
i=0
for rd in "2벌_새클립A_v4:reel1_hookv4_tofu reel2_hookv4_fridge reel5_hookv4_zucchini reel4_hookv4_greenonion reel6_hookv4_anything reel3_hookv4_dough reel7_hookv4_salt reel8_hookv4_takeout" \
          "3벌_새클립B_v3:reel1_hookv3_egg reel2_hookv3_lineup reel5_hookv3_milk reel4_hookv3_fridgedoor reel6_hookv3_mom reel3_hookv3_scroll reel7_hookv3_jjimdak reel8_hookv3_lobby"; do
  folder="${rd%%:*}"; names="${rd#*:}"
  mkdir -p "out/최종24편_음악_v3/$folder"
  for n in $names; do
    dst="out/최종24편_음악_v3/$folder/${n}_음악.mp4"
    if [ -f "$dst" ]; then echo "skip $n (song $i)"; else
      echo "=== $n -> song $i"
      python scripts/add_bgm.py "out/최종24편/$folder/$n.mp4" $i "$dst" --engine 3 2>&1 | tail -1
    fi
    i=$((i+1))
  done
done
echo "=== ALLDONE"
