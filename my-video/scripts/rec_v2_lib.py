# -*- coding: utf-8 -*-
"""기능영상 v2(2026-11-08) 녹화 도구 — rec_lib.py 위에 얹는다.

- CDP 연결 하나를 녹화 내내 열어 두고(`Cdp`), `Page.addScriptToEvaluateOnNewDocument` 로 AI 요청 가짜 응답(fetch 가로채기)을
  페이지가 새로 뜰 때마다 먼저 심는다. 가로채지 못한 AI POST(쿡 픽·식단 짜기·쿡 코치·사진 인식)는 막는다 → 크레딧·서버 AI 호출 없음.
- 레시피 데이터는 실제 서버 GET(/api/recipes/filter)만 쓴다.
- 냉장고 샘플은 스토어 v3 캡처와 같은 재료(소비기한은 오늘 기준으로 매번 계산).
"""
import datetime, json, os, time, urllib.request
import requests, websocket
import rec_lib as r

PROD = "https://refrigeratorcode-production.up.railway.app"
HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "..", "public")


def day(n):
    return (datetime.date.today() + datetime.timedelta(days=n)).isoformat()


def fridge():
    return {
        "frozen": [{"name": "삼겹살", "expiry": day(40)}, {"name": "만두", "expiry": day(60)}],
        "fridge": [
            {"name": "두부", "expiry": day(2)}, {"name": "달걀", "expiry": day(12)}, {"name": "대파", "expiry": day(3)},
            {"name": "김치", "expiry": day(30)}, {"name": "애호박", "expiry": day(4)}, {"name": "양파", "expiry": day(20)},
            {"name": "당근", "expiry": day(15)}, {"name": "우유", "expiry": day(5)}, {"name": "버터", "expiry": day(40)},
        ],
        "room": [{"name": "감자", "expiry": day(25)}, {"name": "간장"}, {"name": "고춧가루"}, {"name": "참기름"},
                 {"name": "밀가루"}, {"name": "설탕"}, {"name": "소금"}, {"name": "식용유"}],
    }


EXPIRING = ["두부", "대파", "애호박", "우유"]


def my_names():
    return ",".join(x["name"] for k in fridge().values() for x in k)


def pool(n=60, extra=None):
    p = {"my_ingredients": my_names(), "sort_by": "match_rate", "size": str(n), "page": "1", "applied_expiry_ingredients": ",".join(EXPIRING)}
    if extra:
        p.update(extra)
    return requests.get(PROD + "/api/recipes/filter", params=p, timeout=90).json()["recipes"]


def mock_src(mocks):
    return (
        "(()=>{const M=%s;const of=window.fetch;window.fetch=function(u,i){try{const s=String(typeof u==='string'?u:(u&&u.url)||'');"
        "const meth=((i&&i.method)||'GET').toUpperCase();"
        "for(const m of M){if(new RegExp(m.match).test(s)&&meth===(m.method||'POST')){return new Promise(r=>setTimeout(()=>r(new Response(JSON.stringify((()=>{let b=m.body;for(const a of (m.alts||[])){if(new RegExp(a['if']).test(String((i&&i.body)||''))){b=a.body;}}return b;})()),{status:m.status||200,headers:{'Content-Type':'application/json'}})),m.delay||400));}}"
        "if(/\\/api\\/(chat|plan\\/suggest|recipes\\/[0-9]+\\/ask|ingredients\\/recognize)/.test(s)&&meth==='POST'){return Promise.reject(new TypeError('blocked'));}"
        "}catch(e){if(e instanceof TypeError&&e.message==='blocked')throw e;}return of.apply(this,arguments)}})();"
    ) % json.dumps(mocks, ensure_ascii=False)


# 말하기(TTS) 막기 — 에뮬레이터 스피커로 소리가 나지 않게(녹화는 무음)
NO_TTS = "try{window.speechSynthesis.speak=function(u){try{u.onstart&&u.onstart();}catch(e){} setTimeout(()=>{try{u.onend&&u.onend()}catch(e){}},2600)};}catch(e){}"


class Cdp:
    def __init__(self):
        r.forward()
        pages = json.load(urllib.request.urlopen("http://localhost:9222/json"))
        page = [p for p in pages if p["type"] == "page"][0]
        self.w = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=120, suppress_origin=True)
        self.n = 0

    def call(self, method, params=None):
        self.n += 1
        mid = self.n
        self.w.send(json.dumps({"id": mid, "method": method, "params": params or {}}))
        while True:
            m = json.loads(self.w.recv())
            if m.get("id") == mid:
                return m

    def on_new_doc(self, src):
        self.call("Page.enable")
        return self.call("Page.addScriptToEvaluateOnNewDocument", {"source": src})

    def ev(self, js):
        m = self.call("Runtime.evaluate", {"expression": js, "awaitPromise": True, "returnByValue": True})
        res = m.get("result", {})
        if "exceptionDetails" in res:
            return "EXC " + json.dumps(res["exceptionDetails"], ensure_ascii=False)[:300]
        return res.get("result", {}).get("value")

    def goto(self, path, wait=9):
        self.ev("setTimeout(()=>{location.href=%s},50); 1" % json.dumps(path))
        time.sleep(wait)

    def close(self):
        try:
            self.w.close()
        except Exception:
            pass


def with_seed_ids(f):
    """앱이 「처음부터 있던 샘플 재료」로 보는 id(`fridge-<시각>-<번호>`)를 붙인다 — 비회원 3개 제한에 안 걸리게."""
    t = int(time.time() * 1000)
    out = {}
    for k, items in f.items():
        out[k] = [dict(x, id=x.get("id") or f"{k}-{t}-{i}") for i, x in enumerate(items)]
    return out


def base_storage(extra=None):
    """첫 실행 안내·설치 권유 같은 팝업을 끄고 냉장고 샘플을 넣는다."""
    d = {
        "myfridge_ingredients": json.dumps(with_seed_ids(fridge()), ensure_ascii=False),
        "usage_guide_never_show": "true", "expiry_push_prompt_seen": "true", "home_install_prompt_never_show": "true",
        "welcome_modal_shown": "true", "myfridge_guide_shown": "true", "last_visit_at": datetime.datetime.now().isoformat(),
    }
    if extra:
        d.update(extra)
    return "(()=>{const D=%s; for(const k in D) localStorage.setItem(k,D[k]); localStorage.removeItem('recipe_sortbar_state_fridge'); localStorage.removeItem('recipe_sortbar_state_popular'); localStorage.removeItem('cookmatch_ai_chat'); localStorage.removeItem('cookmatch_recent_recipe_conditions_v1'); sessionStorage.clear(); return 1})()" % json.dumps(d, ensure_ascii=False)


def setup(mocks=None, extra_storage=None, path="/", wait=10, extra_src=""):
    c = Cdp()
    c.on_new_doc(mock_src(mocks or []) + NO_TTS + extra_src)
    c.ev(base_storage(extra_storage))
    c.goto(path, wait)
    return c


def record(name, js_body, seconds=60):
    rec, res, lat = r.run_timeline(js_body, seconds=seconds)
    raw = os.path.join(HERE, f"rec_raw_{name}.mp4")
    rec.pull(raw)
    out = os.path.join(PUBLIC, f"{name}.mp4")
    r.Recorder.encode(raw, out)
    res["latency"] = lat
    json.dump(res, open(os.path.join(HERE, f"rec_{name}.json"), "w", encoding="utf-8"), ensure_ascii=False)
    print(name, json.dumps(res, ensure_ascii=False)[:600])
    return res


def screencap(path):
    import subprocess
    with open(path, "wb") as f:
        subprocess.run([r.ADB, "exec-out", "screencap", "-p"], stdout=f)
