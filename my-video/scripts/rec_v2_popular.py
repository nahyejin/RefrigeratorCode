# -*- coding: utf-8 -*-
"""기능영상 v2 ① 인기 레시피만 4만 개: 냉장고요리(총 N건) → 요즘인기 순위 → 유튜브 탭. 실제 서버 응답만 씀(AI 없음)."""
import rec_v2_lib as L

c = L.setup([], path="/recipe-list", wait=12)
JS = r"""
await sleep(1600); mark('start');
window.scrollTo({top:700,behavior:'smooth'}); await sleep(1500);
window.scrollTo({top:1500,behavior:'smooth'}); await sleep(1500); mark('list');
click([...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('요즘인기'))); await sleep(2600); mark('popular');
window.scrollTo({top:600,behavior:'smooth'}); await sleep(1500);
window.scrollTo({top:1300,behavior:'smooth'}); await sleep(1500); mark('pop_scrolled');
window.scrollTo({top:0,behavior:'smooth'}); await sleep(900);
click([...document.querySelectorAll('*')].find(b=>b.children.length===0 && b.textContent.trim()==='유튜브' && b.getBoundingClientRect().top<400)); await sleep(2600); mark('yt');
window.scrollTo({top:700,behavior:'smooth'}); await sleep(1800); mark('end');
return document.body.innerText.slice(0,200);
"""
L.record("v2_popular", JS, seconds=35)
c.close()
