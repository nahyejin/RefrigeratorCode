"""스레드 API 토큰 받기(대시보드 「액세스 토큰 생성하기」가 안 될 때 쓰는 직접 로그인 방식).

    python scripts/threads_auth.py

.env.threads(깃에 안 올라감)에 아래 세 줄을 넣어 두고 돌린다. 채팅에는 붙이지 않는다.
    THREADS_APP_ID=2068159973895457
    THREADS_APP_SECRET=...      # 개발자 사이트 → 이용 사례 → Threads 맞춤 설정 → 설정 → 시크릿 코드 「보기」
    THREADS_CODE=...            # 로그인·허용 뒤 넘어간 주소의 ?code= 뒤 값(#_ 앞까지). 한 번만·1시간 안에 써야 한다.
code → 단기 토큰 → 60일 토큰으로 바꿔 THREADS_TOKEN 줄에 써 넣고, 쓴 code 줄은 지운다.
"""
import json
import urllib.parse
import urllib.request
from pathlib import Path

ENV = Path(__file__).resolve().parent.parent / ".env.threads"
REDIRECT = "https://refrigerator-code.vercel.app/"


def load():
    out = {}
    for line in ENV.read_text(encoding="utf-8-sig").splitlines():
        if "=" in line and not line.strip().startswith("#"):
            k, v = line.split("=", 1)
            out[k.strip()] = v.strip()
    return out


def call(url, data=None):
    body = urllib.parse.urlencode(data).encode() if data else None
    try:
        with urllib.request.urlopen(urllib.request.Request(url, data=body), timeout=30) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise SystemExit("스레드 응답 오류: " + e.read().decode("utf-8", "replace"))


def main():
    env = load()
    code = env["THREADS_CODE"].split("#")[0]
    short = call("https://graph.threads.net/oauth/access_token", {
        "client_id": env["THREADS_APP_ID"], "client_secret": env["THREADS_APP_SECRET"],
        "grant_type": "authorization_code", "redirect_uri": REDIRECT, "code": code})
    long_ = call("https://graph.threads.net/access_token?" + urllib.parse.urlencode({
        "grant_type": "th_exchange_token", "client_secret": env["THREADS_APP_SECRET"],
        "access_token": short["access_token"]}))
    token = long_["access_token"]
    me = call("https://graph.threads.net/v1.0/me?" + urllib.parse.urlencode({"fields": "id,username", "access_token": token}))
    keep = [l for l in ENV.read_text(encoding="utf-8-sig").splitlines()
            if not l.startswith(("THREADS_CODE", "THREADS_TOKEN"))]
    ENV.write_text("\n".join(keep + [f"THREADS_TOKEN={token}"]) + "\n", encoding="utf-8")
    print(f"연결됨: @{me.get('username')} · 토큰 {long_.get('expires_in', 0) // 86400}일짜리 저장")


if __name__ == "__main__":
    main()
