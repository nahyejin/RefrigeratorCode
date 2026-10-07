"""릴스 24편(8편 × 3바퀴)을 올릴 때 붙일 인스타 본문 — 문서(store/REEL_CAPTIONS.md)와 폰용 복사 페이지(HTML).

    python scripts/gen_reel_captions.py [out.html]

3바퀴(2026-10-06 사용자: 「8편 × 3턴이니 24개」):
  · 1바퀴 — 처음 만든 8편(my-video/out/reel1_receipt.mp4 …), 후킹은 각 Reel*.tsx 의 훅 자막 상황
  · 2바퀴 — 후킹 v2 8편(my-video/out/reel*_hookv2_*.mp4, store/REEL_HOOKS_V2.md)
  · 3바퀴 — 후킹 v3 8편(store/REEL_HOOKS_V3.md 프롬프트로 앞으로 만들 영상)
규칙(store/REEL_PLAN.md): 마지막 줄은 항상 「프로필 링크에서 받을 수 있어요」, 해시태그는 #냉털 #냉장고파먹기 #자취요리 #오늘뭐먹지
#식단 #집밥 #유통기한 중 5개, 절약액은 단정하지 않는다(「예상」). 기능 설명은 각 편 데모 나레이션에서 실제로 보여 주는 것만.
첫 줄은 피드에서 「더 보기」 전에 보이는 부분이라 그 바퀴 후킹 상황을 짚는 공감 한 줄로. 같은 데모를 세 번 올리니
기능 설명 문장도 바퀴마다 바꿔 복붙처럼 보이지 않게 한다.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAST = "프로필 링크에서 받을 수 있어요"

ROUNDS = [
    {
        "key": "r1", "name": "1바퀴 · 처음 만든 8편",
        "posts": [
            {"file": "reel1_receipt.mp4", "title": "01 이거 저번에도 샀나? — 사진 인식",
             "body": ["\"이거 저번에도 샀나?\" 마트에서 한 번쯤 해 본 생각이죠 🛒", "",
                      "영수증이나 음식 사진 한 장이면 쿡매치가 재료를 알아서 읽어요.",
                      "재료도 유통기한도 자동으로 냉장고에 담겨서, 마트에서 헷갈릴 일이 없어요."],
             "tags": ["#냉털", "#냉장고파먹기", "#자취요리", "#집밥", "#유통기한"]},
            {"file": "reel2_match.mp4", "title": "02 재료 한두 개가 없어서 — 매칭",
             "body": ["어렵게 찾은 레시피, 재료 한두 개 없어서 포기한 적 있죠? 😮‍💨", "",
                      "쿡매치는 내 냉장고 재료 기준으로 레시피를 매칭률 순으로 보여 줘요.",
                      "없는 재료는 있는 재료로 바꿔 쓰는 방법까지 알려 주고, 정말 없는 건 바로 살 수 있게 이어 줘요."],
             "tags": ["#냉털", "#냉장고파먹기", "#오늘뭐먹지", "#자취요리", "#집밥"]},
            {"file": "reel3_cookmode.mp4", "title": "03 손에 뭐가 묻어서 — 요리 모드",
             "body": ["요리할 땐 손에 뭐가 잔뜩 묻어 있는데, 레시피는 손으로 넘겨야 하죠 🙌", "",
                      "요리 모드를 켜면 화면을 안 만져도 레시피를 단계별로 읽어 줘요.",
                      "지금 할 부분은 노랗게 짚어 줘서, 요리가 끝날 때까지 놓칠 일이 없어요."],
             "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"]},
            {"file": "reel4_diet.mp4", "title": "04 카트가 한가득 — AI 식단",
             "body": ["계획 없이 장 보다가 카트가 한가득 찬 적 있죠? 🛒", "",
                      "원하는 걸 말하면 쿡매치 AI가 냉장고 재료로 일주일 식단을 짜 줘요.",
                      "있는 재료부터 채우니까 장 볼 목록이 확 줄고, 짠 식단은 캘린더에 그대로 담겨요."],
             "tags": ["#식단", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"]},
            {"file": "reel5_expiry.mp4", "title": "05 결국 버린 채소 — 유통기한 알림",
             "body": ["사 놓고 유통기한 놓쳐서, 결국 버린 적 있죠? 🥬", "",
                      "쿡매치는 유통기한이 다가오면 앱을 안 켜도 알림으로 알려 줘요.",
                      "유통기한은 자동으로 계산되고, 임박한 재료로 만들 레시피까지 바로 추천해요."],
             "tags": ["#유통기한", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"]},
            {"file": "reel6_chatbot.mp4", "title": "06 검색창 앞에서 멍 — 요리 AI",
             "body": ["오늘 뭐 해 먹지… 검색창 앞에서 멍 때린 적 있죠 🤔", "",
                      "검색창 대신 쿡매치 AI한테 말하듯 물어보세요.",
                      "내 냉장고 재료와 취향을 반영해서 딱 맞는 레시피를 골라 줘요."],
             "tags": ["#오늘뭐먹지", "#집밥", "#냉털", "#자취요리", "#식단"]},
            {"file": "reel7_recipe.mp4", "title": "07 왜 제 것만 이상하죠 — 진짜 레시피",
             "body": ["레시피 따라 했는데, 왜 제 것만 이상하죠? 😢", "",
                      "쿡매치에는 유튜브·네이버 상위 채널에서 매일 골라 모은 레시피가 수만 건 있어요.",
                      "좋아요·댓글·조회수를 반영한 인기순이라, 검증된 레시피부터 볼 수 있어요."],
             "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"]},
            {"file": "reel8_family_savings.mp4", "title": "08 이번 달 배달비 — 가족·아낀 돈",
             "body": ["이번 달 배달비, 얼마인지 볼 용기 있어요? 💸", "",
                      "가족과 함께 이번 달 집밥 목표를 정해 보세요.",
                      "요리할 때마다 아낀 돈(예상)이 쌓이고, 가족이 만든 요리가 캘린더에 남아요."],
             "tags": ["#집밥", "#식단", "#냉장고파먹기", "#냉털", "#오늘뭐먹지"]},
        ],
    },
    {
        "key": "r2", "name": "2바퀴 · 후킹 v2 8편",
        "posts": [
            {"file": "reel1_hookv2_tofu.mp4", "title": "01 두부 — 사진 인식",
             "body": ["마트에서 두부 들고 \"집에 있었나…?\" 멈춘 적 있죠 🤔", "",
                      "냉장고를 폰에 넣어 두면 그런 고민이 없어요.",
                      "영수증이든 음식 사진이든 한 장만 찍으면 재료가 알아서 등록되고, 유통기한도 같이 챙겨 줘요.",
                      "이제 냉장고, 기억 안 해도 돼요."],
             "tags": ["#냉털", "#냉장고파먹기", "#자취요리", "#집밥", "#유통기한"]},
            {"file": "reel2_hookv2_fridge.mp4", "title": "02 냉장고 — 매칭",
             "body": ["냉장고는 몇 번을 열어도 그대로예요 🫠", "",
                      "먹을 게 없는 게 아니라, 뭘 해 먹을지가 안 떠오르는 거예요.",
                      "쿡매치는 지금 냉장고 재료로 만들 수 있는 요리를 매칭률 순으로 보여 줘요.",
                      "재료가 한두 개 모자라면 대신 쓸 재료를 알려 주고, 정말 없는 건 바로 살 수 있게 이어 줘요."],
             "tags": ["#냉털", "#냉장고파먹기", "#오늘뭐먹지", "#자취요리", "#집밥"]},
            {"file": "reel3_hookv2_dough_b.mp4", "title": "03 반죽 — 요리 모드",
             "body": ["반죽 묻은 손으로 레시피 넘기다가… 코까지 써 본 사람 🙋", "",
                      "요리 모드를 켜면 화면을 안 만져도 돼요.",
                      "단계를 소리로 읽어 주고, 지금 할 부분을 노랗게 짚어 줘요. 요리가 끝날 때까지요.",
                      "이제 손으론 요리하고, 레시피는 귀로 들으세요."],
             "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"]},
            {"file": "reel4_hookv2_greenonion.mp4", "title": "04 대파 — AI 식단",
             "body": ["있는 줄 모르고 또 산 대파, 우리 집에만 있는 거 아니죠? 🌿", "",
                      "원하는 걸 말하면 냉장고에 있는 재료로 일주일 식단을 짜 줘요.",
                      "짠 식단은 그대로 캘린더에 담기고, 있는 재료부터 최대한 채워서 장 볼 건 꼭 필요한 것만 남아요.",
                      "이제 장보기도 가장 효율적으로."],
             "tags": ["#식단", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"]},
            {"file": "reel5_hookv2_zucchini.mp4", "title": "05 애호박 — 유통기한 알림",
             "body": ["\"이거 언제 샀더라…\" 야채칸에서 물러진 애호박 꺼내 본 적 있죠 🥲", "",
                      "앱을 안 켜도 유통기한이 다가오면 알림으로 알려 줘요.",
                      "유통기한을 직접 안 적어도 자동으로 계산해 주고, 임박한 재료 순으로 바로 레시피까지 추천해요.",
                      "버리기 전에, 있는 재료부터 요리하세요."],
             "tags": ["#유통기한", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"]},
            {"file": "reel6_hookv2_anything.mp4", "title": "06 아무거나 — 요리 AI",
             "body": ["\"뭐 먹을래?\" \"아무거나.\" \"김치찌개?\" \"아니 그거 말고.\" 🙃", "",
                      "이 대화, 이제 쿡매치한테 물어보세요.",
                      "말하듯 물어보면 내 냉장고 재료와 취향에 맞는 레시피를 골라 줘요.",
                      "검색 대신 말 한마디면 충분해요."],
             "tags": ["#오늘뭐먹지", "#집밥", "#냉털", "#자취요리", "#식단"]},
            {"file": "reel7_hookv2_salt.mp4", "title": "07 적당히 — 진짜 레시피",
             "body": ["\"소금 적당히\"… 적당히가 얼만데요 🧂", "",
                      "쿡매치에는 유튜브·네이버 상위 채널에서 매일 골라 모은 레시피가 수만 건 있어요.",
                      "좋아요·댓글·조회수를 반영해 인기순으로 보여 주고, 출처까지 확인할 수 있어요.",
                      "뭘 골라도 실패 없는 진짜 레시피만."],
             "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"]},
            {"file": "reel8_hookv2_takeout.mp4", "title": "08 배달 탑 — 가족·아낀 돈",
             "body": ["이번 달 배달 용기… 몇 개였는지 세어 보셨어요? 🥡", "",
                      "가족과 함께 이번 달 집밥 목표를 정해 보세요.",
                      "요리할 때마다 아낀 돈(예상)이 바로 보이고, 가족이 언제 뭘 만들었는지 캘린더에 기록으로 남아요.",
                      "목표부터 식단, 절약까지 가족과 함께 확인해요."],
             "tags": ["#집밥", "#식단", "#냉장고파먹기", "#냉털", "#오늘뭐먹지"]},
        ],
    },
    {
        "key": "r3", "name": "3바퀴 · 후킹 v3 8편 (영상 만들 예정)",
        "posts": [
            {"file": "v3 01 — 계란 있어? 없어?", "title": "01 계란 있어? 없어? — 사진 인식",
             "body": ["장 보다가 \"집에 계란 있어?\" 전화해 본 사람 🙋 (답은 늘 \"어, 한 개 있네?\")", "",
                      "냉장고에 뭐가 있는지 이제 폰으로 보세요.",
                      "장 보고 영수증 사진 한 장만 찍으면 재료와 유통기한이 자동으로 등록돼요.",
                      "전화 안 해도, 냉장고 안 열어 봐도 돼요."],
             "tags": ["#냉털", "#냉장고파먹기", "#자취요리", "#집밥", "#유통기한"]},
            {"file": "v3 02 — 냉장고 재료 라인업", "title": "02 냉장고 재료 라인업 — 매칭",
             "body": ["냉장고에 남은 재료 다 꺼내 놓고 한참 쳐다본 적 있죠 🥚🧅", "",
                      "남은 재료만 있어도 괜찮아요.",
                      "쿡매치가 지금 냉장고 재료로 만들 수 있는 요리를 매칭률 순으로 찾아 주고, 모자란 재료는 대신 쓸 재료를 추천해요."],
             "tags": ["#냉털", "#냉장고파먹기", "#오늘뭐먹지", "#자취요리", "#집밥"]},
            {"file": "v3 03 — 아니 아니, 너무 올렸어", "title": "03 아니 아니, 너무 올렸어 — 요리 모드",
             "body": ["\"좀만 더 위로.\" \"너무 올렸어!\" \"아니 아니 아니!\" 양념 묻은 손으로 레시피 보는 사람 공감 🧤", "",
                      "요리 모드면 옆 사람 부를 필요 없어요.",
                      "손 안 대도 단계를 소리로 읽어 주고, 지금 할 부분을 노랗게 짚어 줘요.",
                      "이제 손으론 요리하고, 레시피는 귀로 들으세요."],
             "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"]},
            {"file": "v3 04 — 안 닫히는 냉장고", "title": "04 안 닫히는 냉장고 — AI 식단",
             "body": ["꽉 찬 냉장고, 닫았는데 스르륵 다시 열려서 등으로 막아 본 적 있죠? 😅", "",
                      "이번 주는 장 보기 전에 쿡매치부터 열어 보세요.",
                      "냉장고에 있는 재료로 일주일 식단을 먼저 짜고, 장 볼 건 꼭 필요한 것만 남겨 줘요."],
             "tags": ["#식단", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"]},
            {"file": "v3 05 — 냄새 테스트", "title": "05 냄새 테스트 — 유통기한 알림",
             "body": ["\"이거 우유 괜찮은 거 같아?\" \"음, 자기가 먹어.\" 🥛", "",
                      "냄새 맡기 전에 알림부터 확인하세요.",
                      "쿡매치가 유통기한을 자동으로 계산해서, 다가오면 알림으로 알려 줘요.",
                      "임박한 재료로 만들 레시피도 바로 추천해요."],
             "tags": ["#유통기한", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"]},
            {"file": "v3 06 — 엄마, 뭐 해 먹지?", "title": "06 엄마, 뭐 해 먹지? — 요리 AI",
             "body": ["\"엄마, 두부랑 애호박 있는데 뭐 해 먹지?\" \"그걸 왜 맨날 물어봐.\" 📞", "",
                      "이제 엄마 대신 쿡매치 AI한테 물어보세요.",
                      "냉장고에 있는 재료를 말하듯 알려 주면, 내 취향까지 반영해서 레시피를 골라 줘요.",
                      "몇 번을 물어봐도 괜찮아요."],
             "tags": ["#오늘뭐먹지", "#집밥", "#냉털", "#자취요리", "#식단"]},
            {"file": "v3 07 — 근데 이거 뭐야?", "title": "07 근데 이거 뭐야? — 진짜 레시피",
             "body": ["\"음, 맛있다. 근데 자기야, 이거 뭐야?\" \"찜닭인데.\" 😂", "",
                      "처음부터 검증된 레시피로 시작하세요.",
                      "쿡매치는 유튜브·네이버 상위 채널 레시피를 좋아요·댓글·조회수 순으로 보여 주고, 출처까지 확인할 수 있어요."],
             "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"]},
            {"file": "v3 08 — 또 뵙네요", "title": "08 또 뵙네요 — 가족·아낀 돈",
             "body": ["배달 기사님이 \"또 뵙네요\" 하셨어요… 🛵", "",
                      "기사님과 더 친해지기 전에, 가족과 이번 달 집밥 목표부터 정해 보세요.",
                      "요리할 때마다 아낀 돈(예상)이 바로 보이고, 누가 언제 뭘 만들었는지도 캘린더에 남아요."],
             "tags": ["#집밥", "#식단", "#냉장고파먹기", "#냉털", "#오늘뭐먹지"]},
        ],
    },
]


def caption(p):
    return "\n".join(p["body"] + ["", LAST, "", " ".join(p["tags"])])


def write_md():
    lines = [
        "# 릴스 24편 — 인스타 본문 (8편 × 3바퀴)",
        "",
        "만든 날: 2026-10-06 · 만든 스크립트: `scripts/gen_reel_captions.py`(직접 고치지 말고 스크립트를 고쳐 다시 만든다).",
        "규칙은 [REEL_PLAN.md](REEL_PLAN.md): 마지막 줄 「프로필 링크에서 받을 수 있어요」, 해시태그 5개, 절약액은 「예상」.",
        "1바퀴 = 처음 만든 8편, 2바퀴 = 후킹 v2([REEL_HOOKS_V2.md](REEL_HOOKS_V2.md)), 3바퀴 = 후킹 v3([REEL_HOOKS_V3.md](REEL_HOOKS_V3.md), 영상 만들 예정).",
        "",
    ]
    for r in ROUNDS:
        lines += [f"## {r['name']}", ""]
        for p in r["posts"]:
            where = f"`my-video/out/{p['file']}`" if p["file"].endswith(".mp4") else p["file"]
            lines += [f"### {p['title']}", "", f"영상: {where}", "", "```", caption(p), "```", ""]
    (ROOT / "store/REEL_CAPTIONS.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")


PAGE = """<title>쿡매치 릴스 본문</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: 한 줄 세로 스크롤 — 바퀴(1·2·3)마다 구역, 맨 위 고정 바로 바퀴 이동. 편마다 카드, 복사 버튼은 카드 맨 위. 노랑은 복사·현재 바퀴에만. */
:root{
  --bg:#f4f4f1; --surface:#ffffff; --ink:#1a1a1e; --muted:#62626b; --line:#e2e2dc;
  --accent:#ffd600; --pill:#141416; --pill-ink:#ffffff; --code:#f7f7f4; --bar:rgba(244,244,241,.92);
  --display:'Black Han Sans','IBM Plex Sans KR','Apple SD Gothic Neo',sans-serif;
  --body:'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#141415; --surface:#1d1d1f; --ink:#f1f1ee; --muted:#a3a3ab; --line:#303033;
  --accent:#ffd600; --pill:#f1f1ee; --pill-ink:#141416; --code:#18181a; --bar:rgba(20,20,21,.92); color-scheme:dark } }
:root[data-theme="dark"]{
  --bg:#141415; --surface:#1d1d1f; --ink:#f1f1ee; --muted:#a3a3ab; --line:#303033;
  --accent:#ffd600; --pill:#f1f1ee; --pill-ink:#141416; --code:#18181a; --bar:rgba(20,20,21,.92); color-scheme:dark }
*{box-sizing:border-box}
html{scroll-padding-top:calc(64px + env(safe-area-inset-top,0px))}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.65;margin:0}
.page{max-width:680px;margin:0 auto;padding-inline:18px;padding-block:28px 72px;display:flex;flex-direction:column;gap:22px}
h1{font-family:var(--display);font-weight:400;font-size:32px;line-height:1.2;margin:0;text-wrap:balance}
h2{font-family:var(--display);font-weight:400;font-size:24px;line-height:1.3;margin:0}
h3{font-family:var(--display);font-weight:400;font-size:18px;line-height:1.35;margin:0;min-width:0}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.08em;color:var(--muted);margin:0 0 8px}
.lede{color:var(--muted);margin:10px 0 0;max-width:60ch}
nav{position:sticky;top:env(safe-area-inset-top,0px);z-index:2;background:var(--bar);backdrop-filter:blur(8px);border-bottom:1px solid var(--line);margin-inline:-18px;padding:10px 18px;display:flex;gap:8px;flex-wrap:wrap}
nav a{font-size:14px;font-weight:600;color:var(--ink);text-decoration:none;border:1px solid var(--line);background:var(--surface);border-radius:999px;padding:6px 14px}
nav a:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
.round{display:flex;flex-direction:column;gap:14px}
.round-head{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}
.count{font-family:var(--mono);font-size:12px;color:var(--muted)}
.post{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.bar{display:flex;justify-content:space-between;align-items:center;gap:10px}
.file{font-family:var(--mono);font-size:12px;color:var(--muted);word-break:break-all}
button{font-family:var(--body);font-size:14px;font-weight:600;border-radius:10px;padding:9px 16px;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:#1a1a1e;flex:none}
button.done{background:var(--surface);color:var(--ink);border-color:var(--line)}
button:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
pre{margin:0;background:var(--code);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-family:var(--body);font-size:14.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--pill);color:var(--pill-ink);padding:10px 16px;border-radius:999px;font-size:14px;font-weight:600;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
@media (prefers-reduced-motion:reduce){ .toast{transition:none} }
</style>
<div class="page">
  <header>
    <p class="eyebrow">REEL CAPTIONS · 8 × 3 = 24 · 2026-10-06</p>
    <h1>쿡매치 릴스 본문</h1>
    <p class="lede">릴스 24편(8편 × 3바퀴)에 붙일 글이에요. <b>복사</b>를 누르고 인스타 본문 칸에 그대로 붙이면 돼요. 마지막 줄과 해시태그 5개까지 들어 있어요. 복사한 카드는 버튼이 회색으로 바뀌어요(이 기기에서만 기억해요).</p>
  </header>
  <nav aria-label="바퀴로 이동">__NAV__</nav>
  __ROUNDS__
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
const DATA = __DATA__;
const KEY = 'cookmatch-reel-captions-copied';
let copied = {};
try { copied = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch(e){ copied = {}; }
let t;
function toast(m){ const el=document.getElementById('toast'); el.textContent=m; el.classList.add('on'); clearTimeout(t); t=setTimeout(()=>el.classList.remove('on'),1600); }
function selectText(el){ const r=document.createRange(); r.selectNodeContents(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
function mark(b){ b.classList.add('done'); b.textContent = '다시 복사'; }
document.querySelectorAll('[data-id]').forEach(b => {
  const id = b.dataset.id, pre = document.getElementById('p-' + id);
  if (copied[id]) mark(b);
  b.addEventListener('click', () => {
    const fail = () => { selectText(pre); toast('자동 복사가 막혀 있어요 — 선택된 글자를 길게 눌러 복사하세요'); };
    try {
      navigator.clipboard.writeText(DATA[id]).then(() => {
        toast('복사됐어요 — 인스타 본문에 붙여 넣으세요'); mark(b); copied[id] = 1;
        try { localStorage.setItem(KEY, JSON.stringify(copied)); } catch(e){}
      }, fail);
    } catch(e){ fail(); }
  });
});
</script>
"""


def write_html(path: Path):
    nav, rounds, data = [], [], {}
    for r in ROUNDS:
        nav.append(f'<a href="#{r["key"]}">{html.escape(r["name"].split(" · ")[0])}</a>')
        cards = []
        for i, p in enumerate(r["posts"]):
            pid = f'{r["key"]}-{i + 1}'
            data[pid] = caption(p)
            cards.append(
                f'<article class="post"><div class="bar"><h3>{html.escape(p["title"])}</h3>'
                f'<button type="button" data-id="{pid}">복사</button></div>'
                f'<span class="file">{html.escape(p["file"])}</span>'
                f'<pre id="p-{pid}">{html.escape(caption(p))}</pre></article>'
            )
        rounds.append(
            f'<section class="round" id="{r["key"]}"><div class="round-head"><h2>{html.escape(r["name"])}</h2>'
            f'<span class="count">{len(r["posts"])}편</span></div>' + "".join(cards) + "</section>"
        )
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    out = PAGE.replace("__NAV__", "".join(nav)).replace("__ROUNDS__", "\n  ".join(rounds)).replace("__DATA__", payload)
    path.write_text(out, encoding="utf-8")


if __name__ == "__main__":
    import sys
    write_md()
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "store/reel_captions.html"
    write_html(out)
    print("wrote store/REEL_CAPTIONS.md and", out, "| posts:", sum(len(r["posts"]) for r in ROUNDS))
