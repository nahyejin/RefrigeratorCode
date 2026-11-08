# -*- coding: utf-8 -*-
"""기능영상 v2 ③-b 식단 짜기: /plan → 조건 「아이 먹을 것 위주로」 → 조건에 맞춰 짜기 → 일주일 식단.
AI 답은 가짜 응답(스토어 v3 캡처와 같은 방식), 레시피는 실제 서버 레시피."""
import rec_v2_lib as L

P = L.pool(60)
exp = set(L.EXPIRING)
plan = []
for r in P:
    u = [x for x in (r.get("used_ingredients") or "").split(",") if x]
    if len(u) < 2:
        continue
    r = dict(r)
    r["ingredients"] = u
    hit = [x for x in u if x in exp]
    r["why"] = ("곧 상하는 %s 먼저 써요" % "·".join(hit)) if hit else "냉장고 재료로 바로 만들 수 있어요"
    r["match_rate"] = int(r["match_rate"])
    plan.append(r)
    if len(plan) == 7:
        break
print([p["title"][:20] for p in plan])
mocks = [{"match": "/api/plan/suggest", "delay": 2200, "body": {"plan": plan, "usage": None,
          "summary": "아이가 먹기 좋게 순한 요리 위주로, 곧 상하는 두부·대파·애호박·우유를 먼저 쓰도록 짰어요."}}]
c = L.setup(mocks, path="/plan", wait=12)
JS = r"""
await sleep(1000); mark('start');
const inp=document.querySelector('input[placeholder^="예: 아이"]'); inp.scrollIntoView({block:'center',behavior:'smooth'}); await sleep(700); inp.focus();
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
const q='아이 먹을 것 위주로';
for(let i=1;i<=q.length;i++){ s.call(inp,q.slice(0,i)); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(95); }
inp.blur(); await sleep(700); mark('typed');
const b=[...document.querySelectorAll('button')].find(e=>/조건에 맞춰 짜기/.test(e.textContent||'')); click(b); mark('ask');
for(let i=0;i<60;i++){ await sleep(250); if(document.body.innerText.includes('아이가 먹기 좋게')) break; }
mark('result'); window.scrollTo({top:0,behavior:'smooth'}); await sleep(1800);
window.scrollTo({top:520,behavior:'smooth'}); await sleep(2000);
window.scrollTo({top:1100,behavior:'smooth'}); await sleep(1800); mark('end');
return document.body.innerText.slice(0,200);
"""
L.record("v2_plan", JS, seconds=45)
c.close()
