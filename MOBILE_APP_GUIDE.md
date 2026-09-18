# 쿡매치 모바일 앱 출시 가이드

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
1. **네이버 로그인 검수요청 제출·승인** — CookMatch 앱이 아직 "개발 중" 상태. 이 상태에서는 "멤버관리"에 등록한 테스터 계정만 로그인되고, 실제 신규 사용자는 전부 막힘. developers.naver.com → CookMatch → **"네이버 로그인 검수요청"** 버튼 제출 → 승인이 나야 일반 사용자도 로그인 가능. 승인까지 시간이 걸릴 수 있어 **가장 먼저 신청부터 해 둘 것** — 다른 작업과 동시에 진행 가능.
2. **푸시 알림 네이티브 전환 착수** — Firebase 프로젝트 생성(사용자 계정 작업)부터 시작. 지금은 웹 푸시(Web Push)뿐, `@capacitor/push-notifications`는 설치만 되어 있고 연결 코드 없음. 아래 3번(네이티브 로그인)과 무관하게 지금 시작 가능.
3. **앱 아이콘·스크린샷·스토어 설명 준비** — 안드로이드/iOS 각 사이즈별(하단 "필요한 리소스" 참고). 코드 작업과 무관, 지금 준비 가능.

**그다음 (네이티브 빌드 전에 끝내둘 것)**
4. **네이티브 앱용 소셜 로그인(구글/카카오/네이버) 딥링크 처리** — 지금 등록한 서비스 URL/Callback URL은 **웹 브라우저 로그인 전용**. 네이티브 앱(안드로이드/iOS)은 앱 내부가 인터넷 주소가 아니라 로컬 번들(`capacitor://localhost` 등)이라 이 방식을 그대로 못 씀 — 별도로 구글/카카오/네이버 각 콘솔에 "Android 앱"/"iOS 앱" 환경(패키지명+서명 키 해시, Bundle ID로 등록하는 방식)을 추가하고, 로그인 후 앱으로 돌아오는 딥링크(또는 각사 네이티브 SDK) 코드를 붙여야 함. **기존 웹 설정을 바꾸는 게 아니라 새 환경을 추가하는 작업.** 아직 구현 안 됨 — 이 작업을 먼저 끝내야 빌드를 반복하지 않음.

**그다음**
5. **안드로이드 앱 서명(키스토어) 생성 + 실제 빌드** — Android Studio에서 `Generate Signed Bundle/AAB`.
6. **iOS 실제 빌드** — macOS + Xcode 필요 (이 윈도우 PC로는 불가, Mac 확보 필요).

**마지막**
7. **Google Play Console / App Store Connect 앱 등록 + 심사 제출**.

> 이 목록은 대화 중 나온 내용을 정리한 것으로, 실제 작업 시작 전 코드 상태를 다시 확인할 것.

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



