
### 배포된 이미지 인식이 500으로 죽던 문제 수정

앨범에서 영수증을 올렸는데 "사진을 읽지 못했어요"만 나온다는 제보. 배포된
백엔드에 직접 요청해 보니 **이미지 없이 호출해도 500** 이 났다 — 검증 코드에
닿기도 전에, 라우트 안의 `import` 에서 터지고 있었다.

원인: `ingredient_vision` → `llm_ingredient_extraction` → **`update_used_ingredients_batch`**
사슬. 마지막 모듈은 import 시점에 재료 사전 CSV 를 읽고 `backend.backend.*` 까지
끌어온다. 백엔드 서버는 그 파일의 "사전 정규화" 부분만 쓰는데, 배치용 의존까지
전부 로드되면서 배포 환경에서 무너졌다.

- `llm_ingredient_extraction` 의 `_connect_db`/`_used_ingredient_token_set` import 를
  `_batch_helpers()` 안으로 옮겨 **지연 로드**로 바꿨다. 이 둘은 배치 실행(`run`)
  에서만 쓴다. → 서버는 pandas + CSV 만으로 정규화가 돌아간다.
- 라우트의 import 를 try/except 로 감싸 실패 시 **503 + 트레이스백 로그**를 남긴다.
  전에는 500 이 나가면서 원인이 응답에도 로그에도 안 남아 한참 헤맸다.

실측: 로컬에서 이미지 없이 호출 → 400(정상), 영수증 → 200 + 구매일자 인식.
배치 모듈과 `backend.backend.*` 가 더 이상 함께 로드되지 않는 것도 확인.

### 파일 선택에서 "사진 찍기" 빼기

`accept="image/*"` 이면 OS 선택 메뉴에 "사진 찍기"가 함께 나오는데, 촬영은 위쪽
타일이 맡고 있어 중복이다. `accept` 를 형식 목록으로 좁혔다. 업로드 직전에 전부
JPEG 으로 다시 뽑으므로 실제로 받는 형식은 이 목록보다 넓다.
(메뉴 자체는 OS 가 그리는 것이라 강제할 수는 없다.)

### 문서 정리

- **`INGREDIENT_RECOGNITION_FEATURE.md` 신설** — 사진으로 재료 담기 전체 동작.
  열려 있는/닫아 둔 입구, 응답 형태, 사전 정규화를 서버에서 하는 이유, 날짜 인식
  우선순위와 검증 규칙, 검토·수정 UI 설계 의도, 업로드 제한, 호출 한도, 오류 응답,
  실측 결과, 알려진 한계. **배치 모듈 import 를 최상단으로 되돌리지 말라는 경고**도
  같이 적어 뒀다.
- `PROJECT_OVERVIEW.md` — 재료 동의어 처리 절에 **정규화 3단계**와 연쇄 해소,
  사전 수정 후 돌릴 두 스크립트를 추가. 배치 한도를 5,400 → 5,280 으로 고치고
  일일 한도 소진 시 즉시 중단하는 동작을 설명. 내 냉장고 페이지에 사진 담기 추가.
- `ENVIRONMENT_SETUP.md` — `GEMINI_API_KEY_VISION`, `GEMINI_VISION_MODEL` 추가.
  사진 인식이 챗봇과 하루 한도를 공유한다는 점 명시.
- `DATABASE_SCHEMA.md` — `user_ingredients` 에 사진으로 담은 값이 어떻게 들어가는지,
  사전이 바뀌면 `migrate_user_ingredients.py` 로 맞춰야 하는 이유 추가.
- `README.md` — 문서 목록에 신설 문서 추가.
