# 릴스 후킹 영상 v3 — 제미나이(Veo) 프롬프트 8편

만든 날: 2026-10-06 · 만든 스크립트: `scripts/gen_reel_hooks_v3.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).
폰에서 복사해 쓰는 페이지는 아티팩트로 게시한다. v2(2026-09-29)는 [REEL_HOOKS_V2.md](REEL_HOOKS_V2.md).

## v2를 편집해 보고 바꾼 것
- **세로 9:16**: 제미나이가 가로로 만드는 일이 잦아, 프롬프트 맨 앞 [FORMAT]과 맨 끝 리마인더 두 군데에 세로 1080×1920을 적고 구도도 세로 화면 기준으로 적었다.
- **연기**: 대파 편의 「카메라 쪽으로 입 벌리고 놀라기」 같은 과한 반응을 막도록 ACTING 블록 — 반응은 작게, 입은 말할 때만, 시선은 소품·상대에게, 대사 중에도 손은 하던 일을 계속.
- **대사**: 실생활 반말, 짧게, 끝을 흐리게. 혼잣말보다 주고받는 말. 상황을 설명하는 대사는 쓰지 않는다.
- **물건 개수 유지**: 냉장고 편에서 폰이 하나 더 생긴 일 때문에 CONTINUITY 블록을 넣었다.
- **편 번호 = 앱 데모 번호**: 01 사진 인식, 02 매칭, 03 요리 모드, 04 AI 식단, 05 유통기한, 06 요리 AI, 07 진짜 레시피, 08 가족·아낀 돈.
- **자막 띄울 순간**을 편마다 적었다. 후킹 자막은 웃음 포인트에서 띄운다(0초부터 띄우면 결말을 미리 말해 버린다).

## 세로(9:16)로 받는 법 — 2026-10-06 보강
- v3 첫 판도 가로로 나왔다. 원인 후보: 「가로 16:9로 만들지 마라」처럼 **피할 것의 이름을 적은 문장**(v2 때 자막에서 본 것과 같은 역효과). v2(세로로 잘 나옴)엔 이런 문장이 없었다 → 뺐다.
- 제미나이 앱 사용자 경험상 비율 지시는 **프롬프트 끝에** 「Generate this video in a 9:16 vertical aspect ratio」처럼 짧게 적는 게 잘 먹힌다 → 맨 앞 첫 줄과 맨 끝 줄을 이 문장으로.
- **가장 확실한 방법(2단계)**: 제미나이 앱은 첨부한 이미지와 같은 비율로 영상을 만든다. ① 편마다 있는 **첫 장면 이미지 프롬프트**로 세로 사진을 먼저 만든다(세로인지 확인) ② 새 대화에서 그 사진을 첨부하고 **영상 프롬프트**를 붙인다. 영상 프롬프트에 「첨부 이미지가 있으면 그게 첫 장면」이라는 줄이 들어 있다.
- 쓰는 화면에 비율 고르는 칸이 있으면 9:16을 고른다. 세로 영상 생성은 Google AI Plus·Pro·Ultra 요금제에서 된다.

## 한글·자막이 화면에 나오지 않게 (v2와 같음)
- 프롬프트는 **영어**. 한국어는 AUDIO 칸의 **소리로만 나오는 대사**에만 있다.
- 「자막·글자 금지」라고 적지 않는다 — 그리지 말아야 할 것의 이름을 적으면 오히려 그 단어를 힌트로 쓴다. 대신 **있어야 할 것**만 적는다(깨끗한 원본 촬영분, 무지 소품, 화면이 돌아간 폰).
- 그래도 나오면: ① **새 대화에서 같은 프롬프트로 다시** ② **대사 없는 버전**으로 만들고 대사는 편집에서 목소리·자막으로 ③ 제외할 요소(negative prompt) 칸이 있으면 거기에만 `subtitles, captions, on-screen text, letters, watermark`.

## 공통 지시 (모든 편 맨 앞·맨 끝 — 아래 완성본에 이미 합쳐져 있다)

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

…편별 [CAST]·[HOME]·[ACTION]·[AUDIO]·[LAST SECOND]…

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

## 01. 계란 있어? 없어? — 사진 한 장으로 냉장고 채우기

- **공감 포인트**: 장 보다가 「집에 계란 있어?」 하고 전화하는 건 거의 모든 집에서 하는 일이에요. 냉장고를 한참 뒤져서 찾은 게 계란 한 알이라는 게 웃음 포인트예요.
- **편집 때 얹을 자막(제안)**: 냉장고 사정, / 아직도 전화로 물어봐요?
- **자막 띄울 순간**: 계란판을 열어 한 알만 보이는 순간(「…한 개 있어」)
- **이어 붙일 앱 데모**: 01 사진 인식 — 영수증·음식 사진 한 장으로 재료가 냉장고에 담기는 화면(냉장고가 폰 안에)

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Late-30s Korean man, short tidy hair, light gray hoodie, sweatpants, thick socks. His wife is heard only as a small voice from his phone.

[HOME]
Apartment kitchen in the afternoon, white fridge, light oak floor, a fruit bowl on the counter.

[ACTION]
He crouches in front of the open fridge with his phone pinched between his shoulder and his ear, screen facing his cheek. He slides containers aside one by one, peering behind them. He finds a plain pastel egg carton at the very back, pulls it out and flips the lid open: a single egg sits inside. He looks at it for a beat.

[AUDIO]
Fridge hum, containers sliding. His wife's voice, small and tinny from the phone: "계란 있어? 없어?" He, still digging: "잠깐만, 잠깐만..." After he opens the carton, flat: "...한 개 있어."

[LAST SECOND]
The open egg carton with the single egg inside.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
He crouches in front of the open fridge with his phone pinched between his shoulder and his ear, screen against his cheek, one hand sliding a container aside on a shelf.

[CAST]
Late-30s Korean man, short tidy hair, light gray hoodie, sweatpants, thick socks. His wife is heard only as a small voice from his phone.

[HOME]
Apartment kitchen in the afternoon, white fridge, light oak floor, a fruit bowl on the counter.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 02. 냉장고 재료 라인업 — 있는 재료로 매칭

- **공감 포인트**: 냉장고에 남은 걸 다 꺼내 놓고 「이걸로 뭐가 되나」 고민하는 밤은 누구나 겪어요. 재료를 경찰서 용의자처럼 한 줄로 세워 놓고 팔짱 끼고 노려보는 게 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 재료는 있는데 / 요리가 안 떠올라요
- **자막 띄울 순간**: 「이걸로… 뭐 되나 보고 있어」 대답하는 순간
- **이어 붙일 앱 데모**: 02 매칭 — 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Early-30s Korean man, short neat hair, navy crew-neck sweatshirt. His girlfriend, late 20s, hair in a loose bun, soft gray cardigan.

[HOME]
Small apartment kitchen at night, warm pendant light over a wooden counter, a window with the city dark outside.

[ACTION]
On the wooden counter he has lined up, evenly spaced in one neat row: one egg, half an onion wrapped in plastic, a single sausage and one slice of cheese. He stands back with his arms crossed, studying the row very seriously, like a detective at a lineup. His girlfriend walks in behind him holding a mug, stops and looks at the row, then at him.

[AUDIO]
Quiet kitchen hum. She, puzzled: "뭐 해?" He, without taking his eyes off the counter: "이걸로... 뭐 되나 보고 있어."

[LAST SECOND]
The four lonely ingredients lined up on the counter.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Four ingredients sit evenly spaced in one neat row on the wooden counter: one egg, half an onion wrapped in plastic, a single sausage, one slice of cheese. He stands a step back with his arms crossed, studying them seriously. His girlfriend is just stepping into the doorway behind him holding a mug.

[CAST]
Early-30s Korean man, short neat hair, navy crew-neck sweatshirt. His girlfriend, late 20s, hair in a loose bun, soft gray cardigan.

[HOME]
Small apartment kitchen at night, warm pendant light over a wooden counter, a window with the city dark outside.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 03. 위로, 아니 너무 올렸어 — 요리 모드 · 손 안 대고 넘기기

- **공감 포인트**: 양념 묻은 손으로 레시피를 못 넘겨서 옆 사람을 부르면, 꼭 엉뚱한 데까지 스크롤해 버려요. 커플·가족끼리 태그하기 좋은 상황이에요.
- **편집 때 얹을 자막(제안)**: 손이 바쁠 땐 / 레시피도 못 넘겨요
- **자막 띄울 순간**: 「아니 너무 올렸어」 하는 순간
- **이어 붙일 앱 데모**: 03 요리 모드 — 손대지 않아도 단계를 소리로 읽어 주고 노랗게 짚어 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Early-30s Korean woman, hair tied up high, plain beige apron over a white tee, clear food-prep gloves covered in red marinade. Her husband, early 30s, short hair, dark green t-shirt.

[HOME]
Bright apartment kitchen in the early evening, white counter with a mixing bowl of marinated meat, a phone propped against a jar.

[ACTION]
She is mixing the meat in the bowl with both gloved hands. The phone leaning on the jar has its screen turned away from us. She glances at it, holds her messy hands up and calls her husband over without moving. He walks in, stands beside her and scrolls the phone with one finger while she leans in to read. He scrolls too far; she tilts her head, he scrolls back, she sighs patiently.

[AUDIO]
Soft squish of marinade. She: "자기야, 이것 좀 올려 줘." A beat later, while he scrolls: "아니 위로... 아니, 너무 올렸어." He, quietly: "아 어디..."

[LAST SECOND]
Her red gloved hands held up in the air next to the phone.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
She stands at the counter with both clear gloved hands, covered in red marinade, inside a mixing bowl of marinated meat. A phone leans against a jar with its screen turned away from us. Her husband is on the sofa in the soft-focus background.

[CAST]
Early-30s Korean woman, hair tied up high, plain beige apron over a white tee, clear food-prep gloves covered in red marinade. Her husband, early 30s, short hair, dark green t-shirt.

[HOME]
Bright apartment kitchen in the early evening, white counter with a mixing bowl of marinated meat, a phone propped against a jar.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 04. 안 닫히는 냉장고 — 장 볼 게 가장 적은 식단

- **공감 포인트**: 장을 잔뜩 봐 와서 꽉 찬 냉장고에 테트리스하듯 밀어 넣는 건 다들 해 봤어요. 엉덩이로 문을 닫았는데 스르륵 다시 열리는 게 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 이번 주도 / 장을 너무 많이 봤어요
- **자막 띄울 순간**: 문이 다시 스르륵 열리는 순간
- **이어 붙일 앱 데모**: 04 AI 식단 — 냉장고 재료로 짜서 장 볼 게 가장 적어지는 일주일(84개 → 7개)

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Late-30s Korean woman, shoulder-length hair tucked behind her ears, cream knit top. Her husband, around 40, glasses, gray sweater, seated at the dining table in the background.

[HOME]
Family apartment kitchen in the afternoon, white fridge, dining table by the window, two plain paper grocery bags on the floor.

[ACTION]
The fridge is already packed full. She pushes one more container in and rearranges two others to make it fit, then closes the door and gives it a gentle push with her hip. She turns away, and behind her the door slowly swings back open. She stops, looks at it, and pushes it closed again with her palm, holding it there for a second.

[AUDIO]
Containers clinking, the fridge seal. Her husband, from the table, mild: "또 장 봤어?" She, palm still on the door: "...이번 주 거야."

[LAST SECOND]
Her hand pressed flat against the fridge door, holding it shut.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
She stands at the open, completely packed fridge, pushing one more container onto a full shelf. Two plain paper grocery bags sit on the floor by her feet. Her husband sits at the dining table in the background.

[CAST]
Late-30s Korean woman, shoulder-length hair tucked behind her ears, cream knit top. Her husband, around 40, glasses, gray sweater, seated at the dining table in the background.

[HOME]
Family apartment kitchen in the afternoon, white fridge, dining table by the window, two plain paper grocery bags on the floor.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 05. 냄새 테스트 — 유통기한 임박 알림

- **공감 포인트**: 유통기한 지난 우유를 냄새로 확인하다가 결국 옆 사람한테 넘기는 장면은 거의 모든 커플이 겪어요. 맡아 보고 슬쩍 되돌려 주는 게 웃음 포인트예요.
- **편집 때 얹을 자막(제안)**: 유통기한, / 아직도 냄새로 확인해요?
- **자막 띄울 순간**: 「…너 먹어」 하고 우유를 되돌려 주는 순간
- **이어 붙일 앱 데모**: 05 유통기한 알림 — 푸시 알림 → 유통기한 자동 계산 → 임박 재료 레시피 추천

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
A Korean couple in their early 30s. He wears a plain white t-shirt and has messy morning hair; she wears a soft lavender cardigan, hair down.

[HOME]
Apartment kitchen on a weekend morning, sunlight through the window, a toaster and two mugs on the counter.

[ACTION]
He opens a plain white milk carton, sniffs it, pauses, sniffs again and tilts his head, unsure. He holds it out to her. She takes it, sniffs once, holds still for a beat, then calmly hands it straight back to him with a small polite smile.

[AUDIO]
Morning kitchen sounds, the carton cap twisting. He: "이거 괜찮은 거 같아?" She, after one sniff, handing it back: "...너 먹어."

[LAST SECOND]
The milk carton held between them.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
The couple stand side by side at the sunny counter. He holds an opened plain white milk carton just below his nose, about to sniff it; she holds a mug and watches him.

[CAST]
A Korean couple in their early 30s. He wears a plain white t-shirt and has messy morning hair; she wears a soft lavender cardigan, hair down.

[HOME]
Apartment kitchen on a weekend morning, sunlight through the window, a toaster and two mugs on the counter.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 06. 엄마, 뭐 해 먹지? — 요리 AI · 말로 물어보기

- **공감 포인트**: 냉장고에 있는 재료를 불러 주며 엄마한테 전화로 메뉴를 묻는 건 자취생·신혼부부 모두의 공감 포인트예요. 엄마의 「맨날 물어보니」가 웃음 포인트예요.
- **편집 때 얹을 자막(제안)**: 엄마 말고 / 물어볼 데 없나요?
- **자막 띄울 순간**: 엄마가 「몇 번을 말하니」 하는 순간
- **이어 붙일 앱 데모**: 06 요리 AI — 말하듯 물어보면 냉장고 재료로 딱 맞는 레시피를 찾아 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Late-20s Korean woman, straight hair to her collarbone, oversized light blue shirt. Her mother is heard only as a voice from the phone on speaker.

[HOME]
Small officetel kitchen in the evening, warm lamp, a tofu block and a zucchini on the cutting board.

[ACTION]
Her phone lies face down on the counter on speaker. She holds a zucchini in one hand and taps the tofu pack with the other, looking down at them while she talks. When her mother answers, she presses her lips together, nods to herself and starts slicing the zucchini.

[AUDIO]
Soft kitchen sounds. She, toward the phone: "엄마, 집에 두부랑 애호박 있는데 뭐 해 먹지?" Her mother's voice from the phone speaker, warm but tired: "된장찌개 하면 되잖아. 몇 번을 말하니." She, quietly: "...알았어."

[LAST SECOND]
The zucchini being sliced on the cutting board.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
She stands at the counter holding a zucchini in one hand, a plain tofu pack and a cutting board in front of her. Her phone lies face down beside the board.

[CAST]
Late-20s Korean woman, straight hair to her collarbone, oversized light blue shirt. Her mother is heard only as a voice from the phone on speaker.

[HOME]
Small officetel kitchen in the evening, warm lamp, a tofu block and a zucchini on the cutting board.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 07. 근데 이거 뭐야? — 검증된 진짜 레시피

- **공감 포인트**: 레시피 영상 보고 열심히 만들었는데 결과물이 전혀 다르게 나오는 경험은 요리해 본 사람이면 다 있어요. 상대가 예의 바르게 맛있다고 한 뒤 묻는 한마디가 웃음 포인트예요.
- **편집 때 얹을 자막(제안)**: 레시피대로 했는데 / 왜 이렇게 됐지?
- **자막 띄울 순간**: 「근데 이거 뭐야?」 하는 순간
- **이어 붙일 앱 데모**: 07 진짜 레시피 — 좋아요·조회수로 검증된 레시피, 분량까지 정리된 재료·조리 순서

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
A Korean couple in their late 20s. He wears glasses and a soft gray knit sweater; she has a short bob and a cream blouse.

[HOME]
Small apartment dining table at dinner time, warm pendant light, two plain bowls of rice and spoons.

[ACTION]
He sets a plain white plate of a dark, shapeless braised dish in front of her and sits down, watching her hopefully. She takes a careful bite, chews slowly, nods politely. A short pause. She looks down at the plate again. He keeps watching her.

[AUDIO]
Quiet dinner table sounds. She, chewing, kind: "음... 맛있네." A beat. "근데 이거 뭐야?" He, small voice: "...찜닭."

[LAST SECOND]
The shapeless dish on the white plate.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
The couple sit at the small dining table. He is setting a plain white plate of a dark, shapeless braised dish down in front of her; she looks at the plate.

[CAST]
A Korean couple in their late 20s. He wears glasses and a soft gray knit sweater; she has a short bob and a cream blouse.

[HOME]
Small apartment dining table at dinner time, warm pendant light, two plain bowls of rice and spoons.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 08. 또 뵙네요 — 가족 · 아낀 돈

- **공감 포인트**: 배달 기사님이 얼굴을 알아볼 만큼 시켜 먹었다는 걸 깨닫는 순간은 웃기면서 찔려요. 기사님의 반가운 「또 뵙네요」가 웃음 포인트예요.
- **편집 때 얹을 자막(제안)**: 배달 기사님이 / 우리 얼굴을 알아요
- **자막 띄울 순간**: 기사님이 「또 뵙네요」 하는 순간
- **이어 붙일 앱 데모**: 08 가족·아낀 돈 — 가족이 함께 정한 집밥 목표·달성·아낀 돈(추정)이 보이는 마이캘린더

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The person stands in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people and setting exactly.

[DIRECTION — same for every clip in this series]
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
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
A Korean couple in their mid 30s in comfortable home clothes; she has her hair in a claw clip, he wears a navy hoodie. A friendly delivery rider in his 30s wears a plain black jacket with no logos and holds a plain white paper bag.

[HOME]
Apartment front door in the evening, warm entryway light, shoes neatly lined up on the floor.

[ACTION]
She opens the front door. The rider hands her the plain bag and recognizes her with a friendly smile and a small nod. She smiles back politely, a little awkward, takes the bag and closes the door. She turns around; her husband is standing behind her in the hallway. They look at each other.

[AUDIO]
Door opening, paper bag rustling. Rider, cheerful: "아, 또 뵙네요." She, polite and a little embarrassed: "아... 네, 감사합니다." Door closes. Her husband, quietly: "...우리 단골이네."

[LAST SECOND]
The two of them looking at each other, the delivery bag between them.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Seen from inside the entryway: she has just opened the front door. The delivery rider stands outside holding out a plain white paper bag. Her husband stands in the hallway behind her.

[CAST]
A Korean couple in their mid 30s in comfortable home clothes; she has her hair in a claw clip, he wears a navy hoodie. A friendly delivery rider in his 30s wears a plain black jacket with no logos and holds a plain white paper bag.

[HOME]
Apartment front door in the evening, warm entryway light, shoes neatly lined up on the floor.

The person stands in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, paper items blank, no logos; phone screens face away from the camera or lie face down.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 같은 편을 여러 개 뽑을 때 — 변주

[CAST]·[HOME] 줄만 바꿔 넣는다(장면·대사·마지막 1초는 그대로). 얼굴이 계속 비슷하면 [CAST] 끝에 `Completely different faces from any earlier clip.` 를 붙인다.

| 세트 | 바꾸는 것 | [CAST] 에 덧붙이기 | [HOME] 바꾸기 |
|---|---|---|---|
| A | 원본 그대로 | `Keep CAST and HOME as written.` | 그대로 |
| B | 나이를 한 단계 올리고 머리 모양을 바꿈 | `Same roles, but about ten years older, with different hairstyles.` | `Older apartment with warm wood cabinets and a tiled wall.` |
| C | 성별을 바꿈(가능한 편만) · 옷 색을 어둡게 | `Same roles played by the opposite gender, wearing darker clothes.` | `Compact new officetel, all white with stainless steel.` |
| D | 안경 · 니트 대신 셔츠 | `Add glasses; swap knits for crisp shirts.` | `Detached house with solid wood furniture and a garden visible through the window.` |
| E | 머리를 올려 묶고 앞치마 | `Hair tied up high; add plain aprons.` | `Narrow villa kitchen with pale gray counters and potted herbs on the sill.` |
