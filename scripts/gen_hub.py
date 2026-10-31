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
import gen_reel_hooks_v8 as hooks5  # noqa: E402

# 다 만든 편(영상이 out/ 에 있음). 새로 만들면 여기에 번호를 더한다.
HOOK_DONE = {"02", "03", "04", "05", "06", "06B", "07", "08"}
HOOK5_DONE = set()  # 5벌(gen_reel_hooks_v8.py)
TALK_DONE = {"01", "02", "03"}

ROUND_NAME = {"-1": "총정리", "0": "1벌", "1": "2벌", "2": "3벌", "3": "직접 요리", "4": "4벌"}


def hook_card(c, done, hooks=hooks):
    return {
            "no": c["no"], "title": c["title"], "feature": c["kbf"], "done": c["no"] in done,
            "why": c["why"], "hook": c["hook"], "hookKind": c["hook_kind"], "demo": c["demo"],
            "copies": [
                {"label": "영상 프롬프트", "text": hooks.clip_prompt(c), "main": True},
                {"label": "첫 장면 이미지", "text": hooks.image_prompt(c)},
                {"label": "대사 없는 버전", "text": hooks.clip_prompt(c, True)},
            ] + ([{"label": "추가 컷(냉장고 안쪽)", "text": c["extra"]}] if c.get("extra") else []),
        }


def make_data():
    hook_cards = [hook_card(c, HOOK_DONE) for c in hooks.CLIPS]
    # 5벌은 사진을 먼저 만들므로 「첫 장면 이미지」를 첫 버튼으로
    hook5_cards = []
    for c in hooks5.CLIPS:
        h = hook_card(c, HOOK5_DONE)
        h["copies"] = [{"label": "① 첫 장면 사진", "text": hooks.image_prompt(c), "main": True},
                       {"label": "② 영상 프롬프트", "text": hooks.clip_prompt(c), "main": True},
                       {"label": "대사 없는 버전", "text": hooks.clip_prompt(c, True)}]
        hook5_cards.append(h)
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
    return {"hooks5": hook5_cards, "hooks": hook_cards, "talks": talk_cards}


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


FEATURES_TAIL = """쿡매치로 이런 걸 할 수 있어요
📸 AI 재료인식 — 영수증·음식 사진·장본 목록
🥘 레시피 매칭 — 냉장고 재료로 만들 수 있는 레시피 + 대체 재료
🗓️ AI 식단 — 일주일 식단과 장보기
🤖 요리 AI — 말하듯 물어보면 레시피 추천
⏰ 유통기한 알림 — 곧 상하는 재료를 푸시로 알려 줘요
🙌 읽어주기 모드 — 소리 내어 단계별로 레시피를 읽어 줘요
📺 검증된 레시피 — 유튜브·네이버 인기 레시피
👨‍👩‍👧 가족이 아낀 돈 — 가족 집밥 목표·아낀 돈(예상)

📲 앱스토어·Play 스토어에서 '쿡매치'를 검색하세요
프로필 링크로 들어와도 바로 받을 수 있어요
👉 refrigerator-code.vercel.app/download"""

# 일정표(REEL_UPLOAD_PLAN.html) 뒤에 새로 만든 4벌 편. 날짜는 화·목·토 자리를 이어 간다.
EXTRA_REELS = [
    {"id": "h4-5", "ch": "reel", "kind": "4벌", "date": "2026-11-24", "time": "17:00", "title": "“그럼 자기가 먹어”",
     "scene": "냉장고 구석에서 나온 요거트, 날짜를 보니 어제까지. 「하루 지난 건 괜찮지?」 묻자 남편이 「그럼 자기가 먹어」, 아내가 째려보는 장면.",
     "tag": "유통기한 알림", "file": "my-video/out/후킹v6/reel5_hookv6_yogurt_음악.mp4",
     "music": "음악이 이미 들어 있는 파일이에요(밴조 깡충, 직접 만든 곡). 인스타에서 음악을 추가하지 말고 그대로 올리세요.",
     "body": "「어제까지네… 하루 지난 건 괜찮지?」\n「그럼 자기가 먹어.」 🥄\n\n유통기한 하루 지난 요거트, 먹어? 말아?\n쿡매치는 넣어 둔 재료의 유통기한을 알아서 계산하고, 다가오면 알림으로 먼저 알려 줘요.\n임박한 재료로 만들 레시피까지 바로 보여 줘서, 날짜 지나기 전에 다 먹을 수 있어요.\n\n"
             + FEATURES_TAIL + "\n\n#레시피 #레시피추천 #요리 #집밥 #오늘뭐먹지 #냉털 #냉장고털기 #냉장고파먹기 #유통기한 #부부일상 #쿡매치 #cookmatch"},
    {"id": "h4-8", "ch": "reel", "kind": "4벌", "date": "2026-11-26", "time": "17:00", "title": "“그럼 안 아낀 거잖아”",
     "scene": "남편이 집밥을 차리며 「배달보다 이만 원은 아꼈다」 뿌듯해하자, 아내가 「그 돈으로 치킨 시켜 먹자」, 남편이 「…그럼 안 아낀 거잖아」.",
     "tag": "가족 · 아낀 돈", "file": "my-video/out/후킹v6/reel8_hookv7_chicken_음악.mp4",
     "music": "음악이 이미 들어 있는 파일이에요(대사 구간은 음악 없음). 인스타에서 음악을 추가하지 말고 그대로 올리세요.",
     "body": "「오늘 집에서 해 먹으니까 이만 원은 아꼈다.」\n「그럼 그 돈으로 치킨 시켜 먹자.」\n「…그럼 안 아낀 거잖아.」 🍗\n\n집밥으로 아낀 돈, 어디에 쓰세요?\n쿡매치는 집에서 요리할 때마다 배달 대비 아낀 돈(예상)을 쌓아서 보여 주고, 가족이 같이 집밥 목표를 채워 갈 수 있어요.\n\n"
             + FEATURES_TAIL + "\n\n#레시피 #레시피추천 #요리 #집밥 #오늘뭐먹지 #배달비 #식비절약 #부부일상 #쿡매치 #cookmatch"},
    {"id": "h4-6b", "ch": "reel", "kind": "4벌", "date": "2026-11-28", "time": "17:00", "title": "“나 말고 폰한테 물어봐”",
     "scene": "열린 냉장고 앞 남편이 「두부랑 김치 있는데 뭐 해 먹지?」 묻자, 소파의 아내가 폰만 보며 「그거 오늘만 세 번째야… 나 말고 폰한테 물어봐. 걔가 더 잘 알아」.",
     "tag": "요리 AI", "file": "my-video/out/후킹v6/reel6_hookv7_askphone_음악.mp4",
     "music": "음악이 이미 들어 있는 파일이에요(대사 구간은 음악 없음). 인스타에서 음악을 추가하지 말고 그대로 올리세요.",
     "body": "「자기야, 두부랑 김치 있는데 뭐 해 먹지?」\n「그거 오늘만 세 번째야… 나 말고 폰한테 물어봐.」 📱\n\n하루에 몇 번씩 나오는 「뭐 해 먹지?」\n쿡매치 요리 AI에 말하듯 물어보면, 냉장고에 있는 재료로 만들 수 있는 레시피를 골라 줘요.\n\n"
             + FEATURES_TAIL + "\n\n#레시피 #레시피추천 #요리 #집밥 #오늘뭐먹지 #냉털 #냉장고파먹기 #두부요리 #부부일상 #쿡매치 #cookmatch"},
]

TALK_FILES = {"01": "my-video/out/출연자형/Talk01Matching_음악.mp4", "02": "my-video/out/출연자형/talk02_kim_music.mp4", "03": "my-video/out/출연자형/talk03_cookmode_music.mp4"}


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
    items = plan_items() + EXTRA_REELS + cooking_items() + talk_items() + thread_items()
    # 묶음 탭(2026-10-29 사용자: 릴스가 너무 많아 1벌·2벌… 유형별로 고르게)
    grp = {"총정리": "총정리", "1벌": "연기형 1벌", "2벌": "연기형 2벌", "3벌": "연기형 3벌", "4벌": "연기형 4벌", "직접 요리": "직접 요리", "셀카형": "출연자 셀카형"}
    for it in items:
        it["grp"] = "스레드" if it["ch"] == "threads" else grp.get(it["kind"], "기타")
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
