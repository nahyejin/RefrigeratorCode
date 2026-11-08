# -*- coding: utf-8 -*-
"""기능영상 v2 ⑥ 소비기한 자동 → 곧 상할 재료부터: 재료 「우유」를 넣으면 소비기한(D-n)이 저절로 붙고,
「임박 재료 N개」 → 임박 재료 시트 → 냉장고요리에서 「임박 재료」로 곧 상할 재료를 쓰는 요리부터. 실제 서버 응답만 씀(AI 없음)."""
import json
import rec_v2_lib as L

f = {"frozen": [{"name": "만두", "expiry": L.day(60)}],
     "fridge": [{"name": "두부", "expiry": L.day(2)}, {"name": "대파", "expiry": L.day(3)}, {"name": "애호박", "expiry": L.day(4)}, {"name": "달걀", "expiry": L.day(12)}],
     "room": [{"name": "간장"}, {"name": "참기름"}]}
c = L.setup([], extra_storage={"myfridge_ingredients": json.dumps(L.with_seed_ids(f), ensure_ascii=False)}, path="/my-fridge", wait=11)
print(c.ev("(async()=>{const t=[...document.querySelectorAll('button,label,div')].find(e=>e.children.length<3 && (e.textContent||'').trim()==='종류별로 묶기'); if(!t) return 'no toggle'; const sw=t.closest('label')||t.parentElement.querySelector('button,input')||t; sw.click(); await new Promise(r=>setTimeout(r,800)); return 'toggled'})()"))
JS = r"""
await sleep(1000); mark('start');
const inp=document.querySelector('input[placeholder*="재료명"]'); inp.focus();
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
for(const v of ['우','우유']){ s.call(inp,v); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(450); }
await sleep(900); mark('typed');
const opt=[...document.querySelectorAll('div,li,button,span')].find(e=>e.children.length===0 && e.textContent.trim()==='우유' && e.getBoundingClientRect().top>150 && e.getBoundingClientRect().top<330);
opt.dispatchEvent(new MouseEvent('mousedown',{bubbles:true,cancelable:true})); await sleep(300); inp.blur(); mark('dialog');
const fb=t=>[...document.querySelectorAll('button')].find(b=>(b.textContent||'').replace(/\s/g,'').includes(t));
await sleep(1100); click(fb('냉장보관')); await sleep(900); click(fb('유통기한없어요')); await sleep(1500); mark('purchase');
click([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='오늘')); await sleep(1000);
const ok=[...document.querySelectorAll('button')].find(b=>/^(확인|저장|담기|완료|추가)$/.test(b.textContent.trim())); if(ok){ click(ok); }
mark('added'); await sleep(700);
const milk=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && e.textContent.trim()==='우유' && e.getBoundingClientRect().top>330);
if(milk){ const r=milk.getBoundingClientRect(); window.scrollTo({top: scrollY + r.top - 520, behavior:'smooth'}); }
await sleep(2600); mark('shown');
window.scrollTo({top:0,behavior:'smooth'}); await sleep(900);
click([...document.querySelectorAll('button')].find(e=>/임박 재료/.test(e.textContent||''))); await sleep(2600); mark('sheet');
return [...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,20)).filter(x=>x).slice(-14).join(' | ') + ' ## ' + (document.body.innerText.match(/우유\s*D-\d+/)||[''])[0];
"""
L.record("v2_expiry", JS, seconds=30)
c.close()
