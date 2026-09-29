# 릴스 후킹 영상 v2 — 제미나이(Veo) 프롬프트 8편

만든 날: 2026-09-29 · 만든 스크립트: `scripts/gen_reel_hooks_v2.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).
폰에서 복사해 쓰는 페이지는 아티팩트로 게시한다. v1(2026-09-23)은 [REEL_PROMPTS_FULL.md](REEL_PROMPTS_FULL.md).

## 방향
- 기능 설명이 아니라 **「이거 완전 나잖아」 하고 공유하고 싶어지는 니즈 상황**. 쿡매치 핵심 기능(KBF)마다 한 편.
- 3~5초 안에 상황이 끝나고, 나머지는 자연스럽게 흘러간다. 마지막 1초는 지정한 대상으로 천천히 다가간다.
- 웃음은 슬랩스틱이 아니라 **무표정한 과장 하나**에서. 인물은 단정하게, 집은 정돈되게.

## 한글·자막이 화면에 나오지 않게
- 프롬프트는 **영어**. 한국어는 AUDIO 칸의 **소리로만 나오는 대사**에만 있다.
- 「자막·글자 금지」라고 적지 않는다 — 그리지 말아야 할 것의 이름을 적으면 오히려 그 단어를 힌트로 쓴다. 대신 **있어야 할 것**만 적는다(깨끗한 원본 촬영분, 라벨 없는 소품, 화면이 돌아간 폰).
- 그래도 나오면: ① 제미나이에게 「자막 빼 줘」라고 말하지 말고 **새 대화에서 같은 프롬프트로 다시** 만든다 ② **대사 없는 버전**으로 만들고 대사는 편집에서 목소리·자막으로 얹는다 ③ 쓰는 화면에 제외할 요소(negative prompt) 칸이 있으면 거기에만 `subtitles, captions, on-screen text, letters, watermark` 를 적는다 ④ 자막이 화면 아래에만 살짝 나오면 우리 자막(화면 세로 3/4 지점)과 확대·크롭으로 가린다.

## 공통 지시 (모든 편 맨 앞 — 아래 완성본에 이미 합쳐져 있다)

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.
```

## 01. 냉장고는 세 번 열어도 그대로 — 매칭률 · 있는 재료로

- **공감 포인트**: 냉장고를 열었다 닫았다 다시 여는 행동은 누구나 해 본 일이에요. 「혹시 뭐가 생겼을까」 하는 헛된 기대가 웃음 포인트예요.
- **편집 때 얹을 자막(제안)**: 냉장고는 세 번 열어도 / 안 바뀝니다
- **이어 붙일 앱 데모**: 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Early-30s Korean woman, hair in a neat low ponytail, oatmeal knit sweater, soft gray lounge pants.

[HOME]
Bright apartment kitchen in the evening, white cabinets, light oak floor, a small plant by the window.

[ACTION]
She opens the fridge and stares inside for a beat, then closes it. She takes two steps away, stops, turns back and opens it again, as if something new might have appeared. The same half-empty shelves. She holds the door open while cold air softly spills out, her face completely deadpan.

[AUDIO]
Fridge hum and the soft thump of the door seal. She mutters flatly in Korean: "...아까랑 똑같네."

[LAST SECOND]
Her hand drifting toward the phone lying face down on the counter.
```

## 02. 고무가 된 오이 — 곧 상할 재료부터

- **공감 포인트**: 야채칸 깊숙이 잊힌 오이가 고무처럼 휘는 장면은 「우리 집에도 있다」는 웃픈 공감을 줘요. 무표정하게 U자로 구부리는 게 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 사 놓고 잊은 재료, / 우리 집에도 있죠
- **이어 붙일 앱 데모**: 「곧 상해요」 배지가 붙은 재료와 그 재료로 먼저 만들 요리가 위로 올라오는 화면

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Early-40s Korean woman, neat chin-length bob, navy button-up shirt with the sleeves folded once.

[HOME]
Older apartment kitchen in the afternoon, cherry-wood cabinets, cream tiled backsplash, spice jars lined on the windowsill.

[ACTION]
She slides open the crisper drawer and pulls out a cucumber. It droops. Holding it by one end, she watches it bend limply. Without any expression she slowly bends it into a U shape between two fingers and studies it.

[AUDIO]
The crisper drawer sliding. She mutters quietly in Korean: "너... 언제 이렇게 됐니."

[LAST SECOND]
The cucumber bent into a U shape in her fingers.
```

## 03. 마트에서 두부 앞에 멈춘 사람 — 사진 한 장으로 냉장고 채우기

- **공감 포인트**: 마트에서 「집에 있었나?」 하고 멈추는 순간은 1인 가구·주부 모두의 공통 경험이에요. 두부 두 모를 양손에 들고 저울처럼 재는 게 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 마트만 오면 / 기억이 안 나요
- **이어 붙일 앱 데모**: 영수증·음식 사진 한 장으로 재료가 냉장고에 담기는 화면(냉장고가 폰 안에)

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Late-30s Korean man, short tidy hair, neatly trimmed beard, charcoal zip jacket over a white tee.

[HOME]
Bright neighborhood supermarket, refrigerated aisle under soft even light, shelves stocked with plain packs in solid colors.

[ACTION]
He stands in the aisle holding two identical white tofu packs, one in each hand. He glances at his phone held between them with the screen turned away from us, squints, looks back at the packs, then slowly raises and lowers them like a balance scale.

[AUDIO]
Soft store ambience and a faint freezer hum. He murmurs in Korean: "집에 두부... 있었나, 없었나."

[LAST SECOND]
The two tofu packs in his hands.
```

## 04. 대파만 세 단 — 장 볼 게 가장 적은 식단

- **공감 포인트**: 있는 줄 모르고 또 산 대파가 세 단이 되는 상황은 누구나 한 번쯤 해 봤어요. 꽃다발처럼 모아 드는 게 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 있는 줄 모르고 / 또 샀어요
- **이어 붙일 앱 데모**: AI 식단 — 장 볼 게 가장 적어지는 일주일(84개 → 7개)

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Late-20s Korean woman, shoulder-length straight hair, crisp white shirt with the sleeves rolled up.

[HOME]
New officetel kitchen, all-white surfaces, stainless sink, a small dining table by the window.

[ACTION]
She unpacks a plain paper grocery bag and takes out a bunch of green onions. She opens the fridge door to put it away and finds two more bunches already there, one slightly wilted. She pauses, takes them out, and holds all three together like a bouquet, looking at them.

[AUDIO]
Paper bag rustling, fridge door opening. She says softly in Korean: "대파만... 세 단이네."

[LAST SECOND]
The three bunches of green onions held together like a bouquet.
```

## 05. 코로 넘겨야 하나 — 요리 모드 · 읽어 주기

- **공감 포인트**: 밀가루 묻은 손으로 레시피를 넘기려다 결국 코를 쓰는 순간은 요리해 본 사람이면 다 알아요. 진지한 표정으로 코를 들이미는 게 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 손 씻고 오면 / 다음 단계 까먹어요
- **이어 붙일 앱 데모**: 요리 모드 — 손대지 않아도 단계를 소리로 읽어 주고 노랗게 짚어 주는 화면

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Mid-20s Korean man, short neat hair, navy tee under a plain canvas apron.

[HOME]
Compact studio kitchen, single induction burner, small wooden counter with a jar and a mixing bowl.

[ACTION]
Both of his hands are coated in flour and sticky dough, held up like a surgeon's. A phone leans against a jar with its screen facing away from us. He tries to tap it with a knuckle, then with his pinky, and nothing happens. Very seriously, he leans down and brings his nose toward the screen.

[AUDIO]
Soft kitchen ambience. He mutters in Korean: "잠깐만... 코로 해야 되나."

[LAST SECOND]
His face inches from the phone, nose almost touching it.
```

## 06. 적당히가 얼마예요 — 검증된 진짜 레시피

- **공감 포인트**: 「소금 적당히」 앞에서 얼어붙는 요리 초보의 마음은 공유하고 싶어지는 공감이에요. 숟가락 위 소금을 한 알씩 덜어내는 떨리는 손이 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 레시피가 / 친절하지 않을 때
- **이어 붙일 앱 데모**: 분량까지 정리된 재료·조리 순서, 좋아요·조회수로 검증된 레시피

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Late-20s Korean man, thin-framed glasses, soft gray knit sweater.

[HOME]
Small apartment kitchen at dinner time, a pot simmering on the stove, warm pendant light.

[ACTION]
He holds a spoon heaped with salt over the simmering pot. He glances at a phone propped on the counter with its screen turned away from us, then back at the spoon. His hand freezes mid-air, and with a tiny tremor he tips the salt off grain by grain.

[AUDIO]
Gentle simmering. He mutters in Korean: "소금 적당히... 적당히가 얼마만큼인데."

[LAST SECOND]
The spoon of salt hovering over the pot.
```

## 07. 아무거나 — 요리 AI · 말로 물어보기

- **공감 포인트**: 「뭐 먹을래?」「아무거나」「그럼 김치찌개?」「그건 별로」는 한국 커플·가족의 국민 대화예요. 태그해서 공유하기 딱 좋은 상황이에요.
- **편집 때 얹을 자막(제안)**: 아무거나의 정답, / 물어보세요
- **이어 붙일 앱 데모**: 요리 AI에 「가볍고 따뜻한 거」라고 말하면 냉장고 재료로 레시피가 뜨는 화면

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
A Korean couple in their early 30s. He wears a plain white tee; she wears a soft gray hoodie. Both look neat and relaxed.

[HOME]
Living room in the evening, a low fabric sofa, warm floor lamp, a plant in the corner.

[ACTION]
They sit side by side on the sofa. She scrolls her phone with the screen turned away from us. He turns to her and asks; she answers without looking up. After her last answer he freezes and stares straight ahead, defeated.

[AUDIO]
Quiet room tone. Spoken in Korean at a natural pace. He: "뭐 먹을래?" She: "아무거나." He: "김치찌개?" She: "그건 별로."

[LAST SECOND]
His blank, defeated face.
```

## 08. 배달 용기 탑 — 가족 · 아낀 돈

- **공감 포인트**: 분리수거 날 턱밑까지 쌓인 배달 용기를 드는 순간 「이번 달 우리 뭐 했지?」 하는 반성이 와요. 흔들리는 용기 탑이 과장 포인트예요.
- **편집 때 얹을 자막(제안)**: 이번 달 배달 용기, / 몇 개예요?
- **이어 붙일 앱 데모**: 가족이 함께 정한 집밥 목표·달성·아낀 돈(추정)이 보이는 마이캘린더

```
[DIRECTION — same for every clip in this series]
You are directing a short Korean lifestyle ad series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene itself, exactly as the camera sees it.

FORMAT: Vertical 9:16, photoreal live action, one continuous take, about 8 seconds. The key moment lands within the first 4 seconds, then plays out naturally.
TONE: Observational comedy, like a friend quietly filming a real moment at home. Deadpan and understated. The humor comes from recognition ("that's so me"), never from slapstick or mugging. One small exaggeration per clip, played completely straight-faced.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or defeated; their appearance stays neat. They never look at the camera.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces, one or two plants. No clutter, no piled dishes.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Eye level, 35–50mm lens feel, subtle handheld breathing, shallow depth of field. Medium close-up on the person by default. Real-time motion only.
PROPS: Every object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances carry no brand marks. Phones are held with the screen facing away from the camera or lie face down; if a screen must face us, it glows as a soft blurred color.
SOUND: Natural room sound only (fridge hum, rustling bags, sizzling). No music. The spoken words in AUDIO are heard as voice only.
ENDING: In the last second the camera slowly pushes in on the subject named in LAST SECOND and holds there.

[CAST]
Early-40s Korean man, neat short hair, dark green quilted vest over a light shirt.

[HOME]
Apartment hallway leading from the kitchen to the front door, warm evening light.

[ACTION]
He walks carefully toward the front door carrying a tall stack of clear plastic takeout containers that reaches up to his chin. The tower sways. He stops, rebalances it, then turns his head back toward the kitchen, where his wife is out of frame.

[AUDIO]
Plastic creaking softly. He calls back in Korean: "여보... 우리 이번 달 집밥 몇 번 했어?"

[LAST SECOND]
The wobbling tower of takeout containers.
```

## 같은 편을 여러 개 뽑을 때 — 변주

[CAST]·[HOME] 줄만 바꿔 넣는다(장면·대사·마지막 1초는 그대로). 얼굴이 계속 비슷하면 [CAST] 끝에 `A completely different face from any earlier clip.` 를 붙인다.

| 세트 | 바꾸는 것 | [CAST] 에 덧붙이기 | [HOME] 바꾸기 |
|---|---|---|---|
| A | 원본 그대로 | `Keep CAST and HOME as written.` | 그대로 |
| B | 나이를 한 단계 올리고 머리 모양을 바꿈 | `Same role, but about ten years older, with a different hairstyle.` | `Older apartment with warm wood cabinets and a tiled wall.` |
| C | 성별을 바꿈(가능한 편만) · 옷 색을 어둡게 | `Same role played by the opposite gender, wearing darker clothes.` | `Compact new officetel, all white with stainless steel.` |
| D | 안경 · 니트 대신 셔츠 | `Add glasses; swap the knit for a crisp shirt.` | `Detached house with solid wood furniture and a garden visible through the window.` |
| E | 머리를 올려 묶고 앞치마 | `Hair tied up high; add a plain apron.` | `Narrow villa kitchen with pale gray counters and potted herbs on the sill.` |
