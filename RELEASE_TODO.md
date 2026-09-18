# 쿡매치 출시 — 남은 일 (2026-09-19 기준)

상세 배경은 [MOBILE_APP_GUIDE.md](MOBILE_APP_GUIDE.md), 스토어 원고는 [store/STORE_LISTING.md](store/STORE_LISTING.md).

## 한눈에 보기

| 항목 | 상태 | 다음 |
|---|---|---|
| 안드로이드 앱(서명된 `.aab`) | 완료 | Play 승인 후 업로드 |
| 구글 로그인 | 프로덕션 게시 완료 | 낯선 계정으로 시험 |
| 카카오 로그인 | 설정 확인 완료 | 낯선 계정으로 시험 |
| 네이버 로그인 | **검수 승인 대기** | 승인 뒤 낯선 계정으로 시험 |
| Google Play 개발자 계정 | **신원 확인 검토 중** | 승인 메일 → 전화번호 인증 → 앱 만들기 |
| Apple Developer | **승인 대기** | 승인 메일 → 맥북에서 iOS 작업 |
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
3. **설문은 [store/PLAY_CONSOLE_ANSWERS.md](store/PLAY_CONSOLE_ANSWERS.md) 를 보고 답한다.** 그 문서의 「0. 답하기 전에 정할 것」(방침에 카카오·네이버·푸시 반영, 탈퇴 방식, 쿠팡 광고 선언)을 **제출 전에** 끝낼 것. [STORE_LISTING.md](store/STORE_LISTING.md) 원고를 칸별로 붙여넣기(이름·설명·아이콘·피처 그래픽·스크린샷·개인정보처리방침 URL·연락처 이메일). 데이터 보안·콘텐츠 등급·광고(쿠팡 포함=예) 설문도 채움. 계정 삭제 URL 은 개인정보처리방침 URL.
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

### C. Apple Developer 승인 (이메일)

**승인되면 (맥북에서)**
1. Xcode → Settings → Accounts 에 Apple ID 추가.
2. 프로젝트 Signing & Capabilities: Team 선택, 번들 ID `com.cookmatch.app` 확인, **Sign in with Apple**·**Push Notifications** capability 추가.
3. **Sign in with Apple 구현**(구글·카카오·네이버 로그인을 제공하는 앱은 iOS 심사 필수, 가이드라인 4.8) — 코드는 Claude 와 함께.
4. Apple Developer → Keys 에서 **APNs 인증 키(.p8)** 생성 → Firebase 프로젝트 설정 → 클라우드 메시징에 업로드. Firebase 에 iOS 앱(번들 ID `com.cookmatch.app`) 추가, `GoogleService-Info.plist` 를 Xcode `App` 타깃에 추가.
5. **실제 아이폰**에 설치해 로그인·푸시 확인.
6. App Store Connect 에 앱 등록 → TestFlight 확인 → 심사 제출.

**지연되면**: 가입 후 며칠이 지나도 소식이 없으면 developer.apple.com/account 에서 상태 확인(신원 확인 전화·이메일을 놓치지 말 것), 48시간 넘으면 Apple 지원에 문의. 안드로이드 출시는 Apple 과 별개로 진행 가능.

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
