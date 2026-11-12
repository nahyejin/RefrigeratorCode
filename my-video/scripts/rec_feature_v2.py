# -*- coding: utf-8 -*-
"""기능영상 v2(2026-11-08·11-12) 데모 녹화 — 스토어 v3 순서의 장면별 새 UI 녹화.
사용: python rec_feature_v2.py <장면> [<장면> ...]    장면: match pick plan coach photo expiry listen
산출: scripts/rec_raw_f_<장면>.mp4(원본) · rec_f_<장면>.json(표식·막은 요청 보고) · ../public/feature_v2/demo_<장면>.mp4(940x1920, 30fps)

안전 장치(전부 rec_lib_v2.Guard):
  - 쓰기 요청(POST/PUT/…)은 서버로 안 나간다. AI 화면(쿡 픽 /api/chat · 식단 짜기 /api/plan/suggest · 쿡 코치 /api/recipes/<id>/ask ·
    사진 인식 /api/ingredients/recognize)은 아래 **가짜 응답**만 돌려준다(진짜 크레딧·AI 호출 0).
  - 가짜 응답 안의 레시피(제목·썸네일·링크)는 진짜 레시피 목록(읽기 GET)에서 가져온 실제 항목이다.
  - 끝에 보고(`guard`)를 json 에 남긴다: blocked_writes(막은 쓰기), faked(가짜 응답).
앱은 최신 origin/main 을 `npx vite build` + `cap sync` + `gradlew assembleDebug` 로 빌드해 에뮬레이터(cookmatch_pixel)에 설치한 것.
"""
import json, os, sys, time, urllib.parse, urllib.request
import rec_lib as r
import rec_lib_v2 as v

HERE = os.path.dirname(os.path.abspath(__file__))
PUB = os.path.join(HERE, "..", "public", "feature_v2")
os.makedirs(PUB, exist_ok=True)
API = "https://refrigeratorcode-production.up.railway.app"
MY = "두부,대파,달걀,양파,김치,우유,애호박,마늘,된장,고추장,감자,고구마,소금,간장,식용유,참기름,후추,설탕,밀가루,버터,피자치즈,돼지고기,닭고기,만두"


# ---------- 가짜 응답 재료: 진짜 레시피(읽기 전용 GET) ----------
def real_recipes(n=100, ing=None):
    u = f"{API}/api/recipes/filter?page=1&size={n}&sort_by=match_rate&my_ingredients=" + urllib.parse.quote(ing or MY)
    return json.load(urllib.request.urlopen(u, timeout=60))["recipes"]


def pick_by(rs, words, k, used=()):
    out = []
    for x in rs:
        if x["id"] in used or any(o["id"] == x["id"] for o in out):
            continue
        if any(w in x["title"] for w in words):
            out.append(x)
        if len(out) == k:
            break
    return out


def short(title, n=30):
    return title if len(title) <= n else title[:n].rstrip() + "…"


def chat_fake(rs0):
    rs = real_recipes(60, "김치,고추장,두부,대파,양파,마늘,돼지고기")
    spicy = pick_by(rs, ["김치", "고추장", "제육", "매콤", "두루치기", "찌개"], 3)
    spicy += [x for x in rs if x not in spicy][: 3 - len(spicy)]
    recs = [{"id": x["id"], "title": short(x["title"], 38), "reason": why, "thumbnail": x["thumbnail"], "platform": x["platform"],
             "link": x["link"], "match_rate": int(float(x["match_rate"]))}
            for x, why in zip(spicy, ["김치와 고추장이 있어 바로 만들 수 있어요", "냉장고 재료로 매콤하게 끓일 수 있어요", "있는 재료가 거의 다 들어가요"])]
    return {"reply": "매운 게 당기시는군요. 냉장고에 있는 **김치**와 **고추장**으로 바로 만들 수 있는 요리부터 골랐어요.",
            "recipes": recs, "basis": {"considered": 120, "picked": len(recs), "lines": ["매운 음식 · 내 냉장고 재료 기준"]}, "intent": "recipe"}


def plan_fake(rs):
    used, plan = set(), []
    for words in (["두부"], ["감자"], ["달걀", "계란"], ["애호박"], ["김치"], ["양파"], ["대파"]):
        c = pick_by(rs, words, 1, used) or [x for x in rs if x["id"] not in used][:1]
        x = c[0]
        used.add(x["id"])
        plan.append({"id": x["id"], "title": short(x["title"], 30), "link": x["link"], "thumbnail": x["thumbnail"],
                     "used_ingredients": x.get("used_ingredients", ""), "match_rate": int(float(x["match_rate"])),
                     "why": "아이가 먹기 좋은 순한 맛이에요"})
    return {"plan": plan, "summary": "아이 먹기 좋은 순한 요리로, 곧 상하는 두부·우유부터 썼어요.", "basket": None}


COACH = {
    "reply": "네, **참기름**으로 바꿔도 돼요. 들기름보다 향이 약해서 고소함은 비슷해요.\n- **약불**에서 살짝만 두르세요\n- 양은 **조금 더** 넣어도 괜찮아요",
    "next": ["들기름 대신 참기름 쓸 때 간은요?", "간장은 얼마나 넣어요?"],
}
RECOGNIZE = {  # 시스템 사진 선택기에서 고르는 사진 = store/sources/camera_coupang.png(쿠팡 주문내역: 미니 양배추·표고버섯·페퍼잭 치즈·깻잎무쌈)
    "ingredients": [
        {"name": "방울양배추", "raw": "그린즈 미니 양배추 (냉동)", "expiry": None, "storage": "frozen"},
        {"name": "표고버섯", "raw": "국내산 표고버섯", "expiry": None, "storage": "fridge"},
        {"name": "무쌈", "raw": "풀무원 깻잎무쌈", "expiry": None, "storage": "fridge"},
    ],
    "unmatched": [],
    "purchase_date": time.strftime("%Y-%m-%d"),
}

# ---------- 장면 JS (화면 안 타임라인) ----------
SET = r"""const set=(el,x)=>{const s=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; s.call(el,x); el.dispatchEvent(new Event('input',{bubbles:true})); el.dispatchEvent(new Event('change',{bubbles:true}));};
const typeInto=async(el,text,ms=95)=>{ for(let i=1;i<=text.length;i++){ set(el,text.slice(0,i)); await sleep(ms);} };
const sendBtn=(el)=>{ let p=el; for(let i=0;i<5&&p;i++){ p=p.parentElement; if(!p) break; const b=[...p.querySelectorAll('button')].find(b=>b.type==='submit'||b.getAttribute('aria-label')==='보내기'||b.title==='보내기'||b.textContent.trim()==='↑'); if(b) return b; } return null; };
"""

SCENES = {}

SCENES["match"] = dict(path="/", tab="냉장고요리", seconds=60, js=SET + r"""
await sleep(2200); mark('first_screen');
mark('modal_tap'); click(byText('button','매칭도',false)); await sleep(1500); mark('modal_open');
const ins=[...document.querySelectorAll('input[type=number]')]; set(ins[0],'60'); set(ins[1],'99');
await sleep(1500); mark('apply_tap');
click(byText('button','적용'));
for(let i=0;i<60;i++){ await sleep(500); const t=document.body.innerText; if(t.includes('60~99') && document.querySelectorAll('[data-recipe-card-index]').length>5 && !t.includes('찾는 중')) break; }
await sleep(900); mark('results_start');
for (const y of [650,1300,1950]) { window.scrollTo({top:y,behavior:'smooth'}); await sleep(1700); }
mark('results_end');
return {};
""")

SCENES["pick"] = dict(path="/my-fridge", seconds=60, js=SET + r"""
await sleep(1500); mark('first_screen');
const fab=document.querySelector('[data-guide-target="chat-fab"] button')||document.querySelector('[data-guide-target="chat-fab"]');
mark('fab_tap'); click(fab); await sleep(2000); mark('open');
const inp=document.querySelector('input[placeholder*="편하게"]');
mark('typing'); await typeInto(inp,'오늘 매운 거 먹고 싶어'); await sleep(700); mark('typed');
const b=sendBtn(inp); mark('send'); if(b) click(b); else inp.form&&inp.form.requestSubmit();
for(let i=0;i<60;i++){ await sleep(400); if(document.querySelectorAll('img').length>3 && /근거|매칭률/.test(document.body.innerText)) { mark('reveal'); break; } }
await sleep(2600);
const sc=[...document.querySelectorAll('div')].filter(d=>getComputedStyle(d).overflowY==='auto'&&d.scrollHeight>d.clientHeight+60).pop();
if(sc){ sc.scrollTo({top:sc.scrollHeight,behavior:'smooth'}); }
await sleep(2200); mark('end');
return {send: !!b};
""")

SCENES["plan"] = dict(path="/plan", seconds=60, js=SET + r"""
await sleep(1800); mark('first_screen');
mark('chip_tap'); click(byText('button','아이 먹을 것 위주로',false)); await sleep(1500); mark('chip_done');
const go=[...document.querySelectorAll('button')].filter(x=>/짜기/.test(x.textContent)&&x.textContent.length<30).pop();
mark('go_tap'); click(go);
for(let i=0;i<80;i++){ await sleep(400); if(document.querySelectorAll('img').length>=5 && !/짜는 중|짜고 있/.test(document.body.innerText)) { mark('result'); break; } }
await sleep(2200); mark('result_hold');
for (const y of [500,1000]) { window.scrollTo({top:y,behavior:'smooth'}); await sleep(1600); }
mark('end');
return {go: go&&go.textContent};
""")

SCENES["coach"] = dict(path="/", tab="냉장고요리", seconds=75, js=SET + r"""
await sleep(1500);
mark('modal_tap'); click(byText('button','매칭도',false)); await sleep(1300);
const ins=[...document.querySelectorAll('input[type=number]')]; set(ins[0],'60'); set(ins[1],'99'); await sleep(500);
click(byText('button','적용'));
for(let i=0;i<60;i++){ await sleep(500); const t=document.body.innerText; if(t.includes('60~99') && document.querySelectorAll('[data-recipe-card-index]').length>5 && !t.includes('찾는 중')) break; }
await sleep(3500);
const isSub=b=>(b.title||'').includes('쿡 코치')&&b.textContent.includes('→')&&getComputedStyle(b).backgroundColor==='rgb(58, 58, 66)';
const sub=[...document.querySelectorAll('button')].find(isSub);
let rc=sub.getBoundingClientRect(); sub.scrollIntoView({block:'center'}); await sleep(900); window.scrollBy({top:-120,behavior:'smooth'}); await sleep(1100);
mark('sub_visible'); await sleep(1700);
mark('sub_tap'); click(sub); await sleep(2200); mark('coach_open');
const inp=[...document.querySelectorAll('input')].find(i=>i.value.includes('참기름'));
await sleep(1500);
const b=inp? sendBtn(inp):null; mark('send'); if(b) click(b);
for(let i=0;i<60;i++){ await sleep(400); if(/조금 더|약불/.test(document.body.innerText)) { mark('reveal'); break; } }
await sleep(3500); mark('end');
return {sendFound: !!b, q: inp&&inp.value};
""")

SCENES["photo"] = dict(path="/my-fridge", seconds=70, adb_after=dict(mark="album_tap", steps=[(2.2, 179, 1413), (1.3, 907, 2138)]), js=SET + r"""
await sleep(1500); mark('first_screen');
mark('cam_tap'); click(byText('button','사진으로 재료 담기',false)); await sleep(2000); mark('sheet_open');
await sleep(800);
mark('album_tap'); click(byText('button','앨범에서 고르기',false));
for(let i=0;i<80;i++){ await sleep(300); if(/찾았어요|읽고 있|분석/.test(document.body.innerText)) { mark('loading'); break; } }
for(let i=0;i<80;i++){ await sleep(300); if(/찾았어요/.test(document.body.innerText)) { mark('result'); break; } }
await sleep(3000); mark('result_hold');
return {btns:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t&&t.length<20&&t.includes('담'))};
""")

SCENES["expiry"] = dict(path="/my-fridge", seconds=80, js=SET + r"""
await sleep(1500); mark('first_screen');
const el=document.querySelector('input[placeholder*="재료명"]');
mark('type_start'); await typeInto(el,'시금치',420); await sleep(800); mark('typed');
const it=[...document.querySelectorAll('div')].find(e=>e.children.length===0&&e.textContent.trim()==='시금치'&&String(e.className).includes('cursor-pointer'));
for(const t of ['mousedown','mouseup','click']) it.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true}));
await sleep(1500); mark('modal1');
click(byText('button','냉장보관')); await sleep(1200); mark('fridge');
click([...document.querySelectorAll('button')].find(x=>x.textContent.includes('없어요'))); await sleep(1600); mark('modal2');
click(byText('button','오늘')); await sleep(1100); mark('today');
click(byText('button','확인')); await sleep(1500); mark('confirmed');
const pill=[...document.querySelectorAll('span')].find(e=>e.textContent.trim().startsWith('시금치')&&e.children.length===0);
if(pill){ const rc=pill.getBoundingClientRect(); window.scrollTo({top: scrollY+rc.top-380, behavior:'smooth'}); }
await sleep(2300); mark('reveal');
window.scrollTo({top:0,behavior:'smooth'}); await sleep(1200);
const imm=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('임박 재료')&&b.textContent.includes('개'));
mark('imm_tap'); if(imm) click(imm); await sleep(2600); mark('imm_open'); await sleep(2200); mark('end');
return {imm: !!imm};
""")

SCENES["listen"] = dict(path="/", tab="냉장고요리", seconds=60, js=SET + r"""
await sleep(1500);
const card=document.querySelector('[data-recipe-card-index="0"]'); const t=card.querySelector('h3')||card.querySelector('img'); mark('open_tap'); t.click(); await sleep(3200); mark('sheet_open');
await sleep(1500);
const sc=[...document.querySelectorAll('div')].filter(d=>['auto','scroll'].includes(getComputedStyle(d).overflowY)&&d.scrollHeight>d.clientHeight+200).pop();
const head=[...document.querySelectorAll('h2,h3,div,span')].find(e=>e.children.length===0&&e.textContent.trim()==='조리 순서');
if(sc&&head){ const dy=head.getBoundingClientRect().top - sc.getBoundingClientRect().top - 24; sc.scrollBy({top:dy,behavior:'smooth'}); } await sleep(2200); mark('steps');
const btn=[...document.querySelectorAll('button')].find(x=>x.textContent.includes('읽어 주기'));
mark('read_tap'); if(btn) click(btn); await sleep(9500); mark('reading'); await sleep(1200); mark('end');
return {btn: !!btn, head: !!head, btns:[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(t=>t.includes('읽')||t.includes('멈'))};
""")


def _adb_taps(sc):
    """시스템 사진 선택기(화면 안 JS 가 못 누르는 구간)를 adb 좌표 탭으로 누른다 — 표식이 찍힌 뒤 지정한 초 간격으로."""
    import threading
    cfg = sc.get("adb_after")
    if not cfg:
        return None
    def work():
        for _ in range(600):
            time.sleep(0.2)
            try:
                if r.ev("window.__M && window.__M[%s] !== undefined" % json.dumps(cfg["mark"])) is True:
                    break
            except Exception:
                pass
        for delay, x, y in cfg["steps"]:
            time.sleep(delay)
            r.tap(x, y)
    t = threading.Thread(target=work, daemon=True)
    t.start()
    return t


def run(name):
    sc = SCENES[name]
    rs = real_recipes()
    fake = {
        "/api/chat": (200, chat_fake(rs), 2.6),
        "/api/plan/suggest": (200, plan_fake(rs), 3.2),
        "/ask": (200, COACH, 2.6),
        "/api/ingredients/recognize": (200, RECOGNIZE, 3.4),
    }
    # 앞 장면이 남긴 시스템 창(사진 선택기 등)이 있으면 앱을 맨 앞으로 불러 닫는다
    r.sh("shell", "am", "start", "-n", "kr.cookmatch.app/com.cookmatch.app.MainActivity")
    time.sleep(2)
    r.forward()
    guard = v.Guard(fake=fake, file_to_set=None)
    guard.start()
    raw = os.path.join(HERE, f"rec_raw_f_{name}.mp4")
    try:
        v.seed_v2()
        r.ev("setTimeout(()=>{location.href=%s},50); 1" % json.dumps(sc["path"]))
        time.sleep(14)
        if sc.get("tab"):
            r.ev("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes(%s)).click(); 1" % json.dumps(sc["tab"], ensure_ascii=False))
            for _ in range(25):
                time.sleep(1)
                n = r.ev("document.querySelectorAll('[data-recipe-card-index]').length")
                if isinstance(n, int) and n >= 10:
                    break
            time.sleep(2)
        r.ev("window.scrollTo(0,0); 1")
        time.sleep(1.5)
        _adb_taps(sc)
        rec, res, lat = r.run_timeline(sc["js"], seconds=sc["seconds"])
        rec.pull(raw)
        res["latency"] = lat
        time.sleep(1)
        res["guard"] = guard.report()
    finally:
        guard.stop()
    json.dump(res, open(os.path.join(HERE, f"rec_f_{name}.json"), "w"), ensure_ascii=False)
    print(json.dumps(res, ensure_ascii=False))
    r.Recorder.encode(raw, os.path.join(PUB, f"demo_{name}.mp4"))
    print("saved", name)


if __name__ == "__main__":
    for n in sys.argv[1:]:
        run(n)
