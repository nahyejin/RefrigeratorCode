"""스레드 자동화 — 새 댓글 모으기 / 검토 끝난 답글·새 글 올리기.

    python scripts/threads_bot.py fetch            # 내가 아직 답 안 한 남의 답글 → JSON 출력
    python scripts/threads_bot.py post FILE.json   # 승인된 항목 올리기 → 결과 JSON 출력
    python scripts/threads_bot.py stats            # 최근 글 조회·답글·좋아요

토큰은 .env.threads 의 THREADS_TOKEN(깃 무시). 값은 절대 출력하지 않는다.
post 입력 = [{"id": 검토 문서 id, "kind": "reply"|"post", "text": ..., "reply_to": 답글 id(reply만),
              "image_url": 공개 이미지 주소(post에서 선택), "first_reply": 올린 뒤 바로 달 첫 답글(post에서 선택)}]
"""
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ENV = Path(__file__).resolve().parent.parent / ".env.threads"
API = "https://graph.threads.net/v1.0/"
ME = "yoalmot.mom"


def token():
    for line in ENV.read_text(encoding="utf-8-sig").splitlines():
        if line.startswith("THREADS_TOKEN="):
            return line.split("=", 1)[1].strip()
    raise SystemExit(".env.threads 에 THREADS_TOKEN 이 없어요")


def call(path, method="GET", **q):
    q["access_token"] = token()
    data = urllib.parse.urlencode(q)
    url = API + path + ("?" + data if method == "GET" else "")
    req = urllib.request.Request(url, data=data.encode() if method == "POST" else None, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:
        raise RuntimeError(e.read().decode("utf-8", "replace"))


def my_posts(limit=15):
    return call("me/threads", fields="id,text,timestamp,permalink", limit=limit)["data"]


def fetch():
    """최근 내 글들의 대화에서, 남이 쓴 답글 중 내가 아직 답 안 한 것."""
    out = []
    for p in my_posts():
        conv = call(p["id"] + "/conversation", fields="id,text,username,timestamp,replied_to", reverse="false").get("data", [])
        byid = {c["id"]: c for c in conv}
        mine = [c for c in conv if c.get("username") == ME and c.get("replied_to")]
        for c in conv:
            if c.get("username") == ME:
                continue
            # 답한 것 = 이 답글에 직접 답했거나, 이 답글 뒤에 같은 사람의 다른 답글에 답함
            # (폰에서 맨 위 답글에 한꺼번에 답하는 경우가 많다)
            if any(m["replied_to"]["id"] == c["id"] or
                   (m["timestamp"] > c["timestamp"] and byid.get(m["replied_to"]["id"], {}).get("username") == c.get("username"))
                   for m in mine):
                continue
            parent = byid.get((c.get("replied_to") or {}).get("id"))
            out.append({
                "id": c["id"], "username": c.get("username"), "text": c.get("text") or "",
                "timestamp": c.get("timestamp"), "post_id": p["id"], "post_text": p.get("text") or "",
                "permalink": p.get("permalink"),
                # 내 답글에 다시 단 답이면 그 맥락도 같이
                "parent_text": parent.get("text") if parent else None,
                "parent_user": parent.get("username") if parent else None,
            })
    return out


def wait_ready(cid):
    for _ in range(30):
        st = call(cid, fields="status,error_message")
        if st.get("status") == "FINISHED":
            return
        if st.get("status") in ("ERROR", "EXPIRED"):
            raise RuntimeError(st.get("error_message") or st.get("status"))
        time.sleep(2)
    raise RuntimeError("컨테이너 준비 시간 초과")


def publish(item):
    q = {"text": item["text"]}
    if item["kind"] == "reply":
        q.update(media_type="TEXT", reply_to_id=item["reply_to"])
    elif item.get("image_url"):
        q.update(media_type="IMAGE", image_url=item["image_url"])
    else:
        q.update(media_type="TEXT")
    cid = call("me/threads", "POST", **q)["id"]
    wait_ready(cid)
    mid = call("me/threads_publish", "POST", creation_id=cid)["id"]
    link = call(mid, fields="permalink").get("permalink")
    if item["kind"] == "post" and item.get("first_reply"):  # 가이드: 결론·다음 편 예고는 올리자마자 첫 답글로
        time.sleep(5)
        publish({"id": item["id"], "kind": "reply", "text": item["first_reply"], "reply_to": mid})
    return {"id": item["id"], "ok": True, "media_id": mid, "permalink": link}


def post(path):
    res = []
    for item in json.loads(Path(path).read_text(encoding="utf-8")):
        try:
            res.append(publish(item))
        except Exception as e:  # 하나 실패해도 나머지는 계속
            res.append({"id": item["id"], "ok": False, "error": str(e)[:300]})
    return res


def stats():
    out = []
    for p in my_posts(10):
        ins = call(p["id"] + "/insights", metric="views,likes,replies,reposts,quotes,shares")["data"]
        out.append({"id": p["id"], "date": p["timestamp"][:10], "first_line": (p.get("text") or "").split("\n")[0],
                    **{i["name"]: i["values"][0]["value"] for i in ins}})
    return out


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd = sys.argv[1] if len(sys.argv) > 1 else "fetch"
    result = {"fetch": fetch, "stats": stats}.get(cmd)
    print(json.dumps(result() if result else post(sys.argv[2]), ensure_ascii=False, indent=1))
