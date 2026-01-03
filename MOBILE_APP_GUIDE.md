# 쿡매치 모바일 앱 출시 가이드

## 개요
현재 React + Vite 기반 웹 애플리케이션을 안드로이드/iOS 네이티브 앱으로 변환하는 방법입니다.

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

### PWA 완성하기

1. **Service Worker 설정 확인**
   - `frontend/package.json`에 이미 `workbox-cli`가 있음
   - `workbox-config.js` 파일 생성 필요

2. **manifest.json 완성**
   - 아이콘 추가 (다양한 크기)
   - 스플래시 스크린 설정

3. **HTTPS 필수**
   - 프로덕션 환경에서만 작동

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



