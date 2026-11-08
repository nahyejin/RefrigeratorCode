# -*- coding: utf-8 -*-
"""요리 릴스 6편(쿠키) 쿡매치 구간 — 새 UI 재녹화(2026-11-08). 옛 완성본(쿠키_20261105_v1)의 98~116초 구간과 같은 흐름:
냉장고요리 → 「쿠키」 검색 → 인기순 → 레시피 훑기 → 필터 → 테마 「오븐」 → 적용 → 오븐 쿠키만. 실제 서버 응답만 씀(AI 없음)."""
import rec_v2_lib as L

c = L.setup([], path="/recipe-list", wait=12)
JS = r"""
await sleep(1200); mark('start');
const inp=document.querySelector('input[placeholder*="레시피"]'); inp.focus();
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
for(const v of ['ㅋ','쿠','쿠ㅋ','쿠키']){ s.call(inp,v); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(260); }
await sleep(500); mark('typed');
inp.form ? inp.form.requestSubmit() : inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); inp.blur();
for(let i=0;i<40;i++){ await sleep(250); if(/총 [0-9,]+건/.test(document.body.innerText) && document.querySelectorAll('[data-recipe-card-index]').length>3 && !/찾는 중/.test(document.body.innerText)) break; }
mark('results');
const sortBtn=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('매칭순'));
if(sortBtn){ click(sortBtn); await sleep(800); const pop=[...document.querySelectorAll('button,li,div')].find(e=>e.children.length===0 && e.textContent.trim()==='인기순'); if(pop){ click(pop); } }
for(let i=0;i<40;i++){ await sleep(250); if(!/찾는 중/.test(document.body.innerText) && document.querySelectorAll('[data-recipe-card-index]').length>3) break; }
await sleep(900); mark('popular');
window.scrollTo({top:650,behavior:'smooth'}); await sleep(1500);
window.scrollTo({top:1350,behavior:'smooth'}); await sleep(1500); mark('scrolled');
window.scrollTo({top:0,behavior:'smooth'}); await sleep(800);
click([...document.querySelectorAll('button')].find(b=>/필터/.test(b.getAttribute('aria-label')||''))); await sleep(1500); mark('filter');
const oven=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='오븐');
oven.scrollIntoView({block:'center',behavior:'smooth'}); await sleep(1500); mark('oven_shown');
click(oven); await sleep(1100); mark('oven_on');
click([...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='적용')); mark('apply');
for(let i=0;i<40;i++){ await sleep(250); if(!/찾는 중/.test(document.body.innerText) && document.querySelectorAll('[data-recipe-card-index]').length>2) break; }
await sleep(800); mark('oven_results');
window.scrollTo({top:650,behavior:'smooth'}); await sleep(1600);
window.scrollTo({top:1300,behavior:'smooth'}); await sleep(1600); mark('end');
return (document.body.innerText.match(/총 [0-9,]+건/g)||[]).join(',');
"""
L.record("v2_cookie_app", JS, seconds=45)
c.close()
