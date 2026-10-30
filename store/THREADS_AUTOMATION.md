# 스레드 자동화 — 한 번 실행할 때 할 일

> 2026-10-29 사용자 요청: 새 댓글 읽고 답글 초안, 새 글도 Claude가 써서 올리되 **사용자 검토(승인) 뒤에만** 올린다.
> 예약 작업 `threads-auto`가 이 문서를 그대로 따른다. 글 규칙은 `store/THREADS_GUIDE.md`(먼저 읽기).

- 레포: `C:\Users\user\Desktop\RefrigeratorCode`
- 검토함: 「쿡매치 만들기」 아티팩트 https://claude.ai/artifact/BGyobmSLq8o69qkFQWhSkK 의 「스레드 업로드용」 탭 (db 컬렉션 `items`, 2026-10-30 옛 검토함 6uhYSxHqiFSt7CbpYsM2mQ 에서 옮김). 페이지는 `scripts/gen_hub.py` 로 `scripts/hub_make.html` 을 만들고 `scripts/hub_threads.js` 를 함께 올린다
- 스크립트: `python scripts/threads_bot.py fetch | post FILE | stats` (토큰 `.env.threads`, 깃 무시. **토큰 값은 절대 출력·채팅 금지**)

## items 문서
| 필드 | 뜻 |
|---|---|
| `kind` | `reply`(답글) / `post`(새 글) |
| `status` | `pending` 검토 전 → 사용자가 `approved`(올리기) 또는 `skip` → 실행이 `posted` / `failed` |
| `draft` | Claude 초안. 사용자가 고친 최종본은 `text`(있으면 이걸 올림) |
| reply 전용 | 문서 id = 스레드 답글 id, `username` `comment` `timestamp` `post_id` `post_first_line` `permalink` `parent_text` |
| post 전용 | 문서 id = `post-w1-01` 식, `slot` `type` `photo_hint` `first_reply`(최종 `first_reply_text`) `order`, 사진 `images: [{asset, url}]`(검토함에 올린 사진들, 순서대로, 최대 20장) → 공개 주소 목록 `image_publics`. 옛 문서는 한 장짜리 `image_asset` → `image_public` |
| 결과 | `posted_link` `posted_at` `media_id` `error` |

## 순서
1. **올리기** — `status == approved` 를 읽는다(쿼리).
   - reply: 바로 올린다. `{"id", "kind":"reply", "text": text or draft, "reply_to": 문서 id}`
   - post: **아침 7~8시(출근길), 낮 12~13시(점심), 밤 20시~0시대(퇴근·아이 재운 뒤)에만**, 하루 최대 2개·한 시간대에 1개. 그 밖이면 다음 실행으로 미룬다. (2026-10-30 사용자: 엄마들이 폰 보는 시간 = 출근길·점심·밤 8시~새벽 12시, 본인도 그렇다)
     - `images` 가 있고 `image_publics` 가 없으면: 사진마다 Artifact `read`(url=https://claude.ai/artifact/BGyobmSLq8o69qkFQWhSkK, path=asset id)로 받아서
       `frontend/public/threads/<문서id>-<N>.<확장자>`(N = 1부터 순서) 로 복사 → 한 번에 커밋·푸시 → 모든 `https://refrigerator-code.vercel.app/threads/<파일>` 이 200이 될 때까지(최대 5분) 기다림 → 순서대로 `image_publics` 에 저장.
       (옛 문서: `image_asset` 이 있고 `image_public` 이 없으면 같은 방법으로 `<문서id>.<확장자>` 한 장 → `image_public`.)
     - `{"id", "kind":"post", "text", "image_urls": image_publics (옛 문서는 [image_public]), "first_reply": first_reply_text or first_reply}` — 2장 이상이면 스크립트가 캐러셀로 올린다.
   - 본문에 `[대괄호]` 가 남아 있으면 올리지 말고 `failed`, error = "대괄호를 실제 내용으로 바꿔 주세요".
   - 항목들을 JSON 파일(스크래치 폴더)로 써서 `post` 실행 → 결과대로 `posted`(posted_link·media_id·posted_at) / `failed`(error) 업데이트. 읽은 version 을 if_version 으로.
2. **새 댓글** — `fetch` 결과 중 items 에 같은 id 문서가 **없는** 것만 답글 초안을 써서 `pending` 으로 넣는다.
   - 말투: 스레드식 반말, 1~3줄, 상대 말을 받아 주고 가능하면 쉬운 질문으로 되받기(가이드 5장).
   - **꾸며 낸 사실 금지**: 사용자 경험·숫자·가족 이야기를 지어내지 않는다. 필요하면 `[대괄호]` 로 비워 둔다.
   - 앱(쿡매치) 언급 금지 — 상대가 「어떻게 알았어?/뭐 써?」처럼 직접 물을 때만, 그것도 초안 `why` 에 「앱 언급 — 확인 필요」라고 적는다.
   - 스팸·광고·악플이면 초안 없이 `status: skip`, `why` 에 이유.
   - `why`: 왜 이렇게 답하는지 한 줄.
3. **새 글 채우기** — `kind == post` 이고 `status == pending` 인 게 2개 미만이면, `scripts/gen_threads_posts.py` 의 `POSTS`(튜플: slot, type, photo_hint, text, first_reply, note) 중 아직 items 에 없는 다음 것을 `post-w1-NN`(NN = POSTS 순번, 2자리)로 넣는다. POSTS 를 다 쓰면 가이드 4장 비율(정보4·이야기4·참여2)과 최근 답글에서 나온 이야기로 새 초안을 쓰고 `post-new-YYYYMMDD-N`. 사용자만 아는 사실은 `[대괄호]`.
4. **기록** — 올린 게 있으면 `stats` 로 숫자를 보고, 반응 좋은 글은 `store/THREADS_GUIDE.md` 7장 표에 한 줄 추가. 레포 파일이 바뀌었으면 `CHANGELOG.md`에 적고 커밋·푸시.
5. 끝에 한두 줄 요약: 올린 것, 새로 넣은 초안 수, 실패. 아무것도 없으면 「새 댓글 없음」.

## 하지 말 것
- 승인 안 된 것 올리기, 사용자 글 내용 임의 수정(대괄호 검사 외).
- 토큰·시크릿 출력. `.env.threads` 커밋.
- 남의 글에 답글 달기(우리 글의 대화 안에서만).
- 토큰 오류(만료, 190 코드)면 아무것도 올리지 말고 요약에 「토큰 갱신 필요」.
