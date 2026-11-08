# -*- coding: utf-8 -*-
"""기능영상 v2 ⑤ 사진 한 장으로 재료 등록: 내냉장고 → 사진으로 재료 담기 → (영수증 사진을 앨범 입력에 직접 넣음) → 인식 → 사진에서 찾은 재료 → N개 담기.
시스템 사진 선택기는 화면 안 JS 로 못 누르므로, 파일 입력에 DataTransfer 로 영수증 사진(public/reel1_src_receipt.jpg 의 영수증 부분)을 넣는다.
인식 결과는 가짜 응답(영수증에 실제로 찍힌 품목) — 크레딧·AI 호출 없음."""
import base64, io, json, os
from PIL import Image
import rec_v2_lib as L

src = Image.open(os.path.join(L.PUBLIC, "reel1_src_receipt.jpg")).convert("RGB")
crop = src.crop((0, 40, 640, 980))
buf = io.BytesIO(); crop.save(buf, "JPEG", quality=88)
b64 = base64.b64encode(buf.getvalue()).decode()

items = [("우유", "P국모닝우유 900ML", "fridge"), ("양파", "P양파", "room"), ("브로콜리", "P브로커리", "fridge")]  # 비회원은 3개까지 담기
body = {"ingredients": [{"name": n, "raw": r, "expiry": None, "storage": s} for n, r, s in items], "unmatched": [], "purchase_date": L.day(0), "usage": None}
mocks = [{"match": "/api/ingredients/recognize", "delay": 2600, "body": body}]

small = {"frozen": [{"name": "만두", "expiry": L.day(60)}], "fridge": [{"name": "달걀", "expiry": L.day(12)}, {"name": "대파", "expiry": L.day(3)}, {"name": "김치", "expiry": L.day(30)}],
         "room": [{"name": "간장"}, {"name": "참기름"}]}
c = L.setup(mocks, extra_storage={"myfridge_ingredients": json.dumps(L.with_seed_ids(small), ensure_ascii=False)}, path="/my-fridge", wait=11)
c.ev("window.__RECEIPT_B64=%s; 1" % json.dumps(b64))
JS = r"""
await sleep(1000); mark('start');
click([...document.querySelectorAll('button')].find(e=>/사진으로 재료 담기/.test(e.textContent||'')));
await sleep(1800); mark('sheet');
const bin=atob(window.__RECEIPT_B64); const arr=new Uint8Array(bin.length); for(let i=0;i<bin.length;i++) arr[i]=bin.charCodeAt(i);
const file=new File([arr],'receipt.jpg',{type:'image/jpeg'});
const dt=new DataTransfer(); dt.items.add(file);
const fi=[...document.querySelectorAll('input[type=file]')].find(i=>i.multiple) || document.querySelectorAll('input[type=file]')[1];
fi.files=dt.files; fi.dispatchEvent(new Event('change',{bubbles:true})); mark('picked');
for(let i=0;i<60;i++){ await sleep(250); if(/사진에서 찾은 재료|개 담기/.test(document.body.innerText)) break; }
mark('result'); await sleep(3200);
const add=[...document.querySelectorAll('button')].find(e=>/개 담기/.test(e.textContent||'')); if(add){ click(add); mark('added'); }
await sleep(1200); window.scrollTo({top:330,behavior:'smooth'}); await sleep(2600); mark('end');
return document.body.innerText.slice(0,300);
"""
L.record("v2_photo", JS, seconds=40)
c.close()
