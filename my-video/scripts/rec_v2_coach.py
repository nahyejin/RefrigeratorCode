# -*- coding: utf-8 -*-
"""기능영상 v2 ④ 쿡 코치(대체·계량): 「전자렌지 계란찜 만들기」 레시피 창 → 쿡 코치 → 대체 질문 → 추천 질문(계량) 누르기.
답은 가짜 응답(스토어 v3 쿡 코치 장과 같은 방식) — 크레딧·AI 호출 없음."""
import rec_v2_lib as L

q1 = "당근이 없으면 뭐로 바꿔요?"
q2 = "소금 10꼬집은 몇 g이에요?"
a1 = {"usage": None, "reply": "**애호박**으로 바꿔도 돼요. 냉장고에 있는 애호박을 당근처럼 잘게 다져 넣으면 색감과 단맛이 비슷하게 살아요.\n\n- 양은 당근과 같은 반 개 정도\n- 애호박은 물이 나오니 살짝 짜서 넣기",
      "next": [q2, "아이가 먹어도 괜찮을까요?"]}
a2 = {"usage": None, "reply": "소금 10꼬집은 **약 2~3g**, 티스푼으로 **반 스푼 정도**예요.\n\n- 달걀 4개 기준이라 짜게 느껴지면 절반만\n- 새우젓으로 바꾸면 1작은술",
      "next": ["전자레인지 없이 냄비로 하려면요?", "아이가 먹어도 괜찮을까요?"]}
mocks = [{"match": "/api/recipes/[0-9]+/ask", "delay": 1300, "body": a1, "alts": [{"if": "꼬집", "body": a2}]}]

c = L.setup(mocks, path="/recipe-list", wait=12)
# 레시피 창을 미리 연다(녹화 시작 전) — 제목으로 찾아 누른다
print(c.ev(r"""(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const inp=document.querySelector('input[placeholder*="레시피"]'); if(!inp) return 'noinput';
  inp.focus(); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(inp,'전자렌지 계란찜'); inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.form ? inp.form.requestSubmit() : inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await sleep(6000); inp.blur();
  window.scrollTo(0,0); return 'ok'})()"""))
JS = r"""
await sleep(1200); mark('start');
const h=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /전자렌지 계란찜 만들기/.test(e.textContent||'') && e.getBoundingClientRect().width>0);
click(h); await sleep(2600); mark('panel');
const later=[...document.querySelectorAll('button')].find(b=>/나중에 할게요/.test(b.textContent||'')); if(later){later.click(); await sleep(500);}
const b=[...document.querySelectorAll('button')].find(e=>/쿡 코치/.test(e.textContent||'') && /물어보세요/.test(e.textContent||'')) || [...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||'').includes('쿡 코치'));
click(b); await sleep(1600); mark('open');
const inp=document.querySelector('input.ai-chat-input-dark'); inp.focus();
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
for(let i=1;i<=%Q1%.length;i++){ s.call(inp,%Q1%.slice(0,i)); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(85); }
await sleep(500); mark('typed');
click(document.querySelector('section[aria-label="쿡 코치"] form button[type="submit"]')); mark('sent');
for(let i=0;i<40;i++){ await sleep(250); if(document.body.innerText.includes('애호박**')||document.body.innerText.includes('색감과 단맛')) break; }
mark('a1'); await sleep(3200);
const c2=[...document.querySelectorAll('section[aria-label="쿡 코치"] button')].find(e=>(e.textContent||'').includes('꼬집')); click(c2); mark('q2');
for(let i=0;i<40;i++){ await sleep(250); if(document.body.innerText.includes('티스푼')) break; }
mark('a2'); await sleep(3500); mark('end');
return document.querySelector('section[aria-label="쿡 코치"]').innerText.slice(0,400);
""".replace("%Q1%", '"%s"' % q1)
L.record("v2_coach", JS, seconds=45)
c.close()
