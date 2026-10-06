"""릴스 후킹 v2 8편(my-video/out/reel*_hookv2_*.mp4)을 올릴 때 붙일 인스타 본문 — 문서(store/REEL_CAPTIONS_V2.md)와 폰용 복사 페이지(HTML).

    python scripts/gen_reel_captions_v2.py [out.html]

규칙(store/REEL_PLAN.md): 마지막 줄은 항상 「프로필 링크에서 받을 수 있어요」, 해시태그는 #냉털 #냉장고파먹기 #자취요리 #오늘뭐먹지
#식단 #집밥 #유통기한 중 5개 안팎, 절약액은 단정하지 않는다(「예상」). 기능 설명은 각 편 데모 나레이션에서 실제로 보여 주는 것만 쓴다.
첫 줄은 피드에서 「더 보기」 전에 보이는 부분이라 후킹 상황을 그대로 짚는 공감 한 줄로.
"""
import html
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LAST = "프로필 링크에서 받을 수 있어요"

POSTS = [
    {
        "file": "reel1_hookv2_tofu.mp4", "title": "01 두부 — 사진 인식",
        "body": [
            "마트에서 두부 들고 \"집에 있었나…?\" 멈춘 적 있죠 🤔",
            "",
            "냉장고를 폰에 넣어 두면 그런 고민이 없어요.",
            "영수증이든 음식 사진이든 한 장만 찍으면 재료가 알아서 등록되고, 유통기한도 같이 챙겨 줘요.",
            "이제 냉장고, 기억 안 해도 돼요.",
        ],
        "tags": ["#냉털", "#냉장고파먹기", "#자취요리", "#집밥", "#유통기한"],
    },
    {
        "file": "reel2_hookv2_fridge.mp4", "title": "02 냉장고 — 매칭",
        "body": [
            "냉장고는 몇 번을 열어도 그대로예요 🫠",
            "",
            "먹을 게 없는 게 아니라, 뭘 해 먹을지가 안 떠오르는 거예요.",
            "쿡매치는 지금 냉장고 재료로 만들 수 있는 요리를 매칭률 순으로 보여 줘요.",
            "재료가 한두 개 모자라면 대신 쓸 재료를 알려 주고, 정말 없는 건 바로 살 수 있게 이어 줘요.",
        ],
        "tags": ["#냉털", "#냉장고파먹기", "#오늘뭐먹지", "#자취요리", "#집밥"],
    },
    {
        "file": "reel3_hookv2_dough_b.mp4", "title": "03 반죽 — 요리 모드",
        "body": [
            "반죽 묻은 손으로 레시피 넘기다가… 코까지 써 본 사람 🙋",
            "",
            "요리 모드를 켜면 화면을 안 만져도 돼요.",
            "단계를 소리로 읽어 주고, 지금 할 부분을 노랗게 짚어 줘요. 요리가 끝날 때까지요.",
            "이제 손으론 요리하고, 레시피는 귀로 들으세요.",
        ],
        "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"],
    },
    {
        "file": "reel4_hookv2_greenonion.mp4", "title": "04 대파 — AI 식단",
        "body": [
            "있는 줄 모르고 또 산 대파, 우리 집에만 있는 거 아니죠? 🌿",
            "",
            "원하는 걸 말하면 냉장고에 있는 재료로 일주일 식단을 짜 줘요.",
            "짠 식단은 그대로 캘린더에 담기고, 있는 재료부터 최대한 채워서 장 볼 건 꼭 필요한 것만 남아요.",
            "이제 장보기도 가장 효율적으로.",
        ],
        "tags": ["#식단", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"],
    },
    {
        "file": "reel5_hookv2_zucchini.mp4", "title": "05 애호박 — 유통기한 알림",
        "body": [
            "\"이거 언제 샀더라…\" 야채칸에서 물러진 애호박 꺼내 본 적 있죠 🥲",
            "",
            "앱을 안 켜도 유통기한이 다가오면 알림으로 알려 줘요.",
            "유통기한을 직접 안 적어도 자동으로 계산해 주고, 임박한 재료 순으로 바로 레시피까지 추천해요.",
            "버리기 전에, 있는 재료부터 요리하세요.",
        ],
        "tags": ["#유통기한", "#냉장고파먹기", "#냉털", "#집밥", "#자취요리"],
    },
    {
        "file": "reel6_hookv2_anything.mp4", "title": "06 아무거나 — 요리 AI",
        "body": [
            "\"뭐 먹을래?\" \"아무거나.\" \"김치찌개?\" \"아니 그거 말고.\" 🙃",
            "",
            "이 대화, 이제 쿡매치한테 물어보세요.",
            "말하듯 물어보면 내 냉장고 재료와 취향에 맞는 레시피를 골라 줘요.",
            "검색 대신 말 한마디면 충분해요.",
        ],
        "tags": ["#오늘뭐먹지", "#집밥", "#냉털", "#자취요리", "#식단"],
    },
    {
        "file": "reel7_hookv2_salt.mp4", "title": "07 적당히 — 진짜 레시피",
        "body": [
            "\"소금 적당히\"… 적당히가 얼만데요 🧂",
            "",
            "쿡매치에는 유튜브·네이버 상위 채널에서 매일 골라 모은 레시피가 수만 건 있어요.",
            "좋아요·댓글·조회수를 반영해 인기순으로 보여 주고, 출처까지 확인할 수 있어요.",
            "뭘 골라도 실패 없는 진짜 레시피만.",
        ],
        "tags": ["#집밥", "#자취요리", "#오늘뭐먹지", "#냉털", "#식단"],
    },
    {
        "file": "reel8_hookv2_takeout.mp4", "title": "08 배달 탑 — 가족·아낀 돈",
        "body": [
            "이번 달 배달 용기… 몇 개였는지 세어 보셨어요? 🥡",
            "",
            "가족과 함께 이번 달 집밥 목표를 정해 보세요.",
            "요리할 때마다 아낀 돈(예상)이 바로 보이고, 가족이 언제 뭘 만들었는지 캘린더에 기록으로 남아요.",
            "목표부터 식단, 절약까지 가족과 함께 확인해요.",
        ],
        "tags": ["#집밥", "#식단", "#냉장고파먹기", "#냉털", "#오늘뭐먹지"],
    },
]


def caption(p):
    return "\n".join(p["body"] + ["", LAST, "", " ".join(p["tags"])])


def write_md():
    lines = [
        "# 릴스 후킹 v2 8편 — 인스타 본문",
        "",
        "만든 날: 2026-10-06 · 만든 스크립트: `scripts/gen_reel_captions_v2.py`(직접 고치지 말고 스크립트를 고쳐 다시 만든다).",
        "규칙은 [REEL_PLAN.md](REEL_PLAN.md): 마지막 줄 「프로필 링크에서 받을 수 있어요」, 해시태그 5개, 절약액은 「예상」.",
        "",
    ]
    for p in POSTS:
        lines += [f"## {p['title']}", "", f"영상: `my-video/out/{p['file']}`", "", "```", caption(p), "```", ""]
    (ROOT / "store/REEL_CAPTIONS_V2.md").write_text("\n".join(lines), encoding="utf-8", newline="\n")


PAGE = """<title>쿡매치 릴스 본문</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=IBM+Plex+Sans+KR:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: 한 줄 세로 스크롤 — 편마다 카드 하나, 복사 버튼은 카드 맨 위(폰 엄지 위치). 노랑은 복사 버튼에만. */
:root{
  --bg:#f4f4f1; --surface:#ffffff; --ink:#1a1a1e; --muted:#62626b; --line:#e2e2dc;
  --accent:#ffd600; --pill:#141416; --pill-ink:#ffffff; --code:#f7f7f4;
  --display:'Black Han Sans','IBM Plex Sans KR','Apple SD Gothic Neo',sans-serif;
  --body:'IBM Plex Sans KR','Apple SD Gothic Neo','Malgun Gothic',sans-serif;
  --mono:'IBM Plex Mono',ui-monospace,Menlo,Consolas,monospace;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --bg:#141415; --surface:#1d1d1f; --ink:#f1f1ee; --muted:#a3a3ab; --line:#303033;
  --accent:#ffd600; --pill:#f1f1ee; --pill-ink:#141416; --code:#18181a; color-scheme:dark } }
:root[data-theme="dark"]{
  --bg:#141415; --surface:#1d1d1f; --ink:#f1f1ee; --muted:#a3a3ab; --line:#303033;
  --accent:#ffd600; --pill:#f1f1ee; --pill-ink:#141416; --code:#18181a; color-scheme:dark }
*{box-sizing:border-box}
body{background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.65;margin:0}
.page{max-width:680px;margin:0 auto;padding-inline:18px;padding-block:36px 72px;display:flex;flex-direction:column;gap:22px}
h1{font-family:var(--display);font-weight:400;font-size:32px;line-height:1.2;margin:0;text-wrap:balance}
h2{font-family:var(--display);font-weight:400;font-size:20px;line-height:1.3;margin:0}
.eyebrow{font-family:var(--mono);font-size:12px;letter-spacing:.08em;color:var(--muted);margin:0 0 8px}
.lede{color:var(--muted);margin:10px 0 0;max-width:60ch}
.post{background:var(--surface);border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:12px;min-width:0}
.bar{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.file{font-family:var(--mono);font-size:12px;color:var(--muted);word-break:break-all}
button{font-family:var(--body);font-size:14px;font-weight:600;border-radius:10px;padding:10px 16px;cursor:pointer;border:1px solid var(--accent);background:var(--accent);color:#1a1a1e}
button:focus-visible{outline:3px solid var(--ink);outline-offset:2px}
pre{margin:0;background:var(--code);border:1px solid var(--line);border-radius:10px;padding:12px 14px;font-family:var(--body);font-size:14.5px;line-height:1.65;white-space:pre-wrap;word-break:break-word}
.toast{position:fixed;left:50%;bottom:calc(20px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);background:var(--pill);color:var(--pill-ink);padding:10px 16px;border-radius:999px;font-size:14px;font-weight:600;opacity:0;transition:opacity .2s;pointer-events:none}
.toast.on{opacity:1}
@media (prefers-reduced-motion:reduce){ .toast{transition:none} }
</style>
<div class="page">
  <header>
    <p class="eyebrow">REEL CAPTIONS · HOOK v2 · 2026-10-06</p>
    <h1>쿡매치 릴스 본문</h1>
    <p class="lede">후킹 v2 8편을 올릴 때 붙일 글이에요. <b>복사</b>를 누르고 인스타 본문 칸에 그대로 붙이면 돼요. 마지막 줄과 해시태그 5개까지 들어 있어요.</p>
  </header>
  __POSTS__
</div>
<div class="toast" id="toast" role="status" aria-live="polite"></div>
<script>
const DATA = __DATA__;
let t;
function toast(m){ const el=document.getElementById('toast'); el.textContent=m; el.classList.add('on'); clearTimeout(t); t=setTimeout(()=>el.classList.remove('on'),1600); }
function selectText(el){ const r=document.createRange(); r.selectNodeContents(el); const s=getSelection(); s.removeAllRanges(); s.addRange(r); }
document.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => {
  const i = +b.dataset.i, pre = document.getElementById('p' + i);
  const fail = () => { selectText(pre); toast('자동 복사가 막혀 있어요 — 선택된 글자를 길게 눌러 복사하세요'); };
  try { navigator.clipboard.writeText(DATA[i]).then(() => toast('복사됐어요 — 인스타 본문에 붙여 넣으세요'), fail); } catch(e){ fail(); }
}));
</script>
"""


def write_html(path: Path):
    cards = []
    for i, p in enumerate(POSTS):
        cards.append(
            f'<article class="post"><div class="bar"><h2>{html.escape(p["title"])}</h2>'
            f'<button type="button" data-i="{i}">복사</button></div>'
            f'<span class="file">{html.escape(p["file"])}</span>'
            f'<pre id="p{i}">{html.escape(caption(p))}</pre></article>'
        )
    data = json.dumps([caption(p) for p in POSTS], ensure_ascii=False).replace("</", "<\\/")
    path.write_text(PAGE.replace("__POSTS__", "\n  ".join(cards)).replace("__DATA__", data), encoding="utf-8")


if __name__ == "__main__":
    import sys
    write_md()
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "store/reel_captions_v2.html"
    write_html(out)
    print("wrote store/REEL_CAPTIONS_V2.md and", out)
