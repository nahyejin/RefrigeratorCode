# -*- coding: utf-8 -*-
"""릴스 6(요리 챗봇) 데모 새 UI 녹화 — 비회원 체험 크레딧 1개 사용. 질문 입력 → 전송 → 로딩 → AI 답변 + 레시피 카드."""
import json, os, time
import rec_lib as r
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel6.mp4")
r.forward()
r.seed(); r.ev("setTimeout(()=>location.reload(),50); 1"); time.sleep(12)
r.ev("window.scrollTo(0,0); 1"); time.sleep(1)
JS = r"""
await sleep(1200); mark('fab_tap');
const f=document.querySelector('[data-guide-target="chat-fab"]'); click(f.querySelector('button')||f);
await sleep(2200); mark('chat_open');
const inp=document.querySelector('input[placeholder*="편하게"]'); inp.focus();
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
const q='아이가 잘 먹는 음식 추천';
for(let i=1;i<=q.length;i++){ s.call(inp,q.slice(0,i)); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(110); }
await sleep(900); mark('typed');
click(byText('button','보내기')); mark('sent');
let phase='';
for(let i=0;i<160;i++){ await sleep(500); const t=document.body.innerText;
  if(!phase && /찾는 중|정리하는 중|생각/.test(t)){ phase='loading'; mark('loading'); }
  if(/재료 매칭률|매칭률/.test(t) && document.querySelectorAll('img').length>3){ mark('reveal'); break; } }
await sleep(2500); mark('reveal_hold');
const sc=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).overflowY==='auto'&&d.scrollHeight>d.clientHeight+80).pop();
if(sc){ sc.scrollTo({top:300,behavior:'smooth'}); }
await sleep(2600); mark('scrolled'); await sleep(1000); mark('end');
return {phase, sc: !!sc};
"""
rec, res, lat = r.run_timeline(JS, seconds=75)
rec.pull(RAW)
json.dump(res, open(os.path.join(HERE, "rec_reel6.json"), "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False))
