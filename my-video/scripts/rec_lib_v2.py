# -*- coding: utf-8 -*-
"""기능영상 재제작(2026-11-08)용 녹화 도구 — `rec_lib.py` 위에 얹는 보호막·준비 도구. 원본 `rec_lib.py` 는 그대로 둔다.

핵심은 **Guard**: 녹화하는 동안 앱 웹뷰의 네트워크를 CDP `Fetch` 도메인으로 붙잡아,
  - GET/HEAD/OPTIONS(레시피·사전 읽기)는 그대로 통과,
  - 그 밖의 모든 요청(POST/PUT/PATCH/DELETE — AI 호출(크레딧)·방문 기록·사용 통계·사진 인식 등)은 서버로 **보내지 않고**
    가짜 200 응답으로 막는다. `fake` 에 {URL 조각: 응답 JSON} 을 주면 그 요청만 가짜 응답을 돌려준다(AI 화면 녹화용).
  - 막은 요청은 `guard.blocked` 에 남아, 녹화 뒤 「실제로 나간 쓰기 요청이 0건」임을 보고할 수 있다.
CDP 연결을 하나 계속 열어 두므로(페이지가 새로고침돼도 유지) 시작 직후의 요청도 놓치지 않는다.
과거에 실제 AI 호출이 나간 사고가 있었다 — AI 화면을 찍는 스크립트는 반드시 이걸 먼저 켜고, 끝에 `guard.report()` 를 확인할 것.
"""
import json, threading, time, urllib.request
import websocket
import rec_lib as r

READ_METHODS = {"GET", "HEAD", "OPTIONS"}


class Guard:
    def __init__(self, fake=None, file_to_set=None):
        self.file_to_set = file_to_set  # 파일 선택창이 열리면 시스템 선택기 대신 이 기기 경로의 파일을 넣어 준다(사진 인식 녹화용)
        self.fake = fake or {}          # {URL 조각: (상태코드, 응답 객체[, 지연초])} 또는 함수(req)->같은 튜플 — 이 URL 의 쓰기 요청은 가짜 응답
        self.blocked = []               # [(method, url)] 서버로 안 보내고 막은 쓰기 요청
        self.faked = []                 # 가짜 응답을 돌려준 요청
        self.passed_reads = 0
        self.ws = None
        self._id = 100
        self._lock = threading.Lock()
        self._stop = False

    # -- CDP 보내기
    def _send(self, method, params=None):
        with self._lock:
            self._id += 1
            self.ws.send(json.dumps({"id": self._id, "method": method, "params": params or {}}))
            return self._id

    def start(self):
        pages = json.load(urllib.request.urlopen("http://localhost:9222/json"))
        page = [p for p in pages if p["type"] == "page"][0]
        self.ws = websocket.create_connection(page["webSocketDebuggerUrl"], timeout=30, suppress_origin=True)
        self._send("Page.enable")
        if self.file_to_set:
            self._send("Page.setInterceptFileChooserDialog", {"enabled": True})
        # 모든 요청을 붙잡는다(URL 패턴 *). 읽기는 바로 통과시킨다.
        self._send("Fetch.enable", {"patterns": [{"urlPattern": "*", "requestStage": "Request"}]})
        self.thread = threading.Thread(target=self._loop, daemon=True)
        self.thread.start()
        time.sleep(0.5)

    def stop(self):
        self._stop = True
        try:
            self._send("Fetch.disable")
            time.sleep(0.3)
            self.ws.close()
        except Exception:
            pass

    def _loop(self):
        self.ws.settimeout(1.0)
        while not self._stop:
            try:
                msg = json.loads(self.ws.recv())
            except websocket.WebSocketTimeoutException:
                continue
            except Exception:
                break
            if msg.get("method") == "Page.fileChooserOpened" and self.file_to_set:
                bid = msg["params"].get("backendNodeId")
                self._send("DOM.setFileInputFiles", {"files": [self.file_to_set], "backendNodeId": bid})
                continue
            if msg.get("method") != "Fetch.requestPaused":
                continue
            p = msg["params"]
            rid = p["requestId"]
            req = p["request"]
            method, url = req["method"], req["url"]
            if method in READ_METHODS:
                self.passed_reads += 1
                self._send("Fetch.continueRequest", {"requestId": rid})
                continue
            hit = next((v for k, v in self.fake.items() if k in url), None)
            if callable(hit):
                hit = hit(req)
            origin = req.get("headers", {}).get("Origin") or req.get("headers", {}).get("origin") or "https://localhost"
            headers = [
                {"name": "Content-Type", "value": "application/json"},
                {"name": "Access-Control-Allow-Origin", "value": origin},
                {"name": "Access-Control-Allow-Credentials", "value": "true"},
            ]
            import base64
            if hit is not None:
                code, obj = hit[0], hit[1]
                delay = hit[2] if len(hit) > 2 else 0   # 로딩 화면이 보이도록 응답을 늦춘다(초)
                self.faked.append((method, url))
                body = json.dumps(obj, ensure_ascii=False)
            else:
                code, body, delay = 200, "{}", 0
                self.blocked.append((method, url))
            params = {"requestId": rid, "responseCode": code, "responseHeaders": headers,
                      "body": base64.b64encode(body.encode("utf-8")).decode()}
            if delay:
                threading.Timer(delay, lambda p=params: self._send("Fetch.fulfillRequest", p)).start()
            else:
                self._send("Fetch.fulfillRequest", params)

    def report(self):
        return {"blocked_writes": len(self.blocked), "faked": len(self.faked), "passed_reads": self.passed_reads,
                "blocked_list": [f"{m} {u[:110]}" for m, u in self.blocked[:20]],
                "faked_list": [f"{m} {u[:110]}" for m, u in self.faked[:20]]}


def clean_start(wait=20, tab="냉장고요리"):
    """깨끗한 시작: 필터 기본값·열린 시트 없음 → 새로고침 → 아래 탭 → 레시피 카드가 뜰 때까지.
    (rec_lib.prepare_recipe_list 와 같지만 탭 이름을 고를 수 있다.)"""
    # 「다시 와 주셨네요」 로그인 확인창(utils/loginGate.ts)이 비회원 2번째 방문에 뜬다 — 방금 띄운 것으로 표시해 7일간 막는다(첫 레시피 열람 뒤의 「이 냉장고, 저장해 둘까요?」 `cookmatch_save_prompt_at` 도 같게).
    r.ev("localStorage.removeItem('recipe_sortbar_state_fridge'); localStorage.removeItem('recipe_sortbar_state_popular'); sessionStorage.clear(); localStorage.setItem('cookmatch_return_gate_at', String(Date.now())); localStorage.setItem('cookmatch_save_prompt_at', String(Date.now())); 1")
    r.ev("setTimeout(()=>location.reload(),50); 1")
    time.sleep(12)
    r.ev("[...document.querySelectorAll('nav button')].find(x=>x.textContent.includes(%s)).click(); 1" % json.dumps(tab, ensure_ascii=False))
    for _ in range(int(wait)):
        time.sleep(1)
        n = r.ev("document.querySelectorAll('[data-recipe-card-index]').length")
        if isinstance(n, int) and n >= 10:
            break
    time.sleep(2)
    r.ev("window.scrollTo(0,0); 1")
    time.sleep(1)
    return r.ev("document.querySelectorAll('[data-recipe-card-index]').length")


def seed_v2():
    js = open(__import__('os').path.join(__import__('os').path.dirname(__file__), "seed_fridge_v2.js"), encoding="utf-8").read()
    return r.ev(js)


def encode_v2(raw, out):
    """상태바·내비 줄을 잘라 940x1920, 30fps 고정 프레임(기존 rec_lib.Recorder.encode 와 같은 크롭)."""
    r.Recorder.encode(raw, out)
