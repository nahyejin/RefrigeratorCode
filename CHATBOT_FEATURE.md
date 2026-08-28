# AI 요리 챗봇 동작 방식

`backend/chat_service.py` (`/api/chat`, `handle_chat()`)가 전부다. 프론트는
`frontend/src/components/RecipeChatWidget.tsx`. 최신 변경(2026-08-29) 기준으로
정리했습니다 — 이후 프롬프트나 흐름을 고치면 이 문서도 같이 고쳐 주세요.

## 한 번의 요청이 하는 일

1. 프론트가 `{ messages, ingredients, ingredient_expiry, session_id }`를 보낸다.
   - `messages`: 이 대화창의 전체 히스토리 (매번 전체를 다시 보냄, 서버는 메시지
     자체를 저장하지 않고 매 요청마다 받은 것만 씀)
   - `ingredients`: 냉장고 재료 이름 배열
   - `ingredient_expiry`: `{name, days_left}` 배열 — 답변 문구에서 어떤 재료를
     이름으로 부를지 고를 때만 쓴다 (검색 조건에는 전혀 안 씀)
   - `session_id`: 이 대화창을 구분하는 키. 서버가 세션별로 "직전에 실제로
     검색·표시한 결과"를 기억해 두는 용도(아래 참고)
2. **광범위 질문 감지** (`_is_broad_fridge_request`): "그냥 있는 걸로 뭐
   해먹을 수 있어?" 류는 LLM을 부르지 않고 서버가 바로 `keywords=[]`로 확정
   (하루 호출 한도도 아낌).
3. 광범위 질문이 아니면 LLM(Gemini/Groq) 호출 → `_build_prompt()`가 만든
   프롬프트로 `{reply, keywords, include_ingredients, exclude_ingredients,
   ignore_fridge}` JSON을 받는다.
4. `_search_recipes()`로 DB에서 후보를 찾는다. 결과 0건이면 조건을 한 단계씩
   완화해서 재시도한다(아래 "0건일 때 완화 순서" 참고).
5. `_diversify()`로 같은 요리가 몰리는 것을 걸러내고, 응답과 함께 이번 턴의
   검색 조건·결과를 세션에 기억해 둔다(`_remember`).

## 하루 호출 한도

`LLM_DAILY_LIMIT`(기본 250) — `_consume_quota()`/`remaining_quota()`가 KST
자정 기준으로 리셋한다. 재료 추출 배치와 키를 나누고 싶으면
`GEMINI_API_KEY_CHAT`/`GROQ_API_KEY_CHAT`을 따로 넣으면 된다(안 넣으면 공용
키를 씀) — 배치가 하루 한도를 다 써서 챗봇이 종일 429를 내는 사고가 있었던
이유로 분리해 둔 것.

## 검색 로직 (`_search_recipes`)

- 키워드가 있으면 **관련도 0인 글은 제외**(필수 조건). 관련도는 제목(3)/
  재료(2)/본문(1, 첫 키워드만) 가중치 합.
- 냉장고 매칭률(match_rate)은 재료마다 가중치가 다르다 — 조미료
  (`_load_seasoning_set()`, `ingredient_profile_dict_with_substitutes.csv`의
  "양념/조미료" 분류)는 `SEASONING_WEIGHT=0.3`, 나머지는 `CORE_WEIGHT=1.0`.
  이 상수·분류는 `backend/app.py`(`/api/recipes/filter` 등)와
  `frontend/src/utils/recipeUtils.ts`에도 **동일하게** 있어야 앱 전체에서
  매칭률이 같은 기준으로 보인다 — 셋 중 하나만 고치면 안 됨.
- 정렬: 키워드+냉장고 둘 다 있으면 `관련도*10 + 매칭률`, 없으면 각각 단독 기준.

## 0건일 때 완화 순서 (2026-08-29 수정)

검색 결과가 0건이면 조건을 **한 단계씩만** 완화해서 재시도한다:
`keywords 제거` → `include_ingredients 제거` → `냉장고 우선순위 해제`.

**`exclude_ingredients`(빼달라고 한 재료)는 정말 마지막 단계가 아니면 항상
유지한다.** 예전 버그: 이 순서 없이 한 번에 `keywords`/`include`/`exclude`를
전부 날려버려서, "감자는 빼줘"라고 답은 하면서 실제로는 감자가 그대로 들어간
원래 결과를 돌려주고 있었다. 자세한 재현·수정 내용은 `CHANGELOG.md`
2026-08-29 항목 참고.

## 후속 질문(팔로우업) 처리

프론트는 레시피 데이터를 다음 요청에 다시 보내지 않으므로(표시용일 뿐),
서버가 세션별로 **직전 턴에 실제로 쓴 검색 조건 + 실제로 보여준 레시피**를
기억해 뒀다가(`_get_last_turn`/`_remember`, 메모리 딕셔너리 `_sessions`,
세션당 최근 `MAX_HISTORY=10`개 메시지만, 200개 세션 넘으면 오래된 것부터
정리) 다음 프롬프트에 그대로 다시 넣어준다(`_build_prompt`의
`last_turn_block`).

프롬프트는 새 메시지가 "그중에 A는 빼줘", "더 매운 걸로" 처럼 직전 결과를
전제로 한 **수정 요청**인지부터 판단하도록 지시받는다:
- 수정 요청이면 직전 조건을 이어받고 이번에 말한 변경만 반영 (사용자가 말
  안 한 재료를 `include_ingredients`에 마음대로 채워 넣지 말라고 명시 — 그래야
  조건이 과도하게 좁아져 0건이 되는 걸 막음)
- 직전 결과와 무관한 새 주제면 이전 조건에 얽매이지 않고 새로 판단
- 세션에 직전 결과가 없으면(대화 첫 검색) 수정 규칙 자체가 적용 안 됨

## 답변 문구의 재료 언급 우선순위 (2026-08-29 추가)

`reply` 텍스트가 구체적인 재료 이름을 언급할 때만 적용되는 규칙 (검색 조건인
`keywords`/`include_ingredients`/`exclude_ingredients`에는 영향 없음):

1. 조미료(`_load_seasoning_set()`, 검색 가중치와 같은 목록 재사용)보다
   일반 식재료를 우선 언급
2. 그중 유통기한이 임박한 재료(`ingredient_expiry`로 받은 `days_left` 기준)를
   우선 언급
3. 단, 사용자가 "다이어트식으로 추천해줘"처럼 구체적 목표를 명시하면 그
   목표가 유통기한보다 우선
4. 유통기한 임박이 실제로 답변에 영향을 준 경우에만 그 사실을 답변 문구에
   명시(예: "유통기한이 임박한 두부를 먼저 고려해서 답변드렸어요") — 그래야
   사용자가 "유통기한 신경쓰지 말고 답해줘"로 되돌릴 수 있음. 결정 요인이
   아니었으면 이 문구를 붙이지 않는다.

이 규칙을 적용하려면 프론트가 유통기한 데이터를 보내야 한다 —
`RecipeChatWidget.tsx`의 `getFridgeItems()`/`getFridgeIngredientExpiry()`가
`estimatedExpiry`/`expiry`에서 D-day를 계산해 `ingredient_expiry`로 전송한다.

## 자주 헷갈리는 부분

- **`ingredients`(검색용)와 `ingredient_expiry`(답변 문구용)는 역할이 다르다.**
  검색 조건(`_search_recipes`)은 `ingredients` 이름 목록만 보고, 만드는 답변
  문구만 `expiry_days`를 참고한다. 유통기한을 검색 필터로 쓰고 싶다는 요청이
  나오면 이 분리를 먼저 확인할 것.
- `_sessions`는 프로세스 메모리(딕셔너리)라 서버 재시작하면 전부 날아간다 —
  대화 자체가 사라지는 게 아니라(프론트가 `messages` 전체를 계속 들고 있음),
  "직전 턴 근거" 기억만 초기화된다. 재시작 직후 첫 팔로우업 질문은 첫 검색처럼
  처리될 수 있음(치명적이진 않음 — 그냥 수정 요청 판단을 못 할 뿐).
- 하루 호출 한도·세션 메모리 모두 인스턴스 로컬 상태라, 백엔드를 여러 인스턴스로
  스케일하면 인스턴스마다 따로 카운트/기억한다(현재 단일 인스턴스라 문제 없음).
