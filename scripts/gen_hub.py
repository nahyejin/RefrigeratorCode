"""아티팩트 두 장으로 정리(2026-10-29 사용자: 아티팩트가 다섯 개라 관리가 어렵다 → 「만들 때 보는 프롬프트」 / 「올릴 때 보는 본문」).

    PYTHONUTF8=1 python scripts/gen_hub.py

  · scripts/hub_make.html  — 만들기: 후킹 영상(제미나이 연기) v7 + 출연자 셀카형 프롬프트. 아직 안 만든 편이 위, 다 만든 편은 접어 둔다.
  · scripts/hub_post.html  — 올리기: 인스타 릴스(일정표·요리 릴스·셀카형) + 스레드 글을 날짜순 한 목록으로. 본문·첫 답글 복사.
    「올렸어요」 체크는 아티팩트 db(collection `posted`, 문서 id = 항목 id)에 저장해서 다시 열어도 남는다
    (예전 페이지는 브라우저 저장이라 새로 열면 초기화됐다 — 사용자 지적).

원본(직접 고치지 말고 원본을 고친 뒤 이 스크립트를 다시 돌린다):
  후킹 프롬프트 scripts/gen_reel_hooks_v7.py · 셀카형 scripts/gen_reel_talk_v2.py · 스레드 scripts/gen_threads_posts.py
  릴스 일정·본문 store/REEL_UPLOAD_PLAN.html(옛 일정표 아티팩트를 내려받은 것) · 요리 릴스 본문 store/COOKING_REEL_CAPTIONS.md
"""
import html
import json
import re
import sys
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
import gen_reel_hooks_v7 as hooks  # noqa: E402
import gen_reel_talk_v2 as talk  # noqa: E402
import gen_threads_posts as threads  # noqa: E402

# 다 만든 편(영상이 out/ 에 있음). 새로 만들면 여기에 번호를 더한다.
HOOK_DONE = {"02", "03", "04", "06", "07"}
TALK_DONE = {"01", "02"}

ROUND_NAME = {"-1": "총정리", "0": "1벌", "1": "2벌", "2": "3벌", "3": "직접 요리", "4": "4벌"}


def make_data():
    hook_cards = []
    for c in hooks.CLIPS:
        hook_cards.append({
            "no": c["no"], "title": c["title"], "feature": c["kbf"], "done": c["no"] in HOOK_DONE,
            "why": c["why"], "hook": c["hook"], "hookKind": c["hook_kind"], "demo": c["demo"],
            "copies": [
                {"label": "영상 프롬프트", "text": hooks.clip_prompt(c), "main": True},
                {"label": "첫 장면 이미지", "text": hooks.image_prompt(c)},
                {"label": "대사 없는 버전", "text": hooks.clip_prompt(c, True)},
            ] + ([{"label": "추가 컷(냉장고 안쪽)", "text": c["extra"]}] if c.get("extra") else []),
        })
    talk_cards = []
    for e in talk.EPISODES:
        p = talk.presenter(e)
        talk_cards.append({
            "no": e["no"], "title": e["title"].replace(" / ", " "), "feature": e["feature"], "done": e["no"] in TALK_DONE,
            "why": e["story"], "hook": e["title"].replace(" / ", "\n"), "hookKind": e["strategy"],
            "who": p["name"], "lines": [c[0] for c in e["clips"]],
            "copies": [{"label": "① 출연자 사진", "text": talk.photo_prompt(e), "main": True}]
            + [{"label": f"클립 {i + 1}", "text": talk.clip_prompt(e, i)} for i in range(3)],
        })
    return {"hooks": hook_cards, "talks": talk_cards}


def plan_items():
    s = (ROOT / "store/REEL_UPLOAD_PLAN.html").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r'<article class="post"([^>]*)>(.*?)</article>', s, re.S):
        a, b = m.group(1), m.group(2)
        attr = lambda k: (re.search(k + r'="([^"]*)"', a) or [None, ""])[1]
        txt = lambda pat: html.unescape(re.sub(r"<[^>]+>", "", (re.search(pat, b, re.S) or [None, ""])[1])).strip()
        rnd = attr("data-round")
        out.append({
            "id": attr("data-id"), "ch": "reel", "kind": ROUND_NAME.get(rnd, ""), "date": attr("data-date"),
            "time": txt(r'class="time">(.*?)<'), "title": txt(r"<h3>(.*?)</h3>"), "scene": txt(r'<p class="scene">(.*?)</p>'),
            "tag": txt(r'class="tag">(.*?)<'), "file": html.unescape((re.search(r'class="file" title="([^"]*)"', b) or [None, ""])[1]),
            "music": txt(r'<span class="mood">(.*?)</span>'), "body": html.unescape(re.search(r'<pre class="cap">(.*?)</pre>', b, re.S).group(1)),
        })
    return out


def cooking_items():
    s = (ROOT / "store/COOKING_REEL_CAPTIONS.md").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r"^## (\d{4}-\d{2}-\d{2}) · (.+?)\n(.*?)(?=^## |\Z)", s, re.S | re.M):
        day, name, rest = m.groups()
        f = re.search(r"영상: `([^`]+)`", rest)
        body = re.search(r"```\n(.*?)```", rest, re.S)
        out.append({"id": "k" + day.replace("-", ""), "ch": "reel", "kind": "직접 요리", "date": day, "time": "", "title": name,
                    "scene": "직접 요리한 영상 + 쿡매치 화면", "tag": "실제 요리", "file": f.group(1) if f else "",
                    "music": "음악이 들어 있는 파일이에요.", "body": body.group(1).strip() if body else ""})
    return out


TALK_FILES = {"01": "my-video/out/출연자형/Talk01Matching_음악.mp4", "02": "my-video/out/출연자형/talk02_kim_music.mp4"}


def talk_items():
    out = []
    for e in talk.EPISODES:
        if e["no"] not in TALK_DONE:
            continue
        out.append({"id": "t" + e["no"], "ch": "reel", "kind": "셀카형", "date": "", "time": "", "title": e["title"].replace(" / ", " "),
                    "scene": e["story"], "tag": e["feature"], "file": TALK_FILES.get(e["no"], ""),
                    "music": "음악이 들어 있는 파일이에요(「이 밖에도」부터).", "body": talk.caption(e)})
    return out


THREADS_START = date(2026, 10, 29)  # 첫 글을 올린 날. 「N일」 = 첫 글 다음 N일째.


def thread_items():
    out = []
    for i, (day, kind, photo, body, reply, note) in enumerate(threads.POSTS):
        out.append({"id": f"th{i}", "ch": "threads", "kind": "스레드 · " + kind, "date": (THREADS_START + timedelta(days=i)).isoformat(),
                    "time": "", "title": body.split("\n")[0], "scene": "사진: " + photo, "tag": "", "file": "", "music": "",
                    "body": body, "reply": reply, "note": note})
    later = [{"id": f"thL{i}", "ch": "threads", "kind": "스레드 · 3주 차", "date": "", "time": "", "title": t, "scene": d,
              "tag": "", "file": "", "music": "", "body": "", "reply": "", "note": "글은 2주 회고 반응을 보고 같이 씁니다."}
             for i, (t, d) in enumerate(threads.LATER)]
    return out + later


def post_data():
    items = plan_items() + cooking_items() + talk_items() + thread_items()
    seen = set()
    for it in items:
        assert it["id"] not in seen, it["id"]
        seen.add(it["id"])
    return {"items": items}


def render(tpl, data, out):
    t = (ROOT / "scripts" / tpl).read_text(encoding="utf-8")
    (ROOT / "scripts" / out).write_text(t.replace("/*DATA*/null", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")),
                                         encoding="utf-8", newline="\n")


if __name__ == "__main__":
    render("hub_make_template.html", make_data(), "hub_make.html")
    pd = post_data()
    render("hub_post_template.html", pd, "hub_post.html")
    print("ok make + post", len(pd["items"]))
