# 제미나이(Veo) 영상 프롬프트 규칙

후킹 영상 프롬프트를 새로 짜거나 고칠 때 **먼저 이 파일을 본다**. 4벌까지 직접 뽑아 보며 쌓은 규칙에 제미나이 조언(2026-10-20)을 더했고, 실제로 뽑아 확인한 결과도 같이 적었다.
편별 프롬프트 모음: [v4](REEL_HOOKS_V4.md) · [v3](REEL_HOOKS_V3.md) · [v2](REEL_HOOKS_V2.md) · [1벌](REEL_PROMPTS_FULL.md)

---

## ⭐ 최신 (2026-10-22) — 너무 정적이면 안 된다, 한글로, 호흡 있게
v5(전부 가만히)를 본 사용자 의견: **너무 정적이다. 전부 나란히 앉아 있는 구도뿐이다.** 그래서 아래처럼 고쳤다. 이 절이 아래 1·6번보다 우선한다. 완성본은 [REEL_HOOKS_V6.md](REEL_HOOKS_V6.md)(`scripts/gen_reel_hooks_v6.py`).
- **이야기에 필요한 동작은 넣는다.** 편마다 한두 개, 천천히 한 번씩.
  - 예: 우유 편. 남자가 현관문을 열고 우유를 들고 들어오며 말한다. 아내는 열린 냉장고 앞에서 우유를 하나 꺼내 들며 대답한다.
- **깨짐을 막는 규칙은 그대로 지킨다.**
  - 한 번 잡은 물건은 끝까지 손에 들고 있다.
  - 물건을 서로 건네지 않는다.
  - 사람이 연 문은 열린 채 둔다. 냉장고는 처음부터 열려 있다.
  - 그 밖의 물건은 처음부터 끝까지 가만히 있다.
  - 개수는 숫자로 못 박는다. 예: 「냉장고 1 + 아내 손 1 + 남자 손 1 = 3」.
- **구도는 편마다 다르게 한다.** 나란히 앉기만 반복하지 않는다.
  - 현관→주방, 냉장고와 아일랜드 식탁, 조리대와 소파, 소파 뒤에서 내려다보기, 어깨 너머로 보기, 식탁 차리기.
- **프롬프트는 한글로 쓴다.** 사용자가 요청했다.
- **화면 속 한글 자막은 없어야 한다.**
  - 공통 지시에 이렇게 적는다: 「편집 전 원본 촬영분. 화면에는 사람과 집만 보이고, 말은 목소리로만 들린다」.
  - 「자막 금지」처럼 막을 것의 이름은 본문에 적지 않는다. 이름을 적으면 힌트가 된다.
  - 그래도 나오면 차례로 쓴다:
    1. 새 대화에서 같은 프롬프트로 다시 뽑는다.
    2. 제외할 요소 칸에 적는다.
    3. 대사 없는 버전으로 뽑고 대사는 편집에서 넣는다.
- **대사에 호흡·표정·뉘앙스를 붙인다.**
  - 대사 옆 괄호에 적는다: 말끝 흐림·늘임, 반 박자 쉼, 바로 받아치기, 콧웃음·한숨, 표정 변화.
    - 표정 변화의 예: 웃음이 그대로 굳는다, 눈만 돌려 째려본다.
  - 대본처럼 또박또박 말하지 않게 한다.
  - 웃음 포인트 앞에는 「반 박자 정적」을 둔다.
- **사용자 검토(2026-10-22)에서 나온 것** — 편마다 확인한다.
  - **펀치 대사는 본 것을 그대로 말하게 한다.**
    - 고치기 전: 「그럼 저 안에 있는 건 누가 산 거야?」. 갑자기 「누가 샀냐」로 튀어 어색했다.
    - 고친 뒤: 「…엥. 냉장고에 하나 더 있네?..」. 눈에 보인 걸 그대로 말한다.
  - **냉장고를 비어 보이게 두지 않는다.**
    - 빈 냉장고는 이상해 보이고, 쿡매치(재료 관리)의 맥락과도 반대다.
    - 다른 칸은 평범하게 채우고, 「나머지는 처음부터 끝까지 움직이지 않는다」고 적는다.
  - **영상 의도가 앱 기능으로 이어져야 한다.**
    - 02: 「양배추·소시지밖에 없다」고 했는데 냉장고 안쪽에 재료가 잔뜩 쌓여 있다. 이걸 보여 줘야 내 냉장고를 관리해 주는 앱이라는 맥락이 생긴다.
    - 마지막에 냉장고 안쪽으로 다가가는 장면이 깨지면 편집에서 확대한다.
  - **반복 개그는 끝까지 간다.**
    - 식단 편은 「화요일」에서 끊지 않는다. 월~금까지 둘이 번갈아 묻고 답하며 배달 메뉴로 채운 뒤 「됐다 됐어, 정하지 말자」로 끝낸다.
    - 8초를 넘기면 「수요일은?」에서 두 컷으로 나눈다. 두 번째 컷은 첫 컷의 마지막 장면을 첫 장면 이미지로 쓴다.

## 0. 한 줄 요약
**사람은 표정과 고개 정도만 움직이고, 물건은 처음 놓인 자리에 가만히 둔다. 단, 이야기가 말이 되는지(어디서 왔나, 「이거/그거/저거」가 맞는 거리인가)는 반드시 따로 확인한다.**

## 1. 상태가 바뀌는 행동은 쓰지 않는다 — 가장 중요
AI는 「상태가 바뀌는 순간」에 사람 몸과 물건을 섞어 버린다. 그래서 물건이 혼자 움직이고, 냉장고 문이 두 개가 되고, 손가락이나 물건이 녹아내린다.

- **금지 행동**
  - 문 열기·닫기(냉장고·현관·서랍)
  - 꺼내기·넣기, 물건 주고받기
  - 먹기·마시기·젓가락질, 붓기·썰기
  - 폰 스크롤·화면 누르기
  - 긴 걷기
- **바꿔 쓰는 법**: 처음부터 「이미 그런 상태」로 둔다.

  | 이렇게 쓰지 말고 | 이렇게 쓴다 |
  |---|---|
  | 폰을 꺼낸다 | 이미 폰을 들고 있다 |
  | 냉장고를 연다 | 식탁·조리대 위에 이미 놓여 있다 |
  | 마신다 | 머그를 감싸 쥐고만 있다 |
  | 먹는다 | 음식은 앞에 두고 대화만 한다 |
  | 넘겨 준다 | 둘이 같이 들여다본다 |
- **손**: 손은 잡은 모양을 바꾸지 않는다(`Hands do not change their grip`). 장갑 낀 손으로 폰을 누르는 장면이라면 아예 안 누른다.
  - 이 경우 웃음은 대사로 만든다. 예: 「코로 눌러봐」
- **물건**: 소품은 3개 이하로, 서로 떨어뜨려 둔다.
  - 개수가 웃음 포인트면 「exactly two」처럼 숫자로 못 박는다.
  - 다 합친 개수도 적는다.

## 2. 연기는 「작게」 — 큰 연기를 시키면 표정이 기괴해진다
- 「크게 놀라며 소리친다」 같은 지시는 쓰지 않는다. 표정과 미세한 움직임 위주로 시킨다.
  - 표정과 움직임의 예: 살짝 눈이 커짐, 갸우뚱, 한숨, 피식, 째려보기, 고개 한 번 끄덕
- 프롬프트에 **`subtle` · `gentle` · `natural`** 을 꼭 넣는다. 과한 움직임을 막아 준다.
- 동작은 한두 개만, 일상 속도로 한다. 빠른 반사 동작을 시키면 흐려지면서 손 모양이 무너진다.

## 3. 카메라와 배경은 고정
- 제미나이가 권한 표현: `STRICTLY STATIC ENVIRONMENT`, `completely static camera`, `stable background`
  - 이 표현을 쓰면 배경이 일그러지거나 물건이 복제되는 일이 크게 준다.
- ⚠️ v4 시험(2026-10-18) 결과: 「삼각대에 고정한 카메라」라고 적었더니 **화면 안에 삼각대가 찍혔다**.
  - 장비 이름(tripod·camera rig)은 쓰지 않는다.
  - `static camera` 정도는 괜찮다. 그래도 카메라·삼각대가 화면에 나오면 `the view never moves` 처럼 **보이는 결과**로 바꿔 쓴다.
- 배경은 단순하게, 초점을 흐리게 한다(`simple and out of focus`). 문이 하나뿐인 냉장고처럼 복제될 거리가 적은 배경을 고른다.

## 4. 대사
- 한국 사람이 집에서 실제로 하는 구어체로 쓴다. 추임새를 넣는다.
  - 추임새의 예: 「어?」 「엥?」 「오, 진짜?」 「아, …」
- 문장은 완전하게 쓴다. 한 단어로 자르면 더 어색해진다.
- 대사마다 괄호로 동작이나 표정을 하나씩 붙인다. 순서대로 쓴다.
- 말을 거는 상대는 **첫 프레임부터 화면 안에** 있어야 한다. 그렇지 않으면 허공에 대고 말한다.
- 입모양이 계속 어색하면 다른 방법을 쓴다.
  - **대사 없이 표정만**으로 뽑는다.
  - 소리는 나중에 AI 더빙이나 자막으로 넣는다. 제미나이는 이 방법이 훨씬 자연스럽다고 했다.

## 5. ⚠️ 정지시켜도 이야기는 말이 되게 — 실제로 뽑아 보고 걸린 것(2026-10-20 우유 편)
제미나이 방식(전부 가만히)으로 뽑으니 오류는 거의 없고 한결 자연스러웠다. 다만 **이야기 논리**가 깨져 어색했다.

- **어디서 왔는지가 보여야 한다**: 「나 오다가 우유 사왔어」라고 말하는데 남자가 조리대 옆에 가만히 서 있으면 집에 들어오는 사람처럼 안 보인다.
  - 들어오는 장면은 **긴 걷기 대신 짧게** 쓴다.
    - 문이 보이지 않는 화면 옆에서 2~3걸음, 천천히 걸어 들어온다. 물건이 놓인 식탁 앞을 지나가지 않게 옆에서 들어온다.
    - 제미나이 조언 5번(정면으로 걸어오기는 비교적 안정적)과 같은 원리다.
    - 문은 열지 않는다. 이미 들어와 있거나, 화면 밖에 있다.
  - 도착 신호도 같이 쓴다: 겉옷(점퍼)을 입은 채, 한 손에 우유만.
  - 물건은 끝까지 손에서 놓지 않는다. 내려놓는 순간 복제가 잘 생긴다.
- **지시어와 거리를 맞춘다**: 「이거 / 그거 / 저거」는 거리를 말한다.
  - 「저건」이라고 하면 그 물건은 두 사람에게서 **2~3m 떨어진 곳에, 화면 안에** 있어야 한다.
  - 바로 옆 조리대에 있으면 「이건」이다.
  - 아무도 그 물건까지 가지 않는다. 고개와 눈으로만 가리킨다.
- **대사 속 장소와 HOME 이 같아야 한다**: 대사는 「식탁에 있는 저건」인데 HOME 은 「조리대(counter)」였다. 이런 어긋남이 어색함을 만든다.
  - 대사에 나오는 장소·물건 이름을 HOME·ACTION 과 한 단어씩 맞춰 본다.
- 점검 질문 세 가지. 프롬프트를 내기 전에 매번 확인한다.
  1. 이 사람은 지금 어디서 왔고, 화면이 그걸 보여 주나?
  2. 「이거·그거·저거」가 가리키는 물건이 그 거리에, 화면 안에 있나?
  3. 대사에 나온 장소·물건이 HOME 에 같은 이름으로 있나?

## 6. 공통 지시 블록 (제미나이 수정판 — 실제로 잘 나옴)
v4 의 길었던 DIRECTION 대신 이 짧은 블록을 기본으로 쓴다. 편별 내용은 [CAST]·[HOME]·[ACTION]·[AUDIO]·[LAST SECOND] 에만 쓴다.

```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. No one walks, no doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on tables) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.
```

- 짧게 걸어 들어오는 장면(5번)이 필요한 편만 MOTION 의 `No one walks` 를 바꾼다.
  - 바꿀 문장: `Only he takes two or three slow steps in from the left side of the frame at the start, then stands still; nobody else walks.`
  - 나머지 문장은 그대로 둔다.
- [ACTION] 에서 「누가 무엇을 안 하는지」를 한 번 더 적으면 좋다. 예: `Nobody touches or moves the food.`, `She does not scroll or tap the screen.`
- [LAST SECOND] 는 「가만히 있는 얼굴이나 물건」으로 끝낸다. 예: `…, perfectly still.`

## 7. 고친 예 — 01 우유 편(5번 규칙 반영)
8편 전체 완성본: [REEL_HOOKS_V5.md](REEL_HOOKS_V5.md) (`scripts/gen_reel_hooks_v5.py`).


```
Generate this video in a 9:16 vertical aspect ratio (portrait, 1080×1920) for Instagram Reels.

[FORMAT]
Vertical portrait video for a phone held upright. Medium shot on the people.

[DIRECTION]
A short Korean slice-of-life comedy series. Treat this as raw footage.
ACTING: Natural, relaxed everyday pace. Subtle facial expressions (a quick look, a short laugh). No big movements.
SPEECH: Native Korean speakers talking in natural Seoul Korean. Lip movements match the words exactly.
MOTION AND OBJECTS: STRICTLY STATIC ENVIRONMENT. Only the man takes two or three slow steps in from the left side of the frame at the start, then stands still; nobody else walks. No doors open, no objects are passed back and forth. Objects stay exactly where they start (in hands or on the table) to prevent AI morphing. Hands do not change their grip. Only subtle head turns and facial expressions.

[CAST]
Early-30s Korean man, short tidy hair, light gray zip-up jacket over a navy sweatshirt, just home from outside. His wife, early 30s, hair in a low ponytail, beige knit cardigan.

[HOME]
Apartment kitchen and dining area in the afternoon. About three meters behind them, clearly visible in the frame but slightly out of focus, is a small wooden dining table. On that table are exactly two identical short plain white milk bottles with blue caps, standing apart, and nothing else. No door is visible. The background is simple.

[ACTION]
The man comes in from the left side of the frame, taking two or three slow steps while holding one identical short plain white milk bottle with a blue cap in his right hand, then stops next to his wife. He keeps holding the bottle the whole time and never puts it down. She turns her head to him. Then both of them turn their heads and look over at the dining table in the background. Nobody walks to the table, and nobody touches the two bottles on it; they never move. Count: two bottles on the table plus the one in his hand, three in total, the same from start to end.

[AUDIO]
He, walking in and lifting the bottle slightly: "자기야, 나 오다가 우유 사왔어."
She, turning to him: "어? 나도 아까 샀는데?"
He, looking over at the dining table in the background: "...엥? 그럼 식탁에 있는 저건 누가 산 거야?"
(She looks at the table and lets out a soft sigh with a smirk.)

[LAST SECOND]
The two of them in the foreground, his milk bottle in his hand, and the two bottles on the dining table behind them, perfectly still.
```

- 걸어 들어오는 부분이 또 깨지면, 처음부터 서 있게 바꾼다.
  - 바꾼 장면: `He has just come in and is standing at the kitchen entrance, still wearing his jacket`. 걷기 문장은 뺀다.
  - 점퍼만으로도 「막 들어왔다」가 읽힌다.

## 8. 그래도 깨질 때
1. 첫 장면 이미지를 먼저 만들고(2단계), 그 사진을 첨부해 영상을 뽑는다. 배치가 고정된다.
2. 편마다 **새 대화**에서 2~3번 뽑아 고른다.
3. 제외할 요소 칸이 있으면 거기에만 이렇게 적는다: `objects moving by themselves, morphing, extra objects, duplicated doors, melting hands, camera shake`. 본문에 적으면 오히려 그려진다.
4. 계속 어색하면 대사 없는 버전으로 뽑고, 나중에 더빙이나 자막으로 넣는다.

## 9. 제미나이가 같이 준 「안전한 훅」 8가지 (참고용)
사람과 물건 오류가 가장 적은 구도들이다. 우리 이야기형 훅이 계속 깨질 때 바꿔 쓸 후보로 둔다.

| # | 구도 | 핵심 |
|---|---|---|
| 1 | 시선 집중형 | 정돈된 책상에 앉아 화면을 보고 미소 짓는다. 물건 없음. 텍스트 띄우기 좋음 |
| 2 | 깨달음(aha) | 화면 밖을 보다가 눈이 살짝 커진다. 클로즈업, 배경 흐림 |
| 3 | 여백 가리키기 | 깨끗한 벽 앞에서 손가락으로 오른쪽 빈 곳을 천천히 가리킨다. 그 여백에 훅 문구를 넣는다 |
| 4 | 행동 → 정지 | 노트북 타이핑을 멈추고 화면을 올려다본다. 냉장고처럼 복잡한 물건은 피한다 |
| 5 | 걸어오기 | 조용한 길에서 정면으로 천천히 걸어온다. 물건은 만지지 않는다 |
| 6 | 안도 | 깊게 숨 쉬고 어깨가 풀리며 미소 짓는다. 「해결됐다」는 메시지와 잘 맞는다 |
| 7 | 머그 | 처음부터 양손에 머그를 들고 있다. 한 모금 마시고 화면을 본다. 가장 안전한 소품 |
| 8 | 호기심 | 고개를 살짝 갸우뚱하며 묻는 듯한 눈빛을 보낸다 |
