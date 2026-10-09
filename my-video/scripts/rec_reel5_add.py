# -*- coding: utf-8 -*-
"""릴스 5 — 재료 등록(시금치 입력 → 보관 공간·유통기한 모름 → 구매시점 → 확인) 새 UI 녹화. 타임라인은 화면 안(JS)에서 돈다."""
import json, os, time
import rec_lib as r
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel5a.mp4")
r.forward()
# 깨끗한 시작: 시금치가 없는 샘플 냉장고
r.ev("""(()=>{const d=(n)=>{const t=new Date();t.setDate(t.getDate()+n);const p=x=>String(x).padStart(2,'0');return `${t.getFullYear()}.${p(t.getMonth()+1)}.${p(t.getDate())}`}; let i=0; const mk=(name,e={})=>({id:`seed-${Date.now()}-${i++}`,name,...e});
localStorage.setItem('myfridge_ingredients',JSON.stringify({frozen:[mk('돼지고기')],fridge:[mk('두부',{purchase:d(-5),expiry:d(1)}),mk('우유',{purchase:d(-6),expiry:d(2)}),mk('달걀',{purchase:d(-12),expiry:d(3)}),mk('대파')],room:[mk('소금')]})); return 1})()"""); r.ev("setTimeout(()=>location.reload(),50); 1"); time.sleep(12)
r.ev("window.scrollTo(0,0); 1"); time.sleep(1)
JS = r"""
await sleep(1000); mark('type_start');
const el=document.querySelector('input[placeholder*="재료명"]'); el.focus();
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
for(const v of ['시','시금','시금치']){ s.call(el,v); el.dispatchEvent(new Event('input',{bubbles:true})); await sleep(450); }
await sleep(700); mark('typed');
const it=[...document.querySelectorAll('div')].find(e=>e.children.length===0&&e.textContent.trim()==='시금치'&&String(e.className).includes('cursor-pointer'));
for(const t of ['mousedown','mouseup','click']) it.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true}));
await sleep(1500); mark('modal1');
click(byText('button','냉장보관')); await sleep(1200); mark('fridge');
click([...document.querySelectorAll('button')].find(x=>x.textContent.includes('없어요'))); await sleep(1600); mark('modal2');
click(byText('button','오늘')); await sleep(1100); mark('today');
click(byText('button','확인')); await sleep(1500); mark('confirmed');
const pill=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('시금치')&&e.children.length===0);
if(pill){ const rc=pill.getBoundingClientRect(); window.scrollTo({top: scrollY+rc.top-380, behavior:'smooth'}); }
await sleep(2200); mark('reveal');
const p2=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('시금치')&&e.children.length===0);
const rc2=p2? p2.getBoundingClientRect():null;
await sleep(1200); mark('end');
return {pill: rc2? [rc2.left,rc2.top,rc2.right,rc2.bottom,innerWidth,innerHeight]:null};
"""
rec, res, lat = r.run_timeline(JS, seconds=50)
rec.pull(RAW)
json.dump(res, open(os.path.join(HERE, "rec_reel5a.json"), "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False))
