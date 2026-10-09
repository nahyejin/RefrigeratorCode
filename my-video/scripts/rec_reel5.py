# -*- coding: utf-8 -*-
"""릴스 5(유통기한 임박) 중 **냉장고요리 임박순 레시피 카드** 비트 녹화 — 새 UI 기준.
(알림 잠금화면·재료 등록 비트는 화면 개편과 무관해 옛 녹화를 그대로 쓴다.)"""
import json, os, time
import rec_lib as r

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel5.mp4")
r.forward()
print("cards:", r.prepare_recipe_list())

JS = r"""
await sleep(900); mark('open_tap');
click(byText('button','임박 재료',false)); await sleep(1500); mark('popup_open');
const root=[...document.querySelectorAll('div')].filter(d=>d.textContent.includes('임박 재료 설정')&&d.textContent.includes('냉장고에 담긴')).sort((a,b)=>a.textContent.length-b.textContent.length)[0];
const pick=(name)=>{ const e=[...root.querySelectorAll('*')].find(x=>x.children.length===0&&x.textContent.trim()===name); if(e) e.click(); return !!e; };
const a=pick('우유'); await sleep(700); const b=pick('두부'); await sleep(900); mark('picked');
click(byText('button','적용'));
for(let i=0;i<60;i++){ await sleep(500); const t=document.body.innerText; if(/임박 재료\s*2/.test(t)||/임박 재료\s*\d/.test(t)){ if(document.querySelectorAll('[data-recipe-card-index]').length>3 && !t.includes('찾는 중')) break; } }
await sleep(900); mark('results');
window.scrollTo({top:240,behavior:'smooth'}); await sleep(2600); mark('scrolled');
await sleep(1500); mark('end');
return {a,b};
"""
rec, res, lat = r.run_timeline(JS, seconds=50)
rec.pull(RAW)
json.dump(res, open(os.path.join(HERE, "rec_reel5.json"), "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False))
