"""릴스 후킹 영상 4벌 다듬은 판(v5) — 제미나이(Veo) 프롬프트 8편을 문서(store/REEL_HOOKS_V5.md)와 폰용 페이지(HTML)로 만든다.

    python scripts/gen_reel_hooks_v5.py [out.html]   # store/REEL_HOOKS_V5.md + 폰용 HTML(아티팩트 게시용, 4벌과 같은 주소에 덮어쓴다)

규칙은 store/VEO_PROMPT_RULES.md (2026-10-20). 4벌과 달라진 것:
  · 제미나이가 고쳐 준 짧은 공통 지시(STRICTLY STATIC ENVIRONMENT)를 그대로 쓴다 — 사용자가 뽑아 보니 오류가 거의 없고 한결 자연스러웠다.
  · 상태가 바뀌는 행동(문 열기·꺼내기·주고받기·먹기·마시기·스크롤·화면 켜짐/꺼짐)을 모두 뺐다. 물건은 처음부터 손이나 탁자 위에.
  · 이야기 논리 점검 3개(어디서 왔나 / 「이거·저거」와 거리 / 대사 속 장소 = HOME)를 편마다 적용했다.
    01 우유: 남자가 왼쪽에서 두세 걸음 들어오고(점퍼 차림), 우유 두 통은 3m 떨어진 식탁 위 → 「식탁에 있는 저건」.
후킹 자막·데모 번호·변주는 4벌과 같다.
"""
import json
from pathlib import Path

from gen_reel_hooks_v4 import IMAGE_HEAD, IMAGE_TAIL, VARIANTS

ROOT = Path(__file__).resolve().parent.parent

FORMAT = """Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly."""

MOTION_STILL = "No one walks, no doors open, no objects are passed back and forth."


def direction(motion=MOTION_STILL):
    return f"""[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. {motion} Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music."""


REMINDER = "Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels."

CLIPS = [
    {
        "no": "01", "kbf": "사진 한 장으로 냉장고 채우기", "title": "그럼 식탁에 있는 저건 누가 산 거야?",
        "why": "냉장고에 뭐가 있는지 몰라서 같은 걸 또 사 오는 일, 다들 있죠. 남편도 사 오고 아내도 샀다는데, 식탁엔 이미 두 통 — 그럼 저건 누가 산 건지 아무도 모른다는 게 반전이에요.",
        "hook": "둘이 장 봤는데\n우유가 왜 세 통?", "hook_kind": "🧠 상식 파괴형",
        "alts": [("💛 감정 공감형", "냉장고에 뭐 있는지\n아무도 몰라요"), ("📱 기능 활용형", "영수증 찍어 두면\n냉장고가 기억해요")],
        "demo": "01 사진 인식 — 영수증 사진 한 장으로 산 재료가 냉장고에 담기는 화면(이미 있는 재료가 보임)",
        "motion": "Only the man takes two or three slow steps in from the left side of the frame at the start, then stands still; nobody else walks. No doors open, no objects are passed back and forth.",
        "story": "남자는 점퍼 차림으로 왼쪽에서 두세 걸음 들어온다(밖에서 옴). 우유 두 통은 3m 뒤 식탁 위라 「저건」. 대사의 「식탁」 = HOME 의 식탁.",
        "cast": "Early-30s Korean man, short tidy hair, light gray zip-up jacket over a navy sweatshirt, just home from outside. His wife, early 30s, hair in a low ponytail, beige knit cardigan, standing in the foreground on the right.",
        "home": "Apartment kitchen and dining area in the afternoon. About three meters behind the couple, clearly visible in the frame but slightly out of focus, is a small wooden dining table. On that table are exactly two identical short plain white milk bottles with blue caps, standing apart, and nothing else. No door is visible. The background is simple.",
        "action": "The man comes in from the left side of the frame, taking two or three slow steps while holding one identical short plain white milk bottle with a blue cap in his right hand, then stops beside his wife. He keeps holding the bottle the whole time and never puts it down. She turns her head to him. Then both of them turn their heads and look over at the dining table in the background. Nobody walks to the table and nobody touches the two bottles on it; they never move. Count: two bottles on the table plus the one in his hand, three in total, the same from start to end.",
        "audio": "He, walking in and lifting the bottle slightly: \"자기야, 나 오다가 우유 사왔어.\"\nShe, turning to him: \"어? 나도 아까 샀는데?\"\nHe, looking over at the dining table in the background: \"...엥? 그럼 식탁에 있는 저건 누가 산 거야?\"\n(She looks at the table and lets out a soft sigh with a smirk.)",
        "no_line": "Quiet home sounds. He steps in holding a milk bottle and stops beside his wife; she turns to him; both look over at the two bottles on the dining table behind them; she sighs with a smirk. Spoken words: none.",
        "last": "The two of them in the foreground, his milk bottle in his hand, and the two bottles on the dining table behind them, perfectly still.",
        "first": "Afternoon apartment. A woman in a beige cardigan stands in the foreground on the right. A man in a light gray zip-up jacket stands at the left edge of the frame holding a short plain white milk bottle with a blue cap, just arriving. About three meters behind them, a small wooden dining table holds exactly two identical milk bottles, slightly out of focus.",
    },
    {
        "no": "02", "kbf": "있는 재료로 매칭", "title": "이걸로 뭐 해 먹지?",
        "why": "저녁 메뉴를 정하려고 재료를 꺼내 보면 애매하게 남은 두 개가 전부일 때가 있죠. 둘이 머리를 맞대다가 결국 「그냥 소시지 구워 먹자」로 끝나는 게 현실이에요.",
        "hook": "양배추랑 소시지로\n뭐가 된다고?", "hook_kind": "🧠 상식 파괴형",
        "alts": [("🛠️ 해결책 제시형", "재료가 두 개뿐일 때\n이렇게 찾아요"), ("📱 기능 활용형", "남은 재료만 넣으면\n요리가 나와요")],
        "demo": "02 매칭 — 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면",
        "motion": MOTION_STILL,
        "story": "재료는 이미 꺼내 바로 앞 조리대에 있다 → 「이걸로」(가까움). 냉장고는 뒤에 닫힌 채.",
        "cast": "Mid-30s Korean woman, shoulder-length hair, oatmeal sweater. Her husband, mid-30s, short tidy hair, gray cardigan, stands right next to her.",
        "home": "Open kitchen, evening, warm pendant light. The fridge in the background is completely closed. On the kitchen counter in front of her there are exactly two items, apart from each other: half a green cabbage and one plain sausage.",
        "action": "She stands at the counter with both hands resting flat on the surface, looking down at the cabbage and the sausage. Her husband leans in slightly to look at them. Nobody touches or moves the food.",
        "audio": "He: \"오늘 저녁 뭐 먹어?\"\nShe, looking down at the counter: \"양배추 반 통이랑 소시지 하나 있는데... 이걸로 뭐 해 먹지?\"\nHe: \"볶음밥 할까?\"\nShe: \"밥이 없어.\"\nHe, after a short beat: \"...그럼 그냥 소시지 구워 먹자.\"\n(She nods very slightly.)",
        "no_line": "Quiet kitchen. Both look down at half a cabbage and one sausage on the counter; he suggests something, she shakes her head slightly, he shrugs, she nods very slightly. Spoken words: none.",
        "last": "Both of them looking down at the cabbage and the sausage, motionless.",
        "first": "Evening kitchen under a warm pendant light. A woman in an oatmeal sweater stands at the counter with both hands flat on it, looking down at half a green cabbage and one plain sausage. Her husband in a gray cardigan stands right next to her. The fridge behind them is closed.",
    },
    {
        "no": "03", "kbf": "요리 모드 · 손 안 대고 넘기기", "title": "그럼 코로 눌러 봐",
        "why": "요리하다 레시피 화면이 꺼지면 손이 비어 있지 않아서 난감하죠. 오븐 장갑 낀 채 옆 사람한테 부탁했더니 「코로 눌러 봐」가 돌아오는 게 웃음 포인트예요.",
        "hook": "오븐 장갑 끼고\n화면을 켠다고?", "hook_kind": "🧠 상식 파괴형",
        "alts": [("💛 감정 공감형", "요리 중에 화면 꺼지면\n진짜 난감하죠"), ("📱 기능 활용형", "손 안 대도\n레시피를 읽어 줘요")],
        "demo": "03 요리 모드 — 화면을 안 만져도 단계별로 읽어 주고 지금 단계를 짚어 주는 화면",
        "motion": MOTION_STILL,
        "story": "폰은 바로 앞 거치대에 처음부터 꺼진 채(켜짐→꺼짐 변화 없음) → 「이것 좀」. 아무도 폰을 만지지 않는다.",
        "cast": "Late-20s Korean woman, hair tied up in a bun, light blue apron, wearing thick plain gray oven mitts on both hands. Her boyfriend, late 20s, black hoodie, stands right next to her.",
        "home": "Bright kitchen in the daytime. A phone stands upright in a simple phone stand on the counter in front of her, its screen dark the whole time. The counter is otherwise bare.",
        "action": "She holds both mitted hands up near her chest, helpless. She looks at the phone, then at her boyfriend. He just looks at the phone. Neither of them touches the phone, and it never moves.",
        "audio": "She, looking at the phone: \"아, 화면 꺼졌다. 자기야, 이것 좀 켜 줘. 나 장갑 꼈어.\"\nHe: \"팔꿈치로 눌러 봐.\"\nShe: \"해 봤어. 안 돼.\"\nHe, deadpan: \"그럼 코로 눌러 봐, 코로.\"\n(She glares at him with a tired, expressionless face.)",
        "no_line": "Quiet kitchen. She holds up her oven-mitted hands helplessly, looks at the dark phone, then at her boyfriend; he looks at the phone and says something deadpan; she glares at him. Spoken words: none.",
        "last": "Her tired glare, oven mitts held up near her chest.",
        "first": "Bright kitchen. A woman in a light blue apron and thick plain gray oven mitts holds her hands up near her chest, looking at a phone standing in a simple stand on the counter, its screen dark. Her boyfriend in a black hoodie stands right next to her.",
    },
    {
        "no": "04", "kbf": "장 볼 게 가장 적은 식단", "title": "화요일도 치킨",
        "why": "「이번 주 뭐 먹지」를 같이 정하자고 하면 꼭 이런 대답이 돌아와요. 진지하게 묻는데 아무렇지 않게 「화요일도 치킨」 하고, 결국 「내가 정할게」로 끝나는 게 웃음 포인트예요.",
        "hook": "일주일 식단,\n남편한테 맡기면?", "hook_kind": "😂 현실 직시형",
        "alts": [("🛠️ 해결책 제시형", "일주일 저녁 메뉴\n고민 끝"), ("📱 기능 활용형", "냉장고 재료로\n일주일 식단")],
        "demo": "04 AI 식단 — 원하는 조건을 말하면 냉장고 재료로 일주일 식단과 장볼 목록이 나오는 화면",
        "motion": MOTION_STILL,
        "story": "둘이 나란히 앉아 서로에게 말한다. 머그는 감싸 쥐기만(마시지 않음).",
        "cast": "Mid-30s Korean couple sitting side by side at a small wooden table. The wife: cream sweater. The husband: gray sweatshirt.",
        "home": "Sunday morning dining nook by a window with soft daylight. On the table, only two plain mugs, one in front of each of them.",
        "action": "They sit still. Both have their hands resting around their mugs on the table. Nobody lifts a mug or drinks. They just turn their heads slightly to talk to each other.",
        "audio": "She: \"우리 이번 주 저녁 메뉴 미리 정하자. 월요일은 뭐 먹을래?\"\nHe: \"월요일은 치킨.\"\nShe: \"화요일은?\"\nHe, without a pause: \"화요일도 치킨.\"\n(She looks at him for a beat, then sighs with a small smile.)\nShe: \"...그냥 내가 정할게.\"",
        "no_line": "Quiet morning. She asks him something; he answers easily, twice, without a pause; she looks at him for a beat and sighs with a small smile. Spoken words: none.",
        "last": "Her small resigned smile looking straight ahead.",
        "first": "A couple sits side by side at a small wooden table by a window in soft morning light, hands resting around plain mugs. She is turning her head toward him to ask something.",
    },
    {
        "no": "05", "kbf": "유통기한 임박 알림", "title": "그럼 자기가 먹어",
        "why": "냉장고 구석에서 나온 요거트, 유통기한이 하루 지났을 때 다들 고민하죠. 「괜찮지?」 물었더니 「그럼 자기가 먹어」로 돌아오는 게 웃음 포인트예요.",
        "hook": "유통기한 어제,\n먹어? 말아?", "hook_kind": "💛 감정 공감형",
        "alts": [("⚠️ 경고형", "냉장고 속 요거트\n언제 샀더라?"), ("📱 기능 활용형", "유통기한 전에\n알림이 와요")],
        "demo": "05 유통기한 — 유통기한이 다가오면 알림이 오고, 임박 재료로 만들 레시피를 추천하는 화면",
        "motion": MOTION_STILL,
        "story": "요거트는 처음부터 끝까지 그녀 손에(주고받기 없음) → 「이거」. 남편은 고개만 기울여 밑면을 읽는다 → 「밑에」.",
        "cast": "Early-40s Korean woman, bob haircut, dark green cardigan. Her husband, early 40s, thin glasses, white shirt, sits close beside her.",
        "home": "Living room in the morning, soft daylight. The only prop is one small plain pastel pink yogurt cup with a sealed flat lid.",
        "action": "She is already holding the yogurt cup in front of her face, tilted so its bottom faces her husband, squinting at it. He leans his head in close to read the bottom of the cup. She holds the cup still the whole time; nobody passes it.",
        "audio": "She: \"이거 유통기한이 어디 적혀 있어? 안 보이는데.\"\nHe, leaning in and reading: \"밑에. 어제까지네.\"\nShe: \"하루 지난 건 먹어도 괜찮지?\"\nHe, deadpan: \"어. 그럼 자기가 먹어.\"\n(She turns her eyes to him and glares, still holding the cup.)",
        "no_line": "Quiet morning. She squints at a yogurt cup in her hand; he leans in to read the bottom, then says something deadpan; she glares at him, still holding the cup. Spoken words: none.",
        "last": "Her glaring eyes, the yogurt cup still in her hand.",
        "first": "Morning living room. A woman in a dark green cardigan holds a small plain pastel pink yogurt cup in front of her face, squinting at it. Her husband in thin glasses and a white shirt sits close beside her, leaning in to look at the bottom of the cup.",
    },
    {
        "no": "06", "kbf": "요리 AI · 말로 물어보기", "title": "열 개 다 마트 가래",
        "why": "냉장고에 있는 걸로 해 먹으려고 레시피를 찾으면, 꼭 없는 재료를 사 오라고 하죠. 한참 찾다가 지쳐서 「배달 시킬까?」에 바로 고개를 끄덕이는 게 공감 포인트예요.",
        "hook": "레시피 열 개 봤는데\n다 장 보래요", "hook_kind": "😂 현실 직시형",
        "alts": [("🛠️ 해결책 제시형", "있는 재료로\n물어보면 돼요"), ("💛 감정 공감형", "저녁 메뉴 검색,\n끝이 안 나요")],
        "demo": "06 요리 AI — 「냉장고에 있는 걸로 뭐 해 먹지?」처럼 말하듯 물으면 내 재료로 맞는 레시피를 골라 주는 화면",
        "motion": MOTION_STILL,
        "story": "이미 다 찾아본 뒤라 폰은 무릎 위에 가만히(스크롤 없음).",
        "cast": "Early-30s Korean woman, black knit top. Her husband, early 30s, white T-shirt. They sit side by side on a sofa.",
        "home": "Living room in the evening, warm floor lamp. Plain wall behind the sofa. The only prop is her phone.",
        "action": "She sits holding her phone still in her lap, screen facing down, with a defeated look. She does not scroll or tap it. Her husband sits next to her, looking at her gently.",
        "audio": "He: \"오늘 저녁 뭐 먹어?\"\nShe, staring blankly ahead: \"냉장고 파먹기 하려고 레시피 열 개를 봤는데...\"\nHe: \"응.\"\nShe: \"열 개 다 마트 가서 뭘 사 오래.\"\nHe: \"그냥 배달 시킬까?\"\n(She turns to him and nods firmly once.)",
        "no_line": "Quiet evening. She sits with her phone face down in her lap, staring blankly ahead; he says something gently; she turns to him and nods firmly once. Spoken words: none.",
        "last": "Her face, relieved, looking at him.",
        "first": "Evening living room under a warm floor lamp. A woman in a black knit top sits on a sofa holding her phone face down in her lap, staring blankly ahead. Her husband in a white T-shirt sits next to her, looking at her.",
    },
    {
        "no": "07", "kbf": "검증된 진짜 레시피", "title": "아직 바다 보고 있어",
        "why": "블로그 레시피를 열면 레시피 전에 여행 이야기가 한참 나오죠. 프라이팬 앞에서 남의 제주도 여행기만 보고 있는 게 웃음 포인트예요.",
        "hook": "레시피 보려다\n남의 여행기만 봤어요", "hook_kind": "😂 현실 직시형",
        "alts": [("🛠️ 해결책 제시형", "서론 없이\n조리 순서만"), ("🔍 디테일 분석형", "진짜 레시피는\n스크롤 맨 아래")],
        "demo": "07 진짜 레시피 — 유튜브·네이버 인기 레시피를 재료·순서만 정리해 보여 주는 화면",
        "motion": MOTION_STILL,
        "story": "요리하려고 빈 팬 앞에 섰다(팬은 차갑고 비어 있음). 폰은 들고 보기만(스크롤 없음). 아내는 같은 조리대 끝에.",
        "cast": "Late-30s Korean man, short tidy hair, olive T-shirt, standing at the stove holding his phone in his right hand with the screen facing away from the viewer. His wife, late 30s, hair clipped up, gray hoodie, stands at the other end of the same counter, her hands resting around a plain mug on the counter.",
        "home": "Kitchen in the evening. On the stove, one empty plain black frying pan, cold, with nothing in it; the burners are off. The counter is otherwise bare.",
        "action": "He stands still, staring down at the phone in his hand with a slightly blank, tired look. He does not scroll or tap. His wife looks over at him. Nobody touches the pan, and it never moves. Nobody lifts the mug.",
        "audio": "She: \"레시피 찾았어?\"\nHe, staring at the phone: \"찾았는데... 이 사람 아직 제주도 여행 중이야.\"\nShe: \"응?\"\nHe, deadpan: \"아직 바다 보고 있어.\"\n(She laughs softly through her nose.)\nShe: \"레시피는 맨 밑에 있어.\"",
        "no_line": "Quiet kitchen. He stares blankly at his phone in front of an empty pan; she asks something, he answers deadpan; she laughs softly through her nose. Spoken words: none.",
        "last": "His blank face looking down at the phone, the empty pan in front of him.",
        "first": "Evening kitchen. A man in an olive T-shirt stands at a stove with a cold, empty black frying pan, holding his phone in his right hand with the screen facing away from the viewer, staring at it. His wife in a gray hoodie stands at the other end of the counter, hands around a plain mug.",
    },
    {
        "no": "08", "kbf": "가족 · 아낀 돈", "title": "그 돈으로 치킨 시키자",
        "why": "집밥 차려 놓고 「오늘 돈 아꼈다」 뿌듯해하는 순간, 꼭 그 돈을 다른 데 쓰자는 사람이 있어요. 아낀 돈이 바로 치킨이 되는 게 웃음 포인트예요.",
        "hook": "집밥으로 아낀 돈,\n어디에 써요?", "hook_kind": "😂 반전형",
        "alts": [("💛 감정 공감형", "집밥 한 끼에\n이만 원 아꼈다"), ("📱 기능 활용형", "아낀 돈이\n쌓이는 게 보여요")],
        "demo": "08 가족·아낀 돈 — 가족 집밥 목표와 요리할 때마다 쌓이는 아낀 돈(예상)이 보이는 화면",
        "motion": MOTION_STILL,
        "story": "막 차려 놓고 앉은 순간(수저 없음, 먹는 동작 없음). 「오늘 집에서 해 먹으니까」와 맞는다.",
        "cast": "Mid-30s Korean couple sitting across a small dining table, seen in three-quarter view. The wife: light pink sweater. The husband: navy T-shirt.",
        "home": "Dining table in the evening under a warm pendant light, dinner just served. On the table: two plain white bowls of rice and one plain white plate of vegetables in the middle, and nothing else.",
        "action": "They have just sat down. Their hands rest on the edge of the table. There are no chopsticks or spoons and no eating. They just look at each other and talk. The food never moves.",
        "audio": "She, smiling proudly: \"오늘 집에서 해 먹으니까 최소 이만 원은 아꼈다.\"\nHe, looking happy: \"오, 진짜? 그럼 그 돈으로 치킨 시켜 먹자.\"\n(Her proud smile drops into a deadpan stare.)\nShe: \"그럼 안 아낀 거잖아.\"",
        "no_line": "Quiet dinner. She smiles proudly; he answers with a happy, hopeful look; her smile drops into a deadpan stare. Spoken words: none.",
        "last": "Her deadpan stare across the table.",
        "first": "A couple sits across a small dining table under a warm pendant light, hands resting on the table edge. Two plain white bowls of rice and one plate of vegetables sit between them. She smiles proudly at him.",
    },
]

IMAGE_STYLE = """People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo."""


def image_prompt(c):
    """세로 영상을 확실히 받고 배치를 먼저 고정하는 2단계용 — 이 사진을 첨부해서 영상 프롬프트를 붙인다."""
    return "\n\n".join([
        IMAGE_HEAD,
        f"[SCENE — the first frame]\n{c['first']}",
        f"[CAST]\n{c['cast']}",
        f"[HOME]\n{c['home']}",
        IMAGE_STYLE,
        IMAGE_TAIL,
    ])


def clip_prompt(c, no_line=False):
    audio = c["no_line"] if no_line else c["audio"]
    return "\n\n".join([
        FORMAT,
        direction(c["motion"]),
        f"[CAST]\n{c['cast']}",
        f"[HOME]\n{c['home']}",
        f"[ACTION]\n{c['action']}",
        f"[AUDIO]\n{audio}",
        f"[LAST SECOND]\n{c['last']}",
        REMINDER,
    ])


def write_md():
    lines = [
        "# 릴스 후킹 영상 4벌 다듬은 판(v5) — 제미나이(Veo) 프롬프트 8편",
        "",
        "만든 날: 2026-10-20 · 만든 스크립트: `scripts/gen_reel_hooks_v5.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).",
        "규칙: [VEO_PROMPT_RULES.md](VEO_PROMPT_RULES.md). 폰용 페이지는 4벌과 같은 아티팩트 주소에 덮어쓴다. 이전: [v4](REEL_HOOKS_V4.md).",
        "",
        "## 4벌에서 바꾼 것",
        "- 제미나이가 고쳐 준 **짧은 공통 지시**(STRICTLY STATIC ENVIRONMENT). 사용자가 뽑아 보니 오류가 거의 없고 자연스러웠다(2026-10-20).",
        "- **상태가 바뀌는 행동을 모두 뺐다**: 문 열기·꺼내기·주고받기·먹기·마시기·스크롤·화면 켜짐/꺼짐. 물건은 처음부터 손이나 탁자 위에.",
        "- **이야기 논리 점검**(편마다 「이야기 점검」 줄): 어디서 왔나 / 「이거·저거」와 거리 / 대사 속 장소 = HOME.",
        "- 01 우유: 남자가 점퍼 차림으로 왼쪽에서 두세 걸음 들어오고, 우유 두 통은 3m 뒤 식탁 위. 03 장갑: 폰은 처음부터 꺼진 채 거치대에, 대사는 「화면 꺼졌다 → 켜 줘」(요리 모드 데모와 연결). 07 블로그: 스크롤 대신 폰을 든 채 멍하니.",
        "",
        "## 공통 지시",
        "",
        "```",
        FORMAT,
        "",
        direction(),
        "",
        "…편별 [CAST]·[HOME]·[ACTION]·[AUDIO]·[LAST SECOND]…",
        "",
        REMINDER,
        "```",
        "",
        "걸어 들어오는 편(01)만 MOTION 의 `No one walks` 문장을 그 사람만 두세 걸음으로 바꿨다.",
        "",
    ]
    for c in CLIPS:
        alts = " · ".join(f"{k} 「{t.replace(chr(10), ' / ')}」" for k, t in c["alts"])
        lines += [
            f"## {c['no']}. {c['title']} — {c['kbf']}",
            "",
            f"- **공감 포인트**: {c['why']}",
            f"- **이야기 점검**: {c['story']}",
            f"- **썸네일 후킹 자막(추천, 첫 프레임부터)**: {c['hook_kind']} 「{c['hook'].replace(chr(10), ' / ')}」",
            f"- **다른 후보**: {alts}",
            f"- **이어 붙일 앱 데모**: {c['demo']}",
            "",
            "영상 프롬프트:",
            "",
            "```",
            clip_prompt(c),
            "```",
            "",
            "첫 장면 이미지 프롬프트(2단계용):",
            "",
            "```",
            image_prompt(c),
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
    (ROOT / "store/REEL_HOOKS_V5.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def write_html(path: Path):
    data = {
        "clips": [dict(c, why=f"{c['why']} (이야기 점검: {c['story']})", prompt=clip_prompt(c), promptNoLine=clip_prompt(c, True), promptImage=image_prompt(c)) for c in CLIPS],
        "variants": VARIANTS,
    }
    tpl = (ROOT / "scripts/reel_hooks_v5_template.html").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    path.write_text(tpl.replace("/*__DATA__*/null", payload), encoding="utf-8")


if __name__ == "__main__":
    import sys
    write_md()
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "store/reel_hooks_v5.html"
    write_html(out)
    print("wrote store/REEL_HOOKS_V5.md and", out)
