# -*- coding: utf-8 -*-
"""기능영상 v2 ⑧ 가족과 함께 + 아낀 돈: 마이캘린더(가족 모드) — 식구 엄마·아빠의 이번 달 집밥 기록, 목표, 아낀 돈(예상).
스토어 v3 8번 장과 같은 가짜 로그인·가족 응답(GET 가로채기) — 실제 계정·서버 쓰기 없음."""
import base64, json, time
import rec_v2_lib as L

user = {"id": "1", "email": "", "nickname": "엄마"}
payload = base64.urlsafe_b64encode(json.dumps({"user_id": 1, "nickname": "엄마", "email": "", "exp": int(time.time()) + 86400 * 30}, ensure_ascii=False).encode()).decode().rstrip("=")
token = "x." + payload + ".y"
P = [r for r in L.pool(60) if r.get("thumbnail")]
today = L.datetime.date.today()
plan = [(0, 1, 1), (1, 2, 1), (2, 1, 2), (3, 2, 3), (4, 1, 4), (5, 1, 5), (6, 2, 6), (7, 1, 7), (8, 2, 7), (9, 1, 8)]
entries = []
for idx, uid, dd in plan:
    if dd > today.day:
        continue
    r = P[idx % len(P)]
    day_s = "%04d-%02d-%02d" % (today.year, today.month, dd)
    entries.append({"day": day_s, "created_at": day_s + "T10:00:00Z", "recipe_id": r["id"], "title": r["title"], "thumbnail": r["thumbnail"],
                    "user_id": uid, "nickname": "엄마" if uid == 1 else "아빠", "entry_type": "recipe"})
mocks = [
    {"match": "/api/auth/me", "method": "GET", "body": {"user": user}},
    {"match": "/api/households/me/completed-calendar", "method": "GET", "body": {"entries": entries, "group_goal": 20, "my_personal_goal": 20, "household_size": 2, "family_size": 3, "savings_per_meal": 8000}},
    {"match": "/api/households/me$", "method": "GET", "body": {"in_household": True, "members": [{"id": 1, "nickname": "엄마"}, {"id": 2, "nickname": "아빠"}]}},
    {"match": "/api/users/1/completed-recipes", "method": "GET", "body": {"recipes": [{"id": e["recipe_id"]} for e in entries]}},
]
c = L.setup(mocks, extra_storage={"auth_token": token, "user": json.dumps(user, ensure_ascii=False), "calendar_scope": "all"}, path="/cooking-calendar", wait=12)
print(c.ev("document.body.innerText.slice(0,400)"))
JS = r"""
await sleep(800);
const cl=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='닫기'); if(cl){ cl.click(); }
await sleep(1200); mark('start');
window.scrollTo({top:0,behavior:'smooth'}); await sleep(2200); mark('top');
const sv=[...document.querySelectorAll('*')].find(x=>x.children.length<4 && /절약 약|아낀 돈/.test(x.textContent||'') && x.getBoundingClientRect().width>0 && x.getBoundingClientRect().height<80);
if(sv){ sv.click(); } await sleep(2400); mark('saving');
window.scrollTo({top:480,behavior:'smooth'}); await sleep(2600); mark('cal');
window.scrollTo({top:0,behavior:'smooth'}); await sleep(1500); mark('end');
return document.body.innerText.slice(0,500);
"""
L.record("v2_family", JS, seconds=30)
c.close()
