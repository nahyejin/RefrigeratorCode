"""릴스 후킹 영상 v3 — 제미나이(Veo)에 붙일 프롬프트 8편을 문서(store/REEL_HOOKS_V3.md)와 폰용 페이지(HTML)로 만든다.

    python scripts/gen_reel_hooks_v3.py [out.html]   # store/REEL_HOOKS_V3.md + 폰용 HTML(아티팩트 게시용)

v2(2026-09-29)로 뽑은 9개를 실제로 편집해 보고 나온 문제를 막는 판(2026-10-06 사용자 요청):
  · 가로 영상: 제미나이가 자꾸 가로로 만든다 → 맨 앞 첫 줄과 맨 끝 줄을 「Generate this video in a 9:16 vertical aspect ratio
    (portrait, 1080×1920) for Instagram Reels.」로, 구도도 세로 화면 기준으로. 「가로로 만들지 마라」처럼 피할 것의 이름은 안 적는다
    (첫 판에 넣었다가 그대로 가로로 나옴). 확실히 받는 2단계: 편마다 세로 첫 장면 이미지 프롬프트 → 그 사진을 첨부해 영상 생성.
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

FORMAT = """Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly."""

COMMON = """[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny moment lands around the middle, then plays out naturally to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd detail, played completely straight. Warm, never mean.
ACTING: Shot like a candid phone video a family member took without the others noticing. Nobody performs. Each person is busy with a small physical task (digging in the fridge, stirring, holding a carton) and keeps doing it while talking, so the words come out as a side effect of the task. Replies come quickly, often without looking up. Reactions are small physical things: a pause in the hands, a glance at the object, a breath out through the nose, a slight shrug, a half-smile at the floor. Faces stay relaxed and ordinary; mouths open only for the words. Comedy comes from cause and effect: something happens, the person notices, and reacts with one quick, real physical action (grabbing, blocking, taking something back, handing it over), the way people do without thinking. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog: stretching a name when calling out (자기야~), repeating little words when correcting someone (아니 아니), a small laugh in the voice. Full, natural sentences that say what they need, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field, vertical framing. Medium shot on the people by default. Real-time motion only.
CONTINUITY: Keep the set simple: only the props named in HOME and ACTION are on the counters, each one clearly separate from the others. Every object stays the same for the whole take: the same number of items in the same places, and each one keeps its own shape. Nothing appears, duplicates or turns into something else, and each person keeps the same face, hair and clothes. Only what the ACTION describes moves: doors, drawers, cabinets and appliances in the background stay closed and still unless a person touches them.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there."""

REMINDER = "Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels."

# 대사 없는 버전 — 대사 대신 숨소리·짧은 웃음만. 대사는 편집에서 목소리·자막으로 얹는다(화면에 글자가 섞일 틈이 아예 없다).
NO_LINE = "Spoken words: none. Only small natural sounds: a breath out through the nose, a quiet sigh."

CLIPS = [
    {
        "no": "01", "kbf": "사진 한 장으로 냉장고 채우기", "title": "계란 있어? 없어?",
        "why": "장 보다가 「집에 계란 있어?」 하고 전화하는 건 거의 모든 집에서 하는 일이에요. 냉장고를 한참 뒤져서 찾은 게 계란 한 알이라는 게 웃음 포인트예요.",
        "caption": "냉장고 사정,\n아직도 전화로 물어봐요?",
        "punch": "계란판을 열어 한 알만 보이는 순간(「어, 한 개 있네?」)",
        "demo": "01 사진 인식 — 영수증·음식 사진 한 장으로 재료가 냉장고에 담기는 화면(냉장고가 폰 안에)",
        "cast": "Late-30s Korean man, short tidy hair, light gray hoodie, sweatpants, thick socks. His wife is not in the scene; she is heard only as a small voice from the phone he holds to his ear.",
        "home": "Apartment kitchen in the afternoon. One white single-door fridge, already standing open; the door stays open and still for the whole take. Inside, a few plain pastel containers on the shelves and one plain egg carton at the back of the middle shelf. All cabinet doors and drawers are closed and stay still.",
        "action": "He crouches in front of the open fridge, holding his phone to his left ear with his left hand the whole time. With his right hand he slides two containers aside one at a time and peers behind them. He finds the egg carton at the back, pulls it out and flips the lid open with his thumb: there is a single egg inside. He stops and stares at it for a beat, then slowly closes the lid and puts the carton back where it was.",
        "audio": "Fridge hum, containers sliding. His wife's voice, small and tinny from the phone: \"여보, 집에 계란 있어? 나 지금 마트야.\" He, still digging with one hand: \"잠깐만, 어디 보자.\" (He pulls out the carton and flips the lid open, then stops and stares at the single egg.) He: \"어, 한 개 있네?\" Wife, from the phone: \"한 개? 알았어, 사 갈게.\" (He slowly closes the lid and slides the carton back.)",
        "no_line": "Fridge hum, containers sliding, the soft click of the carton lid. He stares at the single egg and breathes out through his nose. Spoken words: none.",
        "last": "The open egg carton in his hand with the single egg inside.",
        "first": "He crouches in front of the open white single-door fridge, holding his phone to his left ear with his left hand, his right hand sliding a plain container aside on the middle shelf. The fridge door stands wide open. All cabinet doors and drawers are closed.",
    },
    {
        "no": "02", "kbf": "있는 재료로 매칭", "title": "냉장고 재료 라인업",
        "why": "냉장고에 남은 걸 다 꺼내 놓고 「이걸로 뭐가 되나」 고민하는 밤은 누구나 겪어요. 재료를 경찰서 용의자처럼 한 줄로 세워 놓고 팔짱 끼고 노려보는 게 과장 포인트예요.",
        "caption": "재료는 있는데\n요리가 안 떠올라요",
        "punch": "여자가 「계란 하나로?」 하는 순간",
        "demo": "02 매칭 — 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면",
        "cast": "Early-30s Korean man, short neat hair, navy crew-neck sweatshirt, already standing at the counter from the first second. His girlfriend, late 20s, hair in a loose bun, soft gray cardigan, holding a mug, walks in from the doorway on the right.",
        "home": "Small apartment kitchen at night, warm pendant light over a wooden counter, a window with the city dark outside. On the counter there are only four ingredients in one evenly spaced row: one egg, half an onion wrapped in plastic, a single sausage, one slice of cheese. Nothing else is on the counter. All cabinet doors and drawers are closed and stay still.",
        "action": "He stands a step back from the counter with his arms crossed, studying the row of four ingredients very seriously, like a detective at a lineup. His girlfriend walks in, stops beside him and looks at him, then at the row. She picks up the single egg, holds it up and looks at him. Without a word he takes the egg back from her hand and carefully puts it back in its exact place in the row, then crosses his arms again. She stares at him, holding back a laugh.",
        "audio": "Quiet kitchen hum. She, stopping beside him: \"뭐 해? 안 자고.\" He, arms crossed, eyes on the counter: \"배고파서. 이걸로 뭐 해 먹을 수 있나 보고 있어.\" (She picks up the egg and holds it up.) She, half laughing: \"계란 하나로?\" (He takes the egg back without a word and puts it back in its place.)",
        "no_line": "Quiet kitchen hum, the egg tapped softly back onto the counter. She lets out a small laugh through her nose. Spoken words: none.",
        "last": "His hand placing the single egg back in its exact spot in the row.",
        "first": "Four ingredients sit evenly spaced in one neat row on the wooden counter: one egg, half an onion wrapped in plastic, a single sausage, one slice of cheese. He stands a step back with his arms crossed, studying them seriously. His girlfriend, holding a mug, is just stepping in from the doorway on the right.",
    },
    {
        "no": "03", "kbf": "요리 모드 · 손 안 대고 넘기기", "title": "아니 아니, 너무 올렸어",
        "why": "양념 묻은 손으로 레시피를 못 넘겨서 옆 사람을 부르면, 꼭 엉뚱한 데까지 스크롤해 버려요. 커플·가족끼리 태그하기 좋은 상황이에요.",
        "caption": "손이 바쁠 땐\n레시피도 못 넘겨요",
        "punch": "마지막 「아니 아니 아니!」 하는 순간",
        "demo": "03 요리 모드 — 손대지 않아도 단계를 소리로 읽어 주고 노랗게 짚어 주는 화면",
        "cast": "Early-30s Korean woman, hair tied up high, plain beige apron over a white tee, clear food-prep gloves covered in red marinade. Her husband, early 30s, short hair, dark green t-shirt. Both are in the frame from the very first second: she stands at the counter on the left, he stands at the sink just to her right, a step away, rinsing a cup.",
        "home": "Bright apartment kitchen in the early evening. On the white counter there are only two things: a mixing bowl of marinated meat, and in front of it one smartphone standing upright in a plain white phone stand. The counter is otherwise clear.",
        "action": "She is mixing the meat in the bowl with both gloved hands. There is exactly one phone in the whole scene, the one in the white stand, with its screen turned away from us; it stays in the stand the whole time. She holds her messy hands up, turns her head to her husband at the sink and talks to him, looking at him. He puts the cup down, steps over to her side, and scrolls the phone in the stand with one fingertip while she leans in to read. Every correction makes him overshoot the other way, and each time he glances at her face to check. His other hand stays empty.",
        "audio": "Soft squish of marinade, water running briefly at the sink. She, turning her head to look at her husband, gloved hands up: \"자기야, 내가 손에 뭐가 많이 묻어서, 이 화면 좀 올려 줄래?\" (He steps over and scrolls the phone in the stand up a little with one fingertip.) She, leaning in to read: \"아니 아니, 좀만 더 위로.\" (He scrolls up a bit more and glances at her face, checking.) She: \"아니 아니 아니, 너무 올렸어!\" (This time he scrolls back down too far, then freezes and looks at her.) She, laughing in exasperation: \"아니 아니 아니!\"",
        "no_line": "Soft squish of marinade, a finger tapping glass. She sighs patiently. Spoken words: none.",
        "last": "His fingertip frozen just above the phone in the white stand, her red gloved hands up beside it.",
        "first": "She stands at the counter on the left with both clear gloved hands, covered in red marinade, in a mixing bowl of marinated meat. In front of the bowl, one smartphone stands upright in a plain white phone stand, screen turned away from us; the counter is otherwise clear. Her husband stands at the sink just to her right, a step away, rinsing a cup. She has just turned her head toward him.",
    },
    {
        "no": "04", "kbf": "장 볼 게 가장 적은 식단", "title": "안 닫히는 냉장고",
        "why": "장을 잔뜩 봐 와서 꽉 찬 냉장고에 밀어 넣고 문을 닫았는데, 돌아서자마자 문이 스르륵 열려서 방금 넣은 게 삐져나오려는 순간. 다들 해 봤어요. 황급히 등으로 문을 막는 게 웃음 포인트예요.",
        "caption": "이번 주도\n장을 너무 많이 봤어요",
        "punch": "황급히 돌아서서 등으로 문을 막는 순간",
        "demo": "04 AI 식단 — 냉장고 재료로 짜서 장 볼 게 가장 적어지는 일주일(84개 → 7개)",
        "cast": "Late-30s Korean woman, shoulder-length hair tucked behind her ears, cream knit top, light jeans. Her husband, around 40, glasses, gray sweater, already sitting at the dining table in the background on the right from the first second, reading something on a tablet lying flat.",
        "home": "Family apartment kitchen in the afternoon. On the left, one tall white single-door fridge with the hinge on its left side. Dining table by the window on the right. Two plain paper grocery bags on the floor by the fridge. All cabinet doors and drawers are closed and stay closed and still for the whole take.",
        "action": "The fridge is packed full. She pushes one last plain container onto a crowded shelf, closes the fridge door firmly with her hand, and turns to walk toward the table. After two steps, behind her, the fridge door slowly swings back open by itself, and the container she just put in starts to slide out over the edge of the shelf. She hears it, spins around, hurries back and presses her back flat against the door to shut it, arms spread out at her sides, and stays there holding it closed. Only she and the fridge door move; everything else in the kitchen stays still.",
        "audio": "The soft thump of the fridge door closing, footsteps. (Behind her the door creaks slowly open.) She, spinning around: \"어어어, 잠깐만!\" (She hurries back and presses her back against the door.) Her husband, looking up from the table: \"또 장 봤어?\" She, back pressed to the door, laughing a little out of breath: \"이번 주 거야. 이번 주에 다 먹을 거야.\"",
        "no_line": "The soft thump of the fridge door closing, footsteps, the slow creak of the door swinging open, quick footsteps back. She lets out a short breathless laugh. Spoken words: none.",
        "last": "Her back pressed flat against the fridge door, arms spread out to hold it shut.",
        "first": "She stands at the open, completely packed white single-door fridge on the left, pushing one last plain container onto a crowded shelf. Two plain paper grocery bags sit on the floor by her feet. Her husband sits at the dining table in the background on the right. All cabinet doors and drawers are closed.",
    },
    {
        "no": "05", "kbf": "유통기한 임박 알림", "title": "냄새 테스트",
        "why": "유통기한 지난 우유를 냄새로 확인하다가 결국 옆 사람한테 넘기는 장면은 거의 모든 커플이 겪어요. 맡아 보고 슬쩍 되돌려 주는 게 웃음 포인트예요.",
        "caption": "유통기한,\n아직도 냄새로 확인해요?",
        "punch": "「음, 자기가 먹어」 하고 우유곽을 그대로 되돌려 주는 순간",
        "demo": "05 유통기한 알림 — 푸시 알림 → 유통기한 자동 계산 → 임박 재료 레시피 추천",
        "cast": "A Korean couple in their early 30s, both standing at the counter side by side from the first second. He wears a plain white t-shirt and has messy morning hair; she wears a soft lavender cardigan, hair down, hands free.",
        "home": "Apartment kitchen on a weekend morning, sunlight through the window. On the counter only a toaster against the wall. All cabinet doors and drawers are closed and stay still. There is exactly one milk carton in the scene: an ordinary 1-litre white gable-top carton (the classic peaked-roof shape) with a simple blue printed label that wraps around all four sides. Its roof is folded flat and tight against the body, the same width as the body; at one end of the roof ridge the small pour spout is already pinched open, a little triangle. The whole carton is the same white colour top to bottom and keeps this exact shape, size, colour and label for the whole take; it has no screw cap, nobody opens or closes anything on it.",
        "action": "He holds the one gable-top milk carton upright by its body, label facing the camera. He sniffs at the spout, pauses, sniffs again and tilts his head, unsure, then holds it out to her. She takes it with both hands, sniffs once at the spout, and holds very still for a beat. Then, without a word, she calmly hands the carton straight back to him, unchanged, and pats his arm once with a small polite smile. He looks down at the carton in his hands, then at her. The carton only moves when one of them moves it.",
        "audio": "Morning kitchen sounds, two short sniffs. He, holding the carton out to her: \"자기야, 이거 우유 괜찮은 거 같아? 냄새 좀 맡아 봐.\" (She sniffs once at the spout, freezes for a beat, and hands the carton straight back.) She, sweetly: \"음, 자기가 먹어.\"",
        "no_line": "Morning kitchen sounds, two short sniffs, the carton passed from hand to hand. She lets out a short laugh through her nose. Spoken words: none.",
        "last": "The same white gable-top milk carton, roof flat and tight, label facing the camera, back in his hands, him looking down at it.",
        "first": "The couple stand side by side at the sunny counter. He holds one plain white gable-top milk carton with its spout pinched open just below his nose, about to sniff it; she stands beside him with her hands free, watching him. Only a toaster sits on the counter against the wall.",
    },
    {
        "no": "06", "kbf": "요리 AI · 말로 물어보기", "title": "엄마, 뭐 해 먹지?",
        "why": "냉장고에 있는 재료를 불러 주며 엄마한테 전화로 메뉴를 묻는 건 자취생·신혼부부 모두의 공감 포인트예요. 엄마의 「맨날 물어보니」가 웃음 포인트예요.",
        "caption": "엄마 말고\n물어볼 데 없나요?",
        "punch": "엄마가 「그걸 왜 맨날 물어봐」 하는 순간",
        "demo": "06 요리 AI — 말하듯 물어보면 냉장고 재료로 딱 맞는 레시피를 찾아 주는 화면",
        "cast": "Late-20s Korean woman, straight hair to her collarbone, oversized light blue shirt. Her mother is not in the scene; she is heard only as a voice from the phone on speaker.",
        "home": "Small officetel kitchen in the evening, warm lamp. On the counter: a wooden cutting board with one plain tofu pack and a knife on it, and to the right of the board one phone lying face down. Nothing else on the counter. All cabinet doors and drawers are closed and stay still.",
        "action": "She holds a zucchini in one hand, turning it while she talks toward the phone lying face down on the counter; the phone does not move. When her mother answers, she pulls a small sulky face at the phone, puts the zucchini on the board, picks up the knife and starts slicing.",
        "audio": "Soft kitchen sounds. She, toward the phone: \"엄마, 나 집에 두부랑 애호박 있는데 뭐 해 먹지?\" Her mother's voice from the phone speaker, without missing a beat: \"된장찌개 하면 되지. 그걸 왜 맨날 물어봐.\" (She pulls a small sulky face at the phone.) She: \"아 알았어, 알았어.\" (She puts the zucchini on the board and starts slicing.)",
        "no_line": "Soft kitchen sounds, a faint murmur from the phone speaker, the knife meeting the board. She pulls a small sulky face. Spoken words: none.",
        "last": "The zucchini being sliced on the cutting board, the phone lying face down beside it.",
        "first": "She stands at the counter holding a zucchini in one hand. In front of her a wooden cutting board with one plain tofu pack and a knife; to the right of the board one phone lies face down. All cabinet doors and drawers are closed.",
    },
    {
        "no": "07", "kbf": "검증된 진짜 레시피", "title": "근데 이거 뭐야?",
        "why": "레시피 영상 보고 열심히 만들었는데 결과물이 전혀 다르게 나오는 경험은 요리해 본 사람이면 다 있어요. 상대가 예의 바르게 맛있다고 한 뒤 묻는 한마디가 웃음 포인트예요.",
        "caption": "레시피대로 했는데\n왜 이렇게 됐지?",
        "punch": "「근데 자기야, 이거 뭐야?」 하는 순간",
        "demo": "07 진짜 레시피 — 좋아요·조회수로 검증된 레시피, 분량까지 정리된 재료·조리 순서",
        "cast": "A Korean couple in their late 20s, both at the table from the first second. He wears glasses and a soft gray knit sweater; she has a short bob and a cream blouse.",
        "home": "Small apartment dining table at dinner time, warm pendant light. They sit at one corner of the table, at a right angle to each other, so both faces are visible. On the table: two plain bowls of rice, two spoons, and one plain white plate of a dark, shapeless braised dish in front of her. Nothing else on the table.",
        "action": "He sits with his chin on his hand, watching her hopefully. She scoops a careful bite from the white plate with her spoon, chews slowly and nods politely. A short pause. She lifts a piece with her spoon and studies it closely, turning it a little. He keeps watching her. After his answer she nods slowly and politely takes one more small bite.",
        "audio": "Quiet dinner table sounds, slow chewing. She nods politely: \"음, 맛있다.\" (She lifts a piece with her spoon and studies it.) She, gently: \"근데 자기야, 이거 뭐야?\" He, after a beat, small voice: \"찜닭인데.\" She, nodding slowly: \"아, 찜닭.\"",
        "no_line": "Quiet dinner table sounds, slow chewing, a spoon on a plate. She studies a piece on her spoon, then nods politely. Spoken words: none.",
        "last": "The shapeless piece held up on her spoon above the white plate.",
        "first": "The couple sit at one corner of a small dining table at a right angle to each other. In front of her, one plain white plate of a dark, shapeless braised dish and a bowl of rice; she holds a spoon. He rests his chin on his hand, watching her hopefully.",
    },
    {
        "no": "08", "kbf": "가족 · 아낀 돈", "title": "또 뵙네요",
        "why": "배달 기사님이 얼굴을 알아볼 만큼 시켜 먹었다는 걸 깨닫는 순간은 웃기면서 찔려요. 기사님의 반가운 「또 뵙네요」가 웃음 포인트예요.",
        "caption": "배달 기사님이\n우리 얼굴을 알아요",
        "punch": "기사님이 「또 뵙네요」 하는 순간",
        "demo": "08 가족·아낀 돈 — 가족이 함께 정한 집밥 목표·달성·아낀 돈(추정)이 보이는 마이캘린더",
        "cast": "A Korean couple in their mid 30s in comfortable home clothes; she has her hair in a claw clip, he wears a navy hoodie and stands in the hallway behind her from the first second. A friendly delivery rider in his 30s wears a plain black jacket with no logos and holds one plain white paper bag.",
        "home": "Apartment front door in the evening, seen from inside the entryway, warm entryway light, shoes neatly lined up on the floor. The only thing that moves is the front door when she opens and closes it.",
        "action": "She opens the front door. The rider hands her the plain bag and recognizes her with a friendly smile and a small nod. She smiles back politely, a little awkward, takes the bag and closes the door. She turns around to her husband in the hallway. After his line she calmly hands the bag to him.",
        "audio": "Door opening, paper bag rustling. Rider, cheerful, recognizing her: \"아, 안녕하세요! 또 뵙네요.\" She, polite and a little embarrassed: \"아, 네. 감사합니다.\" (She closes the door and turns around.) Her husband, quietly: \"우리 저 기사님이랑 친해졌다.\" She, handing him the bag, deadpan: \"자기가 시켰잖아.\"",
        "no_line": "Door opening, paper bag rustling, the door closing softly. The couple look at each other and let out a short laugh. Spoken words: none.",
        "last": "The delivery bag passing from her hands into his.",
        "first": "Seen from inside the entryway: she has just opened the front door. The delivery rider stands outside holding out one plain white paper bag. Her husband stands in the hallway behind her.",
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


IMAGE_HEAD = "Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright."
IMAGE_STYLE = """The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame."""
IMAGE_TAIL = "Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920)."


def image_prompt(c):
    """세로 영상을 확실히 받는 2단계용 — 먼저 이 세로 사진을 만들고, 그 사진을 첨부해서 영상 프롬프트를 붙인다(영상이 첨부 사진의 비율을 따른다)."""
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
        "## 세로(9:16)로 받는 법 — 2026-10-06 보강",
        "- v3 첫 판도 가로로 나왔다. 원인 후보: 「가로 16:9로 만들지 마라」처럼 **피할 것의 이름을 적은 문장**(v2 때 자막에서 본 것과 같은 역효과). v2(세로로 잘 나옴)엔 이런 문장이 없었다 → 뺐다.",
        "- 제미나이 앱 사용자 경험상 비율 지시는 **프롬프트 끝에** 「Generate this video in a 9:16 vertical aspect ratio」처럼 짧게 적는 게 잘 먹힌다 → 맨 앞 첫 줄과 맨 끝 줄을 이 문장으로.",
        "- **가장 확실한 방법(2단계)**: 제미나이 앱은 첨부한 이미지와 같은 비율로 영상을 만든다. ① 편마다 있는 **첫 장면 이미지 프롬프트**로 세로 사진을 먼저 만든다(세로인지 확인) ② 새 대화에서 그 사진을 첨부하고 **영상 프롬프트**를 붙인다. 영상 프롬프트에 「첨부 이미지가 있으면 그게 첫 장면」이라는 줄이 들어 있다.",
        "- 쓰는 화면에 비율 고르는 칸이 있으면 9:16을 고른다. 세로 영상 생성은 Google AI Plus·Pro·Ultra 요금제에서 된다.",
        "",
        "## 연기·대사가 어색할 때 — 2026-10-07 보강",
        "- 「어색하지 않게」 같은 형용사는 거의 안 먹힌다. 모델은 **구체적인 몸동작 지시**에 반응한다 → ACTING 을 「가족이 몰래 찍은 폰 영상, 각자 하던 일을 하면서 그 김에 말한다, 대답은 고개도 안 들고 바로」로 바꿨다.",
        "- 한국어 억양: 「서울말을 쓰는 한국인이 집에서 하는 평소 억양, 드라마·브이로그처럼」을 SPEECH 에 적었다. 프롬프트 전체를 한글로 바꾸지는 않는다(한글이 많아지면 화면에 깨진 자막이 다시 나온다).",
        "- 대사는 **실제로 할 법한 온전한 문장**으로(10-07 사용자 예시 — 「자기야~! 나 손에 잔뜩 묻어서 만질 수가 없는데, 레시피 좀만 올려 줄래?」). 한때 「최대 두 줄·한마디」로 줄였더니 맥락이 사라져 더 어색했다. 대신 대사마다 그때의 행동을 괄호로 짝지어 **순서대로**(TIMING) 적는다. 말줄임표(…)는 어색하게 긴 멈춤이 되어 쓰지 않는다.",
        "- 말을 거는 상대가 화면 밖에 있으면 허공을 보고 말한다 → 상대를 **첫 초부터 화면 안에** 두고 「그 사람을 보며 말한다」고 적는다. 소품 동작을 그 물건에 없는 부품으로 적으면 모양이 바뀐다(5편: 삼각 지붕형 우유곽에 「뚜껑을 돌려 닫는다」고 써서 6.5초에 위가 평평하고 한글 라벨 붙은 상자로 변함) → 소품의 생김새를 정확히 적고(gable-top, 입구 열림) 「끝까지 같은 모양·사람이 옮길 때만 움직임」. 「입구가 열린」 만 적으면 지붕 전체가 부풀어 몸통보다 넓은 흰 뚜껑처럼 뜨고, 몸통 색이 회색으로 바뀐다(5편 3.5초~) → 「지붕은 몸통 폭 그대로 납작, 입구는 지붕 끝의 작은 삼각형, 네 면을 두르는 같은 라벨, 위아래 같은 흰색」까지 적는다. 배경의 문·서랍은 아무도 안 만져도 움직인다(4편) → 「ACTION 에 적은 것만 움직이고 배경 문·서랍은 닫힌 채 가만히」를 공통 지시에, 냉장고는 문 하나짜리로 정한다. 소품이 붙어 있으면 서로 바뀐다(3편: 폰을 기대 둔 병의 뚜껑이 폰으로 바뀌어 폰이 2개) → 소품 수를 줄이고 **하나씩 떨어뜨려** 적는다. 어려운 편은 **첫 장면 이미지(2단계)** 로 소품·인물 배치를 먼저 고정한다.",
        "- 그래도 어색하면: 같은 프롬프트로 **새 대화에서 2~3번** 뽑아 제일 자연스러운 걸 고른다. 계속 어색하면 **대사 없는 버전**으로 뽑고 웃음은 몸짓·자막으로 낸다.",
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
    (ROOT / "store/REEL_HOOKS_V3.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")


def write_html(path: Path):
    data = {
        "clips": [dict(c, prompt=clip_prompt(c), promptNoLine=clip_prompt(c, True), promptImage=image_prompt(c)) for c in CLIPS],
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
