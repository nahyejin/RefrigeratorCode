# 쿡매치 모바일 앱 출시 가이드

> **지금 남은 일·승인 대기·결과가 오면 할 일은 [RELEASE_TODO.md](RELEASE_TODO.md) 에 순서대로 정리돼 있다.**

## 개요
현재 React + Vite 기반 웹 애플리케이션을 안드로이드/iOS 네이티브 앱으로 변환하는 방법입니다.

## 출시 전 남은 작업 체크리스트 (2026-09-18 기준)

### 완료됨
- ✅ Capacitor 설치, 안드로이드 플랫폼 추가
- ✅ iOS 플랫폼 추가 (`npx cap add ios`) — 실제 빌드는 macOS+Xcode 필요, 아직 못 함
- ✅ 카메라를 진짜 네이티브 API로 교체 ([CameraCaptureSheet.tsx](frontend/src/components/CameraCaptureSheet.tsx), `@capacitor/camera`)
- ✅ iOS 권한 문구 추가 (Info.plist — `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription`)
- ✅ 유튜브 크롤러 API 키 재발급 + Railway 반영
- ✅ Railway DB 비밀번호 재발급 확인
- ✅ 계정 전환 시 장보기 메모·요리 계획 안 지워지던 문제 수정
- ✅ Railway `BACKEND_URL`이 네이버 콜백 경로까지 포함하고 있던 오설정 수정 (구글·카카오·네이버 로그인 전부에 영향 있었음) + 네이버 개발자센터 Callback URL 등록
- ✅ 네이버 로그인 실제 동작 확인 — 최종 원인은 네이버 개발자센터의 **"서비스 URL"이 백엔드(Railway) 주소로 등록돼 있던 것**. 실제로는 "네이버 로그인을 쓰는 서비스의 주소" = 프론트엔드 주소를 넣어야 해서, `https://refrigerator-code.vercel.app`(PC 웹·Mobile 웹 둘 다)로 정정 후 정상 동작 확인(2026-09-18). **Callback URL은 그대로 백엔드 주소 유지**(그건 원래도 맞았음) — 이 두 값의 역할이 다르다는 걸 헷갈리기 쉬우니 주의.

### 남은 작업 — 순서(의존관계 기준, 2026-09-18 정리)

**지금 바로 병행 시작 (서로 기다릴 필요 없음)**
1. **네이버 로그인 검수요청 — 제출 완료(2026-09-18), 승인 대기 중** — 제출 전에 [API 설정] 탭의 "제공 정보 선택"을 실제로 쓰는 항목(이메일 주소·별명)만 남기고 나머지(회원이름·성별·휴대전화번호 등)는 체크 해제 후 신청함. 승인 나면 "개발 중" 배지가 없어지고 테스터 등록 안 된 일반 사용자도 로그인 가능. **승인 여부는 나중에 다시 확인 필요.**
2. **푸시 알림 네이티브 전환 — 안드로이드 켬(2026-09-19), 실기기 수신 확인 대기.** Firebase 프로젝트는 계정 프로젝트 한도가 차 있어서 새로 만들지 않고 기존 Google Cloud 프로젝트 "CookMatch"(`gen-lang-client-0597760155`)에 Firebase 를 추가함(Spark 무료 요금제, 애널리틱스 끔). `google-services.json`·서비스 계정 키 배치, 키로 FCM 인증 성공 확인 후 `NATIVE_PUSH_ENABLED = true`. 남은 것: Android Studio 로 빌드해 실기기에서 알림 켜기 → 발송 배치로 실제 수신 확인. iOS는 Apple Developer 계정 + Mac 이 생긴 뒤(5단계).
3. **앱 아이콘·스크린샷·스토어 설명 — 준비 완료(2026-09-18).** `store/` 폴더: [STORE_LISTING.md](store/STORE_LISTING.md)(스토어 입력칸별 원고·글자 수 검사), `make_store_assets.py`(아이콘·피처 그래픽·스크린샷 생성). 앱 프로젝트 안 아이콘도 교체함(iOS는 Capacitor 기본 placeholder였음). **남은 것: 연락처 이메일 정하기, Sign in with Apple(iOS 필수, 4번 작업 때).**
   - iOS 는 **iPhone 전용**으로 설정(`TARGETED_DEVICE_FAMILY = 1`) — iPad 스크린샷·iPad 화면 심사 불필요.

**계정 만들기 (지금 바로, 승인에 며칠 걸림)**
- **Google Play Console** ($25): **가입 완료(2026-09-19). 신분증 제출·안드로이드 기기 확인은 끝났고 Google 신원 확인 검토 중(며칠, 결과는 이메일). 승인 뒤에 연락처 전화번호 인증을 하고 나면 "앱 만들기"가 열린다.** 계정 유형(개인/비즈니스)에 따라 **2023년 11월 이후 만든 개인 개발자 계정은 프로덕션(정식) 출시 전에 "비공개 테스트"를 테스터 12명 이상, 14일 연속으로 돌려야** 하는 조건이 붙을 수 있음 — 어느 유형으로 가입했는지 확인하고, 개인이라면 테스터 12명을 지금부터 미리 구해 둘 것(출시 일정에서 가장 오래 걸리는 부분).
- **Apple Developer Program** ($99/년): **가입·결제 완료(2026-09-19), 승인 대기 중.** 개인(Individual)으로 진행함. 승인되면 iOS 푸시(APNs 키)·Sign in with Apple·실제 iOS 빌드/출시에 쓸 수 있음.
- **Firebase**: 완료(위 2번 참고, 기존 Google Cloud 프로젝트에 추가함).

**그다음 (네이티브 빌드 전에 끝내둘 것)**
4. **네이티브 앱용 소셜 로그인(구글/카카오/네이버) — 코드 완료(2026-09-19), 실기기 확인 대기.** 애초 계획(각 콘솔에 Android/iOS 앱 환경 추가 + 네이티브 SDK)과 달리 **시스템 브라우저 방식**으로 만들어서 **구글·카카오·네이버 콘솔에 새로 등록할 것이 없다**(콜백 주소는 지금 것 그대로). 앱이 `@capacitor/browser`로 기존 웹 로그인 주소(`/api/auth/<provider>?app=1&challenge=...`)를 시스템 브라우저(Custom Tabs/SFSafariViewController)로 열고, 끝나면 서버가 `com.cookmatch.app://auth?code=...` 로 앱을 다시 연다. 앱 스킴은 다른 앱이 가로챌 수 있어서 토큰 대신 2분짜리 1회용 code 만 싣고, 앱이 처음에 만든 비밀값(verifier, PKCE)과 함께 `/api/auth/native/exchange` 에 내야 토큰을 준다. 코드: `backend/app.py`(네이티브 앱 소셜 로그인 절), `frontend/src/utils/nativeAuth.ts`, `components/NativeAuthBridge.tsx`, 안드로이드 매니페스트 intent-filter·iOS Info.plist URL scheme. **구글·카카오·네이버 모두 안드로이드 에뮬레이터에서 끝까지 확인함(2026-09-19, 백엔드는 Railway 배포 확인). 남은 것: iOS 시뮬레이터(맥)에서도 구글·카카오·네이버 로그인 후 앱 복귀까지 확인(2026-09-19, 사용자 확인). 실제 아이폰 확인은 Apple 승인 뒤.** 앱은 운영 서버를 부르므로 백엔드 배포가 먼저여야 앱 로그인이 된다.

**그다음**
5. **안드로이드 앱 서명(키스토어) + 릴리스 빌드 — 완료(2026-09-19).** 업로드 키를 `C:\Users\user\CookMatchKeys\cookmatch-upload.jks`(프로젝트 밖)에 만들고, 비밀번호는 같은 폴더·`frontend/android/keystore.properties`(둘 다 git 에 안 올라감)에 있다. `frontend/android`에서 `gradlew bundleRelease`(JAVA_HOME 은 Android Studio 의 `jbr`)를 돌리면 서명된 `app/build/outputs/bundle/release/app-release.aab` 가 나온다(Play Console 업로드용). **`CookMatchKeys` 폴더 전체를 클라우드·USB·비밀번호 관리자에 따로 백업할 것** — Play 앱 서명(권장, 기본)을 쓰면 잃어도 Google 지원을 통해 업로드 키를 재설정할 수 있지만 번거롭다. 앱을 새 버전으로 올릴 때마다 `app/build.gradle`의 `versionCode`를 1씩 올려야 한다(같은 번호는 업로드 거부).
6. **iOS 실제 빌드** — macOS + Xcode 필요 (이 윈도우 PC로는 불가, Mac 확보 필요).

**마지막**
7. **Google Play Console / App Store Connect 앱 등록 + 심사 제출**.

> 이 목록은 대화 중 나온 내용을 정리한 것으로, 실제 작업 시작 전 코드 상태를 다시 확인할 것.

## 푸시 알림 켜는 절차 (네이티브 앱)

구조: 앱이 FCM 토큰을 받아 서버(`/api/push/native/register`, 테이블 `push_device_tokens`)에
등록 → 매일 배치(`scripts/send_expiry_push_notifications.py --write`)가 웹 푸시 구독자와 함께
FCM HTTP v1 으로 보낸다. 알림을 누르면 `/my-fridge`로 이동(`NativePushBridge.tsx`).

**1. Firebase 프로젝트 만들기** (사용자)
- https://console.firebase.google.com → 프로젝트 추가 → 이름 `CookMatch` (Google Analytics는 꺼도 됨)

**2. 안드로이드 앱 등록** (사용자)
- 프로젝트 개요 → 앱 추가 → Android → 패키지 이름 **`com.cookmatch.app`** (SHA-1 은 비워도 됨)
- `google-services.json` 다운로드 → **`frontend/android/app/google-services.json`** 에 넣기
  (비밀키가 아니라 앱에 들어가는 설정 파일이라 git 에 올려도 된다)

**3. 발송용 서비스 계정 키** (사용자)
- 프로젝트 설정 → 서비스 계정 → "새 비공개 키 생성" → 받은 JSON 을
  **`backend/firebase-service-account.json`** 으로 저장 (이 컴퓨터에만. **비밀키 — 채팅·메신저로 공유 금지**, gitignore 됨)

**4. 켜기** (코드)
- `frontend/src/utils/push.ts` 의 `NATIVE_PUSH_ENABLED = true`
- `cd frontend && npm run build && npx cap sync`
- Android Studio 로 빌드해 실기기에서 마이페이지 → "유통기한 임박 알림" 켜기 →
  `python -u scripts/send_expiry_push_notifications.py --write` 로 실제 수신 확인
- ⚠ 순서 주의: 2번 파일 없이 스위치를 켜면 안드로이드 앱이 알림을 켜는 순간 강제 종료된다.

**5. iOS** (Apple Developer 계정 + Mac 필요, 나중에)
- Firebase 에 iOS 앱 추가(번들 ID `com.cookmatch.app`) → `GoogleService-Info.plist` 를 Xcode `App` 타깃에 추가
- Apple Developer → Keys → APNs 인증 키(.p8) 생성 → Firebase 프로젝트 설정 → 클라우드 메시징 → APNs 인증 키 업로드
- Xcode → Signing & Capabilities → **Push Notifications** 추가
- `@capacitor/push-notifications` 는 iOS 에서 **APNs 토큰**을 돌려주는데 서버는 FCM 으로 보내므로,
  Firebase Messaging(SPM)을 추가하고 `AppDelegate`에서 APNs 토큰을 FCM 토큰으로 바꿔 넘기는 코드가 필요
  (Capacitor 공식 가이드 "Using Push Notifications with Firebase" iOS 절). Mac 에서 빌드하며 작업.

## 추천 방법: Capacitor (가장 빠르고 효율적)

### 1. Capacitor 설치 및 설정

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
npx cap init
```

초기화 시 질문:
- App name: `쿡매치` 또는 `CookMatch`
- App ID: `com.cookmatch.app` (고유한 ID로 변경 가능)
- Web dir: `dist`

### 2. 빌드 설정

```bash
# 프로덕션 빌드
npm run build

# Capacitor에 빌드 결과물 동기화
npx cap sync
```

### 3. 안드로이드 앱 빌드

#### 사전 요구사항
- Android Studio 설치
- JDK 11 이상 설치
- Android SDK 설치

#### 빌드 과정
```bash
# Android 프로젝트 열기
npx cap open android

# Android Studio에서:
# 1. Build > Generate Signed Bundle / APK
# 2. APK 또는 AAB 선택
# 3. 키스토어 생성 (처음인 경우)
# 4. 빌드 완료
```

#### Google Play Console에 출시
1. [Google Play Console](https://play.google.com/console) 접속
2. 새 앱 만들기
3. 앱 정보 입력 (이름, 설명, 스크린샷 등)
4. AAB 파일 업로드
5. 스토어 등록 정보 작성
6. 검토 제출

### 4. iOS 앱 빌드

#### 사전 요구사항
- macOS (필수)
- Xcode 설치
- Apple Developer 계정 ($99/년)

#### 빌드 과정
```bash
# iOS 프로젝트 열기
npx cap open ios

# Xcode에서:
# 1. Signing & Capabilities에서 Team 설정
# 2. Product > Archive
# 3. App Store Connect에 업로드
```

#### App Store에 출시
1. [App Store Connect](https://appstoreconnect.apple.com) 접속
2. 새 앱 만들기
3. 앱 정보 입력
4. 빌드 업로드
5. 앱 심사 제출

## 대안 방법 1: PWA (Progressive Web App)

이미 일부 PWA 설정이 되어 있습니다. 완성도만 높이면 됩니다.

### 장점
- 별도 앱 스토어 심사 불필요
- 즉시 배포 가능
- 업데이트가 즉시 반영

### 단점
- iOS에서 제한적 (Safari에서만 설치 가능)
- 네이티브 기능 접근 제한

### PWA 현재 상태 (2026-08-26 실측)

| 항목 | 상태 |
|---|---|
| `frontend/public/manifest.json` | ✅ 있음 (이름·아이콘·테마색 `#FFD600`·standalone 설정 완료) |
| `frontend/public/sw.js` | ✅ 파일은 있음 |
| **Service Worker 등록 코드** | ❌ **없음** — `main.tsx` / `index.html` 어디에도 `register` 호출이 없어 실제로는 동작하지 않음 |
| 홈 화면 추가 안내 | ✅ 있음 (`HomeInstallPrompt` 컴포넌트, 7일 스누즈 지원) |
| HTTPS | ✅ Vercel 배포로 충족 |

**즉, 지금은 "설치는 되지만 오프라인 캐싱은 안 되는" 상태입니다.**
오프라인 지원까지 필요하면 서비스 워커 등록만 추가하면 됩니다.

```ts
// frontend/src/main.tsx 에 추가
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
```

다만 서비스 워커는 **한 번 등록되면 캐시가 남아 배포 후에도 옛 화면이 보이는 문제**를
일으킬 수 있으므로, 캐시 무효화 전략을 정한 뒤 넣는 것을 권합니다.

## 대안 방법 2: React Native (비추천)

완전히 재작성해야 하므로 시간이 많이 걸립니다.

## 권장 사항

### 단기 (빠른 출시)
1. **PWA 완성** - 웹 앱을 PWA로 완성하여 즉시 배포
2. **Capacitor로 네이티브 앱 빌드** - 사용자 경험 향상

### 장기
1. **Capacitor로 네이티브 기능 추가**
   - 푸시 알림
   - 카메라 (재료 사진 인식)
   - 오프라인 지원 강화

## 필요한 리소스

### 앱 아이콘
- 안드로이드: 48x48, 72x72, 96x96, 144x144, 192x192, 512x512
- iOS: 1024x1024 (App Store), 다양한 크기

### 스크린샷
- 안드로이드: 최소 2개, 권장 8개
- iOS: 다양한 기기 크기별 필요

### 앱 설명
- 짧은 설명 (80자)
- 긴 설명 (4000자)
- 키워드

## 비용

### 안드로이드
- Google Play 등록비: **$25 (일회성)**

### iOS
- Apple Developer Program: **$99/년**

## 다음 단계

1. Capacitor 설치 및 초기 설정
2. 빌드 테스트
3. 앱 스토어 계정 생성
4. 앱 정보 준비 (설명, 스크린샷 등)
5. 첫 빌드 및 업로드
6. 심사 제출

## 참고 자료

- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Google Play Console 가이드](https://support.google.com/googleplay/android-developer)
- [App Store Connect 가이드](https://developer.apple.com/app-store-connect/)

## 맥북에서 처음 할 일 (Apple 승인 전에도 가능)

1. **Xcode 설치**: 앱스토어에서 Xcode(10GB 이상, 오래 걸림). 설치 후 한 번 실행해 약관 동의·추가 구성요소 설치.
2. **개발 도구**: Homebrew → `brew install node git`.
3. **프로젝트 받기**: `git clone https://github.com/nahyejin/RefrigeratorCode` → `cd RefrigeratorCode/frontend` → `npm install`.
4. **iOS 프로젝트 열기**: `npm run build` → `npx cap sync ios` → `npx cap open ios` (Xcode 가 열림). Capacitor 8 은 Swift Package Manager 를 써서 CocoaPods 는 필요 없음.
5. **시뮬레이터로 실행**: Xcode 위쪽에서 iPhone 시뮬레이터를 고르고 ▶. **유료 계정 없이** 화면·네이티브 소셜 로그인(사파리 뷰 → `com.cookmatch.app://auth` 복귀)을 확인할 수 있다. 푸시(APNs)·Sign in with Apple 은 시뮬레이터/무료 계정으로 안 됨.
6. **Apple 승인 후**: Xcode → Settings → Accounts 에 Apple ID 추가 → 프로젝트 Signing & Capabilities 에서 Team 선택, 번들 ID `com.cookmatch.app`, Sign in with Apple·Push Notifications capability 추가 → 실제 아이폰에 설치해 확인.

### 맥북 매일 작업 순서 (윈도우에서 푸시한 뒤 iOS 로 확인할 때)

맥의 코드는 GitHub 에서 받은 **사본**이다(원본은 GitHub, 윈도우·맥이 각자 사본을 가짐). 맥에서 코드를 고치지 않는 한 커밋할 것은 없고, **pull → 빌드 → 동기화 → ▶** 만 하면 된다. 터미널에서:

```bash
cd ~/Developer/RefrigeratorCode && git pull
cd frontend && npm install && npm run build && npx cap sync ios
```

그다음 Xcode(`npx cap open ios`)에서 ▶. 맥에서 iOS 전용 파일(`frontend/ios/`)을 고쳤으면 맥에서 커밋·푸시하고 윈도우에서 `git pull`(맥에 GitHub 로그인이 되어 있음: `gh auth login` 으로 함).

- **Xcode 26+ 시뮬레이터**: `Simulator.app` 대신 **DeviceHub** 창에 뜬다. 첫 부팅이 몇 분 걸리고, 검은 화면·"Live device view took longer than expected"(오류 4002)가 나면 `killall -9 com.apple.CoreSimulator.CoreSimulatorService` 후 다시 실행하면 풀렸다.
- **iOS 상태바**: `capacitor.config.ts` 의 `ios.contentInset: 'always'` + [SceneDelegate.swift](frontend/ios/App/App/SceneDelegate.swift) 의 흰색 덮개로 고정 GNB 가 상태바에 가려지지 않게 함.
- **Apple 개발자 설정(2026-09-20~21)**: 앱 ID `com.cookmatch.app`(Sign in with Apple·Push), APNs 키(Key ID `Y4S77Z4YFG`, `.p8` 은 비밀키라 git·채팅 금지·따로 백업), Firebase iOS 앱 등록·APNs 키 업로드. 자세한 내용과 남은 일은 [RELEASE_TODO.md](RELEASE_TODO.md) C항.
- **실기기 없이 실기기 확인**: 케이블이 없으면 TestFlight(Archive → App Store Connect 업로드)로 아이폰에 설치.

## 소셜 로그인 "다른 사용자도 되는지" 점검 (2026-09-19)

- **구글**: 로그인용 OAuth 클라이언트(`CookMatch Web Client_web`, ID `622855474105-…`)는 Google Cloud 프로젝트 **My First Project**(`glassy-vial-424406-u7`)에 있다(Firebase 용 CookMatch·RefrigeratorCode 프로젝트가 아님). **게시 상태가 "테스트 중"(테스트 사용자 0명)이라 프로젝트 소유자 본인 말고는 로그인이 안 되는 상태였다 → 2026-09-19 브랜딩(앱 이름·지원 이메일·홈페이지·개인정보처리방침·약관·승인된 도메인 2개, 로고 없음)을 채우고 "앱 게시"로 "프로덕션 단계"로 바꿈(인증 심사 필요 없음: 도메인 10개 이하·로고 없음·기본 권한 openid email profile 만 사용).** 남은 것: 본인이 아닌 구글 계정으로 실제 로그인이 되는지 확인.
- **카카오**: 2026-09-19 설정 확인 — 앱 "Cookmatch"(ID 1359747)는 **비즈 앱**, 카카오 로그인 **ON**, 동의항목 닉네임 **필수 동의**·카카오계정(이메일) **필수 동의 [수집]**(그 외 이름·전화번호 등은 권한 없음, 쓰지 않음). 설정상 문제 없음. 남은 것: 본인(앱 소유자)이 아닌 카카오 계정으로 실제 로그인 확인. 참고: 일반 페이지에 "회원 탈퇴 웹훅(User Unlinked) 설정 권장" 안내가 있음(출시 필수 아님, 나중에 개인정보 처리 때).
- **네이버**: 검수요청 제출 완료, 승인 대기(승인 전에는 개발자센터에 등록된 계정만 로그인).

