"""릴스 후킹 영상 4벌 — 제미나이(Veo)에 붙일 프롬프트 8편을 문서(store/REEL_HOOKS_V4.md)와 폰용 페이지(HTML)로 만든다.

    python scripts/gen_reel_hooks_v4.py [out.html]   # store/REEL_HOOKS_V4.md + 폰용 HTML(아티팩트 게시용)

v3(2026-10-06)로 뽑은 영상을 편집해 보니 **아무도 안 만졌는데 물건이 움직이거나 모양이 바뀌는** 장면이 많았다
(2026-10-18 사용자 지적). 4벌은 그걸 줄이는 데 집중한다:
  · 카메라 고정: v3 의 「손떨림 숨결」·「마지막 1초 밀어 들어가기」가 화면 전체를 흔들어 물건이 미끄러져 보였다 → 삼각대 고정, 줌·이동 없음.
  · 물건은 손에 들렸을 때만: 「손이 잡고 있는 동안만 그 손과 함께 움직이고, 놓은 자리에 그대로 있다」를 공통 지시에.
  · 소품 3개 이하, 서로 떨어뜨려: 붙어 있거나 많으면 서로 섞이고 바뀐다(v3 3편 병뚜껑 → 폰).
  · 동작은 한두 개, 천천히: 빠른 동작(낚아채기·막기)은 흐릿해지며 모양이 무너진다 → v3 ACTING 의 「빠른 반사 동작」을 「느린 작은 동작」으로.
  · 붓기·썰기·지글거림·김·문 여닫기 같은 장면을 안 쓴다: 냉장고는 처음부터 열려 있고 끝까지 그대로, 음식은 통째로·이미 담긴 상태.
  · 장면 자체를 「앉아서 말하기」「한 손으로 들고 보기」처럼 움직임이 적은 상황으로 골랐다.
후킹 자막은 요리 릴스 가이드(my-video/COOKING_REEL_GUIDE.md) 0-1·0-2 규칙: 첫 프레임부터 가운데 큰 노란 질문형 2줄(= 썸네일),
편마다 26가지 전략 중 맞는 것으로 후보 3개 + 추천 1개. 편 번호 = 이어 붙일 앱 데모 번호(01 사진 인식 … 08 가족·아낀 돈).
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FORMAT = """Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly."""

COMMON = """[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene.

LENGTH: One continuous take, about 8 seconds, told as a tiny story: a line, a reply, one natural action that shows the truth (opening the fridge, taking something out, looking at a screen), the funny line, and a small laugh or sigh to end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Like a candid moment a family member happened to catch at home. People behave the way they really do at home: they talk while doing the ordinary thing the story needs, at a normal relaxed everyday pace, and they answer each other right away, so the scene flows like a real conversation instead of a pose. Each line causes the next action, and each action causes the next line. Between lines nobody freezes or stares; they keep the small task going, glance at each other and at the object. Reactions are natural and small: a quick look, a short laugh through the nose, a shrug, a half-smile, a sigh. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the objects or to each other. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
FRAMING: We see the room from where a viewer would stand, at eye level, and the view is perfectly steady from the first frame to the last: the framing never moves, widens or tightens. Natural perspective, shallow depth of field, vertical framing, medium shot on the people. The only people and objects in view are the ones written in CAST, HOME and ACTION. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, each one resting firmly on its own spot or in a hand, spaced apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. A fridge door moves only while a hand pulls it, then stays open. Things inside a fridge are exactly the ones listed in HOME, in exactly that number, and they come into view only when the door opens. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Nothing new appears and nothing multiplies: every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the viewer; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the view still."""

REMINDER = "Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels."

CLIPS = [
    {
        "no": "01", "kbf": "사진 한 장으로 냉장고 채우기", "title": "그럼 나머지 하나는 누가 산 거야?",
        "why": "냉장고에 뭐가 있는지 몰라서 같은 걸 또 사 오는 일, 다들 있죠. 남편도 하나, 아내도 하나 샀는데 냉장고를 열어 보니 두 통 — 남은 한 통은 아무도 산 기억이 없다는 게 반전이에요.",
        "hook": "둘이 장 봤는데\n우유가 왜 세 통?", "hook_kind": "🧠 상식 파괴형",
        "alts": [("💛 감정 공감형", "냉장고에 뭐 있는지\n아무도 몰라요"), ("📱 기능 활용형", "영수증 찍어 두면\n냉장고가 기억해요")],
        "demo": "01 사진 인식 — 영수증 사진 한 장으로 산 재료가 냉장고에 담기는 화면(이미 있는 재료가 보임)",
        "cast": "Early-30s Korean man, short tidy hair, navy sweatshirt, just home from the store. His wife, early 30s, hair in a low ponytail, beige knit cardigan, stands next to the fridge holding a plain mug.",
        "home": "Apartment kitchen in the afternoon. One white single-door fridge with a vertical handle, closed at the start. Inside it, on the middle shelf, are exactly two identical short plain white milk bottles with blue screw caps and nothing else; the other shelves are empty. The counter is bare.",
        "action": "He walks a few relaxed steps into the kitchen holding one identical short plain white milk bottle with a blue cap in his right hand, lifting it a little as he talks. His wife answers, sets her mug down on the bare counter, takes the fridge handle and pulls the door open in one smooth motion; it swings open and stays open. The two bottles on the middle shelf come into view. Both lean in and look. He keeps holding his own bottle in his hand for the whole video and never puts it down. The two bottles on the shelf never move. Count: two bottles inside the fridge plus the one in his hand, three bottles in total, the same from start to end.",
        "audio": "He, walking in and lifting the bottle: \"자기야, 나 오다가 우유 하나 샀어.\" She: \"어? 나도 어제 하나 샀는데?\" (She sets down her mug and opens the fridge; two bottles are on the shelf.) He, looking from the shelf to the bottle in his hand: \"엥, 그럼 나머지 하나는 누가 산 거야?\" (She looks at him and laughs softly through her nose.)",
        "no_line": "Kitchen sounds. He walks in holding a milk bottle; she opens the fridge to reveal two identical bottles; he looks from the shelf to his bottle, and she laughs softly through her nose. Spoken words: none.",
        "last": "The two milk bottles on the shelf and the one in his hand, all in view.",
        "first": "Kitchen in the afternoon. A man in a navy sweatshirt stands a step inside the kitchen holding a short plain white milk bottle with a blue cap in his right hand. His wife in a beige cardigan stands beside the closed white single-door fridge holding a plain mug, turning toward him.",
    },
    {
        "no": "02", "kbf": "있는 재료로 매칭", "title": "이걸로 뭐 해 먹지?",
        "why": "저녁 메뉴를 정하려고 냉장고를 열면 애매하게 남은 재료 두 개가 전부일 때가 있죠. 둘이 머리를 맞대다가 결국 「그냥 구워 먹자」로 끝나는 게 현실이에요.",
        "hook": "양배추랑 소시지로\n뭐가 된다고?", "hook_kind": "🧠 상식 파괴형",
        "alts": [("🛠️ 해결책 제시형", "재료가 두 개뿐일 때\n이렇게 찾아요"), ("📱 기능 활용형", "남은 재료만 넣으면\n요리가 나와요")],
        "demo": "02 매칭 — 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면",
        "cast": "Mid-30s Korean woman, shoulder-length hair, oatmeal sweater, standing at the fridge. Her husband, mid-30s, short tidy hair, gray cardigan, sits at a small dining table at the right of the frame, his hands resting on the table.",
        "home": "Open kitchen with a small wooden dining table, evening, warm pendant light. One white single-door fridge, already standing open; the door stays open and still for the whole take. Inside, on the middle shelf, are exactly two things and nothing else: half a green cabbage wrapped in clear film on the left, and one plain sausage in a clear wrapper on the right. The table is bare.",
        "action": "She looks into the open fridge, takes out the half cabbage with her left hand, then the sausage with her right hand, and turns toward her husband holding one in each hand at chest height. After she takes them out, the fridge shelves are empty. He looks at the two items and thinks, then answers. She looks down at the items in her hands. She keeps holding both items until the end.",
        "audio": "He: \"오늘 저녁 뭐 먹어?\" She, taking out the cabbage and then the sausage: \"양배추 반 통이랑 소시지 하나 있는데, 이걸로 뭐 해 먹지?\" He: \"볶음밥 할까?\" She: \"밥이 없어.\" He, after a beat: \"그럼 그냥 소시지 구워 먹자.\" (She looks down at the cabbage and breathes out through her nose.)",
        "no_line": "Quiet kitchen. She takes the half cabbage and the sausage out of the open fridge and turns to her husband holding them up; he thinks and shrugs; she looks down at the cabbage. Spoken words: none.",
        "last": "The half cabbage and the sausage in her hands.",
        "first": "Evening kitchen. A woman in an oatmeal sweater stands at an open white single-door fridge, looking at the middle shelf where half a cabbage in clear film and one wrapped sausage sit. Her husband in a gray cardigan sits at a small bare dining table on the right.",
    },
    {
        "no": "03", "kbf": "요리 모드 · 손 안 대고 넘기기", "title": "나 장갑 꼈단 말이야",
        "why": "요리하다 레시피 화면이 꺼지면 손이 비어 있지 않아서 난감하죠. 오븐 장갑 낀 손으로 아무리 눌러도 안 켜지고, 결국 옆 사람을 부르는 게 웃음 포인트예요.",
        "hook": "오븐 장갑 끼고\n화면을 켠다고?", "hook_kind": "🧠 상식 파괴형",
        "alts": [("💛 감정 공감형", "요리 중에 화면 꺼지면\n진짜 난감하죠"), ("📱 기능 활용형", "손 안 대도\n레시피를 읽어 줘요")],
        "demo": "03 요리 모드 — 화면을 안 만져도 단계별로 읽어 주고 지금 단계를 짚어 주는 화면",
        "cast": "Late-20s Korean woman, hair tied up in a bun, light blue apron over a white T-shirt, wearing thick plain gray oven mitts on both hands for the whole take. Her boyfriend, late 20s, black hoodie, leans on the far end of the same counter, a step away, at the right of the frame.",
        "home": "Bright kitchen in the daytime. On the counter in front of her, one phone lies flat and face up, alone, its screen a soft blurred glow. The counter is otherwise bare. Cabinets below stay closed.",
        "action": "She leans over the phone lying flat on the counter, reading. The screen's glow fades to dark. She taps it twice with the thumb of her mitt; nothing changes. She tries pressing it with her elbow; still nothing. She turns to her boyfriend and asks. He takes one step over and taps the screen once with his finger; the soft glow comes back. The phone stays flat in the same spot the whole time.",
        "audio": "She, reading: \"다음이 뭐더라. 아, 꺼졌다.\" (She taps with the mitt, then tries her elbow.) She, turning to him: \"자기야, 이것 좀 켜 줘. 나 장갑 꼈단 말이야.\" He, stepping over: \"팔꿈치로 해 보지.\" She: \"해 봤어.\" (He taps the screen and it lights up; she laughs softly.)",
        "no_line": "Quiet kitchen. The phone goes dark; she taps it with her oven mitt and her elbow, then turns to her boyfriend, who steps over and taps it on; she laughs softly. Spoken words: none.",
        "last": "His finger on the glowing phone, her oven mitts beside it.",
        "first": "Bright kitchen. A woman in a light blue apron and thick plain gray oven mitts leans over a phone that lies flat and face up on a bare counter, its screen softly glowing. Her boyfriend in a black hoodie leans on the far end of the counter on the right.",
    },
    {
        "no": "04", "kbf": "장 볼 게 가장 적은 식단", "title": "화요일도 치킨",
        "why": "「이번 주 뭐 먹지」를 같이 정하자고 하면 꼭 이런 대답이 돌아와요. 진지하게 묻는데 아무렇지 않게 「화요일도 치킨」 하고, 결국 「내가 정할게」로 끝나는 게 웃음 포인트예요.",
        "hook": "일주일 식단,\n남편한테 맡기면?", "hook_kind": "😂 현실 직시형",
        "alts": [("🛠️ 해결책 제시형", "일주일 저녁 메뉴\n고민 끝"), ("📱 기능 활용형", "냉장고 재료로\n일주일 식단")],
        "demo": "04 AI 식단 — 원하는 조건을 말하면 냉장고 재료로 일주일 식단과 장볼 목록이 나오는 화면",
        "cast": "Mid-30s Korean couple sitting side by side at a small wooden table, facing the viewer. The wife: long hair tucked behind her ears, cream sweater, holding a plain mug with both hands. The husband: short hair, gray sweatshirt, holding a plain mug in his right hand.",
        "home": "Sunday morning dining nook by a window with soft daylight. On the table, only their two plain mugs. Plain light wall behind them.",
        "action": "They sip coffee in a relaxed way. She turns to him to ask. He answers right away, easily, as if it is obvious. She asks once more; he answers the same way. She looks at him for a beat, then sets her mug down on the table and sighs with a small smile. He takes another sip. The mugs stay where they are set.",
        "audio": "She: \"자기야, 이번 주 저녁 뭐 먹을지 정해 놓자. 월요일은 뭐 먹을래?\" He: \"월요일은 치킨.\" She: \"화요일은?\" He, without a pause: \"화요일도 치킨.\" (She sets her mug down and sighs with a small smile.) She: \"그냥 내가 정할게.\"",
        "no_line": "Quiet morning. She asks him something; he answers easily with a shrug, twice; she sets her mug down and sighs with a small smile. Spoken words: none.",
        "last": "Her small resigned smile beside him as he sips.",
        "first": "A couple sits side by side at a small wooden table by a window, facing the viewer, each holding a plain mug. She is turning toward him to ask something.",
    },
    {
        "no": "05", "kbf": "유통기한 임박 알림", "title": "그럼 자기가 먹어",
        "why": "냉장고 구석에서 나온 요거트, 유통기한이 하루 지났을 때 다들 고민하죠. 「괜찮지?」 물었더니 「그럼 자기가 먹어」로 돌아오는 게 웃음 포인트예요.",
        "hook": "유통기한 어제,\n먹어? 말아?", "hook_kind": "💛 감정 공감형",
        "alts": [("⚠️ 경고형", "냉장고 속 요거트\n언제 샀더라?"), ("📱 기능 활용형", "유통기한 전에\n알림이 와요")],
        "demo": "05 유통기한 — 유통기한이 다가오면 알림이 오고, 임박 재료로 만들 레시피를 추천하는 화면",
        "cast": "Early-40s Korean woman, bob haircut, dark green cardigan. Her husband, early 40s, thin glasses, white shirt, stands beside her on the right.",
        "home": "Kitchen in the morning. One white single-door fridge, already standing open; the door stays open and still for the whole take. Inside, on the middle shelf, is exactly one small plain pastel pink yogurt cup with a sealed flat foil lid, and nothing else. The counter is bare.",
        "action": "She takes the yogurt cup out of the open fridge, turns it in her fingers looking for the date, and squints. After she takes it, the fridge is empty. She hands the cup to her husband; he takes it, tilts it to read the bottom, and hands it back to her. She looks at the cup in her hand. The cup is always in one person's hand.",
        "audio": "She, taking out the cup: \"이거 언제 산 거지? 유통기한이 어디 있어.\" (She hands it to him.) He, reading the bottom: \"어제까지네.\" She, taking it back: \"어제면 괜찮지?\" He: \"그럼 자기가 먹어.\" (She looks at the cup and laughs out through her nose.)",
        "no_line": "Quiet kitchen. She takes a yogurt cup from the fridge, squints at it and hands it to him; he checks the bottom, winces a little and hands it back; she looks at the cup. Spoken words: none.",
        "last": "The yogurt cup in her hand.",
        "first": "Morning kitchen. A woman in a dark green cardigan stands at an open white single-door fridge reaching for one small plain pastel pink yogurt cup on the middle shelf. Her husband in thin glasses and a white shirt stands beside her on the right.",
    },
    {
        "no": "06", "kbf": "요리 AI · 말로 물어보기", "title": "열 개 다 마트 가래",
        "why": "냉장고에 있는 걸로 해 먹으려고 레시피를 찾으면, 꼭 없는 재료를 사 오라고 하죠. 한참 찾다가 지쳐서 폰을 내려놓는 게 공감 포인트예요.",
        "hook": "레시피 열 개 봤는데\n다 장 보래요", "hook_kind": "😂 현실 직시형",
        "alts": [("🛠️ 해결책 제시형", "있는 재료로\n물어보면 돼요"), ("💛 감정 공감형", "저녁 메뉴 검색,\n끝이 안 나요")],
        "demo": "06 요리 AI — 「냉장고에 있는 걸로 뭐 해 먹지?」처럼 말하듯 물으면 내 재료로 맞는 레시피를 골라 주는 화면",
        "cast": "Early-30s Korean woman, long straight hair, black knit top, sitting at the left end of a sofa holding her phone with both hands, its screen facing away from the viewer. Her husband, early 30s, white T-shirt, sits at the right end of the sofa.",
        "home": "Living room in the evening, warm floor lamp. The only prop: her phone. Plain wall behind the sofa.",
        "action": "She scrolls with her thumb at a normal pace. Her husband turns to her and asks. She answers while still scrolling, then lets out a sigh and lowers the phone onto her lap, screen down. She looks at him. He answers easily.",
        "audio": "He: \"저녁 뭐 먹어?\" She, scrolling: \"냉장고에 있는 걸로 할 거 찾고 있어.\" (She sighs and lowers the phone onto her lap, screen down.) She: \"근데 열 개 봤는데 열 개 다 마트 가서 사 오래.\" He: \"그럼 시켜 먹자.\" (She looks at him for a beat.)",
        "no_line": "Quiet evening. She scrolls, sighs, and lowers the phone face down onto her lap; he says something with a shrug; she looks at him. Spoken words: none.",
        "last": "Her face looking at him, the phone face down on her lap.",
        "first": "A woman in a black knit top sits at the left end of a sofa holding her phone with both hands, screen facing away from the viewer. Her husband in a white T-shirt sits at the right end, turning toward her.",
    },
    {
        "no": "07", "kbf": "검증된 진짜 레시피", "title": "아직 바다 보고 있어",
        "why": "블로그 레시피를 열면 레시피 전에 여행 이야기가 한참 나오죠. 프라이팬 앞에서 남의 제주도 여행기를 끝까지 내리는 게 웃음 포인트예요.",
        "hook": "레시피 보려다\n남의 여행기만 봤어요", "hook_kind": "😂 현실 직시형",
        "alts": [("🛠️ 해결책 제시형", "서론 없이\n조리 순서만"), ("🔍 디테일 분석형", "진짜 레시피는\n스크롤 맨 아래")],
        "demo": "07 진짜 레시피 — 유튜브·네이버 인기 레시피를 재료·순서만 정리해 보여 주는 화면",
        "cast": "Late-30s Korean man, short tidy hair, olive T-shirt, standing at the stove holding his phone in his right hand, screen facing away from the viewer, his left hand resting on the counter. His wife, late 30s, hair clipped up, gray hoodie, stands at the other end of the counter holding a plain mug.",
        "home": "Kitchen in the evening. On the stove, one empty plain black frying pan, cold, with nothing in it; the burners are off. The counter is otherwise bare.",
        "action": "He scrolls his phone with his thumb at a normal pace, again and again, frowning a little. His wife asks; he answers without looking up and keeps scrolling. She leans over a little to look, then laughs softly. His left hand stays on the counter and the pan stays exactly where it is.",
        "audio": "She: \"레시피 찾았어?\" He, scrolling: \"찾았는데, 이 사람 계속 제주도 여행 얘기만 해.\" (He keeps scrolling.) He: \"아직 바다 보고 있어.\" She, laughing softly: \"레시피는 맨 밑에 있어.\"",
        "no_line": "Quiet kitchen. He keeps scrolling in front of the empty pan, frowning; his wife leans over to look and laughs softly. Spoken words: none.",
        "last": "His face looking down at the phone, the empty pan in front of him.",
        "first": "A man in an olive T-shirt stands at a stove with a cold, empty black frying pan, holding his phone in his right hand with the screen facing away from the viewer, left hand on the counter. His wife in a gray hoodie stands at the other end of the counter holding a plain mug.",
    },
    {
        "no": "08", "kbf": "가족 · 아낀 돈", "title": "그 돈으로 치킨 시키자",
        "why": "집밥 해 먹고 「오늘 돈 아꼈다」 뿌듯해하는 순간, 꼭 그 돈을 다른 데 쓰자는 사람이 있어요. 아낀 돈이 바로 치킨이 되는 게 웃음 포인트예요.",
        "hook": "집밥으로 아낀 돈,\n어디에 써요?", "hook_kind": "😂 반전형",
        "alts": [("💛 감정 공감형", "집밥 한 끼에\n이만 원 아꼈다"), ("📱 기능 활용형", "아낀 돈이\n쌓이는 게 보여요")],
        "demo": "08 가족·아낀 돈 — 가족 집밥 목표와 요리할 때마다 쌓이는 아낀 돈(예상)이 보이는 화면",
        "cast": "Mid-30s Korean couple sitting across a small dining table, seen in three-quarter view. The wife: low ponytail, light pink sweater. The husband: short hair, navy T-shirt. Each holds a pair of plain wooden chopsticks.",
        "home": "Dining table in the evening under a warm pendant light. On the table: two plain white bowls of white rice, already served, and one plain white plate of simple stir-fried vegetables in the middle. Everything on the table stays in place.",
        "action": "They eat at a relaxed pace. She says something with a pleased look. He looks up while chewing and answers happily. She stops with her chopsticks in the air, looks at him, then shakes her head with a laugh. The bowls and plate never move.",
        "audio": "She, pleased: \"오늘 집에서 해 먹으니까 이만 원 아꼈다.\" He, chewing, looking up: \"오, 진짜? 그럼 그 돈으로 치킨 시키자.\" (She stops with her chopsticks in the air and looks at him.) She, laughing: \"그럼 안 아낀 거잖아.\"",
        "no_line": "Quiet dinner. She looks pleased; he looks up with a hopeful grin; she stops with her chopsticks in the air, then shakes her head with a laugh. Spoken words: none.",
        "last": "Her laughing face, chopsticks in hand, looking at him.",
        "first": "A couple sits across a small dining table under a warm pendant light, holding plain wooden chopsticks. Two plain white bowls of rice and one plate of stir-fried vegetables sit on the table. She looks pleased; he is chewing.",
    },
]

# 같은 편을 여러 개 뽑을 때 [CAST]·[HOME] 줄만 바꿔 끼우는 변주(v3 와 같음)
VARIANTS = [
    ("A", "원본 그대로", "Keep CAST and HOME as written.", ""),
    ("B", "나이를 한 단계 올리고 머리 모양을 바꿈", "Same roles, but about ten years older, with different hairstyles.", "Older apartment with warm wood cabinets and a tiled wall."),
    ("C", "성별을 바꿈(가능한 편만) · 옷 색을 어둡게", "Same roles played by the opposite gender, wearing darker clothes.", "Compact new officetel, all white with stainless steel."),
    ("D", "안경 · 니트 대신 셔츠", "Add glasses; swap knits for crisp shirts.", "Detached house with solid wood furniture and a garden visible through the window."),
    ("E", "머리를 올려 묶고 앞치마", "Hair tied up high; add plain aprons.", "Narrow villa kitchen with pale gray counters."),
]

IMAGE_HEAD = "Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright."
IMAGE_STYLE = """The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the viewer.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the viewer unless described.
A clean, unedited photo."""
IMAGE_TAIL = "Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920)."


def image_prompt(c):
    """세로 영상을 확실히 받고 소품 배치를 먼저 고정하는 2단계용 — 이 사진을 첨부해서 영상 프롬프트를 붙인다."""
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
        COMMON,
        f"[CAST]\n{c['cast']}",
        f"[HOME]\n{c['home']}",
        f"[ACTION]\n{c['action']}",
        f"[AUDIO]\n{audio}",
        f"[LAST SECOND]\n{c['last']}",
        REMINDER,
    ])


def write_md():
    lines = [
        "# 릴스 후킹 영상 4벌 — 제미나이(Veo) 프롬프트 8편",
        "",
        "만든 날: 2026-10-18 · 만든 스크립트: `scripts/gen_reel_hooks_v4.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).",
        "폰에서 복사해 쓰는 페이지는 아티팩트로 게시한다. 이전 벌: [v3(3벌)](REEL_HOOKS_V3.md) · [v2(2벌)](REEL_HOOKS_V2.md) · [1벌](REEL_PROMPTS_FULL.md).",
        "",
        "## v3를 편집해 보고 바꾼 것 — 움직임 줄이기",
        "- 사용자 지적(2026-10-18): 아무도 안 만졌는데 물건이 움직이거나 모양이 바뀌는 장면이 많았다.",
        "- **카메라 고정**: v3 의 「손떨림 숨결」과 「마지막 1초 밀어 들어가기」를 빼고 삼각대 고정(줌·이동·흔들림 없음). 화면이 흔들리면 물건이 미끄러지는 것처럼 보이고, 밀어 들어갈 때 모양이 다시 그려진다.",
        "- **장비 이름을 쓰지 않는다**(2026-10-18 01편 시험): 「삼각대에 고정한 카메라」라고 썼더니 **화면 안에 삼각대·카메라가 소품으로 찍혔다**. 그리지 말 것의 이름을 적으면 그리는 것과 같은 함정 → 「보는 사람이 서 있는 자리에서, 화면이 처음부터 끝까지 그대로」처럼 **보이는 결과**로만 적고 camera·tripod·lens 단어를 프롬프트에서 뺐다. 같은 시험에서 우유가 4통이 됨 → 개수가 중요한 편은 「처음 2 + 들고 온 1 = 전체 3」처럼 숫자로 못 박는다.",
        "- **물건은 손에 들렸을 때만 움직인다**: 「손이 잡고 있는 동안만 그 손과 함께 움직이고, 놓은 자리에 정확히 있다. 그 밖의 모든 것(음식·포장·문·서랍·커튼·식물·가전)은 처음부터 끝까지 가만히」를 공통 지시 MOTION AND OBJECTS 에.",
        "- **소품 3개 이하, 서로 떨어뜨려**: 많거나 붙어 있으면 서로 섞이고 바뀐다(v3 3편 병뚜껑이 폰으로).",
        "- **동작은 한두 개, 천천히**: v3 ACTING 의 「낚아채기·막기 같은 빠른 반사 동작」을 뺐다. 빠른 동작은 흐릿해지며 손·물건 모양이 무너진다. 웃음은 대사와 작은 반응으로.",
        "- **어려운 장면은 아예 안 쓴다**: 붓기·썰기·지글거림·김·문 여닫기·물건 주고받기 여러 번. 냉장고는 처음부터 열려 있고 끝까지 그대로, 음식은 통째로·이미 담긴 상태.",
        "- **장면 고르기**: 앉아서 말하기, 한 손으로 들고 보기처럼 원래 움직임이 적은 상황 8개.",
        "- **이야기 흐름으로 다시 씀**(2026-10-18 01편 시험 후 사용자 의견): 「조용히 쳐다보기」 위주라 연기가 굳어 보였다 → 편마다 **말 → 대꾸 → 사실을 보여 주는 행동(냉장고 열기·꺼내기·화면 보기) → 펀치 대사 → 작은 웃음/한숨** 순서로. 동작은 일상 속도, 대사가 다음 행동을, 행동이 다음 대사를 부른다.",
        "- **개수가 늘어나지 않게**: 냉장고 안은 문이 열려야 보이고 HOME 에 적은 개수 그대로. 들고 온 물건은 **끝까지 손에서 놓지 않는다**(내려놓는 순간 복제가 잘 생김 — 우유 3→4). 꺼낸 뒤에는 「선반은 비었다」까지 적는다.",
        "- 그래도 물건이 움직이면: ① **첫 장면 이미지(2단계)** 로 배치를 먼저 고정 ② 새 대화에서 2~3번 뽑아 고르기 ③ 제외할 요소 칸이 있으면 `objects moving by themselves, morphing, extra objects, camera shake` 를 거기에만.",
        "",
        "## 후킹 자막 — 요리 릴스 가이드 0-1·0-2 규칙",
        "- **첫 프레임부터** 화면 가운데 큰 노란 글씨 2줄(한 줄 10자 안팎), 질문형 — 이 장면이 인스타 썸네일. (v3 까지는 웃음 포인트 순간에 띄웠다.)",
        "- 편마다 26가지 후킹 전략 중 맞는 것으로 **후보 3개**, 맨 앞이 추천. 정답(웃음)은 영상 안에서 풀린다. AI 말투·과장 없이.",
        "",
        "## 세로·연기·한글 (v3 와 같음)",
        "- 세로가 안 나오면 첫 장면 이미지 → 그 사진을 첨부해 영상 프롬프트(2단계). 편마다 **새 대화**.",
        "- 프롬프트는 영어, 한국어는 AUDIO 의 소리로만. 그리지 말 것의 이름 대신 있어야 할 것(무지 소품)만 적는다.",
        "- 어색하면 같은 프롬프트로 새 대화에서 다시, 계속 어색하면 **대사 없는 버전**.",
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
        alts = " · ".join(f"{k} 「{t.replace(chr(10), ' / ')}」" for k, t in c["alts"])
        lines += [
            f"## {c['no']}. {c['title']} — {c['kbf']}",
            "",
            f"- **공감 포인트**: {c['why']}",
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
    (ROOT / "store/REEL_HOOKS_V4.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def write_html(path: Path):
    data = {
        "clips": [dict(c, prompt=clip_prompt(c), promptNoLine=clip_prompt(c, True), promptImage=image_prompt(c)) for c in CLIPS],
        "variants": VARIANTS,
    }
    tpl = (ROOT / "scripts/reel_hooks_v4_template.html").read_text(encoding="utf-8")
    payload = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    path.write_text(tpl.replace("/*__DATA__*/null", payload), encoding="utf-8")


if __name__ == "__main__":
    import sys
    write_md()
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "store/reel_hooks_v4.html"
    write_html(out)
    print("wrote store/REEL_HOOKS_V4.md and", out)
