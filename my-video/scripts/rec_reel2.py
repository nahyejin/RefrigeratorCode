# -*- coding: utf-8 -*-
"""릴스 2(냉장고요리 매칭) 데모 녹화 — 새 UI 기준. 타임라인은 화면 안(JS)에서 돈다.
비트: ① 매칭도 설정 모달 → 범위 조정 → 적용 ② 결과 목록 훑기 ③ 대체 재료 칩 ④ 부족 재료 칩 → 구매 시트.
"""
import json, os, sys, time
import rec_lib as r

HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel2.mp4")

r.forward()
print("cards:", r.prepare_recipe_list())

JS = r"""
await sleep(1200); mark('modal_tap');
click(byText('button','매칭도',false)); await sleep(1500); mark('modal_open');
const set=(el,v)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));};
const ins=[...document.querySelectorAll('input[type=number]')]; set(ins[0],'60'); set(ins[1],'99');
await sleep(1700); mark('apply_tap');
click(byText('button','적용'));
for(let i=0;i<60;i++){ await sleep(500); const t=document.body.innerText; if(t.includes('60~99') && document.querySelectorAll('[data-recipe-card-index]').length>5 && !t.includes('찾는 중')) break; }
await sleep(900); mark('results_start');
for (const y of [650,1300,1950]) { window.scrollTo({top:y,behavior:'smooth'}); await sleep(1900); }
mark('results_end');
const isSub=e=>(e.textContent||'').includes('→')&&getComputedStyle(e).backgroundColor==='rgb(58, 58, 66)';
const sub=[...document.querySelectorAll('span')].find(isSub);
let rc=sub.getBoundingClientRect(); window.scrollTo({top: scrollY + rc.top - 560, behavior:'smooth'}); await sleep(1700); mark('sub_start');
rc=sub.getBoundingClientRect(); const subRect=[rc.left,rc.top,rc.right,rc.bottom,innerWidth,innerHeight];
await sleep(3000); mark('sub_end');
const miss=[...document.querySelectorAll('button')].filter(b=>b.title&&b.title.includes('구매'))[0];
rc=miss.getBoundingClientRect(); window.scrollTo({top: scrollY + rc.top - 560, behavior:'smooth'}); await sleep(1900); mark('list_start');
await sleep(1200); mark('miss_tap'); click(miss); await sleep(900); mark('modal_shown'); await sleep(2800); mark('end');
return {sub: sub.textContent, subRect};
"""
rec, res, lat = r.run_timeline(JS, seconds=75)
rec.pull(RAW)
res["latency"] = lat
json.dump(res, open(os.path.join(HERE, "rec_reel2.json"), "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False))
