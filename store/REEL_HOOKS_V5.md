# 릴스 후킹 영상 4벌 다듬은 판(v5) — 제미나이(Veo) 프롬프트 8편

만든 날: 2026-10-20 · 만든 스크립트: `scripts/gen_reel_hooks_v5.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).
규칙: [VEO_PROMPT_RULES.md](VEO_PROMPT_RULES.md). 폰용 페이지는 4벌과 같은 아티팩트 주소에 덮어쓴다. 이전: [v4](REEL_HOOKS_V4.md).

## 4벌에서 바꾼 것
- 제미나이가 고쳐 준 **짧은 공통 지시**(STRICTLY STATIC ENVIRONMENT). 사용자가 뽑아 보니 오류가 거의 없고 자연스러웠다(2026-10-20).
- **상태가 바뀌는 행동을 모두 뺐다**: 문 열기·꺼내기·주고받기·먹기·마시기·스크롤·화면 켜짐/꺼짐. 물건은 처음부터 손이나 탁자 위에.
- **이야기 논리 점검**(편마다 「이야기 점검」 줄): 어디서 왔나 / 「이거·저거」와 거리 / 대사 속 장소 = HOME.
- 01 우유: 남자가 점퍼 차림으로 왼쪽에서 두세 걸음 들어오고, 우유 두 통은 3m 뒤 식탁 위. 03 장갑: 폰은 처음부터 꺼진 채 거치대에, 대사는 「화면 꺼졌다 → 켜 줘」(요리 모드 데모와 연결). 07 블로그: 스크롤 대신 폰을 든 채 멍하니.

## 공통 지시

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

…편별 [CAST]·[HOME]·[ACTION]·[AUDIO]·[LAST SECOND]…

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

걸어 들어오는 편(01)만 MOTION 의 `No one walks` 문장을 그 사람만 두세 걸음으로 바꿨다.

## 01. 그럼 식탁에 있는 저건 누가 산 거야? — 사진 한 장으로 냉장고 채우기

- **공감 포인트**: 냉장고에 뭐가 있는지 몰라서 같은 걸 또 사 오는 일, 다들 있죠. 남편도 사 오고 아내도 샀다는데, 식탁엔 이미 두 통 — 그럼 저건 누가 산 건지 아무도 모른다는 게 반전이에요.
- **이야기 점검**: 남자는 점퍼 차림으로 왼쪽에서 두세 걸음 들어온다(밖에서 옴). 우유 두 통은 3m 뒤 식탁 위라 「저건」. 대사의 「식탁」 = HOME 의 식탁.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 🧠 상식 파괴형 「둘이 장 봤는데 / 우유가 왜 세 통?」
- **다른 후보**: 💛 감정 공감형 「냉장고에 뭐 있는지 / 아무도 몰라요」 · 📱 기능 활용형 「영수증 찍어 두면 / 냉장고가 기억해요」
- **이어 붙일 앱 데모**: 01 사진 인식 — 영수증 사진 한 장으로 산 재료가 냉장고에 담기는 화면(이미 있는 재료가 보임)

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. Only the man takes two or three slow steps in from the left side of the frame at the start, then stands still; nobody else walks. No doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Early-30s Korean man, short tidy hair, light gray zip-up jacket over a navy sweatshirt, just home from outside. His wife, early 30s, hair in a low ponytail, beige knit cardigan, standing in the foreground on the right.

[HOME]
Apartment kitchen and dining area in the afternoon. About three meters behind the couple, clearly visible in the frame but slightly out of focus, is a small wooden dining table. On that table are exactly two identical short plain white milk bottles with blue caps, standing apart, and nothing else. No door is visible. The background is simple.

[ACTION]
The man comes in from the left side of the frame, taking two or three slow steps while holding one identical short plain white milk bottle with a blue cap in his right hand, then stops beside his wife. He keeps holding the bottle the whole time and never puts it down. She turns her head to him. Then both of them turn their heads and look over at the dining table in the background. Nobody walks to the table and nobody touches the two bottles on it; they never move. Count: two bottles on the table plus the one in his hand, three in total, the same from start to end.

[AUDIO]
He, walking in and lifting the bottle slightly: "자기야, 나 오다가 우유 사왔어."
She, turning to him: "어? 나도 아까 샀는데?"
He, looking over at the dining table in the background: "...엥? 그럼 식탁에 있는 저건 누가 산 거야?"
(She looks at the table and lets out a soft sigh with a smirk.)

[LAST SECOND]
The two of them in the foreground, his milk bottle in his hand, and the two bottles on the dining table behind them, perfectly still.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Afternoon apartment. A woman in a beige cardigan stands in the foreground on the right. A man in a light gray zip-up jacket stands at the left edge of the frame holding a short plain white milk bottle with a blue cap, just arriving. About three meters behind them, a small wooden dining table holds exactly two identical milk bottles, slightly out of focus.

[CAST]
Early-30s Korean man, short tidy hair, light gray zip-up jacket over a navy sweatshirt, just home from outside. His wife, early 30s, hair in a low ponytail, beige knit cardigan, standing in the foreground on the right.

[HOME]
Apartment kitchen and dining area in the afternoon. About three meters behind the couple, clearly visible in the frame but slightly out of focus, is a small wooden dining table. On that table are exactly two identical short plain white milk bottles with blue caps, standing apart, and nothing else. No door is visible. The background is simple.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 02. 이걸로 뭐 해 먹지? — 있는 재료로 매칭

- **공감 포인트**: 저녁 메뉴를 정하려고 재료를 꺼내 보면 애매하게 남은 두 개가 전부일 때가 있죠. 둘이 머리를 맞대다가 결국 「그냥 소시지 구워 먹자」로 끝나는 게 현실이에요.
- **이야기 점검**: 재료는 이미 꺼내 바로 앞 조리대에 있다 → 「이걸로」(가까움). 냉장고는 뒤에 닫힌 채.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 🧠 상식 파괴형 「양배추랑 소시지로 / 뭐가 된다고?」
- **다른 후보**: 🛠️ 해결책 제시형 「재료가 두 개뿐일 때 / 이렇게 찾아요」 · 📱 기능 활용형 「남은 재료만 넣으면 / 요리가 나와요」
- **이어 붙일 앱 데모**: 02 매칭 — 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Mid-30s Korean woman, shoulder-length hair, oatmeal sweater. Her husband, mid-30s, short tidy hair, gray cardigan, stands right next to her.

[HOME]
Open kitchen, evening, warm pendant light. The fridge in the background is completely closed. On the kitchen counter in front of her there are exactly two items, apart from each other: half a green cabbage and one plain sausage.

[ACTION]
She stands at the counter with both hands resting flat on the surface, looking down at the cabbage and the sausage. Her husband leans in slightly to look at them. Nobody touches or moves the food.

[AUDIO]
He: "오늘 저녁 뭐 먹어?"
She, looking down at the counter: "양배추 반 통이랑 소시지 하나 있는데... 이걸로 뭐 해 먹지?"
He: "볶음밥 할까?"
She: "밥이 없어."
He, after a short beat: "...그럼 그냥 소시지 구워 먹자."
(She nods very slightly.)

[LAST SECOND]
Both of them looking down at the cabbage and the sausage, motionless.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Evening kitchen under a warm pendant light. A woman in an oatmeal sweater stands at the counter with both hands flat on it, looking down at half a green cabbage and one plain sausage. Her husband in a gray cardigan stands right next to her. The fridge behind them is closed.

[CAST]
Mid-30s Korean woman, shoulder-length hair, oatmeal sweater. Her husband, mid-30s, short tidy hair, gray cardigan, stands right next to her.

[HOME]
Open kitchen, evening, warm pendant light. The fridge in the background is completely closed. On the kitchen counter in front of her there are exactly two items, apart from each other: half a green cabbage and one plain sausage.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 03. 그럼 코로 눌러 봐 — 요리 모드 · 손 안 대고 넘기기

- **공감 포인트**: 요리하다 레시피 화면이 꺼지면 손이 비어 있지 않아서 난감하죠. 오븐 장갑 낀 채 옆 사람한테 부탁했더니 「코로 눌러 봐」가 돌아오는 게 웃음 포인트예요.
- **이야기 점검**: 폰은 바로 앞 거치대에 처음부터 꺼진 채(켜짐→꺼짐 변화 없음) → 「이것 좀」. 아무도 폰을 만지지 않는다.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 🧠 상식 파괴형 「오븐 장갑 끼고 / 화면을 켠다고?」
- **다른 후보**: 💛 감정 공감형 「요리 중에 화면 꺼지면 / 진짜 난감하죠」 · 📱 기능 활용형 「손 안 대도 / 레시피를 읽어 줘요」
- **이어 붙일 앱 데모**: 03 요리 모드 — 화면을 안 만져도 단계별로 읽어 주고 지금 단계를 짚어 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Late-20s Korean woman, hair tied up in a bun, light blue apron, wearing thick plain gray oven mitts on both hands. Her boyfriend, late 20s, black hoodie, stands right next to her.

[HOME]
Bright kitchen in the daytime. A phone stands upright in a simple phone stand on the counter in front of her, its screen dark the whole time. The counter is otherwise bare.

[ACTION]
She holds both mitted hands up near her chest, helpless. She looks at the phone, then at her boyfriend. He just looks at the phone. Neither of them touches the phone, and it never moves.

[AUDIO]
She, looking at the phone: "아, 화면 꺼졌다. 자기야, 이것 좀 켜 줘. 나 장갑 꼈어."
He: "팔꿈치로 눌러 봐."
She: "해 봤어. 안 돼."
He, deadpan: "그럼 코로 눌러 봐, 코로."
(She glares at him with a tired, expressionless face.)

[LAST SECOND]
Her tired glare, oven mitts held up near her chest.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Bright kitchen. A woman in a light blue apron and thick plain gray oven mitts holds her hands up near her chest, looking at a phone standing in a simple stand on the counter, its screen dark. Her boyfriend in a black hoodie stands right next to her.

[CAST]
Late-20s Korean woman, hair tied up in a bun, light blue apron, wearing thick plain gray oven mitts on both hands. Her boyfriend, late 20s, black hoodie, stands right next to her.

[HOME]
Bright kitchen in the daytime. A phone stands upright in a simple phone stand on the counter in front of her, its screen dark the whole time. The counter is otherwise bare.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 04. 화요일도 치킨 — 장 볼 게 가장 적은 식단

- **공감 포인트**: 「이번 주 뭐 먹지」를 같이 정하자고 하면 꼭 이런 대답이 돌아와요. 진지하게 묻는데 아무렇지 않게 「화요일도 치킨」 하고, 결국 「내가 정할게」로 끝나는 게 웃음 포인트예요.
- **이야기 점검**: 둘이 나란히 앉아 서로에게 말한다. 머그는 감싸 쥐기만(마시지 않음).
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 현실 직시형 「일주일 식단, / 남편한테 맡기면?」
- **다른 후보**: 🛠️ 해결책 제시형 「일주일 저녁 메뉴 / 고민 끝」 · 📱 기능 활용형 「냉장고 재료로 / 일주일 식단」
- **이어 붙일 앱 데모**: 04 AI 식단 — 원하는 조건을 말하면 냉장고 재료로 일주일 식단과 장볼 목록이 나오는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Mid-30s Korean couple sitting side by side at a small wooden table. The wife: cream sweater. The husband: gray sweatshirt.

[HOME]
Sunday morning dining nook by a window with soft daylight. On the table, only two plain mugs, one in front of each of them.

[ACTION]
They sit still. Both have their hands resting around their mugs on the table. Nobody lifts a mug or drinks. They just turn their heads slightly to talk to each other.

[AUDIO]
She: "우리 이번 주 저녁 메뉴 미리 정하자. 월요일은 뭐 먹을래?"
He: "월요일은 치킨."
She: "화요일은?"
He, without a pause: "화요일도 치킨."
(She looks at him for a beat, then sighs with a small smile.)
She: "...그냥 내가 정할게."

[LAST SECOND]
Her small resigned smile looking straight ahead.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
A couple sits side by side at a small wooden table by a window in soft morning light, hands resting around plain mugs. She is turning her head toward him to ask something.

[CAST]
Mid-30s Korean couple sitting side by side at a small wooden table. The wife: cream sweater. The husband: gray sweatshirt.

[HOME]
Sunday morning dining nook by a window with soft daylight. On the table, only two plain mugs, one in front of each of them.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 05. 그럼 자기가 먹어 — 유통기한 임박 알림

- **공감 포인트**: 냉장고 구석에서 나온 요거트, 유통기한이 하루 지났을 때 다들 고민하죠. 「괜찮지?」 물었더니 「그럼 자기가 먹어」로 돌아오는 게 웃음 포인트예요.
- **이야기 점검**: 요거트는 처음부터 끝까지 그녀 손에(주고받기 없음) → 「이거」. 남편은 고개만 기울여 밑면을 읽는다 → 「밑에」.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 💛 감정 공감형 「유통기한 어제, / 먹어? 말아?」
- **다른 후보**: ⚠️ 경고형 「냉장고 속 요거트 / 언제 샀더라?」 · 📱 기능 활용형 「유통기한 전에 / 알림이 와요」
- **이어 붙일 앱 데모**: 05 유통기한 — 유통기한이 다가오면 알림이 오고, 임박 재료로 만들 레시피를 추천하는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Early-40s Korean woman, bob haircut, dark green cardigan. Her husband, early 40s, thin glasses, white shirt, sits close beside her.

[HOME]
Living room in the morning, soft daylight. The only prop is one small plain pastel pink yogurt cup with a sealed flat lid.

[ACTION]
She is already holding the yogurt cup in front of her face, tilted so its bottom faces her husband, squinting at it. He leans his head in close to read the bottom of the cup. She holds the cup still the whole time; nobody passes it.

[AUDIO]
She: "이거 유통기한이 어디 적혀 있어? 안 보이는데."
He, leaning in and reading: "밑에. 어제까지네."
She: "하루 지난 건 먹어도 괜찮지?"
He, deadpan: "어. 그럼 자기가 먹어."
(She turns her eyes to him and glares, still holding the cup.)

[LAST SECOND]
Her glaring eyes, the yogurt cup still in her hand.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Morning living room. A woman in a dark green cardigan holds a small plain pastel pink yogurt cup in front of her face, squinting at it. Her husband in thin glasses and a white shirt sits close beside her, leaning in to look at the bottom of the cup.

[CAST]
Early-40s Korean woman, bob haircut, dark green cardigan. Her husband, early 40s, thin glasses, white shirt, sits close beside her.

[HOME]
Living room in the morning, soft daylight. The only prop is one small plain pastel pink yogurt cup with a sealed flat lid.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 06. 열 개 다 마트 가래 — 요리 AI · 말로 물어보기

- **공감 포인트**: 냉장고에 있는 걸로 해 먹으려고 레시피를 찾으면, 꼭 없는 재료를 사 오라고 하죠. 한참 찾다가 지쳐서 「배달 시킬까?」에 바로 고개를 끄덕이는 게 공감 포인트예요.
- **이야기 점검**: 이미 다 찾아본 뒤라 폰은 무릎 위에 가만히(스크롤 없음).
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 현실 직시형 「레시피 열 개 봤는데 / 다 장 보래요」
- **다른 후보**: 🛠️ 해결책 제시형 「있는 재료로 / 물어보면 돼요」 · 💛 감정 공감형 「저녁 메뉴 검색, / 끝이 안 나요」
- **이어 붙일 앱 데모**: 06 요리 AI — 「냉장고에 있는 걸로 뭐 해 먹지?」처럼 말하듯 물으면 내 재료로 맞는 레시피를 골라 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Early-30s Korean woman, black knit top. Her husband, early 30s, white T-shirt. They sit side by side on a sofa.

[HOME]
Living room in the evening, warm floor lamp. Plain wall behind the sofa. The only prop is her phone.

[ACTION]
She sits holding her phone still in her lap, screen facing down, with a defeated look. She does not scroll or tap it. Her husband sits next to her, looking at her gently.

[AUDIO]
He: "오늘 저녁 뭐 먹어?"
She, staring blankly ahead: "냉장고 파먹기 하려고 레시피 열 개를 봤는데..."
He: "응."
She: "열 개 다 마트 가서 뭘 사 오래."
He: "그냥 배달 시킬까?"
(She turns to him and nods firmly once.)

[LAST SECOND]
Her face, relieved, looking at him.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Evening living room under a warm floor lamp. A woman in a black knit top sits on a sofa holding her phone face down in her lap, staring blankly ahead. Her husband in a white T-shirt sits next to her, looking at her.

[CAST]
Early-30s Korean woman, black knit top. Her husband, early 30s, white T-shirt. They sit side by side on a sofa.

[HOME]
Living room in the evening, warm floor lamp. Plain wall behind the sofa. The only prop is her phone.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 07. 아직 바다 보고 있어 — 검증된 진짜 레시피

- **공감 포인트**: 블로그 레시피를 열면 레시피 전에 여행 이야기가 한참 나오죠. 프라이팬 앞에서 남의 제주도 여행기만 보고 있는 게 웃음 포인트예요.
- **이야기 점검**: 요리하려고 빈 팬 앞에 섰다(팬은 차갑고 비어 있음). 폰은 들고 보기만(스크롤 없음). 아내는 같은 조리대 끝에.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 현실 직시형 「레시피 보려다 / 남의 여행기만 봤어요」
- **다른 후보**: 🛠️ 해결책 제시형 「서론 없이 / 조리 순서만」 · 🔍 디테일 분석형 「진짜 레시피는 / 스크롤 맨 아래」
- **이어 붙일 앱 데모**: 07 진짜 레시피 — 유튜브·네이버 인기 레시피를 재료·순서만 정리해 보여 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Late-30s Korean man, short tidy hair, olive T-shirt, standing at the stove holding his phone in his right hand with the screen facing away from the viewer. His wife, late 30s, hair clipped up, gray hoodie, stands at the other end of the same counter, her hands resting around a plain mug on the counter.

[HOME]
Kitchen in the evening. On the stove, one empty plain black frying pan, cold, with nothing in it; the burners are off. The counter is otherwise bare.

[ACTION]
He stands still, staring down at the phone in his hand with a slightly blank, tired look. He does not scroll or tap. His wife looks over at him. Nobody touches the pan, and it never moves. Nobody lifts the mug.

[AUDIO]
She: "레시피 찾았어?"
He, staring at the phone: "찾았는데... 이 사람 아직 제주도 여행 중이야."
She: "응?"
He, deadpan: "아직 바다 보고 있어."
(She laughs softly through her nose.)
She: "레시피는 맨 밑에 있어."

[LAST SECOND]
His blank face looking down at the phone, the empty pan in front of him.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
Evening kitchen. A man in an olive T-shirt stands at a stove with a cold, empty black frying pan, holding his phone in his right hand with the screen facing away from the viewer, staring at it. His wife in a gray hoodie stands at the other end of the counter, hands around a plain mug.

[CAST]
Late-30s Korean man, short tidy hair, olive T-shirt, standing at the stove holding his phone in his right hand with the screen facing away from the viewer. His wife, late 30s, hair clipped up, gray hoodie, stands at the other end of the same counter, her hands resting around a plain mug on the counter.

[HOME]
Kitchen in the evening. On the stove, one empty plain black frying pan, cold, with nothing in it; the burners are off. The counter is otherwise bare.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 08. 그 돈으로 치킨 시키자 — 가족 · 아낀 돈

- **공감 포인트**: 집밥 차려 놓고 「오늘 돈 아꼈다」 뿌듯해하는 순간, 꼭 그 돈을 다른 데 쓰자는 사람이 있어요. 아낀 돈이 바로 치킨이 되는 게 웃음 포인트예요.
- **이야기 점검**: 막 차려 놓고 앉은 순간(수저 없음, 먹는 동작 없음). 「오늘 집에서 해 먹으니까」와 맞는다.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 반전형 「집밥으로 아낀 돈, / 어디에 써요?」
- **다른 후보**: 💛 감정 공감형 「집밥 한 끼에 / 이만 원 아꼈다」 · 📱 기능 활용형 「아낀 돈이 / 쌓이는 게 보여요」
- **이어 붙일 앱 데모**: 08 가족·아낀 돈 — 가족 집밥 목표와 요리할 때마다 쌓이는 아낀 돈(예상)이 보이는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people. If an image is attached, it is the first frame: keep its framing, people, props and setting exactly.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
PROPS: Every object is plain and unmarked, with no logos.
SOUND: Natural room sound and the spoken lines only. No music.

[CAST]
Mid-30s Korean couple sitting across a small dining table, seen in three-quarter view. The wife: light pink sweater. The husband: navy T-shirt.

[HOME]
Dining table in the evening under a warm pendant light, dinner just served. On the table: two plain white bowls of rice and one plain white plate of vegetables in the middle, and nothing else.

[ACTION]
They have just sat down. Their hands rest on the edge of the table. There are no chopsticks or spoons and no eating. They just look at each other and talk. The food never moves.

[AUDIO]
She, smiling proudly: "오늘 집에서 해 먹으니까 최소 이만 원은 아꼈다."
He, looking happy: "오, 진짜? 그럼 그 돈으로 치킨 시켜 먹자."
(Her proud smile drops into a deadpan stare.)
She: "그럼 안 아낀 거잖아."

[LAST SECOND]
Her deadpan stare across the table.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
A couple sits across a small dining table under a warm pendant light, hands resting on the table edge. Two plain white bowls of rice and one plate of vegetables sit between them. She smiles proudly at him.

[CAST]
Mid-30s Korean couple sitting across a small dining table, seen in three-quarter view. The wife: light pink sweater. The husband: navy T-shirt.

[HOME]
Dining table in the evening under a warm pendant light, dinner just served. On the table: two plain white bowls of rice and one plain white plate of vegetables in the middle, and nothing else.

People: Korean adults with a clean, neat, likable look and natural relaxed expressions, looking at the props or at each other rather than at the viewer.
Light: soft natural light, warm white balance, natural skin tones, shallow depth of field, seen at eye level.
Props: only the props named here, each clearly separate, plain and unmarked, with no logos.
A clean, unedited photo.

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
| E | 머리를 올려 묶고 앞치마 | `Hair tied up high; add plain aprons.` | `Narrow villa kitchen with pale gray counters.` |
