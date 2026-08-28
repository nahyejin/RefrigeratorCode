# Capacitor 설정 가이드

## 1단계: Capacitor 설치

```bash
cd frontend
npm install @capacitor/core @capacitor/cli
npm install @capacitor/android @capacitor/ios
```

## 2단계: Capacitor 초기화

```bash
npx cap init
```

질문에 답변:
- **App name**: `쿡매치` 또는 `CookMatch`
- **App ID**: `com.cookmatch.app` (고유한 ID로 변경 가능, 예: `com.yourname.cookmatch`)
- **Web dir**: `dist`

## 3단계: 프로덕션 빌드

```bash
npm run build
```

## 4단계: Capacitor에 빌드 결과물 동기화

```bash
npx cap sync
```

이 명령어는:
- `dist` 폴더의 빌드 결과물을 네이티브 프로젝트에 복사
- 네이티브 프로젝트의 의존성을 업데이트
- 플러그인을 동기화

## 5단계: 안드로이드 앱 빌드

### 사전 요구사항
1. [Android Studio](https://developer.android.com/studio) 설치
2. JDK 11 이상 설치
3. Android SDK 설치 (Android Studio에서 자동 설치)

### 빌드 과정

```bash
# Android 프로젝트 열기
npx cap open android
```

Android Studio에서:
1. **프로젝트 열기**: `android` 폴더가 자동으로 열림
2. **Gradle 동기화**: 자동으로 진행되거나 "Sync Now" 클릭
3. **빌드 설정**:
   - `app/build.gradle`에서 `versionCode`와 `versionName` 확인
   - `minSdkVersion` 확인 (최소 22 이상 권장)
4. **서명 키 생성** (처음인 경우):
   - Build > Generate Signed Bundle / APK
   - APK 또는 AAB 선택
   - Create new keystore 클릭
   - 키스토어 정보 입력 및 저장
5. **빌드**:
   - Release 빌드 선택
   - 빌드 완료 후 `app/release/app-release.aab` 또는 `app-release.apk` 생성

### Google Play Console에 출시

1. [Google Play Console](https://play.google.com/console) 접속
2. **새 앱 만들기** 클릭
3. **앱 정보 입력**:
   - 앱 이름: 쿡매치
   - 기본 언어: 한국어
   - 앱 또는 게임: 앱
   - 무료 또는 유료: 무료
4. **스토어 등록 정보** 작성:
   - 짧은 설명 (80자)
   - 전체 설명 (4000자)
   - 그래픽 자산 (아이콘, 스크린샷)
5. **AAB 파일 업로드**:
   - 프로덕션 > 새 버전 만들기
   - AAB 파일 업로드
6. **콘텐츠 등급** 설정
7. **가격 및 배포** 설정
8. **검토 제출**

## 6단계: iOS 앱 빌드

### 사전 요구사항
1. **macOS** (필수)
2. [Xcode](https://developer.apple.com/xcode/) 설치
3. [Apple Developer 계정](https://developer.apple.com/programs/) ($99/년)

### 빌드 과정

```bash
# iOS 프로젝트 열기
npx cap open ios
```

Xcode에서:
1. **프로젝트 열기**: `ios/App/App.xcworkspace` 열림
2. **Signing & Capabilities** 설정:
   - Team 선택 (Apple Developer 계정)
   - Bundle Identifier 확인 (`com.cookmatch.app`)
3. **빌드 설정**:
   - Product > Scheme > App 선택
   - Product > Destination > Any iOS Device 선택
4. **Archive 생성**:
   - Product > Archive
   - 빌드 완료 후 Organizer 창 열림
5. **App Store Connect에 업로드**:
   - "Distribute App" 클릭
   - App Store Connect 선택
   - 업로드 완료

### App Store Connect에 출시

1. [App Store Connect](https://appstoreconnect.apple.com) 접속
2. **새 앱 만들기**:
   - 앱 이름: 쿡매치
   - 기본 언어: 한국어
   - 번들 ID: `com.cookmatch.app`
   - SKU: 고유한 식별자
3. **앱 정보** 입력:
   - 카테고리: Food & Drink
   - 연령 등급 설정
4. **앱 스토어 정보** 작성:
   - 이름, 부제목, 설명
   - 키워드
   - 스크린샷 (다양한 기기 크기)
   - 앱 아이콘 (1024x1024)
5. **빌드 선택**:
   - 업로드된 빌드 선택
6. **심사 제출**

## 7단계: Capacitor 설정 파일 수정

`capacitor.config.ts` 파일 생성/수정:

```typescript
import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cookmatch.app',
  appName: '쿡매치',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: "#FFD600",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      iosSpinnerStyle: "small",
      spinnerColor: "#FFD600"
    }
  }
};

export default config;
```

## 8단계: 네이티브 기능 추가 (선택사항)

### 푸시 알림
```bash
npm install @capacitor/push-notifications
npx cap sync
```

### 카메라
```bash
npm install @capacitor/camera
npx cap sync
```

### 파일 시스템
```bash
npm install @capacitor/filesystem
npx cap sync
```

## 주의사항

1. **API URL 설정**: 프로덕션 API URL이 올바르게 설정되어 있는지 확인
2. **CORS 설정**: 백엔드에서 모바일 앱의 요청을 허용하도록 설정
3. **HTTPS**: 프로덕션 환경에서는 반드시 HTTPS 사용
4. **테스트**: 실제 기기에서 충분히 테스트 후 출시

## 빌드 후 업데이트 프로세스

코드 변경 후:
```bash
npm run build
npx cap sync
npx cap open android  # 또는 ios
```

## 문제 해결

### Android 빌드 오류
- Gradle 버전 확인
- SDK 버전 확인
- `android/gradle.properties` 확인

### iOS 빌드 오류
- Xcode 버전 확인
- Signing 설정 확인
- CocoaPods 업데이트: `cd ios && pod install`

## 참고 자료

- [Capacitor 공식 문서](https://capacitorjs.com/docs)
- [Android 개발 가이드](https://developer.android.com/guide)
- [iOS 개발 가이드](https://developer.apple.com/documentation/)

## (향후 계획) 홈 화면 위젯

네이티브 앱 출시 이후에 검토할 아이디어. 지금의 PWA/웹 코드로는 만들 수
없고, 이 문서의 앱스토어 빌드가 끝난 뒤 각 플랫폼에 별도 네이티브 코드를
더 얹어야 나올 수 있는 기능이다.

- **형태**: 1x1 크기의 작은 위젯. `내냉장고`의 카메라 버튼과 같은 아이콘에
  "COOKMATCH" 배지를 얹은 모양. 홈 화면에서 이 위젯을 누르면 앱을 거치지
  않고 바로 `CameraCaptureSheet`의 "무엇을 찍을까요?" 선택 화면이 뜬다.
  (영수증/음식1개/음식여러개/앨범 4개를 한 번에 보여주는 4x1 형태도
  검토했지만, 아이콘 하나로 진입점만 제공하는 1x1 쪽이 더 낫다고 판단)
- **필요한 것**:
  - iOS: WidgetKit(Swift/SwiftUI) 익스텐션을 Xcode 프로젝트에 추가, 앱과
    위젯 사이에 딥링크(예: `cookmatch://camera`)로 카메라 시트를 바로
    열도록 연결. Xcode 빌드가 필요하므로 Mac 필요(기존 계획과 동일한 제약)
  - Android: `AppWidgetProvider` + 위젯 레이아웃 XML을 Capacitor Android
    프로젝트에 추가, 탭 시 같은 딥링크로 앱을 열도록 연결
- **완료 레시피 달력 위젯(아이디어)**: 아래 "완료 레시피 달력" 기능이
  먼저 만들어지면, 그 축약판(이번 달 완료 개수, 오늘 완료한 레시피 등)을
  위젯으로도 보여줄 수 있다 — 카메라 위젯과 별개의 두 번째 위젯이 된다.



