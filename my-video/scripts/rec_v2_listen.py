# -*- coding: utf-8 -*-
"""기능영상 v2 ⑦ 단계별 요약 + 귀로 듣기: 「전자렌지 계란찜 만들기」 레시피 창 → 조리 순서(단계별 요약) → 「읽어 주기」.
말소리는 막아 두고(녹화는 무음, 영상에서 스피커 표시로 보여 줌) 단계 넘김만 화면에 나온다. AI 호출 없음."""
import rec_v2_lib as L

# 안드로이드 웹뷰에는 speechSynthesis 가 없어 「읽어 주기」 버튼이 안 나온다(iOS·웹에는 있음) → 녹화용 가짜 음성 엔진을 심는다.
FAKE_TTS = r"""(()=>{ if('speechSynthesis' in window) return;
  window.SpeechSynthesisUtterance=function(t){this.text=t;this.rate=1;this.lang='ko-KR';this.onstart=null;this.onend=null;this.onerror=null;this.onboundary=null;};
  let cur=null, tm=null;
  window.speechSynthesis={speaking:false,pending:false,paused:false,onvoiceschanged:null,
    getVoices(){return [];}, addEventListener(){}, removeEventListener(){},
    speak(u){ cur=u; this.speaking=true; setTimeout(()=>{try{u.onstart&&u.onstart({});}catch(e){}},30);
      const ms=Math.min(3200, 900+ (u.text||'').length*45)/(u.rate||1);
      tm=setTimeout(()=>{ this.speaking=false; try{u.onend&&u.onend({});}catch(e){} }, ms); },
    cancel(){ if(tm) clearTimeout(tm); this.speaking=false; const u=cur; cur=null; if(u){ setTimeout(()=>{try{u.onend&&u.onend({});}catch(e){}},0);} },
    pause(){}, resume(){} };
})();"""
c = L.setup([], path="/recipe-list", wait=12, extra_src=FAKE_TTS)
print(c.ev(r"""(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const inp=document.querySelector('input[placeholder*="레시피"]'); if(!inp) return 'noinput';
  inp.focus(); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(inp,'전자렌지 계란찜'); inp.dispatchEvent(new Event('input',{bubbles:true}));
  inp.form ? inp.form.requestSubmit() : inp.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
  await sleep(6000); inp.blur(); window.scrollTo(0,0); return 'ok'})()"""))
JS = r"""
await sleep(900); mark('start');
const h=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && /전자렌지 계란찜 만들기/.test(e.textContent||'') && e.getBoundingClientRect().width>0);
click(h); await sleep(2400); mark('panel');
const later=[...document.querySelectorAll('button')].find(b=>/나중에 할게요/.test(b.textContent||'')); if(later){later.click(); await sleep(400);}
const t=[...document.querySelectorAll('*')].find(e=>e.children.length===0 && (e.textContent||'').trim()==='조리 순서');
t.scrollIntoView({block:'start',behavior:'smooth'}); await sleep(1800); mark('steps');
const rb=[...document.querySelectorAll('button')].find(b=>/읽어 주기/.test(b.textContent||''));
click(rb); mark('read'); await sleep(9000); mark('end');
return [...document.querySelectorAll('button')].map(b=>b.textContent.trim().slice(0,20)).filter(x=>/읽|멈|다음|이전|요약|원문/.test(x)).join(' | ');
"""
L.record("v2_listen", JS, seconds=40)
c.close()
