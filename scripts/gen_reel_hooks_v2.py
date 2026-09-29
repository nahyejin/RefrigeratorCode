"""릴스 후킹 영상 v2 — 제미나이(Veo)에 붙일 프롬프트 8편을 문서(store/REEL_HOOKS_V2.md)와 폰용 페이지(HTML)로 만든다.

    python scripts/gen_reel_hooks_v2.py            # store/REEL_HOOKS_V2.md + scratch HTML(아티팩트 게시용)

v1(REEL_PROMPTS_FULL.md, 2026-09-23)과 다른 점(2026-09-29 사용자 요청):
  · 방향: 기능 설명이 아니라 **「이거 완전 나잖아」 하고 공유하고 싶어지는 니즈 상황**(웃기거나 공감되는 3~5초). 쿡매치 핵심
    기능(KBF)마다 하나씩, 처음 8종·v1 과 겹치지 않는 상황으로 새로 짰다.
  · 한글·자막 문제: 제미나이가 화면에 깨진 한글·자막을 자꾸 넣는다. 원인은 (1) 프롬프트 전체가 한국어 (2) 「자막 금지」처럼
    **그려선 안 될 것의 이름을 적은 것**(생성 모델은 부정문을 잘 못 읽고 단어 자체를 힌트로 쓴다) (3) 대사를 장면 설명
    한가운데 따옴표로 넣은 것. → 프롬프트는 영어로, 「자막」이라는 말은 쓰지 않고 **있어야 할 것만 긍정문으로**(깨끗한 원본
    촬영분·라벨 없는 소품·화면이 돌아간 폰), 한국어는 **소리로만 나오는 대사**로 AUDIO 칸에만 둔다.
"""
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

COMMON = """[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there."""

# 대사 없는 버전 — 대사 대신 숨소리만. 대사는 편집에서 목소리·자막으로 얹는다(글자가 섞일 틈이 아예 없다).
NO_LINE = "Spoken words: none. The person only lets out a quiet sigh."

CLIPS = [
    {
        "no": "01", "kbf": "매칭률 · 있는 재료로", "title": "냉장고는 세 번 열어도 그대로",
        "why": "냉장고를 열었다 닫았다 다시 여는 행동은 누구나 해 본 일이에요. 「혹시 뭐가 생겼을까」 하는 헛된 기대가 웃음 포인트예요.",
        "caption": "냉장고는 세 번 열어도\n안 바뀝니다",
        "demo": "지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면",
        "cast": "Early-30s Korean woman, hair in a neat low ponytail, oatmeal knit sweater, soft gray lounge pants.",
        "home": "Bright apartment kitchen in the evening, white cabinets, light oak floor, a small plant by the window.",
        "action": "She opens the fridge and stares inside for a beat, then closes it. She takes two steps away, stops, turns back and opens it again, as if something new might have appeared. The same half-empty shelves. She holds the door open while cold air softly spills out, her face completely deadpan.",
        "audio": "Fridge hum and the soft thump of the door seal. She mutters flatly in Korean: \"...아까랑 똑같네.\"",
        "last": "Her hand drifting toward the phone lying face down on the counter.",
    },
    {
        "no": "02", "kbf": "곧 상할 재료부터", "title": "고무가 된 오이",
        "why": "야채칸 깊숙이 잊힌 오이가 고무처럼 휘는 장면은 「우리 집에도 있다」는 웃픈 공감을 줘요. 무표정하게 U자로 구부리는 게 과장 포인트예요.",
        "caption": "사 놓고 잊은 재료,\n우리 집에도 있죠",
        "demo": "「곧 상해요」 배지가 붙은 재료와 그 재료로 먼저 만들 요리가 위로 올라오는 화면",
        "cast": "Early-40s Korean woman, neat chin-length bob, navy button-up shirt with the sleeves folded once.",
        "home": "Older apartment kitchen in the afternoon, cherry-wood cabinets, cream tiled backsplash, spice jars lined on the windowsill.",
        "action": "She slides open the crisper drawer and pulls out a cucumber. It droops. Holding it by one end, she watches it bend limply. Without any expression she slowly bends it into a U shape between two fingers and studies it.",
        "audio": "The crisper drawer sliding. She mutters quietly in Korean: \"너... 언제 이렇게 됐니.\"",
        "last": "The cucumber bent into a U shape in her fingers.",
    },
    {
        "no": "03", "kbf": "사진 한 장으로 냉장고 채우기", "title": "마트에서 두부 앞에 멈춘 사람",
        "why": "마트에서 「집에 있었나?」 하고 멈추는 순간은 1인 가구·주부 모두의 공통 경험이에요. 두부 두 모를 양손에 들고 저울처럼 재는 게 과장 포인트예요.",
        "caption": "마트만 오면\n기억이 안 나요",
        "demo": "영수증·음식 사진 한 장으로 재료가 냉장고에 담기는 화면(냉장고가 폰 안에)",
        "cast": "Late-30s Korean man, short tidy hair, neatly trimmed beard, charcoal zip jacket over a white tee.",
        "home": "Bright neighborhood supermarket, refrigerated aisle under soft even light, shelves stocked with plain packs in solid colors.",
        "action": "He stands in the aisle holding two identical white tofu packs, one in each hand. He glances at his phone held between them with the screen turned away from us, squints, looks back at the packs, then slowly raises and lowers them like a balance scale.",
        "audio": "Soft store ambience and a faint freezer hum. He murmurs in Korean: \"집에 두부... 있었나, 없었나.\"",
        "last": "The two tofu packs in his hands.",
    },
    {
        "no": "04", "kbf": "장 볼 게 가장 적은 식단", "title": "대파만 세 단",
        "why": "있는 줄 모르고 또 산 대파가 세 단이 되는 상황은 누구나 한 번쯤 해 봤어요. 꽃다발처럼 모아 드는 게 과장 포인트예요.",
        "caption": "있는 줄 모르고\n또 샀어요",
        "demo": "AI 식단 — 장 볼 게 가장 적어지는 일주일(84개 → 7개)",
        "cast": "Late-20s Korean woman, shoulder-length straight hair, crisp white shirt with the sleeves rolled up.",
        "home": "New officetel kitchen, all-white surfaces, stainless sink, a small dining table by the window.",
        "action": "She unpacks a plain paper grocery bag and takes out a bunch of green onions. She opens the fridge door to put it away and finds two more bunches already there, one slightly wilted. She pauses, takes them out, and holds all three together like a bouquet, looking at them.",
        "audio": "Paper bag rustling, fridge door opening. She says softly in Korean: \"대파만... 세 단이네.\"",
        "last": "The three bunches of green onions held together like a bouquet.",
    },
    {
        "no": "05", "kbf": "요리 모드 · 읽어 주기", "title": "코로 넘겨야 하나",
        "why": "밀가루 묻은 손으로 레시피를 넘기려다 결국 코를 쓰는 순간은 요리해 본 사람이면 다 알아요. 진지한 표정으로 코를 들이미는 게 과장 포인트예요.",
        "caption": "손 씻고 오면\n다음 단계 까먹어요",
        "demo": "요리 모드 — 손대지 않아도 단계를 소리로 읽어 주고 노랗게 짚어 주는 화면",
        "cast": "Mid-20s Korean man, short neat hair, navy tee under a plain canvas apron.",
        "home": "Compact studio kitchen, single induction burner, small wooden counter with a jar and a mixing bowl.",
        "action": "Both of his hands are coated in flour and sticky dough, held up like a surgeon's. A phone leans against a jar with its screen facing away from us. He tries to tap it with a knuckle, then with his pinky, and nothing happens. Very seriously, he leans down and brings his nose toward the screen.",
        "audio": "Soft kitchen ambience. He mutters in Korean: \"잠깐만... 코로 해야 되나.\"",
        "last": "His face inches from the phone, nose almost touching it.",
    },
    {
        "no": "06", "kbf": "검증된 진짜 레시피", "title": "적당히가 얼마예요",
        "why": "「소금 적당히」 앞에서 얼어붙는 요리 초보의 마음은 공유하고 싶어지는 공감이에요. 숟가락 위 소금을 한 알씩 덜어내는 떨리는 손이 과장 포인트예요.",
        "caption": "레시피가\n친절하지 않을 때",
        "demo": "분량까지 정리된 재료·조리 순서, 좋아요·조회수로 검증된 레시피",
        "cast": "Late-20s Korean man, thin-framed glasses, soft gray knit sweater.",
        "home": "Small apartment kitchen at dinner time, a pot simmering on the stove, warm pendant light.",
        "action": "He holds a spoon heaped with salt over the simmering pot. He glances at a phone propped on the counter with its screen turned away from us, then back at the spoon. His hand freezes mid-air, and with a tiny tremor he tips the salt off grain by grain.",
        "audio": "Gentle simmering. He mutters in Korean: \"소금 적당히... 적당히가 얼마만큼인데.\"",
        "last": "The spoon of salt hovering over the pot.",
    },
    {
        "no": "07", "kbf": "요리 AI · 말로 물어보기", "title": "아무거나",
        "why": "「뭐 먹을래?」「아무거나」「그럼 김치찌개?」「그건 별로」는 한국 커플·가족의 국민 대화예요. 태그해서 공유하기 딱 좋은 상황이에요.",
        "caption": "아무거나의 정답,\n물어보세요",
        "demo": "요리 AI에 「가볍고 따뜻한 거」라고 말하면 냉장고 재료로 레시피가 뜨는 화면",
        "cast": "A Korean couple in their early 30s. He wears a plain white tee; she wears a soft gray hoodie. Both look neat and relaxed.",
        "home": "Living room in the evening, a low fabric sofa, warm floor lamp, a plant in the corner.",
        "action": "They sit side by side on the sofa. She scrolls her phone with the screen turned away from us. He turns to her and asks; she answers without looking up. After her last answer he freezes and stares straight ahead, defeated.",
        "audio": "Quiet room tone. Spoken in Korean at a natural pace. He: \"뭐 먹을래?\" She: \"아무거나.\" He: \"김치찌개?\" She: \"그건 별로.\"",
        "last": "His blank, defeated face.",
        # 대사가 곧 웃음 포인트라, 대사 없는 버전은 몸짓으로 같은 흐름을 만든다
        "no_line": "Quiet room tone. Spoken words: none. He turns to her with a questioning look twice; each time she only shrugs without looking up from her phone.",
    },
    {
        "no": "08", "kbf": "가족 · 아낀 돈", "title": "배달 용기 탑",
        "why": "분리수거 날 턱밑까지 쌓인 배달 용기를 드는 순간 「이번 달 우리 뭐 했지?」 하는 반성이 와요. 흔들리는 용기 탑이 과장 포인트예요.",
        "caption": "이번 달 배달 용기,\n몇 개예요?",
        "demo": "가족이 함께 정한 집밥 목표·달성·아낀 돈(추정)이 보이는 마이캘린더",
        "cast": "Early-40s Korean man, neat short hair, dark green quilted vest over a light shirt.",
        "home": "Apartment hallway leading from the kitchen to the front door, warm evening light.",
        "action": "He walks carefully toward the front door carrying a tall stack of clear plastic takeout containers that reaches up to his chin. The tower sways. He stops, rebalances it, then turns his head back toward the kitchen, where his wife is out of frame.",
        "audio": "Plastic creaking softly. He calls back in Korean: \"여보... 우리 이번 달 집밥 몇 번 했어?\"",
        "last": "The wobbling tower of takeout containers.",
    },
]

# 같은 편을 여러 개 뽑을 때 [CAST]·[HOME] 줄만 바꿔 끼우는 변주
VARIANTS = [
    ("A", "원본 그대로", "Keep CAST and HOME as written.", ""),
    ("B", "나이를 한 단계 올리고 머리 모양을 바꿈", "Same role, but about ten years older, with a different hairstyle.", "Older apartment with warm wood cabinets and a tiled wall."),
    ("C", "성별을 바꿈(가능한 편만) · 옷 색을 어둡게", "Same role played by the opposite gender, wearing darker clothes.", "Compact new officetel, all white with stainless steel."),
    ("D", "안경 · 니트 대신 셔츠", "Add glasses; swap the knit for a crisp shirt.", "Detached house with solid wood furniture and a garden visible through the window."),
    ("E", "머리를 올려 묶고 앞치마", "Hair tied up high; add a plain apron.", "Narrow villa kitchen with pale gray counters and potted herbs on the sill."),
]


def clip_prompt(c, no_line=False):
    audio = c["audio"]
    if no_line and c.get("no_line"):
        audio = c["no_line"]
    elif no_line:
        # 장면 소리 문장만 남기고 대사 문장을 뺀다
        audio = re.split(r"(?<=\.)\s+(?=(?:She|He|They|Spoken)\b)", audio)[0] + " " + NO_LINE
    return "\n\n".join([
        COMMON,
        "[CAST]\n" + c["cast"],
        "[HOME]\n" + c["home"],
        "[ACTION]\n" + c["action"],
        "[AUDIO]\n" + audio,
        "[LAST SECOND]\n" + c["last"],
    ])


def old_blocks():
    """v1 완성본(REEL_PROMPTS_FULL.md)의 코드 블록 8개 — 참고용으로 페이지 맨 아래에 접어 둔다."""
    md = (ROOT / "store/REEL_PROMPTS_FULL.md").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r"^## (\d+\. .+?)\n\n```\n(.*?)```", md, re.S | re.M):
        out.append((m.group(1), m.group(2).strip()))
    return out


def write_md():
    lines = [
        "# 릴스 후킹 영상 v2 — 제미나이(Veo) 프롬프트 8편",
        "",
        "만든 날: 2026-09-29 · 만든 스크립트: `scripts/gen_reel_hooks_v2.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).",
        "폰에서 복사해 쓰는 페이지는 아티팩트로 게시한다. v1(2026-09-23)은 [REEL_PROMPTS_FULL.md](REEL_PROMPTS_FULL.md).",
        "",
        "## 방향",
        "- 기능 설명이 아니라 **「이거 완전 나잖아」 하고 공유하고 싶어지는 니즈 상황**. 쿡매치 핵심 기능(KBF)마다 한 편.",
        "- 3~5초 안에 상황이 끝나고, 나머지는 자연스럽게 흘러간다. 마지막 1초는 지정한 대상으로 천천히 다가간다.",
        "- 웃음은 슬랩스틱이 아니라 **무표정한 과장 하나**에서. 인물은 단정하게, 집은 정돈되게.",
        "",
        "## 한글·자막이 화면에 나오지 않게",
        "- 프롬프트는 **영어**. 한국어는 AUDIO 칸의 **소리로만 나오는 대사**에만 있다.",
        "- 「자막·글자 금지」라고 적지 않는다 — 그리지 말아야 할 것의 이름을 적으면 오히려 그 단어를 힌트로 쓴다. 대신 **있어야 할 것**만 적는다(깨끗한 원본 촬영분, 라벨 없는 소품, 화면이 돌아간 폰).",
        "- 그래도 나오면: ① 제미나이에게 「자막 빼 줘」라고 말하지 말고 **새 대화에서 같은 프롬프트로 다시** 만든다 ② **대사 없는 버전**으로 만들고 대사는 편집에서 목소리·자막으로 얹는다 ③ 쓰는 화면에 제외할 요소(negative prompt) 칸이 있으면 거기에만 `subtitles, captions, on-screen text, letters, watermark` 를 적는다 ④ 자막이 화면 아래에만 살짝 나오면 우리 자막(화면 세로 3/4 지점)과 확대·크롭으로 가린다.",
        "",
        "## 공통 지시 (모든 편 맨 앞 — 아래 완성본에 이미 합쳐져 있다)",
        "",
        "```",
        COMMON,
        "```",
        "",
    ]
    for c in CLIPS:
        lines += [
            f"## {c['no']}. {c['title']} — {c['kbf']}",
            "",
            f"- **공감 포인트**: {c['why']}",
            f"- **편집 때 얹을 자막(제안)**: {c['caption'].replace(chr(10), ' / ')}",
            f"- **이어 붙일 앱 데모**: {c['demo']}",
            "",
            "```",
            clip_prompt(c),
            "```",
            "",
        ]
    lines += [
        "## 같은 편을 여러 개 뽑을 때 — 변주",
        "",
        "[CAST]·[HOME] 줄만 바꿔 넣는다(장면·대사·마지막 1초는 그대로). 얼굴이 계속 비슷하면 [CAST] 끝에 `A completely different face from any earlier clip.` 를 붙인다.",
        "",
        "| 세트 | 바꾸는 것 | [CAST] 에 덧붙이기 | [HOME] 바꾸기 |",
        "|---|---|---|---|",
    ]
    for v in VARIANTS:
        lines.append(f"| {v[0]} | {v[1]} | `{v[2]}` | {('`' + v[3] + '`') if v[3] else '그대로'} |")
    (ROOT / "store/REEL_HOOKS_V2.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def write_html(path: Path):
    data = {
        "clips": [dict(c, prompt=clip_prompt(c), promptNoLine=clip_prompt(c, True)) for c in CLIPS],
        "variants": VARIANTS,
        "old": old_blocks(),
    }
    tpl = (ROOT / "scripts/reel_hooks_v2_template.html").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    path.write_text(tpl.replace("/*__DATA__*/null", payload), encoding="utf-8")


if __name__ == "__main__":
    import sys
    write_md()
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "store/reel_hooks_v2.html"
    write_html(out)
    print("wrote store/REEL_HOOKS_V2.md and", out)
