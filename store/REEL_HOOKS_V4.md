# 릴스 후킹 영상 4벌 — 제미나이(Veo) 프롬프트 8편

만든 날: 2026-10-18 · 만든 스크립트: `scripts/gen_reel_hooks_v4.py`(이 파일을 직접 고치지 말고 스크립트를 고쳐 다시 만든다).
폰에서 복사해 쓰는 페이지는 아티팩트로 게시한다. 이전 벌: [v3(3벌)](REEL_HOOKS_V3.md) · [v2(2벌)](REEL_HOOKS_V2.md) · [1벌](REEL_PROMPTS_FULL.md).

## v3를 편집해 보고 바꾼 것 — 움직임 줄이기
- 사용자 지적(2026-10-18): 아무도 안 만졌는데 물건이 움직이거나 모양이 바뀌는 장면이 많았다.
- **카메라 고정**: v3 의 「손떨림 숨결」과 「마지막 1초 밀어 들어가기」를 빼고 삼각대 고정(줌·이동·흔들림 없음). 화면이 흔들리면 물건이 미끄러지는 것처럼 보이고, 밀어 들어갈 때 모양이 다시 그려진다.
- **물건은 손에 들렸을 때만 움직인다**: 「손이 잡고 있는 동안만 그 손과 함께 움직이고, 놓은 자리에 정확히 있다. 그 밖의 모든 것(음식·포장·문·서랍·커튼·식물·가전)은 처음부터 끝까지 가만히」를 공통 지시 MOTION AND OBJECTS 에.
- **소품 3개 이하, 서로 떨어뜨려**: 많거나 붙어 있으면 서로 섞이고 바뀐다(v3 3편 병뚜껑이 폰으로).
- **동작은 한두 개, 천천히**: v3 ACTING 의 「낚아채기·막기 같은 빠른 반사 동작」을 뺐다. 빠른 동작은 흐릿해지며 손·물건 모양이 무너진다. 웃음은 대사와 작은 반응으로.
- **어려운 장면은 아예 안 쓴다**: 붓기·썰기·지글거림·김·문 여닫기·물건 주고받기 여러 번. 냉장고는 처음부터 열려 있고 끝까지 그대로, 음식은 통째로·이미 담긴 상태.
- **장면 고르기**: 앉아서 말하기, 한 손으로 들고 보기처럼 원래 움직임이 적은 상황 8개.
- 그래도 물건이 움직이면: ① **첫 장면 이미지(2단계)** 로 배치를 먼저 고정 ② 새 대화에서 2~3번 뽑아 고르기 ③ 제외할 요소 칸이 있으면 `objects moving by themselves, morphing, extra objects, camera shake` 를 거기에만.

## 후킹 자막 — 요리 릴스 가이드 0-1·0-2 규칙
- **첫 프레임부터** 화면 가운데 큰 노란 글씨 2줄(한 줄 10자 안팎), 질문형 — 이 장면이 인스타 썸네일. (v3 까지는 웃음 포인트 순간에 띄웠다.)
- 편마다 26가지 후킹 전략 중 맞는 것으로 **후보 3개**, 맨 앞이 추천. 정답(웃음)은 영상 안에서 풀린다. AI 말투·과장 없이.

## 세로·연기·한글 (v3 와 같음)
- 세로가 안 나오면 첫 장면 이미지 → 그 사진을 첨부해 영상 프롬프트(2단계). 편마다 **새 대화**.
- 프롬프트는 영어, 한국어는 AUDIO 의 소리로만. 그리지 말 것의 이름 대신 있어야 할 것(무지 소품)만 적는다.
- 어색하면 같은 프롬프트로 새 대화에서 다시, 계속 어색하면 **대사 없는 버전**.

## 공통 지시 (모든 편 맨 앞·맨 끝 — 아래 완성본에 이미 합쳐져 있다)

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

…편별 [CAST]·[HOME]·[ACTION]·[AUDIO]·[LAST SECOND]…

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

## 01. 어제 산 계란, 오늘 또 — 사진 한 장으로 냉장고 채우기

- **공감 포인트**: 냉장고에 뭐가 있는지 몰라서 같은 걸 또 사 오는 일, 다들 있죠. 둘이 각자 계란을 사 와서 똑같은 계란판 두 개가 나란히 놓이는 게 웃음 포인트예요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 🧠 상식 파괴형 「어제 산 계란을 / 오늘 또 샀다고?」
- **다른 후보**: 💛 감정 공감형 「장 보고 와서 / 늘 이 말 하죠」 · 📱 기능 활용형 「냉장고 속을 / 폰으로 보세요」
- **이어 붙일 앱 데모**: 01 사진 인식 — 영수증 사진 한 장으로 산 재료가 냉장고에 담기는 화면(이미 있는 재료가 보임)

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Early-30s Korean woman, hair in a low ponytail, beige knit cardigan. Her husband, early 30s, short hair, navy sweatshirt, stands at the kitchen counter a step to her right, both hands resting on the counter.

[HOME]
Apartment kitchen in the afternoon. One white single-door fridge, already standing wide open; the door stays open and still for the whole take. On the middle shelf, one closed plain white egg carton sits alone in the center. The other shelves are empty. The counter beside the fridge is bare.

[ACTION]
She stands in front of the open fridge holding one closed plain white egg carton in both hands at chest height, identical to the one on the shelf. She slowly raises it toward the shelf, then stops and holds it still in the air, looking at the identical carton already on the shelf. After a beat she slowly turns her head to her husband. He glances at the carton in her hands, then at the shelf. The carton on the shelf never moves.

[AUDIO]
Fridge hum. She, holding the carton up: "어? 자기야, 계란 사 왔어?" He, glancing at the shelf: "응, 어제 사 왔지." (She looks down at the carton in her hands.) She, quietly: "나도 오늘 샀는데." (He breathes out through his nose with a small smile.)

[LAST SECOND]
The two identical egg cartons: one held in her hands, one on the shelf.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
She stands in front of the open white single-door fridge holding a closed plain white egg carton in both hands at chest height. An identical closed carton sits alone on the middle shelf. Her husband stands at the bare counter a step to her right, hands resting on it, looking at her.

[CAST]
Early-30s Korean woman, hair in a low ponytail, beige knit cardigan. Her husband, early 30s, short hair, navy sweatshirt, stands at the kitchen counter a step to her right, both hands resting on the counter.

[HOME]
Apartment kitchen in the afternoon. One white single-door fridge, already standing wide open; the door stays open and still for the whole take. On the middle shelf, one closed plain white egg carton sits alone in the center. The other shelves are empty. The counter beside the fridge is bare.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 02. 이 두 개로 뭐 돼? — 있는 재료로 매칭

- **공감 포인트**: 냉장고에 애매하게 남은 재료 두 개 들고 「이걸로 뭐 해 먹지」 하는 저녁은 누구나 있어요. 머리 맞대고 고민하다 결국 「그냥 구워 먹자」로 끝나는 게 현실이에요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 🧠 상식 파괴형 「양배추랑 소시지로 / 뭐가 된다고?」
- **다른 후보**: 🛠️ 해결책 제시형 「재료가 두 개뿐일 때 / 이렇게 찾아요」 · 📱 기능 활용형 「남은 재료만 넣으면 / 요리가 나와요」
- **이어 붙일 앱 데모**: 02 매칭 — 지금 냉장고 재료로 만들 수 있는 요리가 매칭률 순으로 뜨는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Mid-30s Korean man, short tidy hair, white T-shirt under a gray cardigan, standing. His wife, mid-30s, shoulder-length hair, oatmeal sweater, sits at a small dining table at the right of the frame, holding a plain mug with both hands.

[HOME]
Open kitchen with a small wooden dining table, evening, warm pendant light. The only props: her plain mug, and the two food items he holds. The table and counter are otherwise bare.

[ACTION]
He stands beside the table holding half a green cabbage wrapped in clear film in his left hand and one plain sausage in a clear wrapper in his right hand, both held still at chest height, slightly toward his wife. She keeps both hands around her mug and looks at the two items while she thinks. He slowly lowers his eyes from one item to the other. She lifts the mug for one slow sip near the end.

[AUDIO]
He: "자기야, 냉장고에 이거 두 개 남았는데 이걸로 뭐 해 먹을 수 있어?" She, looking at the items over her mug: "음, 양배추랑 소시지? 볶음밥 할까?" He: "밥이 없어." (She takes one slow sip.) She: "그럼 그냥 소시지 구워 먹자."

[LAST SECOND]
The half cabbage and the sausage held still in his hands.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
He stands beside a small wooden dining table holding half a green cabbage in clear film in his left hand and one plain wrapped sausage in his right hand at chest height. His wife sits at the table on the right, both hands around a plain mug, looking at the items.

[CAST]
Mid-30s Korean man, short tidy hair, white T-shirt under a gray cardigan, standing. His wife, mid-30s, shoulder-length hair, oatmeal sweater, sits at a small dining table at the right of the frame, holding a plain mug with both hands.

[HOME]
Open kitchen with a small wooden dining table, evening, warm pendant light. The only props: her plain mug, and the two food items he holds. The table and counter are otherwise bare.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 03. 오븐 장갑 끼고 화면 켜기 — 요리 모드 · 손 안 대고 넘기기

- **공감 포인트**: 요리하다 레시피 화면이 꺼지면 손이 비어 있지 않아서 난감하죠. 오븐 장갑 낀 손으로 아무리 눌러도 안 켜지는 게 웃음 포인트예요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 🧠 상식 파괴형 「오븐 장갑 끼고 / 화면을 켠다고?」
- **다른 후보**: 💛 감정 공감형 「요리 중에 화면 꺼지면 / 진짜 난감하죠」 · 📱 기능 활용형 「손 안 대도 / 레시피를 읽어 줘요」
- **이어 붙일 앱 데모**: 03 요리 모드 — 화면을 안 만져도 단계별로 읽어 주고 지금 단계를 짚어 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Late-20s Korean woman, hair tied up in a bun, light blue apron over a white T-shirt, wearing thick plain gray oven mitts on both hands for the whole take. Her boyfriend, late 20s, black hoodie, leans on the counter at the right edge of the frame holding a plain glass of water still in one hand.

[HOME]
Bright kitchen in the daytime. On the counter in front of her, one phone lies flat and face up, alone, well apart from everything, its screen a soft blurred glow. The counter is otherwise bare. Cabinets below stay closed.

[ACTION]
She leans slightly over the phone lying flat on the counter and reads it. The screen's soft glow fades to dark. She slowly taps the screen once with the thumb of her mitt, then once more. Nothing changes. She pauses and looks at her mitts, then slowly lowers her elbow and presses the screen with the tip of her elbow. The phone stays flat in the same spot the whole time; only her mitt and elbow touch it. Her boyfriend watches, his glass held still.

[AUDIO]
She, reading: "다음이 뭐더라." (The screen goes dark; she taps it with the mitt.) She: "아, 꺼졌어. 자기야, 이것 좀 켜 줄래?" He, not moving: "팔꿈치로 해 봐." (She presses the screen with her elbow.) She, flatly: "안 되잖아."

[LAST SECOND]
Her elbow resting on the dark phone screen, her oven mitts in frame.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
She stands at a bare counter wearing thick plain gray oven mitts on both hands, leaning slightly over a phone that lies flat and face up on the counter with a soft blurred glow. Her boyfriend leans on the counter at the right edge holding a plain glass of water.

[CAST]
Late-20s Korean woman, hair tied up in a bun, light blue apron over a white T-shirt, wearing thick plain gray oven mitts on both hands for the whole take. Her boyfriend, late 20s, black hoodie, leans on the counter at the right edge of the frame holding a plain glass of water still in one hand.

[HOME]
Bright kitchen in the daytime. On the counter in front of her, one phone lies flat and face up, alone, well apart from everything, its screen a soft blurred glow. The counter is otherwise bare. Cabinets below stay closed.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 04. 월요일 치킨, 화요일도 치킨 — 장 볼 게 가장 적은 식단

- **공감 포인트**: 「이번 주 뭐 먹지」를 같이 정하자고 하면 꼭 이런 대답이 돌아와요. 진지하게 묻는데 아무렇지 않게 「화요일도 치킨」 하는 게 웃음 포인트예요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 현실 직시형 「일주일 식단, / 남편한테 맡기면?」
- **다른 후보**: 🛠️ 해결책 제시형 「일주일 저녁 메뉴 / 고민 끝」 · 📱 기능 활용형 「냉장고 재료로 / 일주일 식단」
- **이어 붙일 앱 데모**: 04 AI 식단 — 원하는 조건을 말하면 냉장고 재료로 일주일 식단과 장볼 목록이 나오는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Mid-30s Korean couple sitting side by side at a small wooden table, facing the camera. The wife: long hair tucked behind her ears, cream sweater, holding a plain mug with both hands. The husband: short hair, gray sweatshirt, holding a plain mug in his right hand.

[HOME]
Sunday morning dining nook by a window with soft daylight. On the table, only their two plain mugs. Plain light wall behind them.

[ACTION]
Both sit still holding their mugs. She turns her head toward him as she asks. He looks up slightly, thinking, then answers calmly. After his last answer she slowly turns her face back to the front and takes one slow sip. He sips too.

[AUDIO]
She: "이번 주 저녁 뭐 먹을지 정해 놓자. 월요일은 뭐 먹을래?" He, after a short think: "월요일은 치킨." She: "화요일은?" He, without a pause: "화요일도 치킨." (She slowly turns back to the front and sips her coffee.)

[LAST SECOND]
Her face looking forward with the mug at her lips.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
A couple sits side by side at a small wooden table by a window, facing the camera. She holds a plain mug with both hands and is turning her head toward him; he holds a plain mug in his right hand.

[CAST]
Mid-30s Korean couple sitting side by side at a small wooden table, facing the camera. The wife: long hair tucked behind her ears, cream sweater, holding a plain mug with both hands. The husband: short hair, gray sweatshirt, holding a plain mug in his right hand.

[HOME]
Sunday morning dining nook by a window with soft daylight. On the table, only their two plain mugs. Plain light wall behind them.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 05. 어제까지면 괜찮지? — 유통기한 임박 알림

- **공감 포인트**: 유통기한 하루 지난 요거트 앞에서 고민하는 건 모든 집의 일이에요. 「괜찮지?」 물었더니 「자기가 먹어」로 돌아오는 게 웃음 포인트예요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 💛 감정 공감형 「유통기한 어제, / 먹어? 말아?」
- **다른 후보**: ⚠️ 경고형 「냉장고 속 요거트 / 언제 샀더라?」 · 📱 기능 활용형 「유통기한 전에 / 알림이 와요」
- **이어 붙일 앱 데모**: 05 유통기한 — 유통기한이 다가오면 알림이 오고, 임박 재료로 만들 레시피를 추천하는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Early-40s Korean woman, bob haircut, dark green cardigan. Her husband, early 40s, thin glasses, white shirt, stands beside her at the counter on the right.

[HOME]
Kitchen counter in the morning. The only prop: one small plain pastel pink yogurt cup with a sealed flat foil lid. The counter is bare.

[ACTION]
She holds the yogurt cup at eye level and slowly turns it once in her fingers, looking for the date, then holds it a little farther away and squints. She slowly hands the cup to her husband; he takes it in one hand, tilts it to look at the bottom, and slowly hands it back to her. The cup is always in someone's hand.

[AUDIO]
She, turning the cup: "이거 유통기한 언제까지야? 글씨가 너무 작아." (She hands it to him.) He, looking at the bottom: "어제까지네." She, taking it back: "어제면 괜찮지?" He: "그럼 자기가 먹어."

[LAST SECOND]
The yogurt cup back in her hand.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
She stands at a bare kitchen counter holding a small plain pastel pink yogurt cup at eye level, squinting at it. Her husband in thin glasses and a white shirt stands beside her on the right, looking at the cup.

[CAST]
Early-40s Korean woman, bob haircut, dark green cardigan. Her husband, early 40s, thin glasses, white shirt, stands beside her at the counter on the right.

[HOME]
Kitchen counter in the morning. The only prop: one small plain pastel pink yogurt cup with a sealed flat foil lid. The counter is bare.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 06. 열 개 다 마트 가래 — 요리 AI · 말로 물어보기

- **공감 포인트**: 냉장고에 있는 걸로 해 먹으려고 레시피를 찾으면, 꼭 없는 재료를 사 오라고 하죠. 한참 찾다가 지쳐서 폰을 내려놓는 게 공감 포인트예요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 현실 직시형 「레시피 열 개 봤는데 / 다 장 보래요」
- **다른 후보**: 🛠️ 해결책 제시형 「있는 재료로 / 물어보면 돼요」 · 💛 감정 공감형 「저녁 메뉴 검색, / 끝이 안 나요」
- **이어 붙일 앱 데모**: 06 요리 AI — 「냉장고에 있는 걸로 뭐 해 먹지?」처럼 말하듯 물으면 내 재료로 맞는 레시피를 골라 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Early-30s Korean woman, long straight hair, black knit top, sitting at the left end of a sofa holding her phone with both hands, its screen facing away from the camera. Her husband, early 30s, white T-shirt, sits at the right end of the sofa with a plain pillow on his lap.

[HOME]
Living room in the evening, warm floor lamp. The only props: her phone and his plain pillow. Plain wall behind the sofa.

[ACTION]
She scrolls slowly with her thumb, three slow swipes, then lets out a sigh and slowly lowers the phone onto her lap, screen down. He turns his head toward her when he asks.

[AUDIO]
He: "뭘 그렇게 오래 찾아?" She, still scrolling: "냉장고에 있는 걸로 해 먹을 거." (She lowers the phone onto her lap, screen down.) She: "근데 열 개 봤는데 열 개 다 마트 가서 사 오래."

[LAST SECOND]
Her tired face, the phone lying face down on her lap.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
A woman in a black knit top sits at the left end of a sofa holding her phone with both hands, screen facing away from the camera. Her husband in a white T-shirt sits at the right end with a plain pillow on his lap.

[CAST]
Early-30s Korean woman, long straight hair, black knit top, sitting at the left end of a sofa holding her phone with both hands, its screen facing away from the camera. Her husband, early 30s, white T-shirt, sits at the right end of the sofa with a plain pillow on his lap.

[HOME]
Living room in the evening, warm floor lamp. The only props: her phone and his plain pillow. Plain wall behind the sofa.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 07. 아직 바다 보고 있어 — 검증된 진짜 레시피

- **공감 포인트**: 블로그 레시피를 열면 레시피 전에 여행 이야기가 한참 나오죠. 프라이팬 앞에서 남의 제주도 여행기를 끝까지 내리는 게 웃음 포인트예요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 현실 직시형 「레시피 보려다 / 남의 여행기만 봤어요」
- **다른 후보**: 🛠️ 해결책 제시형 「서론 없이 / 조리 순서만」 · 🔍 디테일 분석형 「진짜 레시피는 / 스크롤 맨 아래」
- **이어 붙일 앱 데모**: 07 진짜 레시피 — 유튜브·네이버 인기 레시피를 재료·순서만 정리해 보여 주는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Late-30s Korean man, short tidy hair, olive T-shirt, standing at the stove holding his phone in his right hand, screen facing away from the camera, his left hand resting on the counter. His wife, late 30s, hair clipped up, gray hoodie, stands at the other end of the counter holding a plain mug.

[HOME]
Kitchen in the evening. On the stove, one empty plain black frying pan, cold, with nothing in it; the burners are off. The counter is otherwise bare.

[ACTION]
He scrolls his phone slowly with his thumb, again and again, frowning slightly. His left hand stays on the counter and the pan stays exactly where it is. His wife watches him over her mug.

[AUDIO]
She: "레시피 찾았어?" He, scrolling: "찾았는데 계속 이 사람 제주도 여행 얘기만 나와." (He scrolls again.) He: "아직 바다 보고 있어." (She breathes out a small laugh into her mug.)

[LAST SECOND]
His face looking down at the phone, the empty pan in front of him.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
A man in an olive T-shirt stands at a stove with a cold, empty black frying pan, holding his phone in his right hand with the screen facing away from the camera, left hand on the counter. His wife in a gray hoodie stands at the other end of the counter holding a plain mug.

[CAST]
Late-30s Korean man, short tidy hair, olive T-shirt, standing at the stove holding his phone in his right hand, screen facing away from the camera, his left hand resting on the counter. His wife, late 30s, hair clipped up, gray hoodie, stands at the other end of the counter holding a plain mug.

[HOME]
Kitchen in the evening. On the stove, one empty plain black frying pan, cold, with nothing in it; the burners are off. The counter is otherwise bare.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
A clean, unedited camera frame.

Generate this image in a 9:16 vertical aspect ratio (portrait, 1080×1920).
```

## 08. 아낀 돈으로 치킨 시키자 — 가족 · 아낀 돈

- **공감 포인트**: 집밥 해 먹고 「오늘 돈 아꼈다」 뿌듯해하는 순간, 꼭 그 돈을 다른 데 쓰자는 사람이 있어요. 아낀 돈이 바로 치킨이 되는 게 웃음 포인트예요.
- **썸네일 후킹 자막(추천, 첫 프레임부터)**: 😂 반전형 「집밥으로 아낀 돈, / 어디에 써요?」
- **다른 후보**: 💛 감정 공감형 「집밥 한 끼에 / 이만 원 아꼈다」 · 📱 기능 활용형 「아낀 돈이 / 쌓이는 게 보여요」
- **이어 붙일 앱 데모**: 08 가족·아낀 돈 — 가족 집밥 목표와 요리할 때마다 쌓이는 아낀 돈(예상)이 보이는 화면

영상 프롬프트:

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright, the same shape as an Instagram Reel: much taller than it is wide, from the first frame to the last. The people stand or sit in the center column with a little headroom, hands and props sit in the lower third, and the room stretches up behind them. If an image is attached, it is the first frame: keep its vertical framing, people, props and setting exactly.

[DIRECTION — same for every clip in this series]
A short Korean slice-of-life comedy series. Treat this as raw camera footage (a clean plate) that an editor will finish later: the frame shows only the live-action scene, exactly as the camera sees it.

LENGTH: One continuous take, about 8 seconds. The funny line lands around the middle, then the moment plays out quietly to the end.
TONE: Observational comedy, like a friend quietly filming a real moment at home. The laugh comes from recognition ("that's so us") and one small absurd line, played completely straight. Warm, never mean.
ACTING: Shot like a candid video a family member took without the others noticing. Nobody performs. The comedy lives in the words and in tiny reactions, so bodies stay calm: each person makes only the one or two slow, simple movements written in ACTION, and otherwise just breathes, blinks, glances and talks. Reactions are small and slow: a pause, a glance at the object, a breath out through the nose, a slight shrug, a half-smile. Faces stay relaxed and ordinary; mouths open only for the words. Eyes go to the props or to each other and stay away from the lens. Whoever is spoken to is already in the frame from the first second, and the speaker turns to look at that person while talking.
SPEECH: Native Korean speakers talking in their own natural Seoul Korean, with the warm, lively everyday tone couples and families use with each other at home, the way people sound in a Korean TV drama or a vlog. Full, natural sentences, never clipped or read aloud. Lip movements match the Korean words exactly.
TIMING: The lines happen in the order written in AUDIO, each one tied to the action next to it, with short natural pauses between them. Each line is spoken once, by the person named.
PEOPLE: Korean adults with a clean, neat, likable look: tidy hair, clear skin, natural minimal makeup, crisp everyday clothes. Their faces can look tired, puzzled or resigned; their appearance stays neat.
HOMES: Modern Korean homes, lived-in but tidy. Warm wood and white surfaces. Clean, simple backgrounds with large plain areas.
LIGHT: Soft daylight from a window plus gentle warm practical lights. Warm white balance, soft contrast, natural skin tones. Evening scenes use a warm pendant or lamp and stay bright enough to read faces.
CAMERA: Locked-off camera on a tripod at eye level for the entire take: no zoom, no pan, no push-in, no shake. 35–50mm lens feel, shallow depth of field, vertical framing, medium shot on the people. Real-time motion only.
MOTION AND OBJECTS: The scene holds only the props named in HOME and ACTION, three or fewer, each one resting firmly on its own spot or in a hand, spaced well apart. An object moves only while a hand is visibly holding it, travels exactly with that hand, and stays precisely where it is put down. Everything else in the frame, including food, packages, doors, drawers, curtains, plants and appliances, stays completely still from the first frame to the last. Every object keeps its exact shape, size, color and count for the whole take. Hands have five fingers and hold things with a natural, firm grip, moving slowly. Food appears whole and at rest: closed packages, whole vegetables, or dishes already served. Each person keeps the same face, hair and clothes throughout.
PROPS: Every surface and object is plain and unmarked. Food packaging comes in solid pastel colors, containers are clear or single-colored, paper items are blank, appliances and clothes carry no logos. Phones are held with the screen facing away from the camera; if a screen must face up, it glows as a soft blurred color.
SOUND: Natural room sound plus the spoken lines in AUDIO. No music. The Korean in AUDIO is heard as voice only.
ENDING: The final second simply holds on the subject named in LAST SECOND, with the camera still.

[CAST]
Mid-30s Korean couple sitting across a small dining table, seen in three-quarter view. The wife: low ponytail, light pink sweater. The husband: short hair, navy T-shirt. Each holds a pair of plain wooden chopsticks.

[HOME]
Dining table in the evening under a warm pendant light. On the table: two plain white bowls of white rice, already served, and one plain white plate of simple stir-fried vegetables in the middle. Everything on the table stays in place.

[ACTION]
They eat slowly. He lifts a small bite of rice with his chopsticks and chews. She looks at him and talks. He looks up and answers. At his answer she stops with her chopsticks held still in the air and looks at him. The bowls and plate never move.

[AUDIO]
She: "오늘 집에서 해 먹으니까 이만 원 아꼈다." He, chewing, looking up: "오, 진짜? 그럼 그 돈으로 치킨 시키자." (She stops with her chopsticks in the air and looks at him.)

[LAST SECOND]
Her chopsticks held still in the air as she looks at him.

Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.
```

첫 장면 이미지 프롬프트(2단계용):

```
Create a photoreal still photo in a 9:16 vertical aspect ratio (portrait, 1080×1920), like a frame from an Instagram Reel shot on a phone held upright.

[SCENE — the first frame]
A couple sits across a small dining table under a warm pendant light, holding plain wooden chopsticks. Two plain white bowls of rice and one plate of stir-fried vegetables sit on the table. She looks at him; he lifts a small bite of rice.

[CAST]
Mid-30s Korean couple sitting across a small dining table, seen in three-quarter view. The wife: low ponytail, light pink sweater. The husband: short hair, navy T-shirt. Each holds a pair of plain wooden chopsticks.

[HOME]
Dining table in the evening under a warm pendant light. On the table: two plain white bowls of white rice, already served, and one plain white plate of simple stir-fried vegetables in the middle. Everything on the table stays in place.

The people stand or sit in the center column with a little headroom; hands and props sit in the lower third; the room stretches up behind them.
People: Korean adults with a clean, neat, likable look and natural relaxed expressions, caught mid-moment, looking at the props or at each other rather than at the camera.
Light: soft daylight from a window plus gentle warm practical lights, warm white balance, natural skin tones, shallow depth of field, eye level, 35–50mm lens feel.
Props: only the props named here, three or fewer, each clearly separate; every surface and object is plain and unmarked; food packaging in solid pastel colors, containers clear or single-colored, no logos; phone screens face away from the camera unless described.
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
| E | 머리를 올려 묶고 앞치마 | `Hair tied up high; add plain aprons.` | `Narrow villa kitchen with pale gray counters.` |
