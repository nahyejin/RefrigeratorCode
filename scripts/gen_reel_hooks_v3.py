"""릴스 후킹 영상 v3 — 제미나이(Veo)에 붙일 프롬프트 8편을 문서(store/REEL_HOOKS_V3.md)와 폰용 페이지(HTML)로 만든다.

    python scripts/gen_reel_hooks_v3.py [out.html]   # store/REEL_HOOKS_V3.md + 폰용 HTML(아티팩트 게시용)

v2(2026-09-29)로 뽑은 9개를 실제로 편집해 보고 나온 문제를 막는 판(2026-10-06 사용자 요청):
  · 가로 영상: 제미나이가 자꾸 16:9로 만든다 → 프롬프트 맨 앞 [FORMAT] 블록과 맨 끝 리마인더 두 군데에 세로 9:16(1080×1920)을
    못 박고, 구도도 세로 화면 기준으로 적는다(인물은 가운데 세로 기둥, 손·소품은 아래 1/3).
  · 어색한 연기: 대파 편에서 카메라 쪽으로 고개를 돌려 입을 크게 벌리는 표정이 나왔다 → ACTING 블록에 「반응은 작게, 입은 말할
    때만, 시선은 소품·상대에게, 대사하는 동안에도 손은 하던 일을 계속」을 긍정문으로 적는다.
  · 어색한 대사: 실생활 반말·짧게·말끝 흐림. 혼잣말보다 옆 사람과 주고받는 말. 상황을 설명하는 대사는 쓰지 않는다.
  · 물건이 늘어남: 냉장고 편에서 조리대에 폰이 하나 더 생겼다 → CONTINUITY 블록(개수·위치 유지).
  · 한글: v2 방식 그대로 — 프롬프트는 영어, 한국어는 AUDIO 칸의 소리로만, 그리지 말 것의 이름 대신 있어야 할 것만(무지 소품).
  · 편 번호 = 이어 붙일 앱 데모 번호(01 사진 인식 … 08 가족·아낀 돈). v2에서 짝을 다시 맞춘 일이 있어서 처음부터 맞춰 둔다.
  · 자막은 웃음 포인트 순간에 띄운다(0초부터 띄우면 결말을 미리 말해 버린다) — 편마다 「자막 띄울 순간」을 적어 둔다.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FORMAT = """[FORMAT — READ FIRST]
VERTICAL PORTRAIT VIDEO. Aspect ratio 9:16, 1080 pixels wide by 1920 pixels tall: the frame is much taller than it is wide, shot for a phone held upright, like an Instagram Reel or a TikTok. Compose every moment for this tall frame: the person stands in the center column with a little headroom, hands and props sit in the lower third, and the background stretches up behind them. The whole video is this one vertical frame from the first to the last second. Do not make a landscape 16:9 or square video."""

COMMON = """[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny moment lands around the middle, then plays out naturally to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd detail, played completely straight. Warm, never mean.
ACTING: Natural, understated performances, like a Korean slice-of-life drama or a documentary where people forget the camera is there. Reactions stay small and real: a short pause, a glance, a breath out through the nose, a tired half-smile, a tiny shake of the head. Faces stay relaxed; mouths open only to speak. Eyes go to the props or to each other and stay away from the lens. Hands keep doing what they were doing while people talk (holding, wiping, putting things away), and lines come with natural timing, small pauses and the odd overlap. Every gesture is something a real person would do at home.
SPEECH: Everyday spoken Korean at normal conversational speed, the way people really talk at home: short, casual banmal, half under the breath, words trailing off. Lip movements match the words exactly. Each line is spoken once, by the person named in AUDIO, and nobody narrates what is happening.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field, vertical framing. Medium shot on the people by default. Real-time motion only.
CONTINUITY: Every object stays the same for the whole take: the same number of items in the same places. Nothing appears, duplicates or vanishes, and each person keeps the same face, hair and clothes.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there."""

REMINDER = "[FORMAT REMINDER] Vertical 9:16 portrait video, 1080×1920, taller than wide, from the first frame to the last."

# 대사 없는 버전 — 대사 대신 숨소리·짧은 웃음만. 대사는 편집에서 목소리·자막으로 얹는다(화면에 글자가 섞일 틈이 아예 없다).
NO_LINE = "Spoken words: none. Only small natural sounds: a breath out through the nose, a quiet sigh."

CLIPS = [
    {
        "no": "01", "kbf": "사진 한 장으로 냉장고 채우기", "title": "계란 있어? 없어?",
        "why": "장 보다가 「집에 계란 있어?」 하고 전화하는 건 거의 모든 집에서 하는 일이에요. 냉장고를 한참 뒤져서 찾은 게 계란 한 알이라는 게 웃음 포인트예요.",
        "caption": "냉장고 사정,\n아직도 전화로 물어봐요?",
        "punch": "계란판을 열어 한 알만 보이는 순간(「…한 개 있어」)",
        "demo": "01 사진 인식 — 영수증·음식 사진 한 장으로 재료가 냉장고에 담기는 화면(냉장고가 폰 안에)",
        "cast": "Late-30s Korean man, short tidy hair, light gray hoodie, sweatpants, thick socks. His wife is heard only as a small voice from his phone.",
        "home": "Apartment kitchen in the afternoon, white fridge, light oak floor, a fruit bowl on the counter.",
        "action": "He crouches in front of the open fridge with his phone pinched between his shoulder and his ear, screen facing his cheek. He slides containers aside one by one, peering behind them. He finds a plain pastel egg carton at the very back, pulls it out and flips the lid open: a single egg sits inside. He looks at it for a beat.",
        "audio": "Fridge hum, containers sliding. His wife's voice, small and tinny from the phone: \"계란 있어? 없어?\" He, still digging: \"잠깐만, 잠깐만...\" After he opens the carton, flat: \"...한 개 있어.\"",
        "no_line": "Fridge hum, containers sliding, the soft click of the carton lid. He lets out one breath through his nose. Spoken words: none.",
        "last": "The open egg carton with the single egg inside.",
    },
    {
        "no": "02", "kbf": "있는 재료로 매칭", "title": "냉장고 재료 라인업",
        "why": "냉장고에 남은 걸 다 꺼내 놓고 「이걸로 뭐가 되나」 고민하는 밤은 누구나 겪어요. 재료를 경찰서 용의자처럼 한 줄로 세워 놓고 팔짱 끼고 노려보는 게 과장 포인트예요.",
        "caption": "재료는 있는데\n요리가 안 떠올라요",
        "punch": "「이걸로… 뭐 되나 보고 있어」 대답하는 순간",
        "demo": "02 매칭 — 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면",
        "cast": "Early-30s Korean man, short neat hair, navy crew-neck sweatshirt. His girlfriend, late 20s, hair in a loose bun, soft gray cardigan.",
        "home": "Small apartment kitchen at night, warm pendant light over a wooden counter, a window with the city dark outside.",
        "action": "On the wooden counter he has lined up, evenly spaced in one neat row: one egg, half an onion wrapped in plastic, a single sausage and one slice of cheese. He stands back with his arms crossed, studying the row very seriously, like a detective at a lineup. His girlfriend walks in behind him holding a mug, stops and looks at the row, then at him.",
        "audio": "Quiet kitchen hum. She, puzzled: \"뭐 해?\" He, without taking his eyes off the counter: \"이걸로... 뭐 되나 보고 있어.\"",
        "no_line": "Quiet kitchen hum, a mug set down softly. She lets out a small laugh through her nose. Spoken words: none.",
        "last": "The four lonely ingredients lined up on the counter.",
    },
    {
        "no": "03", "kbf": "요리 모드 · 손 안 대고 넘기기", "title": "위로, 아니 너무 올렸어",
        "why": "양념 묻은 손으로 레시피를 못 넘겨서 옆 사람을 부르면, 꼭 엉뚱한 데까지 스크롤해 버려요. 커플·가족끼리 태그하기 좋은 상황이에요.",
        "caption": "손이 바쁠 땐\n레시피도 못 넘겨요",
        "punch": "「아니 너무 올렸어」 하는 순간",
        "demo": "03 요리 모드 — 손대지 않아도 단계를 소리로 읽어 주고 노랗게 짚어 주는 화면",
        "cast": "Early-30s Korean woman, hair tied up high, plain beige apron over a white tee, clear food-prep gloves covered in red marinade. Her husband, early 30s, short hair, dark green t-shirt.",
        "home": "Bright apartment kitchen in the early evening, white counter with a mixing bowl of marinated meat, a phone propped against a jar.",
        "action": "She is mixing the meat in the bowl with both gloved hands. The phone leaning on the jar has its screen turned away from us. She glances at it, holds her messy hands up and calls her husband over without moving. He walks in, stands beside her and scrolls the phone with one finger while she leans in to read. He scrolls too far; she tilts her head, he scrolls back, she sighs patiently.",
        "audio": "Soft squish of marinade. She: \"자기야, 이것 좀 올려 줘.\" A beat later, while he scrolls: \"아니 위로... 아니, 너무 올렸어.\" He, quietly: \"아 어디...\"",
        "no_line": "Soft squish of marinade, a finger tapping glass. She sighs patiently. Spoken words: none.",
        "last": "Her red gloved hands held up in the air next to the phone.",
    },
    {
        "no": "04", "kbf": "장 볼 게 가장 적은 식단", "title": "안 닫히는 냉장고",
        "why": "장을 잔뜩 봐 와서 꽉 찬 냉장고에 테트리스하듯 밀어 넣는 건 다들 해 봤어요. 엉덩이로 문을 닫았는데 스르륵 다시 열리는 게 과장 포인트예요.",
        "caption": "이번 주도\n장을 너무 많이 봤어요",
        "punch": "문이 다시 스르륵 열리는 순간",
        "demo": "04 AI 식단 — 냉장고 재료로 짜서 장 볼 게 가장 적어지는 일주일(84개 → 7개)",
        "cast": "Late-30s Korean woman, shoulder-length hair tucked behind her ears, cream knit top. Her husband, around 40, glasses, gray sweater, seated at the dining table in the background.",
        "home": "Family apartment kitchen in the afternoon, white fridge, dining table by the window, two plain paper grocery bags on the floor.",
        "action": "The fridge is already packed full. She pushes one more container in and rearranges two others to make it fit, then closes the door and gives it a gentle push with her hip. She turns away, and behind her the door slowly swings back open. She stops, looks at it, and pushes it closed again with her palm, holding it there for a second.",
        "audio": "Containers clinking, the fridge seal. Her husband, from the table, mild: \"또 장 봤어?\" She, palm still on the door: \"...이번 주 거야.\"",
        "no_line": "Containers clinking, the soft creak of the fridge door swinging open. She breathes out slowly. Spoken words: none.",
        "last": "Her hand pressed flat against the fridge door, holding it shut.",
    },
    {
        "no": "05", "kbf": "유통기한 임박 알림", "title": "냄새 테스트",
        "why": "유통기한 지난 우유를 냄새로 확인하다가 결국 옆 사람한테 넘기는 장면은 거의 모든 커플이 겪어요. 맡아 보고 슬쩍 되돌려 주는 게 웃음 포인트예요.",
        "caption": "유통기한,\n아직도 냄새로 확인해요?",
        "punch": "「…너 먹어」 하고 우유를 되돌려 주는 순간",
        "demo": "05 유통기한 알림 — 푸시 알림 → 유통기한 자동 계산 → 임박 재료 레시피 추천",
        "cast": "A Korean couple in their early 30s. He wears a plain white t-shirt and has messy morning hair; she wears a soft lavender cardigan, hair down.",
        "home": "Apartment kitchen on a weekend morning, sunlight through the window, a toaster and two mugs on the counter.",
        "action": "He opens a plain white milk carton, sniffs it, pauses, sniffs again and tilts his head, unsure. He holds it out to her. She takes it, sniffs once, holds still for a beat, then calmly hands it straight back to him with a small polite smile.",
        "audio": "Morning kitchen sounds, the carton cap twisting. He: \"이거 괜찮은 거 같아?\" She, after one sniff, handing it back: \"...너 먹어.\"",
        "no_line": "Morning kitchen sounds, the carton cap twisting, one sniff, then another. She lets out a short laugh through her nose. Spoken words: none.",
        "last": "The milk carton held between them.",
    },
    {
        "no": "06", "kbf": "요리 AI · 말로 물어보기", "title": "엄마, 뭐 해 먹지?",
        "why": "냉장고에 있는 재료를 불러 주며 엄마한테 전화로 메뉴를 묻는 건 자취생·신혼부부 모두의 공감 포인트예요. 엄마의 「맨날 물어보니」가 웃음 포인트예요.",
        "caption": "엄마 말고\n물어볼 데 없나요?",
        "punch": "엄마가 「몇 번을 말하니」 하는 순간",
        "demo": "06 요리 AI — 말하듯 물어보면 냉장고 재료로 딱 맞는 레시피를 찾아 주는 화면",
        "cast": "Late-20s Korean woman, straight hair to her collarbone, oversized light blue shirt. Her mother is heard only as a voice from the phone on speaker.",
        "home": "Small officetel kitchen in the evening, warm lamp, a tofu block and a zucchini on the cutting board.",
        "action": "Her phone lies face down on the counter on speaker. She holds a zucchini in one hand and taps the tofu pack with the other, looking down at them while she talks. When her mother answers, she presses her lips together, nods to herself and starts slicing the zucchini.",
        "audio": "Soft kitchen sounds. She, toward the phone: \"엄마, 집에 두부랑 애호박 있는데 뭐 해 먹지?\" Her mother's voice from the phone speaker, warm but tired: \"된장찌개 하면 되잖아. 몇 번을 말하니.\" She, quietly: \"...알았어.\"",
        "no_line": "Soft kitchen sounds, a faint murmur from the phone speaker, the knife meeting the board. She nods to herself. Spoken words: none.",
        "last": "The zucchini being sliced on the cutting board.",
    },
    {
        "no": "07", "kbf": "검증된 진짜 레시피", "title": "근데 이거 뭐야?",
        "why": "레시피 영상 보고 열심히 만들었는데 결과물이 전혀 다르게 나오는 경험은 요리해 본 사람이면 다 있어요. 상대가 예의 바르게 맛있다고 한 뒤 묻는 한마디가 웃음 포인트예요.",
        "caption": "레시피대로 했는데\n왜 이렇게 됐지?",
        "punch": "「근데 이거 뭐야?」 하는 순간",
        "demo": "07 진짜 레시피 — 좋아요·조회수로 검증된 레시피, 분량까지 정리된 재료·조리 순서",
        "cast": "A Korean couple in their late 20s. He wears glasses and a soft gray knit sweater; she has a short bob and a cream blouse.",
        "home": "Small apartment dining table at dinner time, warm pendant light, two plain bowls of rice and spoons.",
        "action": "He sets a plain white plate of a dark, shapeless braised dish in front of her and sits down, watching her hopefully. She takes a careful bite, chews slowly, nods politely. A short pause. She looks down at the plate again. He keeps watching her.",
        "audio": "Quiet dinner table sounds. She, chewing, kind: \"음... 맛있네.\" A beat. \"근데 이거 뭐야?\" He, small voice: \"...찜닭.\"",
        "no_line": "Quiet dinner table sounds, a spoon on a plate, slow chewing. She nods politely, then pauses. Spoken words: none.",
        "last": "The shapeless dish on the white plate.",
    },
    {
        "no": "08", "kbf": "가족 · 아낀 돈", "title": "또 뵙네요",
        "why": "배달 기사님이 얼굴을 알아볼 만큼 시켜 먹었다는 걸 깨닫는 순간은 웃기면서 찔려요. 기사님의 반가운 「또 뵙네요」가 웃음 포인트예요.",
        "caption": "배달 기사님이\n우리 얼굴을 알아요",
        "punch": "기사님이 「또 뵙네요」 하는 순간",
        "demo": "08 가족·아낀 돈 — 가족이 함께 정한 집밥 목표·달성·아낀 돈(추정)이 보이는 마이캘린더",
        "cast": "A Korean couple in their mid 30s in comfortable home clothes; she has her hair in a claw clip, he wears a navy hoodie. A friendly delivery rider in his 30s wears a plain black jacket with no logos and holds a plain white paper bag.",
        "home": "Apartment front door in the evening, warm entryway light, shoes neatly lined up on the floor.",
        "action": "She opens the front door. The rider hands her the plain bag and recognizes her with a friendly smile and a small nod. She smiles back politely, a little awkward, takes the bag and closes the door. She turns around; her husband is standing behind her in the hallway. They look at each other.",
        "audio": "Door opening, paper bag rustling. Rider, cheerful: \"아, 또 뵙네요.\" She, polite and a little embarrassed: \"아... 네, 감사합니다.\" Door closes. Her husband, quietly: \"...우리 단골이네.\"",
        "no_line": "Door opening, paper bag rustling, the door closing softly. The couple look at each other and let out a short laugh. Spoken words: none.",
        "last": "The two of them looking at each other, the delivery bag between them.",
    },
]

# 같은 편을 여러 개 뽑을 때 [CAST]·[HOME] 줄만 바꿔 끼우는 변주
VARIANTS = [
    ("A", "원본 그대로", "Keep CAST and HOME as written.", ""),
    ("B", "나이를 한 단계 올리고 머리 모양을 바꿈", "Same roles, but about ten years older, with different hairstyles.", "Older apartment with warm wood cabinets and a tiled wall."),
    ("C", "성별을 바꿈(가능한 편만) · 옷 색을 어둡게", "Same roles played by the opposite gender, wearing darker clothes.", "Compact new officetel, all white with stainless steel."),
    ("D", "안경 · 니트 대신 셔츠", "Add glasses; swap knits for crisp shirts.", "Detached house with solid wood furniture and a garden visible through the window."),
    ("E", "머리를 올려 묶고 앞치마", "Hair tied up high; add plain aprons.", "Narrow villa kitchen with pale gray counters and potted herbs on the sill."),
]


def clip_prompt(c, no_line=False):
    audio = c["no_line"] if no_line else c["audio"]
    return "\n\n".join([
        FORMAT,
        COMMON,
        f"[CAST]\n{c['cast']}",
        f"[HOME]\n{c['home']}",
        f"[ACTION]\n{c['action']}",
        f"[AUDIO]\n{audio}",
        f"[LAST SECOND]\n{c['last']}",
        REMINDER,
    ])


def v2_blocks():
    """v2 완성본(REEL_HOOKS_V2.md)의 편별 코드 블록 — 참고용으로 페이지 맨 아래에 접어 둔다."""
    md = (ROOT / "store/REEL_HOOKS_V2.md").read_text(encoding="utf-8")
    out = []
    for m in re.finditer(r"^## (\d+\. .+?)\n\n(?:- [^\n]*\n)+\n```\n(.*?)```", md, re.S | re.M):
        out.append((m.group(1), m.group(2).strip()))
    return out


def write_md():
    lines = [
        "# 릴스 후킹 영상 v3 — 제미나이(Veo) 프롬프트 8편",
        "",
        "만든 날: 2026-10-06 · 만든 스크립트: `scripts/gen_reel_hooks_v3.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).",
        "폰에서 복사해 쓰는 페이지는 아티팩트로 게시한다. v2(2026-09-29)는 [REEL_HOOKS_V2.md](REEL_HOOKS_V2.md).",
        "",
        "## v2를 편집해 보고 바꾼 것",
        "- **세로 9:16**: 제미나이가 가로로 만드는 일이 잦아, 프롬프트 맨 앞 [FORMAT]과 맨 끝 리마인더 두 군데에 세로 1080×1920을 적고 구도도 세로 화면 기준으로 적었다.",
        "- **연기**: 대파 편의 「카메라 쪽으로 입 벌리고 놀라기」 같은 과한 반응을 막도록 ACTING 블록 — 반응은 작게, 입은 말할 때만, 시선은 소품·상대에게, 대사 중에도 손은 하던 일을 계속.",
        "- **대사**: 실생활 반말, 짧게, 끝을 흐리게. 혼잣말보다 주고받는 말. 상황을 설명하는 대사는 쓰지 않는다.",
        "- **물건 개수 유지**: 냉장고 편에서 폰이 하나 더 생긴 일 때문에 CONTINUITY 블록을 넣었다.",
        "- **편 번호 = 앱 데모 번호**: 01 사진 인식, 02 매칭, 03 요리 모드, 04 AI 식단, 05 유통기한, 06 요리 AI, 07 진짜 레시피, 08 가족·아낀 돈.",
        "- **자막 띄울 순간**을 편마다 적었다. 후킹 자막은 웃음 포인트에서 띄운다(0초부터 띄우면 결말을 미리 말해 버린다).",
        "",
        "## 세로로 안 나올 때",
        "- 쓰는 화면에 비율 고르는 칸이 있으면 **9:16(세로)** 을 고른다.",
        "- 제미나이 앱에서 계속 가로로 나오면, 같은 대화에서 고쳐 달라고 하지 말고 **새 대화에서 다시** 붙인다. 그래도 가로면 비율을 고를 수 있는 Google Flow에서 세로를 고르고 같은 프롬프트를 쓴다.",
        "- 가로 영상을 세로로 잘라 쓰면 화질이 떨어지고 인물이 잘리니, 되도록 다시 뽑는다.",
        "",
        "## 한글·자막이 화면에 나오지 않게 (v2와 같음)",
        "- 프롬프트는 **영어**. 한국어는 AUDIO 칸의 **소리로만 나오는 대사**에만 있다.",
        "- 「자막·글자 금지」라고 적지 않는다 — 그리지 말아야 할 것의 이름을 적으면 오히려 그 단어를 힌트로 쓴다. 대신 **있어야 할 것**만 적는다(깨끗한 원본 촬영분, 무지 소품, 화면이 돌아간 폰).",
        "- 그래도 나오면: ① **새 대화에서 같은 프롬프트로 다시** ② **대사 없는 버전**으로 만들고 대사는 편집에서 목소리·자막으로 ③ 제외할 요소(negative prompt) 칸이 있으면 거기에만 `subtitles, captions, on-screen text, letters, watermark`.",
        "",
        "## 공통 지시 (모든 편 맨 앞·맨 끝 — 아래 완성본에 이미 합쳐져 있다)",
        "",
        "```",
        FORMAT,
        "",
        COMMON,
        "",
        "…편별 [CAST]·[HOME]·[ACTION]·[AUDIO]·[LAST SECOND]…",
        "",
        REMINDER,
        "```",
        "",
    ]
    for c in CLIPS:
        lines += [
            f"## {c['no']}. {c['title']} — {c['kbf']}",
            "",
            f"- **공감 포인트**: {c['why']}",
            f"- **편집 때 얹을 자막(제안)**: {c['caption'].replace(chr(10), ' / ')}",
            f"- **자막 띄울 순간**: {c['punch']}",
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
        "[CAST]·[HOME] 줄만 바꿔 넣는다(장면·대사·마지막 1초는 그대로). 얼굴이 계속 비슷하면 [CAST] 끝에 `Completely different faces from any earlier clip.` 를 붙인다.",
        "",
        "| 세트 | 바꾸는 것 | [CAST] 에 덧붙이기 | [HOME] 바꾸기 |",
        "|---|---|---|---|",
    ]
    for v in VARIANTS:
        lines.append(f"| {v[0]} | {v[1]} | `{v[2]}` | {('`' + v[3] + '`') if v[3] else '그대로'} |")
    (ROOT / "store/REEL_HOOKS_V3.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def write_html(path: Path):
    data = {
        "clips": [dict(c, prompt=clip_prompt(c), promptNoLine=clip_prompt(c, True)) for c in CLIPS],
        "variants": VARIANTS,
        "old": v2_blocks(),
    }
    tpl = (ROOT / "scripts/reel_hooks_v3_template.html").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    path.write_text(tpl.replace("/*__DATA__*/null", payload), encoding="utf-8")


if __name__ == "__main__":
    import sys
    write_md()
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "store/reel_hooks_v3.html"
    write_html(out)
    print("wrote store/REEL_HOOKS_V3.md and", out, "| v2 blocks:", len(v2_blocks()))
