# -*- coding: utf-8 -*-
"""릴스 7(실제 레시피) 중 **냉장고요리 정렬 드롭다운 → 인기순 → 로딩 카드 → 인기 카드** 비트 녹화 — 새 UI 기준.
(레시피 상세·원문 유튜브 비트는 화면 개편과 무관해 옛 녹화를 그대로 쓴다.)"""
import json, os, time
import rec_lib as r

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel7.mp4")
r.forward()
print("cards:", r.prepare_recipe_list())

JS = r"""
await sleep(1000); mark('sort_tap');
const sd=document.querySelector('[data-guide-target="sort-dropdown"]'); click(sd.querySelector('button, div, span') || sd); await sleep(1400); mark('sort_open');
const opt=[...document.querySelectorAll('li,div,button,span')].filter(e=>e.children.length===0&&e.textContent.trim()==='인기순')[0]; click(opt); mark('picked');
let loadSeen=false;
for(let i=0;i<80;i++){ await sleep(250); const t=document.body.innerText; if(t.includes('찾는 중')) { if(!loadSeen){ loadSeen=true; mark('loading_start'); } } else if(loadSeen && document.querySelectorAll('[data-recipe-card-index]').length>3) break; }
mark('loaded'); await sleep(1800); mark('hold_end'); await sleep(800); mark('end');
return {loadSeen};
"""
rec, res, lat = r.run_timeline(JS, seconds=60)
rec.pull(RAW)
json.dump(res, open(os.path.join(HERE, "rec_reel7.json"), "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False))
