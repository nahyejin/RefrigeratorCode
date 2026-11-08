# -*- coding: utf-8 -*-
"""기능영상 v2 ③-a 쿡 픽: 냉장고요리 화면 → 쿡 픽 열기 → 「오늘 매운 거 먹고 싶어」 → 답 + 레시피 카드 3개.
답은 가짜 응답(크레딧·AI 호출 없음), 레시피 3개는 실제 서버 레시피."""
import rec_v2_lib as L


def cr(r, reason):
    return dict(id=r["id"], title=r["title"], thumbnail=r["thumbnail"], platform=r["platform"], link=r["link"], match_rate=int(r["match_rate"]), reason=reason)


P = L.pool(200)
def find(sub):
    for r in P:
        if sub in r["title"]:
            return r
    raise KeyError(sub)

want = [("김치찌개", "김치·삼겹살·고춧가루가 냉장고에 있어요"), ("두부조림", "두부와 고춧가루로 바로 만들 수 있어요"), ("두부김치", "김치·두부·삼겹살로 만들어요")]
recs = []
for sub, why in want:
    try:
        recs.append(cr(find(sub), why))
    except KeyError:
        pass
print([x["title"][:24] for x in recs])
mocks = [{"match": "/api/chat", "delay": 1600, "body": {"reply": "얼큰한 게 당기시는군요. 냉장고에 있는 김치와 삼겹살, 두부로 바로 만들 수 있는 요리부터 골라봤어요.", "recipes": recs, "basis": None, "intent": "recipe", "usage": None}}]

c = L.setup(mocks, path="/recipe-list", wait=12)
JS = r"""
await sleep(900); mark('fab');
const b=[...document.querySelectorAll('button')].find(e=>(e.getAttribute('aria-label')||'').includes('쿡 픽 열기')); click(b);
await sleep(1500); mark('open');
const inp=document.querySelector('input.ai-chat-input'); inp.focus();
const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
const q='오늘 매운 거 먹고 싶어';
for(let i=1;i<=q.length;i++){ s.call(inp,q.slice(0,i)); inp.dispatchEvent(new Event('input',{bubbles:true})); await sleep(90); }
await sleep(500); mark('typed');
click(document.querySelector('button[aria-label="보내기"]')); mark('sent');
for(let i=0;i<40;i++){ await sleep(250); if(document.body.innerText.includes('얼큰한 게')) break; }
mark('reply'); await sleep(2600);
const sc=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).overflowY==='auto'&&d.scrollHeight>d.clientHeight+80).pop();
if(sc){ sc.scrollTo({top:sc.scrollHeight,behavior:'smooth'}); }
await sleep(2400); mark('end');
return {n: document.querySelectorAll('img').length};
"""
L.record("v2_pick", JS, seconds=40)
c.close()
