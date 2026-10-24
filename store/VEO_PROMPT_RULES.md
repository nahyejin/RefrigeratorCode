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

## ⭐ 프롬프트 모양 (2026-10-23, v7부터) — 위에서 아래로 한 번만 읽히게
사용자: 동작과 대사가 [동작]·[소리·대사]로 나뉘어 있으면, 제미나이가 위아래를 오가며 대조해야 해서 헷갈린다. 상황과 대사를 한 번에, 순서대로 준다.

1. **[한 줄 요약]**: 누가 무엇을 해서 어떻게 끝나는 몇 초짜리 장면인지 한 문장으로 쓴다.
2. **[꼭 지킬 것]**: 공통 규칙 6개. 화면 글자 없음, 적힌 사람만 말함, 말투, 물건, 화면 고정, 집·빛·소품.
3. **[등장인물]**: 사람마다 옷을 정한다. 이 옷 이름으로 [장면 순서]에서 사람을 부른다.
4. **[장소 — 처음 모습]**: 물건의 위치와 개수를 정한다.
5. **[장면 순서]**: 한 줄 = 「N) 시간 · 누가(옷): 하는 것 — 말(말투): "대사"」. 말이 없으면 「— 말 없음」. 말하지 않는 사람의 상태도 그 줄에 적는다(예: 「여자는 입을 다물고 있다」).
6. **[마지막 장면]**: 마지막 화면을 적는다.

완성본: [REEL_HOOKS_V7.md](REEL_HOOKS_V7.md) (`scripts/gen_reel_hooks_v7.py`).

## 길이 한계 (2026-10-24 사용자 확인)
- 제미나이 앱에서 한 프롬프트로 나오는 영상은 **8~10초**다. 30초를 한 번에 시켜도 10초로 나온다. 예전 메뉴 편 20초는 예외였다.
- 그래서 긴 영상은 **10초 안에 들어가는 클립 여러 개**(대사 6~7초)로 나눠 뽑고, 편집에서 이어 붙인다.
- 같은 사람으로 보이게 출연자 사진을 먼저 만들어 클립마다 첨부한다.

## v7 시험(2026-10-23, 06 배달 편) — 성별이 바뀌고 대사가 꼬였다
- (정정) 사용자가 쓴 건 다른 세션이 만든 v7.1 이었다. v7.1 에서는 06·07·08 이 남편 주인공이고, 06 도 남편이 소파에 앉는다. 그러니 자리는 프롬프트대로 나온 것이다. 실제 문제는 아래 증상 2(목소리 꼬임)뿐이다.
- 증상 2: 남편(소파)의 대사 「열 개 다 마트 가서…」가 여자 목소리로 나왔다. 바로 앞에 아내의 「응」이 끼어 있었다.
- 원인으로 보이는 것 1: 「아내/남편」만으로는 성별이 단단히 묶이지 않는다.
- 원인으로 보이는 것 2: 아내 대사 두 줄 사이에 남편의 「응.」이 끼어 있어, 말하는 사람이 짧게 자주 바뀌었다.
- 고친 방법:
  - 줄마다 **성별을 맨 앞에** 쓴다. 예: `여자(아내 · 검은 니트, 소파에 앉음)`.
  - 대사마다 **「여자 목소리로 말한다 … (남자는 입을 다문 채 듣는다.)」**를 붙인다.
  - 「꼭 지킬 것」에 「남자 1명·여자 1명, 성별·옷·자리를 바꾸지 않는다」를 넣었다.
  - **같은 사람의 말은 한 줄로 합친다.** 「응」·「…응?」 같은 짧게 끼어드는 말은 빼고 표정으로 바꾼다(06, 07).

## v6 1차 시험(2026-10-23) — 뽑아 보니 깨진 것
v6 프롬프트로 다섯 편을 뽑았다(대사는 Whisper로, 목소리 높이로 화자를 확인). 결과와 고친 방법:
- **목소리가 사람과 안 맞았다(03 장갑).**
  - 「팔꿈치로 눌러」를 여자가 말했다.
  - 「냄비 들고 있잖아」는 남자 목소리(121Hz)로 나왔다.
  - 고친 방법:
    - 공통 지시에 이렇게 넣었다: 「각 줄은 그 줄 앞에 적힌 사람만 말한다. 그 사람 입만 움직이고 다른 사람은 입을 다문다. 남자는 낮은 남자 목소리.」
    - 화자 이름은 옷과 자리로 적는다. 예: `남자친구(검은 후드티, 뒤쪽 식탁)`.
- **「앞줄」이라고 쓰자 엉뚱한 가전이 생겼다(02 양배추).**
  - 「냉장고 앞줄」이라고 쓰자, 화면 아래에 뚜껑식 김치냉장고 같은 상자가 생겼다. 재료가 그 위에 올라갔다.
  - 고친 방법:
    - 「앞줄」을 「냉장고 안」으로 바꿨다.
    - 「주방에 있는 가전은 이 냉장고 하나뿐, 화면 아래는 깨끗한 나무 바닥」이라고 적었다.
- **숨긴 게 처음부터 보였다(02 양배추).**
  - 냉장고 안이 처음부터 다 보여서, 「이게 다야」라는 대사가 거짓말이 됐다. 공개도 안 됐다.
  - 고친 방법:
    - 냉장고 문을 보는 사람 쪽으로 열어 안을 가렸다.
    - 냉장고 안쪽은 따로 3초 추가 컷으로 뽑아, 편집할 때 붙인다.
- **우유가 엉뚱한 데서 나왔다(01 우유).**
  - 아내가 칸 안쪽에서 꺼낸 뒤 손에 두 개를 들고 있었다.
  - 고친 방법:
    - 우유 자리를 「열린 문 안쪽 맨 아래 포켓에 2개」로 정했다.
    - 「아내 손에는 1개뿐」, 「새 우유는 어디에서도 생기지 않는다」라고 적었다.
- **화면에 한글 자막이 나왔다(03 장갑, 04 식단).**
  - 03에는 대사 자막이, 04에는 「머쓱」 같은 효과 글자가 화면에 나왔다.
  - 고친 방법:
    - 공통 지시에 「대사와 숨소리는 소리로만 들리고, 화면 위에는 어떤 글자도 나타나지 않는다」를 넣었다. 실험이다. 계속 나오면 제외할 요소 칸을 쓰거나 대사 없는 버전으로 뽑는다.
- **편집(확대·자르기)으로는 물건 오류를 못 살린다.** 우유가 떠다니거나 늘어난 영상, 아래에 엉뚱한 가전이 생긴 영상을 확대해서 가려 봤다. 결국 화면이 너무 잘려 어색했고, 문제도 다 가려지지 않았다(사용자 판단). 편집으로 살릴 수 있는 건 화면에 박힌 글자 지우기와 오른쪽 아래 표식 지우기 정도다. 물건이나 사람 오류가 있으면 다시 뽑는다.
- **v5 정적판으로 뽑은 양배추 영상은 버린다.** 사용자가 결정했다.

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
