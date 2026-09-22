# 쿡매치 출시 — 남은 일 (2026-09-22 기준)

상세 배경은 [MOBILE_APP_GUIDE.md](MOBILE_APP_GUIDE.md), 스토어 원고는 [store/STORE_LISTING.md](store/STORE_LISTING.md).

## 🔗 앱 다운로드 링크 (인스타 프로필·릴스 광고용) — https://refrigerator-code.vercel.app/download

- 하나의 링크로 아이폰은 App Store, 안드로이드는 Play(출시 전엔 "곧 출시"+웹), PC 는 버튼 목록. `frontend/public/download.html`.
- **안드로이드 정식 출시되면 `download.html` 의 `ANDROID_LIVE = true` 로 바꾸고 push** (인스타 링크는 안 바꿔도 됨).

## ✅ 2026-09-22 오후 — 구글 비공개 테스트 승인, BETA FLOW 결제·테스터 등록, 안드로이드 1.0.1 검토 전송

- 비공개 테스트 Alpha 1(1.0) 검토 통과·게시(Play 알림 「앱 업데이트가 게시되었습니다」).
- **BETA FLOW**(closedtesting12.com) 기본 9,000원 결제, 패키지 `kr.cookmatch.app`, 만료일 2026-10-22 14:55(기본 20일 테스트, 필요 시 무료 연장). 받은 CSV(테스터 Gmail 27개 — 제3자 이메일이라 repo 에 안 올림)를 Play 「쿡매치 테스터」 목록에 업로드 → **28명**(체크됨). BETA FLOW 관리 메뉴의 **「승인 완료」는 프로덕션 승인 뒤에만** 누를 것.
- **안드로이드 2 (1.0.1)** 업로드(알림 자동 구독 수정·챗봇 입력창) — 경고 2개(가독화 파일·네이티브 디버그 기호, 무시 가능), 지원 기기 변화 없음, 100% 출시 → 빠른 검사 후 자동 검토 전송. BETA FLOW 가 권하는 "테스트 중 1~2회 업데이트" 1회에 해당.
- **관리형 게시가 켜져 있어** 검토 통과 후 게시 개요에서 **「게시」를 직접 눌러야** 테스터에게 간다 → 게시되면 BETA FLOW 설치 시작(Day 카운트). 12명 이상 참여한 날부터 14일 → 프로덕션 신청(BETA FLOW 「프로덕션 신청 양식」 + `store/PLAY_CONSOLE_ANSWERS.md` 10번).
- **같은 날 검토 통과 → 「변경사항 1개 게시」 완료** — 2 (1.0.1) 이 테스터 28명에게 제공 중. 이제 BETA FLOW Day·Testers 숫자 확인.
- iOS 1.0.1 은 빌드 6 으로 교체해 재제출.

## ✅ 2026-09-22 저녁 — iOS 1.0.1 (빌드 5) 심사 제출 완료

- 맥에서 `40a352db` pull → build → `cap sync ios` → Xcode Archive(1.0.1/5) → App Store Connect 업로드 → 버전 1.0.1 생성, 프로모션 텍스트·**설명(명령어 → 정상 원고)**·키워드(냉털·냉털이·냉파·쿡매치·cookmatch 추가)·새로운 기능 입력, 빌드 5 연결 → **심사 대기 중**. 자동 출시·전체 사용자 즉시·평점 유지.
- 참고: Capacitor 8(SPM) 이라 `App.xcworkspace` 가 없다 → `open frontend/ios/App/App.xcodeproj`. 맥 Xcode 에서 App·Info 옆에 `M`(로컬 수정) 표시가 있었음 — 다음 pull 전에 맥에서 `git status` 로 확인(필요 없으면 `git checkout -- <파일>`).
- **남은 일**: ① 1.0.1 심사 결과(naver 메일) → 통과 시 App Store 설명·키워드 확인 ② 구글 비공개 테스트 검토 결과 → BETA FLOW 결제·CSV 업로드 ③ 다운로드 폴더 `AuthKey_MB2S3T63BC.p8` 백업 후 삭제 ④ 구글 검토 뒤 심사용 계정 비밀번호 변경(두 스토어 반영) ⑤ EU 거래자 여부(제출은 막지 않았음 — 유럽 판매 국가 제외 또는 거래자 등록 중 결정) ⑥ (선택) 「Apple Silicon Mac 사용 가능」 해제 ⑦ 며칠 뒤 「쿡매치」「냉털이」 검색 노출 확인.

## 📋 2026-09-22 하루 정리 (무엇이 바뀌었나)

**스토어 진행 상황**
| 곳 | 상태 | 다음 |
|---|---|---|
| **App Store (iOS)** | ✅ 심사 통과(09:28) → 가격 미설정으로 「판매 중단」이던 것을 $0.00 무료로 설정 → 10:02 「배포 승인」, 148개국 처리 중 | 24시간 안에 https://apps.apple.com/app/id6814209983 열리는지 확인. 오늘 저녁 맥에서 **1.0.1 제출**(아래) |
| **Google Play (Android)** | 앱 만들기(패키지 `kr.cookmatch.app`)·앱 설정 전부 완료 → 비공개 테스트 Alpha **검토 중** | 승인 메일 오면 BETA FLOW 결제(9,000원) → 테스터 CSV 를 「쿡매치 테스터」에 업로드 → 14일 → 프로덕션 신청 |
| **네이버 로그인** | ✅ 09-21 승인 | 없음 |

**코드·설정 변경 (커밋 순)**
1. `e5bffef9` 재료 사전·쿠팡 광고 후보 자동 반영(매일 배치).
2. `1ea1e595` 안드로이드 applicationId `com.cookmatch.app` → **`kr.cookmatch.app`**(Play 에서 이미 사용 중). namespace·iOS 번들 ID·로그인 복귀 스킴은 그대로. Firebase 에 새 안드로이드 앱 추가, `google-services.json` 갱신.
3. `0abb9fea` **계정 삭제 안내 페이지** `/account-deletion`(Play 데이터 보안의 계정 삭제 URL) + 개인정보처리방침 3항 개정(시행 2026-09-22) + 탈퇴 1년 뒤 자동 삭제 배치 `scripts/purge_deleted_accounts.py`(매일 배치에 추가) + 탈퇴 계정에 알림 안 보내게 수정.
4. `675318aa` Play 피처 그래픽 재디자인 — 시안 A(검정, 채택)·B(노랑).
5. `55b3362a`·`a555019d` 출시 기록(Play 설정 완료, App Store 심사 통과).
6. `0bef62df` **탈퇴 즉시 콘텐츠 삭제**(냉장고·기록·식단·AI 대화·알림 구독), **iOS 푸시 발송 연결**(APNs 키 → `backend/apns-auth-key.p8`, 아이폰 수신 확인), App Store 원고에 알림 문장 복원, **iOS 1.0.1(빌드 5)** 로 pbxproj 올림.
7. `94fbe50b` App Store 판매 중단 원인(가격 미설정) 해결 기록.
8. 1.0.1 「새로운 기능」 원고(`store/STORE_LISTING.md` `ios-whatsnew`) 작성, 이 정리 추가.

**사용자가 직접 할 일 (남은 것)**
- App Store Connect **프로모션 텍스트**를 `ios-promo`(알림 문장 포함)로 교체 — 심사 없이 바로 가능.
- 다운로드 폴더 `AuthKey_MB2S3T63BC.p8` 비공개 백업 후 삭제.
- 구글 비공개 테스트 승인 뒤: 심사용 계정 비밀번호 변경 → App Store Connect·Play 로그인 정보에 새 비밀번호.
- (선택) App Store Connect 「Apple Silicon Mac 사용 가능」 체크 해제.

## 🍎 오늘 저녁 맥에서 할 일 — iOS 1.0.1 (빌드 5) 제출

맥이 마지막으로 올린 커밋은 `92e173b1`. 그 뒤 윈도우에서 바뀐 앱 쪽 수정: 챗봇 입력창 넘침(`min-w-0`), 안드로이드 전용 스플래시 즉시 닫기(`App.tsx` — iOS 동작 변화 없음), 계정 삭제 안내 페이지·방침 개정, pbxproj 1.0.1(5).

1. **받기·빌드** (터미널)
   ```bash
   cd ~/Developer/RefrigeratorCode && git pull
   cd frontend && npm install && npm run build && npx cap sync ios
   ```
   맥 Claude 가 같은 파일을 먼저 고쳐 둬서 pull 이 막히면 `git checkout <파일>` 로 그 변경을 버리고 다시 pull.
2. **시뮬레이터/실기기 확인** — Xcode 에서 ▶. 로그인·카메라·챗봇 입력창·알림 스위치만 빠르게 확인.
3. **버전 확인** — Xcode 타깃 App → General 에 Version **1.0.1**, Build **5** 인지 확인.
   - **언어 한국어로**: App Store 페이지 「Language」가 **EN** 으로 떠서(2026-09-22 확인) 윈도우에서 Info.plist `CFBundleDevelopmentRegion ko`·`CFBundleLocalizations [ko]`, pbxproj `developmentRegion = ko`·knownRegions 에 ko 를 넣어 둠. Xcode 에서 PROJECT App → Info → **Localizations** 에 **Korean** 이 보이는지 확인(없으면 ⊕ → Korean, 파일 체크 그대로 Finish).
4. **Archive·업로드** — 기기 선택을 「Any iOS Device (arm64)」 → Product → Archive → Organizer 에서 Distribute App → App Store Connect → Upload. 업로드 뒤 처리까지 10~30분.
5. **App Store Connect 에 새 버전** — 앱 → iOS 앱 옆 ⊕ → 버전 **1.0.1**.
   - 「이 버전의 새로운 기능」: `store/STORE_LISTING.md` 의 `ios-whatsnew`
   - 「설명」: `ios-desc`(알림 문장 포함), 「프로모션 텍스트」: `ios-promo`
   - ⚠ **1.0 설명(또는 프로모션 텍스트)에 원고 대신 복사 명령어(`cd ~/Developer/RefrigeratorCode && python3 -c "import re…" | pbcopy`)가 들어가 공개됨**(2026-09-22 App Store 페이지에서 확인). 붙여 넣은 뒤 명령어가 아니라 「오늘 저녁 뭐 해 먹지?」로 시작하는지 꼭 확인. **확인 결과 1.0 「설명」 칸에 들어감**(프로모션 텍스트는 정상) — 1.0 은 설명을 못 고치니 1.0.1 로만 교체 가능. 복사는 명령어 없이 `store/paste/ios-desc.txt` 등을 텍스트 편집기로 열어 전체 선택·복사(원고에서 뽑아 둔 순수 텍스트 파일).
   - 「키워드」: `store/paste/ios-keywords.txt`(쿡매치·cookmatch·레시피추천·냉털·냉털이·냉파 추가 — 이름 전체를 쳐야만 검색되던 문제)
   - 스크린샷·앱 심사 정보는 1.0 에서 그대로 넘어옴
   - 빌드: 처리 끝난 **1.0.1 (5)** 선택
6. **심사 제출** — 「심사에 추가」 → 제출. 출시 방식은 자동 그대로 OK.
7. 끝나면 Claude 에게 "맥 pull 했어"라고 알려 주면 마지막 pull 지점을 갱신한다.

## ⚠ 2026-09-22 10:00 — App Store 「판매 중단」 원인: 가격·판매 국가 미설정 → 해결

- 심사 통과 후에도 App Store Connect 버전 1.0 화면에 「App Store에서 이 앱의 판매가 중단되었습니다」가 떴다. 원인은 **가격 및 사용 가능 여부**에 가격이 비어 있어 판매 국가가 하나도 없었던 것.
- 해결: 가격 변경 일정 ⊕ → **글로벌 가격 변경** → 2026.09.22, **$0.00(무료)**, 기준 국가 미국(USD) 그대로. 저장 직후 앱 사용 가능 여부 **148개 처리 중 / 27개 판매 불가**(중국 등 인허가 필요국 — 무시) → 10:02 Apple 메일 「배포 승인되었음」. 최대 24시간 안에 링크·검색 노출.
- 할 일: 148개에 대한민국 포함 확인, 내일 https://apps.apple.com/app/id6814209983 열리는지 확인. (선택) 「Apple Silicon Mac 사용 가능」 체크는 Mac 미검증이라 해제 권장.

## 🎉 2026-09-22 09:28 — App Store 심사 통과 (iOS 1.0 출시)

- Apple 메일 「Review of your submission is complete… eligible for distribution」(920803hj@naver.com). 제출 ID `cec53827-…`, 빌드 1.0(4). **자동 출시**라 최대 24시간 안에 공개.
- App Store 링크: https://apps.apple.com/app/id6814209983 (앱 ID `6814209983`). 09:40 기준 아직 "페이지를 찾을 수 없음" — 전파 대기(정상).
- **공개되면 확인**: 링크 열림·아이콘·스크린샷 순서(AI 3종 먼저)·설명.
- **이제 풀린 제약**: 심사가 끝나 Railway 백엔드 배포 제약이 없어졌다. 단, 심사용 계정 `920803hj+review@gmail.com` 은 **다음 iOS 업데이트 심사에도 쓰니** 지우지 말고 비밀번호만 바꾼 뒤 App Store Connect 앱 심사 정보에 새 비밀번호를 적을 것(Google Play 로그인 세부정보도 같이 갱신 — 구글 비공개 테스트 검토가 끝난 뒤에).
- **다음 iOS 할 일**: ① ~~iOS 푸시 발송 연결~~ **완료(2026-09-22)** — 맥의 APNs 키를 `backend/apns-auth-key.p8`(gitignore)로 옮기고 본인 기기 3대에 테스트 발송 → 아이폰에서 수신 확인. 매일 배치(`run_expiry_push_daily.bat`)가 이제 iOS 에도 보낸다. `ios-desc`·`ios-promo` 에 알림 문장 복원 → **App Store Connect 프로모션 텍스트는 지금 바로 교체 가능, 설명은 1.0.1 제출 때** ② **맥에서 pull → 1.0.1 (빌드 5) Archive·업로드**(pbxproj 는 윈도우에서 1.0.1/5 로 올려 둠. App Store Connect 에서 새 버전 1.0.1 만들고 설명에 알림 문장 반영, 「이 버전의 새로운 기능」 작성) ③ ~~탈퇴 즉시 데이터 삭제~~ **완료(2026-09-22)** — 백엔드가 탈퇴 즉시 콘텐츠(냉장고·기록·식단·AI 대화·알림 구독)를 지우고, 계정·가입 혜택·이용량 기록만 1년 보관.
- **맥이 가져갈 윈도우 수정분**: 챗봇 입력창 넘침 수정(`min-w-0`), 안드로이드 전용 스플래시 즉시 닫기(`App.tsx`, iOS 동작은 그대로), 계정 삭제 안내 페이지·방침 개정(웹 번들), iOS 버전 1.0.1(5).
- **남은 사용자 작업**: 심사용 계정(`920803hj+review@gmail.com`) 비밀번호 변경 → App Store Connect 앱 심사 정보·Play 로그인 세부정보에 새 비밀번호 반영(구글 비공개 테스트 검토가 끝난 뒤). 다운로드 폴더의 `AuthKey_MB2S3T63BC.p8`(Apple 로그인 키 — 이미 Railway 에 등록)는 비공개 백업 후 삭제.

## ✅ 2026-09-22 — Play 앱 생성·설정 완료, 비공개 테스트 검토 제출

- **앱 만들기**: 이름 `쿡매치 - 냉장고 재료로 레시피 추천`, **패키지 `kr.cookmatch.app`**(com.cookmatch.app 은 다른 개발자가 이미 사용 중이라 변경 — iOS 번들 ID·로그인 복귀 스킴은 com.cookmatch.app 그대로), 한국어, 앱, 무료.
- **앱 설정 전부 완료**: 개인정보처리방침, 로그인 세부정보(심사용 계정 `920803hj+review@gmail.com`, 영문 안내), 광고(예), 콘텐츠 등급(사용자 상호작용 예·초대된 식구로만 제한 예), 타겟층(만 18세 이상), 데이터 보안(수집 8종, 앱 상호작용·기기 ID 는 쿠팡 광고 때문에 "공유·광고 목적"으로 보수적 선언, **계정 삭제 URL `https://refrigerator-code.vercel.app/account-deletion`** 신설), 정부 앱·금융 기능·건강 = 아니요/없음, 카테고리 식음료·태그(레시피·음식/음료·라이프스타일), 연락처 920803hj@gmail.com, 스토어 등록정보(원고·아이콘·피처 그래픽 A안·스크린샷 8장을 휴대전화·7인치·10인치 태블릿에 같은 순서로), AI 애셋 라벨 = 지정 안 함.
- **비공개 테스트 - Alpha**: 버전 `1 (1.0)`(서명된 `app-release.aab`), 국가 대한민국, 테스터 목록 「쿡매치 테스터」(본인 Gmail), 관리형 게시 꺼짐 → **검토를 위해 전송(2026-09-22)**. 승인되면 테스터 참여 링크가 생긴다.
- **다음**: ① 비공개 테스트 검토 결과(Gmail·Play Console) ② **BETA FLOW 결제** → 그룹 이메일을 「쿡매치 테스터」에 추가(앱 등록 패키지명 `kr.cookmatch.app` 확인) ③ 12명 이상 참여한 날부터 14일(테스터 의견·고친 내용을 날짜별 메모) ④ 프로덕션 액세스 신청(`store/PLAY_CONSOLE_ANSWERS.md` 10번) → 승인 뒤 정식 출시.
- **두 심사가 끝난 뒤 할 일**: iOS 푸시 발송 연결(.p8 → `backend/`, `.env`, `httpx[http2]`) 후 App Store 설명에 알림 문장 복원, 탈퇴 즉시 데이터 삭제(백엔드), 심사용 계정 비밀번호 변경(채팅 스크린샷에 노출됨), 맥에서 pull 후 iOS 다음 빌드(빌드 번호 5 이상)에 윈도우 수정분(챗봇 입력창 등) 포함.

## ✅ 2026-09-21 오전 — Google Play·네이버 둘 다 승인

- **Google Play 본인(신원) 인증 완료** — 2026-09-21 10:23, Gmail 920803hj@gmail.com 로 「본인 인증이 완료되었습니다」. → 아래 **A 「승인되면」 1번(전화번호 인증)부터** 진행.
- **네이버 로그인 검수 승인** — 2026-09-21 10:32, 네이버 메일 920803hj@naver.com 로 「'승인'이 완료되었습니다」(Client ID `jzjmqhoWiiZy6HEDR0Gi`, 앱 이름 CookMatch). 이제 테스터로 등록 안 된 일반 사용자도 네이버로 로그인 가능. → 아래 **B 「승인되면」 2번(낯선 네이버 계정으로 로그인 시험)**.
- 남은 외부 대기는 **Apple 심사** 하나.

## 지금 기다리는 것 (2026-09-21 기준) — 세 곳(→ 위와 같이 Google·네이버는 승인됨, Apple 만 남음)

| 곳 | 기다리는 것 | 어디로 오나 | 오면 할 일 |
|---|---|---|---|
| **Apple (App Store 심사)** | 심사 결과(최대 48시간) | Apple 메일 **920803hj@naver.com** (스팸함도), App Store Connect → 앱 심사 | **승인** → 자동 출시라 바로 공개된다(원치 않으면 미리 수동 출시로 변경). 공개되면 App Store 링크 확인·스크린샷 순서 확인. **반려** → 사유(가이드라인 번호)를 Claude 에게 보여 주고 같이 수정 → 새 빌드는 **빌드 번호 3** 부터 |
| **Google Play (개발자 신원 확인)** | 신원 확인 결과(며칠) | Gmail **920803hj@gmail.com**, Play Console 첫 화면 배너(「Google Play Console」로 검색, 스팸함) | **승인** → 전화번호 인증 → **앱 만들기** → 설문(`store/PLAY_CONSOLE_ANSWERS.md`)·스토어 원고·**스크린샷은 iOS 와 같은 AI 우선 순서**(STORE_LISTING 「소구 순서」) → `.aab` 를 비공개 테스트에 업로드 → 테스터 12명·14일(BETA FLOW) → 프로덕션 신청. 아래 A 참고 |
| **네이버 (로그인 검수)** | 검수 승인 | 네이버 개발자센터 → 내 애플리케이션(「개발 중」 배지가 사라지면 승인) | **승인** → 본인 계정이 아닌 네이버 계정으로 로그인 시험 → 통과하면 테스트 시작. **반려** → 사유 확인해 수정·재신청. 아래 B 참고 |

**기다리는 동안**: Apple 심사 중에는 **테스트 계정(`920803hj+review@gmail.com`)을 지우거나 비밀번호를 바꾸지 말고, 백엔드(Railway)를 크게 건드리지 않는다**(아래 D). 인스타그램 광고는 **AI 식단 → AI 사진 인식 → AI 챗봇** 순의 소구로 준비(AD_BRIEF.md). 승인·반려 소식이 오면 Claude 에게 알려 주면 그다음 단계를 같이 한다.

## 한눈에 보기

| 항목 | 상태 | 다음 |
|---|---|---|
| 안드로이드 앱(서명된 `.aab`) | 완료 | Play 승인 후 업로드 |
| 구글 로그인 | 프로덕션 게시 완료 | 낯선 계정으로 시험 |
| 카카오 로그인 | 설정 확인 완료 | 낯선 계정으로 시험 |
| 네이버 로그인 | **검수 승인(2026-09-21)** | 낯선 네이버 계정으로 시험 |
| Google Play 개발자 계정 | **본인 인증 완료(2026-09-21)** | 전화번호 인증 → 앱 만들기 |
| Apple Developer | **승인 완료·활성**(2026-09-19 계약 수락, 팀 ID `63N6U28LJR`, 개인, 갱신 2027-09-19) | Apple 메일은 **920803hj@naver.com** 로 옴 |
| Apple 설정(앱 ID·APNs 키·Firebase iOS) | **완료**(2026-09-20~21) | 아래 C 참고 |
| App Store Connect 앱·TestFlight 업로드 | **앱 등록 완료(`쿡매치 - 냉장고 레시피`, iOS 1.0)·빌드 1.0(2) 업로드·TestFlight 확인(2026-09-21)** | — |
| **App Store 심사** | **재제출 완료 — 심사 대기 중(2026-09-21 08:34 KST, 빌드 1.0(4))**. 1차(2.1 정보 요청)에 영문 답장 + 화면 녹화 첨부, 카메라 버그 2개 수정한 빌드로 교체 | Apple 메일(920803hj@naver.com) 기다리기(보통 48시간 이내). 승인 시 **자동 출시**. 아래 D |
| Sign in with Apple(iOS 심사 필수) | **완료 — TestFlight 실기기(아이폰)에서 로그인 성공(2026-09-21)** | — |
| Apple 토큰 취소(탈퇴 시, 가이드라인 5.1.1(v)) | **완료 — Railway 변수 3개 설정, 실기기 탈퇴 시 서버 로그 `Apple 토큰을 취소함`·탈퇴 200 확인(2026-09-21)** | 선택: 아이폰 설정 → Apple 계정 → 「Apple로 로그인」 목록에서 쿡매치가 사라졌는지 |
| iOS 시뮬레이터(맥) | 앱 화면·GNB·소셜 로그인 3종 앱 복귀까지 정상(2026-09-19) | 실제 아이폰 확인은 Apple 승인 뒤 |
| 테스터 12명·14일 | 계획: BETA FLOW 유료 대행(9,000원) | 앱·`.aab` 업로드 뒤 결제 |

## 1. 지금 할 수 있는 일 (기다리는 동안)

1. **맥북 세팅**: 앱스토어에서 Xcode 설치(오래 걸리니 먼저 걸어 둠) → Homebrew → `brew install node git` → `git clone https://github.com/nahyejin/RefrigeratorCode` → `cd RefrigeratorCode/frontend && npm install` → `npm run build` → `npx cap sync ios` → `npx cap open ios` → iPhone 시뮬레이터 선택 후 ▶. (유료 계정 없이 가능. 푸시·Sign in with Apple 은 승인 뒤)
2. **BETA FLOW 앱 등록 저장만**: 패키지명 **`kr.cookmatch.app`**(⚠ 예전에 com.cookmatch.app 으로 저장했다면 고칠 것 — Play 에서 그 이름이 이미 사용 중이라 2026-09-22 변경), 가격 무료. **결제는 아직 하지 않는다.**
3. **낯선 계정 로그인 시험**: 가족·지인의 구글·카카오 계정을 잠깐 빌려 가상 폰이나 PC 에서 로그인이 되는지 확인. (본인 계정은 소유자라 항상 통과해서 확인이 안 됨)
4. (선택) **공기계 실기기 테스트**: 개발자 옵션 → USB 디버깅 → PC 연결 → 푸시 알림 수신·카메라 확인.
5. (선택) 쿡매치 웹 가입자 7명 중 **안드로이드 사용자와 구글 이메일**을 받아 둔다(테스터 후보).

## 2. 기다리는 것과, 결과가 오면 할 일

### A. Google Play 신원 확인 (계정 이메일 920803hj@gmail.com 로 안내, 며칠)

**승인되면**
1. Play Console 홈 → 연락처 전화번호 인증 → "계정 세부정보로 이동" → 번호 확인 → 인증 → 문자·전화로 온 코드 입력.
2. **앱 만들기**: 이름 `쿡매치`, 한국어, 앱, 무료.
3. **설문은 [store/PLAY_CONSOLE_ANSWERS.md](store/PLAY_CONSOLE_ANSWERS.md) 를 보고 답한다.** 그 문서의 「0. 답하기 전에 정할 것」을 확인할 것(방침 반영·탈퇴 방식은 2026-09-19 처리 완료, 쿠팡 광고 공유 선언 여부는 제출 때 결정). [STORE_LISTING.md](store/STORE_LISTING.md) 원고를 칸별로 붙여넣기(이름·설명·아이콘·피처 그래픽·스크린샷·개인정보처리방침 URL·연락처 이메일). 데이터 보안·콘텐츠 등급·광고(쿠팡 포함=예) 설문도 채움. 계정 삭제 URL 은 개인정보처리방침 URL.
4. **`.aab`를 비공개 테스트 트랙에 업로드**: `frontend/android/app/build/outputs/bundle/release/app-release.aab`. (Play 앱 서명 사용을 권장·기본값으로 진행)
5. **BETA FLOW 결제·시작**: 서비스가 알려주는 그룹 이메일을 비공개 테스트 트랙의 테스터로 등록하고, 서비스 안내대로 옵트인 링크를 전달.
6. 테스트 기간(14~20일) 동안 버그를 고쳐 새 버전 업로드(아래 5번).
7. 14일 뒤 Play Console **프로덕션 신청**(테스트 피드백·개선 내용 작성) → Google 심사 → 통과하면 정식 출시.

**반려되면**: 이메일의 사유(신분증 흐림·이름 불일치·만료 등)를 확인해 재제출. 사유를 Claude 에게 보여주면 같이 정리.

### B. 네이버 로그인 검수 (네이버 개발자센터, 승인 대기)

**승인되면**
1. 개발자센터에서 앱의 "개발 중" 배지가 사라졌는지 확인.
2. 본인 계정이 아닌 네이버 계정으로 로그인이 되는지 시험.
3. 되면 BETA FLOW 테스트를 시작해도 됨(낯선 테스터도 네이버로 로그인 가능).

**반려되면**: 사유(서비스 URL·제공 정보 활용 설명·캡처 부적합 등)를 확인해 수정 후 재신청. 재신청 결과를 기다리는 동안 네이버 버튼을 숨기고 구글·카카오만으로 테스트를 시작할지 결정(코드 수정 필요, Claude 에게 요청).

### C. Apple Developer (계정은 활성 — 남은 건 실기기·출시 작업)

**완료(2026-09-20~21, 맥북)**
- Xcode 설치·라이선스 동의, Xcode 에 Apple ID 추가, `App` 타깃 Team = `63N6U28LJR`(자동 서명).
- developer.apple.com → Identifiers: **`com.cookmatch.app` 앱 ID 등록**(Sign in with Apple·Push Notifications 켬).
- Keys: **APNs 인증 키 `CookMatch APNs`** 생성(Key ID `Y4S77Z4YFG`, Sandbox & Production, Team Scoped). `.p8` 파일은 **한 번만 받을 수 있는 비밀키** — 채팅·git 에 올리지 말고 마이박스 등 비공개 곳에 백업(공유 링크 만들지 말 것). 잃으면 키를 새로 만들어야 함.
- Firebase(프로젝트 `CookMatch`): **iOS 앱 `CookMatch iOS`(`com.cookmatch.app`) 추가**, 클라우드 메시징에 **APNs 키 업로드**(개발·프로덕션 둘 다). `GoogleService-Info.plist` 는 받아 뒀지만 **아직 프로젝트에 넣지 않음**(푸시를 iOS 에 연결할 때).
- **Sign in with Apple 구현**(가이드라인 4.8): 아래 「Sign in with Apple」 참고.

**Xcode 에 뜨는 노란 경고 "Your team has no devices…"**: 개발용 프로파일은 **등록된 실기기가 있어야** 만들어지는데 아직 기기를 안 붙여서 나는 안내. **시뮬레이터 실행엔 영향 없음.** 케이블로 아이폰을 한 번 연결하면(개발자 모드 켜기) 사라지고 기기가 자동 등록된다. 케이블이 없으면 TestFlight 로 대신한다(아래).

**남은 일**
1. **백엔드 배포 확인**: 이번 푸시로 `backend/apple_signin.py`·`/api/auth/apple/native` 와 `requirements.txt` 의 `cryptography` 가 들어감. Railway 가 GitHub 푸시로 자동 배포하면 배포가 성공했는지(서버 로그에 import 오류 없는지) 확인. 자동 배포가 아니면 수동 배포. **→ 확인 완료(2026-09-21, 윈도우)**: 운영 서버 `POST /api/auth/apple/native` 가 빈 요청에 401 `Invalid Apple token` 으로 응답(배포됨·`cryptography` import 정상), 안드로이드 디버그 APK·서명된 릴리스 번들 빌드도 새 플러그인이 붙은 채 성공.
2. **Sign in with Apple 실기기 확인**: 시뮬레이터에서는 Apple 로그인 창이 제대로 안 뜰 수 있어 **실제 아이폰**이 필요. 케이블이 없으면 **TestFlight**: App Store Connect 에 앱 등록 → Xcode Product → Archive → 업로드 → 아이폰의 TestFlight 앱으로 설치(내부 테스트는 Apple 심사 없이 가능).
3. **Apple 토큰 취소 켜기(코드는 완료, 설정이 남음)** — 아래 「Apple 토큰 취소 켜기」 절차를 할 것. 안 하면 탈퇴해도 Apple 에 취소 요청이 가지 않아 **심사에서 걸릴 수 있다.**
4. **개인정보처리방침은 반영 완료(2026-09-21)** — 「Apple 로그인 연결 정보」 행과 탈퇴 시 취소 문장 추가. 남은 것: **App Store Connect 의 「앱 개인정보」(개인정보 라벨)**에 Apple 로그인으로 받는 이메일·이름·사용자 ID 반영(앱 등록할 때). **→ 방침(`LegalPage.tsx`, 개정일 2026-09-21)·`PLAY_CONSOLE_ANSWERS.md` 반영 완료. 남은 것: App Store Connect 개인정보 라벨 입력 때 Apple 로그인(이메일·이름) 항목 포함.**
5. **iOS 푸시 연결**: Firebase Messaging(SPM) 추가 + `AppDelegate` 에서 APNs 토큰→FCM 토큰 + `GoogleService-Info.plist` 를 Xcode `App` 타깃에 추가 + Push Notifications capability(`aps-environment`). 심사 필수는 아님 — Sign in with Apple 다음 순서. **→ 진행(2026-09-21 진행, 윈도우)**: 실기기에서 알림 스위치가 안 켜지던 원인이 `AppDelegate` 의 APNs 등록 연결(`didRegister…`/`didFail…`)과 `App.entitlements` 의 `aps-environment` 부재 — 둘 다 추가(Firebase iOS SDK 없이 Capacitor 플러그인만 쓰는 방식이라 위 Firebase Messaging 절차는 필요 없음). 발송은 `scripts/send_expiry_push_notifications.py` 가 APNs 로 직접 보냄. **남은 것: ① 맥에서 pull → 새 TestFlight 빌드 업로드 ② 맥의 APNs 키 `.p8` 를 윈도우 `backend/apns-auth-key.p8` 로 안전하게 옮기고 `backend/.env` 에 `APNS_KEY_ID=Y4S77Z4YFG`·`APNS_TEAM_ID=63N6U28LJR` 추가 ③ `pip install "httpx[http2]"`.**
6. App Store Connect 에 앱 등록 → TestFlight 확인 → 심사 제출(스크린샷·설명은 `store/`).

**TestFlight 업로드 (2026-09-21, 맥북) — 케이블 문제와 해결**
- 앱 등록: App Store Connect 신규 앱 — 이름 `쿡매치 - 냉장고 레시피`, 번들 ID `com.cookmatch.app`, SKU `cookmatch-ios-001`, iOS, 한국어. (이름은 심사 제출 전까지 바꿀 수 있음)
- **Archive 가 처음엔 실패**: "Your team has no devices…" — Xcode 가 Archive 때 먼저 만드는 **개발용 프로파일에 등록된 실기기가 필요**해서. 아이폰을 케이블로 연결하고 **개발자 모드**(설정 → 개인정보 보호 및 보안 → 개발자 모드, 재시동)를 켠 뒤, 명령줄로는 자동 등록이 안 돼서 **developer.apple.com → Devices 에 UDID 를 직접 등록**하니 통과. 등록된 기기: `iphone17pro`(연 100개 슬롯 중 1개). 한 번 등록되면 이후 케이블은 필요 없다.
- 명령줄 절차(Xcode 화면 대신, 같은 결과): `cd frontend/ios/App` → `xcodebuild -project App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath /tmp/cm-archive/App.xcarchive -allowProvisioningUpdates archive` → `xcodebuild -exportArchive -archivePath /tmp/cm-archive/App.xcarchive -exportOptionsPlist <method=app-store-connect, destination=upload, teamID=63N6U28LJR, signingStyle=automatic> -exportPath /tmp/cm-export -allowProvisioningUpdates`. (`/tmp` 은 맥을 재시작하면 지워짐.)
- `Info.plist` 에 `ITSAppUsesNonExemptEncryption = false` 추가(HTTPS 만 사용 → 업로드마다 뜨는 암호화 질문 생략).
- **새 버전을 올릴 때**는 빌드 번호(`CURRENT_PROJECT_VERSION`, 지금 1)를 올려야 한다(같은 번호는 거부). 새 앱 버전이면 `MARKETING_VERSION` 도.
- 다음: App Store Connect → 앱 → **TestFlight** 에서 빌드가 "처리 중" → 사용 가능이 되면(10~30분) **내부 테스트 그룹**을 만들어 본인 Apple ID 를 추가 → 아이폰의 TestFlight 앱에서 설치. 내부 테스트는 Apple 심사 없이 가능.

**실기기 확인 결과 (2026-09-21, TestFlight)**
- 아이폰 TestFlight 로 설치 → **Apple 로그인 성공, 앱 진입 확인**.
- 마이페이지 → 회원 탈퇴 → 백엔드 로그 `[Apple 로그인] 탈퇴 계정 id=77 의 Apple 토큰을 취소함` + `POST /api/auth/delete-account 200`. (로그는 MySQL 서비스가 아니라 **백엔드 서비스(RefrigeratorCode)** 의 Deployments → Deploy Logs 에 있다.)
- ⚠ Apple 이메일이 기존 계정 이메일과 같으면 그 기존 계정으로 연결돼 들어온다(`get_or_create_user`). 그 상태로 탈퇴하면 **진짜 계정이 탈퇴**되므로, 탈퇴 시험은 새로 만들어진 계정(`애플사용자_…`)으로만 할 것.

**빌드 1.0(2) 업로드 (2026-09-21, 맥북)**
- 윈도우가 만든 **iOS 푸시 연결**(`AppDelegate` 의 APNs 등록, `App.entitlements` 의 `aps-environment`)을 받아 **빌드 번호 2**(`CURRENT_PROJECT_VERSION = 2`)로 Archive → App Store Connect 업로드. 보관함에서 `aps-environment`·`applesignin` 권한 확인. 빌드 1.0(1)은 푸시가 없는 옛 빌드라 **쓰지 않는다**(App Store 심사에는 1.0(2) 이상을 선택).
- 새 빌드를 올릴 때마다 **빌드 번호를 1 올려야** 한다(지금 4).
- 남은 것: TestFlight 에서 1.0(2) 처리 완료 → 아이폰에 업데이트 → 마이페이지에서 알림을 켜고 발송 스크립트로 **실제 푸시 수신** 확인(윈도우 `backend/.env` 의 `APNS_KEY_ID`·`APNS_TEAM_ID`, `apns-auth-key.p8`, `httpx[http2]` 준비 필요).
- **스토어 문구**: iOS 푸시가 실기기에서 실제로 오는 걸 확인하기 전까지 App Store 설명·프로모션에서는 알림 문장을 뺀 `ios-desc`·`ios-promo` 를 쓴다([store/STORE_LISTING.md](store/STORE_LISTING.md)). 확인되면 Play 원고와 같은 문장으로 되돌릴 수 있다.

**Sign in with Apple — 만든 것(2026-09-21)**
- 서버: [backend/apple_signin.py](backend/apple_signin.py) 가 앱이 낸 identity token 을 Apple 공개키(RS256)로 검증(발급자·`aud`=`com.cookmatch.app`·만료·nonce). `POST /api/auth/apple/native`([app.py](backend/app.py))가 검증되면 쿡매치 로그인 토큰을 줌. 재로그인은 이메일이 아니라 Apple 사용자 고유값(`sub`)으로 찾음(Apple 은 이메일을 숨길 수 있어서). 로그인 수단은 `provider='apple'`.
- 앱: [nativeAuth.ts](frontend/src/utils/nativeAuth.ts) `signInWithAppleNative()`(플러그인 `@capacitor-community/apple-sign-in`), [Login.tsx](frontend/src/pages/Login.tsx) 에 **iOS 앱에서만** 맨 위에 검정 "Apple로 계속하기" 버튼. 웹·안드로이드에는 안 보임.
- iOS 설정: `App.entitlements`(Sign in with Apple)를 프로젝트에 연결. `DEVELOPMENT_TEAM=63N6U28LJR` 도 프로젝트에 저장됨.
- 검증: 가짜 Apple 키로 만든 토큰으로 잘못된 nonce·다른 앱용 토큰·다른 발급자·만료·위조 서명이 모두 거부됨을 확인. 앱은 시뮬레이터 빌드 성공·권한 삽입 확인. **실제 Apple 로그인 창은 실기기에서 아직 못 봄.**
- ⚠ 플러그인이 Capacitor 7 용으로 만들어져 `cap sync` 때 "built for Capacitor 7" 경고가 뜸(iOS 빌드는 성공). 안드로이드 쪽에도 플러그인이 붙으므로 **다음 안드로이드 빌드(`gradlew bundleRelease`)가 성공하는지 확인**할 것 — 문제가 되면 이 플러그인을 iOS 전용으로 격리.

**Apple 토큰 취소 켜기 (직접 해야 하는 설정)**

Apple 로그인으로 들어온 사람이 탈퇴하면 Apple 에도 "이 앱과의 연결을 끊는다"고 알려야 한다. 코드는 다 되어 있고(`apple_signin.py`, `app.py` `revoke_apple_token_for_user`), 아래 설정만 하면 켜진다. 설정이 없으면 토큰 저장·취소를 **건너뛸 뿐 로그인·탈퇴는 정상 동작**한다.
1. developer.apple.com → Certificates, Identifiers & Profiles → **Keys → +** → 이름 `CookMatch SignIn`, **Sign in with Apple** 체크 → 옆 **Configure** 에서 Primary App ID 로 `CookMatch (com.cookmatch.app)` 선택 → Save → Continue → Register → **`.p8` 다운로드**(APNs 키와 **다른 키**. 한 번만 받을 수 있음 — 비밀키라 채팅·git 금지, 비공개로 백업). **Key ID** 를 메모.
2. Railway → 백엔드 서비스 → Variables 에 추가:
   - `APPLE_TEAM_ID` = `63N6U28LJR`
   - `APPLE_SIGNIN_KEY_ID` = 1번의 Key ID
   - `APPLE_SIGNIN_PRIVATE_KEY` = `.p8` 파일 내용 전체(`-----BEGIN PRIVATE KEY-----` 부터 `-----END PRIVATE KEY-----` 까지. 여러 줄이 안 들어가면 줄바꿈을 `\n` 글자로 바꿔 한 줄로 넣어도 됨)
3. 저장하면 재배포된다. **이후에 Apple 로그인한 사람부터** 토큰이 저장된다(그 전에 로그인한 사람은 저장된 토큰이 없어 취소할 게 없음 — 아직 Apple 로그인 사용자는 없음).
4. 확인: TestFlight 앱에서 Apple 로그인 → 마이페이지 → 회원 탈퇴 → Railway 로그에 `Apple 토큰을 취소함` 이 찍히고, 아이폰 설정 → Apple 계정 → 로그인 및 보안 → **Apple로 로그인** 목록에서 쿡매치가 사라지는지 본다.
- 동작: 로그인 때 앱이 받은 1회용 `authorization code`(5분 유효)를 서버가 그 자리에서 refresh token 으로 바꿔 표 `apple_refresh_tokens`(계정당 1행)에 저장 → 탈퇴 시 Apple `auth/revoke` 호출 → 성공하면 행 삭제, 실패하면 행을 남기고 로그(`⚠`)만 남김(탈퇴는 막지 않음).

**지연되면**: 문제가 있으면 developer.apple.com/account 에서 상태 확인. 안드로이드 출시는 Apple 과 별개로 진행 가능.

### D. App Store 심사 제출 기록 (2026-09-21)

**제출한 것**: iOS 앱 1.0 (빌드 1.0(2)), 가격 무료(₩0), 버전 **자동 출시**(승인되면 바로 공개 — 안드로이드·광고 시점을 맞추려면 심사 통과 전에 「수동으로 버전 출시」로 바꿀 수 있다).

**입력한 내용**
- 이름 `쿡매치 - 냉장고 레시피`, 부제 `있는 재료로 오늘 저녁 해결`, 카테고리 음식 및 음료 / 라이프스타일, 키워드·프로모션·설명은 [store/STORE_LISTING.md](store/STORE_LISTING.md) 의 `ios-*` 블록(**푸시 알림 문장은 뺌** — iOS 푸시를 실기기에서 확인한 뒤 되돌릴 수 있음).
- 스크린샷 8장: **AI 식단 → AI 사진 인식 → AI 챗봇 → 매칭률 요리 → 곧 상할 재료 → 대체 재료 → 요리 모드 → 가족·절약** 순(STORE_LISTING 「소구 순서」). App Store 6.5" 칸은 1284×2778 만 받아 원본(1290×2796)을 줄여 올림.
- 지원 URL `https://refrigerator-code.vercel.app`, 마케팅 URL 은 쿡매치 인스타그램(`@Cook._.match`), 저작권 `2026 나혜진`.
- **연령 등급 4+**: 유해 콘텐츠 차단·나이 확인·제한 없는 웹·**사용자 생성 콘텐츠(아니요 — 가족 그룹은 비공개 공유)**·소셜 미디어·메시지/채팅 = 아니요, **광고 = 예**(쿠팡 파트너스). 의료 또는 치료 정보 = 없음, 건강·웰빙 주제 = 아니요.
- **콘텐츠 권한**: 타사 콘텐츠(유튜브·네이버 레시피) 권한 있음으로 답함(출처 링크 항상 표시, 공식 제휴 아님).
- **앱 개인정보(라벨) 게시**: 수집 8종 — 이름·이메일 주소·사진 또는 비디오·기타 사용자 콘텐츠·사용자 ID·기기 ID(전부 목적 앱 기능), 제품 상호 작용·기타 사용 데이터(앱 기능+분석). **모두 사용자에게 연결 = 예, 추적 = 아니요.**
- **심사용 테스트 계정**: 이메일 `920803hj+review@gmail.com`(Gmail 뒤에 +review — 비밀번호는 App Store Connect 에만 있음, 이 문서에 적지 않음). 메모는 영문: 로그인 없이 둘러볼 수 있음, 로그인 수단(Apple·Google·Kakao·Naver·이메일), 계정 삭제 경로(마이페이지 → 회원 탈퇴, Apple 로그인이면 Apple 연결도 해제), 카메라·앨범·푸시 사용, AI 주간 한도, 쿠팡 파트너스 링크, **네이티브 기능(카메라·앨범·푸시·Sign in with Apple)** 명시(가이드라인 4.2 대비).

**심사 중 지킬 것**
- **테스트 계정을 지우거나 비밀번호를 바꾸지 말 것**(로그인이 안 되면 반려).
- **백엔드(Railway)가 정상이어야 한다** — 심사관이 앱을 쓰는 동안 서버가 죽거나 로그인 API 가 깨지면 반려된다. 이 기간에는 큰 배포를 피하고, 부득이하면 로그인·탈퇴·AI 기능부터 확인.
- 반려되면 메일의 사유(가이드라인 번호)를 그대로 Claude 에게 보여 줄 것.
- 승인 뒤 **다음 빌드는 빌드 번호를 올려야** 한다(지금 2).

**심사 결과 1차: 「Guideline 2.1 - Information Needed」 (2026-09-21 04:54 KST 메일, 제출 후 2시간)**
- 앱이 반려된 게 아니라 **신규 개발자 계정이라 앱을 이해할 정보를 더 달라**는 요청. Apple 이 요구한 것: ① **실기기 화면 녹화**(앱 실행부터, 가입·로그인·**계정 삭제**·사용자 콘텐츠(신고·차단)·유료 기능이 있으면 포함) ② 앱 목적·대상 ③ 접근 방법·로그인 정보 ④ 외부 서비스 목록 ⑤ 지역별 차이 ⑥ 규제 산업·제3자 자료 증빙 — **답장으로 보내고 앱 심사 정보의 메모에도 같은 내용을 추가**.
- 답장에 쓸 영문 초안: 목적(냉장고 재료로 만들 요리 추천·식단·장보기 최소화), 접근(비회원 둘러보기 + 데모 계정), 외부 서비스(Sign in with Apple·Google·Kakao·Naver, Google Gemini·Groq, Apple 푸시, Railway·Vercel, YouTube Data API·네이버 블로그 공개글(출처 링크), 쿠팡 파트너스; 결제·인앱 구매 없음), 지역(한국어·전 지역 동일), 제3자 자료(공개 게시물 요약+출처 링크, 규제 산업 아님).
- **화면 녹화 요령**: 아이폰 화면 기록, TestFlight 빌드로. 앱 실행 → 비회원 둘러보기 → 카메라/앨범 재료 인식 → 요리 모드 → AI 식단·챗봇 → 이메일 로그인·Apple 로그인 → **회원 탈퇴는 방금 Apple 로 만든 새 계정으로만**(⚠ 심사용 테스트 계정 `920803hj+review@gmail.com` 은 지우지 말 것).

**⚠ 이 요청 덕에 찾은 진짜 버그 (2026-09-21)**: 아이폰 TestFlight 빌드에서 카메라 버튼을 누르면 "You are missing **NSPhotoLibraryAddUsageDescription** in your Info.plist" 로 실패. `@capacitor/camera` iOS 는 `NSCameraUsageDescription`·`NSPhotoLibraryUsageDescription`·`NSPhotoLibraryAddUsageDescription` **세 키가 모두 있어야** 카메라를 연다 — 셋째 키가 빠져 있었다(시뮬레이터에는 카메라가 없어 못 봤음). 심사관이 카메라를 눌렀다면 2.1 반려 사유. **`Info.plist` 에 셋째 키 추가**하고 **빌드 번호를 3 으로 올려 업로드**(빌드 1.0(2)는 쓰지 않는다). 교훈: 새 iOS 권한 기능은 **실제 아이폰**에서 눌러 본 뒤에 제출할 것.

**⚠ 카메라 버그 2 (같은 날, 빌드 3 에서 발견)**: 권한 키를 넣은 뒤에도 재료 사진 창의 **위쪽 타일 3개(영수증·음식 한 개·음식 여러 개)** 를 누르면 **아무 반응도, 오류도 없었다**(「사진 추가」로 앨범을 고르는 경로는 정상). 원인: 타일이 부르는 `Camera.getPhoto({source: Camera})` 는 `@capacitor/camera` 8 에서 **deprecated** 된 경로이고, 실기기(iPhone 17 Pro, iOS 26.6)에서 카메라를 열지 못한 채 조용히 멈췄다(권한 거부면 화면에 오류가 떴을 텐데 그것도 없었음). **수정**: [CameraCaptureSheet.tsx](frontend/src/components/CameraCaptureSheet.tsx) 의 `openCameraFor` 가 **iOS 에서는 새 API `Camera.takePhoto({ quality: 85 })`** 를 쓰게 함(안드로이드는 검증된 기존 `getPhoto` 그대로). 개발용 빌드를 아이폰에 직접 설치해 **타일로 카메라가 열리고 촬영되는 것 확인** → **빌드 번호 4** 로 업로드. 교훈: 시뮬레이터에 카메라가 없어 이런 오류는 **실기기에서만** 드러난다 — 앱 심사 제출 전에 카메라·푸시·Apple 로그인을 **아이폰에서 직접** 눌러 볼 것.


**재제출 (2026-09-21 08:34 KST)**: 「Information Needed」에 **영문 답장 + 아이폰 화면 녹화**(카카오톡으로 옮긴 mp4)를 보내고, 앱 버전의 빌드를 **1.0(2) → 1.0(4)** 로 바꿔 **다시 제출** → 상태 **심사 대기 중**. 앱 심사 정보 메모에도 답장의 2~6번(목적·접근·외부 서비스·지역·제3자 자료)을 넣음.
- **기다리는 동안**: 테스트 계정(`920803hj+review@gmail.com`)·백엔드 유지, 새 iOS 빌드 올리지 말 것(재제출한 빌드가 바뀌면 심사가 다시 시작될 수 있음).
- **다음에 또 정보를 요청하면**: 앱 심사 화면(App Review)의 메시지를 그대로 Claude 에게 보여 줄 것. 반려(가이드라인 번호)면 사유별로 수정 후 빌드 번호 5 부터.

**나중에 할 일 (메모)**
- **음성 대화**를 넣으면: 앱 개인정보에 오디오 데이터 추가, `Info.plist` 마이크·음성 인식 권한 문구, 방침·Play 데이터 보안에 음성 처리 반영.
- **결제**를 넣으면: 앱 개인정보에 구입 항목 추가, **iOS 는 Apple 인앱 결제(IAP) 필수**(가이드라인 3.1.1, 수수료 15~30%), 사업자등록·통신판매업 신고·청약철회·환불 조항(LegalPage.tsx 참고).
- **디지털 서비스법(DSA)**: EU 에 배포하려면 App Store Connect 에서 개인/사업자(trader) 여부를 밝혀야 함. 심사 제출은 막지 않았음.

## 3. 세 승인의 순서 관계

- **Google 승인**이 가장 먼저 필요(앱을 만들어야 테스트가 시작됨).
- **네이버 승인**은 테스트 시작 전이 이상적, 늦어도 프로덕션 신청 전.
- **Apple 승인**은 안드로이드와 별개.

## 4. 출시 후

- 스토어 리뷰·오류 모니터링, 카카오 회원 탈퇴 웹훅(User Unlinked) 설정 검토(개인정보 처리).

## 5. 새 버전을 올릴 때 (테스트 중 버그 수정 포함)

1. 코드를 고치고 `frontend` 에서 `npm run build` → `npx cap sync android`.
2. `frontend/android/app/build.gradle` 의 **`versionCode` 를 1 올림**(같은 번호는 업로드 거부).
3. `frontend/android` 에서 `gradlew bundleRelease`(JAVA_HOME 은 Android Studio 의 `jbr`) → 서명된 `.aab` 생성.
4. Play Console 비공개 테스트에 새 `.aab` 업로드.

## 6. 잃어버리면 안 되는 것

- **업로드 키스토어**: `C:\Users\user\CookMatchKeys` 폴더(`cookmatch-upload.jks` + `keystore.properties`). 사용자가 네이버 Box·개인 메일에 백업함(Box 공유 링크가 비공개인지 확인할 것). git 에는 올라가지 않음.
- **구글 로그인 OAuth 클라이언트**: Google Cloud 프로젝트 **My First Project**(`glassy-vial-424406-u7`) 의 `CookMatch Web Client_web`(ID `622855474105-…`). 게시 상태는 "프로덕션".
- **Firebase(푸시)**: 프로젝트 CookMatch(`gen-lang-client-0597760155`), `frontend/android/app/google-services.json`, 서비스 계정 키 `backend/firebase-service-account.json`(gitignore).
