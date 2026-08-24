# CHANGELOG

쿡매치(CookMatch) 프로젝트 변경 이력. Cursor AI에서 Claude Code로 작업 환경을 이관한 2026-08-24부터 기록.

## 2026-08-24

### 프로젝트 구조 정리
- 옛 CRA 프론트엔드 잔재 삭제 (루트 `src/`, `package.json`, `vercel.json`, `main.py`) — 실제 배포는 `frontend/`에서 진행되므로 영향 없음
- `backend/App.tsx`, 루트 `check_db.py`, 중복 `export_recipes_all.ipynb` 등 죽은 코드/중복 파일 삭제
- 로컬 SQLite 흔적(`posts.db`, `recipes.db`, `refrigerator.db`) 삭제 — 현재는 MySQL(Railway) 사용
- `crawler.log`, `chromedriver-win64/`, `__pycache__/` 전체를 git 추적 해제 (로컬엔 유지, `.gitignore` 반영)
- 루트에 흩어진 디버그/점검용 스크립트 18개를 `scripts/`로 이동
- `utils/requirements.txt.txt`(오타성 파일명)를 `ingredient_management/requirements.txt`로 이동

### 요리 챗봇 기능 추가
- `backend/chat_service.py`: Gemini/Groq LLM으로 대화 의도를 파악해 DB에서 레시피를 검색하는 `/api/chat` 엔드포인트 신설. 일일 호출 한도(기본 250회) 적용
- 프론트에 전역 플로팅 챗 위젯(`RecipeChatWidget.tsx`) 추가 — 냉장고 재료(localStorage) + 대화 기록을 세션 단위로 유지하며 추천 레시피 카드 표시
- Gemini 기본 모델을 `gemini-2.0-flash`(단종됨) → `gemini-3.5-flash-lite`로 교체
- 레시피 썸네일에 기존 `getProxiedImageUrl` 유틸 적용 — 네이버 이미지 핫링크 차단(403) 우회
- 로컬 개발 CORS 이슈 해결 (프론트 dev 서버 포트를 화이트리스트에 있는 5178로 통일)

### 챗봇 FAB를 AI 기능처럼 리디자인
- 텍스트만 있던 "챗" 버튼을 스파클 아이콘 + 회전하는 그라디언트 링 + 펄스 글로우 + "AI" 배지로 교체
- 채팅창 헤더와 어시스턴트 말풍선에도 같은 스파클 아바타 적용해 AI 브랜딩 통일

### 챗봇 대화 히스토리 관리 + 재료 매칭 우선 검색으로 재설계
- `RecipeChatWidget.tsx`: 채팅창을 닫았다 다시 열면 항상 새 대화로 시작하도록 변경. 지난 대화는 localStorage에 스레드 단위로 저장(최근 30일 보관)되고, 헤더의 "지난 대화" 버튼으로 목록을 열어 이어보거나 삭제 가능
- `chat_service.py`: 기존엔 LLM이 뽑은 키워드가 title/content LIKE **강제 필터**라서, 냉장고 재료와 매칭률이 높은 레시피도 키워드가 안 맞으면 통째로 걸러졌음. 이제 냉장고 재료가 있으면 키워드는 `HAVING` 절의 소프트 조건(키워드 매칭 OR 매칭률 25% 이상)으로 바뀌어, 매칭률 높은 레시피가 우선 노출됨
- LLM 프롬프트에 `ignore_fridge` 필드 추가: 사용자가 "재료 상관없이" 등으로 명시적으로 요청할 때만 냉장고 매칭을 끄고 순수 키워드 검색으로 전환
- 레시피 카드의 "재료 매칭률 N%"를 일반 텍스트에서, 기존 `RecipeCard.tsx`와 동일한 톤(짙은 배지 + 노란색 굵은 글씨)의 배지로 변경
