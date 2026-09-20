# 쿡매치 출시 — 남은 일 (2026-09-21 기준)

상세 배경은 [MOBILE_APP_GUIDE.md](MOBILE_APP_GUIDE.md), 스토어 원고는 [store/STORE_LISTING.md](store/STORE_LISTING.md).

## 한눈에 보기

| 항목 | 상태 | 다음 |
|---|---|---|
| 안드로이드 앱(서명된 `.aab`) | 완료 | Play 승인 후 업로드 |
| 구글 로그인 | 프로덕션 게시 완료 | 낯선 계정으로 시험 |
| 카카오 로그인 | 설정 확인 완료 | 낯선 계정으로 시험 |
| 네이버 로그인 | **검수 승인 대기** | 승인 뒤 낯선 계정으로 시험 |
| Google Play 개발자 계정 | **신원 확인 검토 중** | 승인 메일 → 전화번호 인증 → 앱 만들기 |
| Apple Developer | **승인 완료·활성**(2026-09-19 계약 수락, 팀 ID `63N6U28LJR`, 개인, 갱신 2027-09-19) | Apple 메일은 **920803hj@naver.com** 로 옴 |
| Apple 설정(앱 ID·APNs 키·Firebase iOS) | **완료**(2026-09-20~21) | 아래 C 참고 |
| App Store Connect 앱·TestFlight 업로드 | **앱 등록 완료(`쿡매치 - 냉장고 레시피`, iOS 1.0)·빌드 1.0(1) 업로드함(2026-09-21)** | 처리 끝나면 내부 테스터로 본인 추가 → 아이폰 TestFlight 로 설치·Apple 로그인·탈퇴 확인 |
| Sign in with Apple(iOS 심사 필수) | **코드 작성 완료·푸시함, 실기기 확인 대기** | 백엔드 배포 확인 → TestFlight 로 실기기 확인 |
| Apple 토큰 취소(탈퇴 시, 가이드라인 5.1.1(v)) | **코드 작성 완료(2026-09-21)** — 단 **Sign in with Apple 키를 만들어 Railway 변수 3개를 넣어야 동작** | 아래 C 「Apple 토큰 취소 켜기」 |
| iOS 시뮬레이터(맥) | 앱 화면·GNB·소셜 로그인 3종 앱 복귀까지 정상(2026-09-19) | 실제 아이폰 확인은 Apple 승인 뒤 |
| 테스터 12명·14일 | 계획: BETA FLOW 유료 대행(9,000원) | 앱·`.aab` 업로드 뒤 결제 |

## 1. 지금 할 수 있는 일 (기다리는 동안)

1. **맥북 세팅**: 앱스토어에서 Xcode 설치(오래 걸리니 먼저 걸어 둠) → Homebrew → `brew install node git` → `git clone https://github.com/nahyejin/RefrigeratorCode` → `cd RefrigeratorCode/frontend && npm install` → `npm run build` → `npx cap sync ios` → `npx cap open ios` → iPhone 시뮬레이터 선택 후 ▶. (유료 계정 없이 가능. 푸시·Sign in with Apple 은 승인 뒤)
2. **BETA FLOW 앱 등록 저장만**: 패키지명 `com.cookmatch.app`, 가격 무료. **결제는 아직 하지 않는다.**
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
