# -*- coding: utf-8 -*-
"""릴스 4 — 식단을 담은 뒤의 마이캘린더(월 보기 점 → 주 보기 목록) 새 UI 녹화. `rec_reel4.py` 로 식단을 담은 상태에서 돌린다."""
import json, os, time
import rec_lib as r
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel4c.mp4")
r.forward()
r.ev("setTimeout(()=>{location.href='/cooking-calendar'},50); 1"); time.sleep(12)
r.ev("window.scrollTo(0,0); 1"); time.sleep(1)
JS = r"""
await sleep(1200); mark('top');
const cal=[...document.querySelectorAll('h2')].find(h=>h.textContent.includes('요리 기록'));
const rc=cal.getBoundingClientRect(); window.scrollTo({top: scrollY+rc.top-70, behavior:'smooth'}); await sleep(2000); mark('month_view');
await sleep(1800); mark('month_hold');
click(byText('button','주')); await sleep(2400); mark('week_view');
await sleep(1300); mark('week_hold'); click(document.querySelector('button[aria-label="다음"]')); await sleep(2600); mark('week2'); await sleep(1600); mark('end');
return document.body.innerText.slice(0,100);
"""
rec, res, lat = r.run_timeline(JS, seconds=40)
rec.pull(RAW)
json.dump(res, open(os.path.join(HERE, "rec_reel4c.json"), "w"), ensure_ascii=False)
print(json.dumps(res, ensure_ascii=False)[:500])
