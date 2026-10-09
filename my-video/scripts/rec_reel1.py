# -*- coding: utf-8 -*-
"""릴스 1(사진 인식) 데모 새 UI 녹화 — 로그인 계정(크레딧 2 사용). 에뮬레이터 사진 보관함에 `coupang_order.png`(store/sources/camera_coupang.png)를
`adb push /sdcard/Pictures/` 해 두고(MSYS_NO_PATHCONV=1), 시스템 사진 선택기에서 실제로 고른다 — 화면 안 JS 로는 못 누르는 구간이라 좌표 탭(adb)을 쓴다.
녹화 뒤 반영된 재료는 사용자가 필요하면 지운다(재료가 몇 개 늘어남)."""
import json, os, time
import rec_lib as r
HERE = os.path.dirname(__file__)
RAW = os.path.join(HERE, "rec_raw_reel1.mp4")

r.forward()
r.ev("setTimeout(()=>{location.href='/'},50); 1"); time.sleep(12)
r.ev("window.scrollTo(0,0); 1"); time.sleep(1)
before = r.ev("document.body.innerText.length")

rec = r.Recorder("reel1", 170)
rec.start()
t0 = rec.t0
M = {}
def mk(k): M[k] = round(time.time() - t0, 2)
time.sleep(1.0); mk("idle")
r.tap_el("document.querySelector('.ai-fab-button')"); time.sleep(2.0); mk("sheet")
r.tap_el(r.by_text('button','사진 추가',False)); time.sleep(2.0); mk("modal")
r.tap_el("[...document.querySelectorAll('button')].find(b=>b.textContent.includes('영수증')&&b.textContent.length<14)"); time.sleep(2.5); mk("picker")
time.sleep(1.5); mk("browse")
r.tap(179, 1413); time.sleep(1.2); mk("checked")
r.tap(907, 2134); time.sleep(2.0); mk("selected")
res = None
for i in range(100):
    time.sleep(1)
    t = r.ev("document.body.innerText")
    if isinstance(t, str) and ("개를 읽었어요" in t or "읽었어요" in t):
        res = True; break
mk("result")
time.sleep(2.5); mk("result_hold")
time.sleep(1.0)
print(r.ev("[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t&&t.length<30).join(' | ')"))
rec.stop(); rec.pull(RAW)
json.dump(M, open(os.path.join(HERE, "rec_reel1.json"), "w"))
print(M, res)
