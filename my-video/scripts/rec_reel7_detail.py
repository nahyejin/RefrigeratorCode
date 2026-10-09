# -*- coding: utf-8 -*-
"""릴스 7 — 레시피 상세 시트 비트(냉장고요리에서 카드를 눌러 상세가 열림) 새 UI 녹화."""
import json, os, time
import rec_lib as r
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel7d.mp4")
r.forward()
print("cards:", r.prepare_recipe_list())
JS = r"""
await sleep(1000);
// 사진이 큰 첫 카드의 제목을 눌러 상세를 연다
const card=document.querySelector('[data-recipe-card-index="0"]');
const title=[...card.querySelectorAll('div')].find(d=>d.textContent.trim().length>6 && d.children.length===0) || card;
mark('tap'); click(title); await sleep(1800); mark('open');
const sheet=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).overflowY==='auto' && d.scrollHeight>d.clientHeight+50 && d.clientHeight>300).pop();
if(sheet){ sheet.scrollTo({top:260,behavior:'smooth'}); }
await sleep(2600); mark('scrolled'); await sleep(1200); mark('end');
return {sheet: !!sheet};
"""
rec, res, lat = r.run_timeline(JS, seconds=40)
rec.pull(RAW)
json.dump(res, open(os.path.join(HERE, "rec_reel7d.json"), "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False))
