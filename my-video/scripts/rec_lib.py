# -*- coding: utf-8 -*-
"""안드로이드 에뮬레이터(cookmatch_pixel)에서 쿡매치 앱 화면을 녹화하는 도구 모음.

앱(웹뷰)은 원격 디버깅(CDP, localhost:9222)으로 읽고 조작하고, 화면은 `adb screenrecord` 로 녹화한다.
녹화본은 안드로이드 상태바(위 132px)와 내비게이션 줄(아래)을 잘라 940x1920 · 30fps 고정 프레임으로
다시 인코딩한다(릴스 컴포지션이 940x1920 박스에 넣어 쓴다).
"""
import json, os, subprocess, sys, time, urllib.request
import websocket

ADB = os.path.expandvars(r"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe")
FFMPEG = "ffmpeg"
DPR = 2.625
WEBVIEW_TOP = 132     # 상태바 높이(px)
WEBVIEW_H = 2205      # 웹뷰 높이(px) — 그 아래는 내비게이션 줄


def sh(*args, **kw):
    return subprocess.run([ADB, *args], capture_output=True, **kw)


def forward():
    pid = sh("shell", "pidof", "kr.cookmatch.app").stdout.decode().strip()
    sh("forward", "--remove-all")
    sh("forward", "tcp:9222", f"localabstract:webview_devtools_remote_{pid}")
    return pid


def ev(js, await_promise=True):
    pages = json.load(urllib.request.urlopen("http://localhost:9222/json"))
    page = [p for p in pages if p["type"] == "page"][0]
    w = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=60, suppress_origin=True)
    w.send(json.dumps({"id": 1, "method": "Runtime.evaluate", "params": {"expression": js, "awaitPromise": await_promise, "returnByValue": True}}))
    while True:
        r = json.loads(w.recv())
        if r.get("id") == 1:
            w.close()
            res = r.get("result", {})
            if "exceptionDetails" in res:
                return "EXC " + json.dumps(res["exceptionDetails"], ensure_ascii=False)[:300]
            return res.get("result", {}).get("value")


def tap(x, y):
    sh("shell", "input", "tap", str(int(x)), str(int(y)))


def rect(js_expr):
    """DOM 요소(JS 식)의 화면 좌표 [left, top, right, bottom] (기기 px, 상태바 포함)."""
    v = ev("(()=>{const e=%s; if(!e) return null; const r=e.getBoundingClientRect(); const d=devicePixelRatio; return JSON.stringify([r.left*d, r.top*d+%d, r.right*d, r.bottom*d+%d])})()" % (js_expr, WEBVIEW_TOP, WEBVIEW_TOP))
    return json.loads(v) if v and not str(v).startswith("EXC") else None


def tap_el(js_expr):
    r = rect(js_expr)
    if not r:
        return False
    tap((r[0] + r[2]) / 2, (r[1] + r[3]) / 2)
    return True


def by_text(sel, text, exact=True):
    cond = "x.textContent.trim()===%s" % json.dumps(text) if exact else "x.textContent.includes(%s)" % json.dumps(text)
    return "[...document.querySelectorAll(%s)].find(x=>%s)" % (json.dumps(sel), cond)


def smooth_scroll(y, wait=1.2):
    ev("window.scrollTo({top:%d,behavior:'smooth'}); 1" % y)
    time.sleep(wait)


class Recorder:
    def __init__(self, name, seconds=60):
        self.name = name
        self.remote = f"/sdcard/{name}.mp4"
        self.proc = None
        self.t0 = None
        self.marks = {}
        self.seconds = seconds

    def start(self):
        self.proc = subprocess.Popen([ADB, "shell", "screenrecord", "--time-limit", str(self.seconds), "--bit-rate", "16000000", "--size", "1080x2400", self.remote])
        time.sleep(0.8)
        self.t0 = time.time()

    def mark(self, label):
        self.marks[label] = round(time.time() - self.t0, 2)
        return self.marks[label]

    def stop(self):
        sh("shell", "pkill", "-2", "screenrecord")
        if self.proc:
            self.proc.wait(timeout=30)
        time.sleep(1.5)

    def pull(self, local_raw):
        sh("pull", self.remote, local_raw)

    @staticmethod
    def encode(raw, out):
        """상태바·내비게이션 줄을 잘라 940x1920, 30fps 고정 프레임으로."""
        vf = f"crop=1080:{WEBVIEW_H}:0:{WEBVIEW_TOP},scale=940:1920,fps=30"
        subprocess.run([FFMPEG, "-v", "error", "-y", "-i", raw, "-vf", vf, "-c:v", "libx264", "-crf", "16", "-pix_fmt", "yuv420p", "-an", out], check=True)


def seed(extra_ingredients=None):
    js = open(os.path.join(os.path.dirname(__file__), "seed_fridge.js"), encoding="utf-8").read()
    return ev(js)


def run_timeline(js_body, seconds=70, poll=1.0):
    """화면 안에서 타임라인(JS)을 돌리면서 녹화한다 — 파이썬 ↔ 에뮬레이터 왕복 지연(수 초)이 타이밍에 안 끼게.

    `js_body` 는 `async function` 안에서 실행되는 코드. `sleep(ms)` · `mark(이름)` · `M`(표식 모음) · `click(요소)` ·
    `byText(선택자, 글자)` 를 쓸 수 있고, `return` 값은 `window.__result` 로 남는다.
    녹화 시작 → 타임라인 시작 → 끝날 때까지 기다림 → 녹화 종료. 표식(ms)과 결과를 돌려준다.
    """
    prelude = """
      window.__done=false; window.__result=null; window.__M={};
      (async()=>{
        const sleep=ms=>new Promise(r=>setTimeout(r,ms));
        const t0=performance.now(); const M=window.__M;
        const mark=k=>{M[k]=Math.round(performance.now()-t0)};
        const click=el=>{ if(!el) throw new Error('no element'); el.click(); };
        const byText=(sel,text,exact=true)=>[...document.querySelectorAll(sel)].find(x=>exact?x.textContent.trim()===text:x.textContent.includes(text));
        try { window.__result = await (async()=>{ %s })(); } catch(e) { window.__result = 'ERR '+e.message; }
        window.__done=true;
      })(); 1
    """ % js_body
    rec = Recorder("tl", seconds)
    rec.start()
    t_send = time.time()
    ev(prelude)
    t_ack = time.time()
    for _ in range(int(seconds / poll)):
        time.sleep(poll)
        d = ev("window.__done")
        if d is True:
            break
    time.sleep(1.0)
    rec.stop()
    res = ev("JSON.stringify({M:window.__M, r:window.__result})")
    return rec, json.loads(res), (t_send - rec.t0, t_ack - rec.t0)


def first_change_time(video, thr=0.004):
    """영상에서 처음으로 화면이 바뀌는 시각(초) — 표식(ms)과 영상 시각을 맞추는 기준."""
    out = subprocess.run([FFMPEG, "-v", "info", "-i", video, "-vf", f"select='gt(scene,{thr})',showinfo", "-an", "-f", "null", "-"], capture_output=True, text=True).stderr
    import re
    ts = [float(m.group(1)) for m in re.finditer(r"pts_time:([0-9.]+)", out)]
    return ts


def prepare_recipe_list(wait=20):
    """깨끗한 시작 상태: 필터 기본값(10%↑)·열린 시트 없음·냉장고요리 맨 위."""
    ev("localStorage.removeItem('recipe_sortbar_state_fridge'); sessionStorage.clear(); 1")
    ev("setTimeout(()=>location.reload(),50); 1")
    time.sleep(12)
    ev("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes('냉장고요리')).click(); 1")
    for _ in range(int(wait / 1)):
        time.sleep(1)
        n = ev("document.querySelectorAll('[data-recipe-card-index]').length")
        if isinstance(n, int) and n >= 10:
            break
    time.sleep(2)
    ev("window.scrollTo(0,0); 1")
    time.sleep(1)
    return ev("document.querySelectorAll('[data-recipe-card-index]').length")
