# -*- coding: utf-8 -*-
"""기능영상 재제작 시범(2026-11-08) — 데모 A 「매칭률순」을 새 UI 로 녹화. 원본 `rec_reel2.py` 는 그대로 둔다.

옛 스크립트에서 바뀐 것(새 UI 기준):
  - 대체 칩이 `span` 이 아니라 **`button`**(배경 rgb(58,58,66), title 「A 대신 B 써도 되는지 쿡 코치에게 물어보기」) — 누르면 레시피 창 + 쿡 코치가 열려서 **여기서는 누르지 않고 보여 주기만** 한다.
  - 필터를 걸면 목록 위에 「최근 · 매칭 60~99% ✕ · 모두 지우기」 줄이 생긴다(스크롤 위치 계산이 달라짐).
  - 비회원 「다시 와 주셨네요」·「이 냉장고, 저장해 둘까요?」 로그인 확인창을 미리 막는다(rec_lib_v2.clean_start).
  - **쓰기 요청(POST 등)은 전부 막는 Guard** 를 켠 채로 녹화한다 — 앱이 방문 기록(`/api/events`)·쿠팡 파트너 로그를 쏘는 것도 막힌다.
비트: ① 냉장고요리 첫 화면(매칭순·내 재료 4/4) ② 매칭도 모달 → 60~99% → 적용 ③ 결과 훑기(「내 재료 8/9 (94%)」) ④ 대체 칩 ⑤ 부족 칩 → 구매 시트.
산출: scripts/rec_raw_reel2_v2.mp4(원본) + rec_reel2_v2.json(표식) → ../public/reel2_matching_demo_v2.mp4(940x1920, 30fps).
"""
import json, os, sys, time
import rec_lib as r
import rec_lib_v2 as v

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "rec_raw_reel2_v2.mp4")
OUT = os.path.join(HERE, "..", "public", "reel2_matching_demo_v2.mp4")

r.forward()
guard = v.Guard()
guard.start()
try:
    print("cards:", v.clean_start())

    JS = r"""
await sleep(2200); mark('first_screen');
mark('modal_tap'); click(byText('button','매칭도',false)); await sleep(1500); mark('modal_open');
const set=(el,x)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(el,x); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));};
const ins=[...document.querySelectorAll('input[type=number]')]; set(ins[0],'60'); set(ins[1],'99');
await sleep(1700); mark('apply_tap');
click(byText('button','적용'));
for(let i=0;i<60;i++){ await sleep(500); const t=document.body.innerText; if(t.includes('60~99') && document.querySelectorAll('[data-recipe-card-index]').length>5 && !t.includes('찾는 중')) break; }
await sleep(900); mark('results_start');
for (const y of [650,1300,1950]) { window.scrollTo({top:y,behavior:'smooth'}); await sleep(1900); }
mark('results_end');
// 대체 칩: 새 UI 는 button(배경 rgb(58,58,66)) — 누르지 않고 화면 가운데 위쪽으로 가져와 보여 준다
const isSub=b=>(b.title||'').includes('쿡 코치')&&b.textContent.includes('→')&&getComputedStyle(b).backgroundColor==='rgb(58, 58, 66)';
const sub=[...document.querySelectorAll('button')].find(isSub);
if(!sub) return {err:'no substitute chip'};
let rc=sub.getBoundingClientRect(); window.scrollTo({top: scrollY + rc.top - 560, behavior:'smooth'}); await sleep(1700); mark('sub_start');
rc=sub.getBoundingClientRect(); const subRect=[rc.left,rc.top,rc.right,rc.bottom,innerWidth,innerHeight];
await sleep(3000); mark('sub_end');
const miss=[...document.querySelectorAll('button')].filter(b=>b.title&&b.title.includes('구매'))[0];
if(!miss) return {err:'no missing chip', sub: sub.textContent, subRect};
rc=miss.getBoundingClientRect(); window.scrollTo({top: scrollY + rc.top - 560, behavior:'smooth'}); await sleep(1900); mark('list_start');
await sleep(1200); mark('miss_tap'); click(miss); await sleep(900); mark('modal_shown'); await sleep(2800); mark('end');
return {sub: sub.textContent, subTitle: sub.title, subRect, miss: miss.title};
"""
    rec, res, lat = r.run_timeline(JS, seconds=75)
    rec.pull(RAW)
    res["latency"] = lat
    res["guard"] = guard.report()
    json.dump(res, open(os.path.join(HERE, "rec_reel2_v2.json"), "w"), ensure_ascii=False)
    print(json.dumps(res, ensure_ascii=False, indent=1))
finally:
    guard.stop()

r.Recorder.encode(RAW, OUT)
print("saved", os.path.abspath(OUT))
