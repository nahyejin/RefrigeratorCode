# -*- coding: utf-8 -*-
"""릴스 8(가족·절약) 데모 새 UI 녹화 — 로그인한 가족 계정(엄마) 필요.
비트: ① 목표수정(15→20) ② 자세히 보기(절약액) ③ 달력(전월 가족 기록 점) ④ 목록(우리 식구 전체).
녹화 뒤 목표는 `restore_goal()` 로 원래 값(15)으로 되돌린다."""
import json, os, time
import rec_lib as r
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel8.mp4")

def goto_calendar():
    r.forward()
    r.ev("localStorage.setItem('calendar_scope','all'); 1")
    r.ev("setTimeout(()=>location.reload(),50); 1"); time.sleep(10)
    r.tap_el("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('마이캘린더'))"); time.sleep(7)
    r.ev("window.scrollTo(0,0); 1"); time.sleep(1)

def restore_goal(value=15):
    r.forward(); goto_calendar()
    r.ev("""(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms)); [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='목표수정').click(); await sleep(700); const inp=document.querySelector('input[type=number]'); const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(inp,'%d'); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(300); [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='적용').click(); await sleep(1200); return 1})()""" % value)

if __name__ == "__main__":
    goto_calendar()
    JS = r"""
    await sleep(1200); mark('goal_tap');
    click(byText('button','목표수정')); await sleep(1100); mark('goal_input');
    const inp=document.querySelector('input[type=number]'); inp.focus();
    const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
    for(const v of ['','2','20']){ s.call(inp,v); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(520); }
    await sleep(800); mark('goal_typed');
    click(byText('button','적용')); await sleep(1800); mark('goal_applied');
    click(byText('button','자세히 보기')); await sleep(2600); mark('detail_open');
    window.scrollTo({top:0,behavior:'smooth'}); await sleep(600);
    const cal=[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('요리 기록'));
    const rc=cal.getBoundingClientRect(); window.scrollTo({top: scrollY+rc.top-70, behavior:'smooth'}); await sleep(1800); mark('cal_shown');
    click(document.querySelector('button[aria-label="이전"]')); await sleep(2200); mark('cal_prev');
    await sleep(1800); mark('cal_hold');
    click(byText('button','목록')); await sleep(2200); mark('list_open');
    window.scrollTo({top: scrollY+260, behavior:'smooth'}); await sleep(2400); mark('list_scrolled'); await sleep(1200); mark('end');
    return 1;
    """
    rec, res, lat = r.run_timeline(JS, seconds=70)
    rec.pull(RAW)
    json.dump(res, open(os.path.join(HERE, "rec_reel8.json"), "w"), ensure_ascii=False)
    print(json.dumps(res, ensure_ascii=False))
