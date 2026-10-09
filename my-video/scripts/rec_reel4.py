# -*- coding: utf-8 -*-
"""릴스 4(AI 식단) 데모 새 UI 녹화 — 로그인 계정(크레딧 3 사용). 끝나면 담긴 식단은 `clear_plan()` 으로 지운다.
비트: ① 캘린더 위 `이번 주 AI 식단 추천` 탭 ② 조건(칩) 전송 ③ 로딩 ④ 답변 + 장보기 ⑤ 일주일 목록 ⑥ 담기 → 월/주 캘린더."""
import json, os, time
import rec_lib as r
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel4.mp4")

def goto_calendar():
    r.forward()
    r.ev("setTimeout(()=>{location.href='/cooking-calendar'},50); 1"); time.sleep(12)
    r.ev("window.scrollTo(0,0); 1"); time.sleep(1)

if __name__ == "__main__":
    goto_calendar()
    JS = r"""
    await sleep(1300); mark('tap_ai');
    click([...document.querySelectorAll('button')].find(b=>b.textContent.includes('이번 주 AI 식단'))); await sleep(2200); mark('plan_open');
    click(byText('button','아이 먹을 것 위주로',false)); await sleep(300); mark('prompt_sent');
    let seen=false;
    for(let i=0;i<240;i++){ await sleep(500); const t=document.body.innerText;
      if(!seen && /찾는 중|보는 중|정리/.test(t)){ seen=true; mark('loading'); }
      if(/장보기 목록|요리 캘린더에 담기/.test(t)) break; }
    mark('reveal'); await sleep(2600); mark('reveal_hold');
    const add=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('마이캘린더에 담기'));
    window.scrollTo({top: scrollY+380, behavior:'smooth'}); const sc=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).overflowY==='auto'&&d.scrollHeight>d.clientHeight+80).pop(); if(sc) sc.scrollTo({top:sc.scrollTop+420,behavior:'smooth'});
    await sleep(2600); mark('list_shown');
    mark('add_tap'); if(add) click(add);
    await sleep(4500); mark('after_add');
    const w=byText('button','월'); const wk=byText('button','주');
    const rcMon=w? 1:0;
    window.scrollTo({top:0,behavior:'smooth'}); await sleep(500);
    const cal=[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('요리 기록')); if(cal){ const rc=cal.getBoundingClientRect(); window.scrollTo({top: scrollY+rc.top-70, behavior:'smooth'}); }
    await sleep(2200); mark('month_view'); await sleep(1200);
    if(wk){ click(wk); } await sleep(2800); mark('week_view'); await sleep(1500); mark('end');
    return {added: !!add, path: location.pathname};
    """
    rec, res, lat = r.run_timeline(JS, seconds=110)
    rec.pull(RAW)
    json.dump(res, open(os.path.join(HERE, "rec_reel4.json"), "w"), ensure_ascii=False)
    print(json.dumps(res, ensure_ascii=False)[:900])


def clear_plan():
    """녹화로 담긴 식단을 지운다(마이캘린더 `요리 계획 전체 삭제`)."""
    r.forward(); goto_calendar()
    print(r.ev("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t.includes('삭제')||t.includes('계획')).join(' | ')"))
