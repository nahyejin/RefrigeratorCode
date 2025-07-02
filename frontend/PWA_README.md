# 쿡매치 PWA (Progressive Web App) 가이드

## 🚀 PWA 기능 개요

쿡매치는 이제 PWA(Progressive Web App)로 변환되어 다음과 같은 기능을 제공합니다:

### ✨ 주요 PWA 기능

1. **홈화면 설치**
   - 브라우저에서 "홈화면에 추가" 또는 "앱 설치" 가능
   - 독립적인 앱처럼 실행

2. **오프라인 지원**
   - 인터넷 연결이 없어도 기본 기능 사용 가능
   - 이전에 본 레시피 캐시 저장

3. **푸시 알림**
   - 새로운 레시피 알림
   - 재료 유통기한 알림

4. **앱과 같은 사용자 경험**
   - 스플래시 스크린
   - 네이티브 앱과 유사한 UI/UX

## 📱 설치 방법

### Chrome/Edge (데스크톱)
1. 브라우저에서 쿡매치 웹사이트 접속
2. 주소창 옆의 설치 아이콘(⬇️) 클릭
3. "설치" 클릭

### Chrome (Android)
1. Chrome 브라우저에서 쿡매치 접속
2. 주소창 옆 설치 아이콘(⬇️) 탭
3. "설치" 선택

### Safari (iOS)
1. Safari에서 쿡매치 접속
2. 하단 공유 버튼(□↑) 탭
3. "홈 화면에 추가" 선택
4. "추가" 탭

## 🧪 PWA 테스트 방법

### 1. 개발 서버 실행
```bash
cd frontend
npm run dev
```

### 2. 브라우저에서 테스트
- Chrome DevTools → Application 탭
- Service Workers 확인
- Manifest 확인
- Cache Storage 확인

### 3. PWA 테스트 페이지
- `/pwa-test` 경로에서 PWA 기능 테스트
- 설치 상태, 오프라인 기능, 알림 권한 확인

### 4. 오프라인 테스트
1. Chrome DevTools → Network 탭
2. "Offline" 체크박스 활성화
3. 페이지 새로고침하여 오프라인 동작 확인

## 🔧 PWA 구성 요소

### 1. Manifest (`public/manifest.json`)
```json
{
  "name": "쿡매치 - 냉장고 재료로 맛있는 요리",
  "short_name": "쿡매치",
  "display": "standalone",
  "theme_color": "#FFD600",
  "background_color": "#FFD600"
}
```

### 2. Service Worker (`public/sw.js`)
- 오프라인 캐싱
- 백그라운드 동기화
- 푸시 알림 처리

### 3. PWA 유틸리티 (`src/utils/pwa.ts`)
- 설치 프롬프트 관리
- 알림 권한 요청
- 오프라인 상태 감지

### 4. PWA 컴포넌트
- `PWAInstallPrompt`: 설치 유도 프롬프트
- `OfflineIndicator`: 오프라인 상태 표시
- `PWAInstallGuide`: 설치 가이드

## 📊 성능 모니터링

### PWA 분석 (`src/utils/pwaAnalytics.ts`)
- 설치율 추적
- 오프라인 사용률
- 캐시 히트율
- 사용자 참여도

### Core Web Vitals
- LCP (Largest Contentful Paint)
- FID (First Input Delay)
- CLS (Cumulative Layout Shift)

## 🚀 배포 및 빌드

### PWA 빌드
```bash
npm run build:pwa
```

### 워크박스 설정
- `public/workbox-config.js`에서 캐싱 전략 설정
- 정적 리소스, API 요청별 캐싱 정책

## 🔍 문제 해결

### 설치가 안 되는 경우
1. HTTPS 연결 확인
2. 브라우저 버전 업데이트
3. 팝업 차단 해제
4. 다른 브라우저 시도

### 오프라인 기능이 작동하지 않는 경우
1. Service Worker 등록 확인
2. 캐시 정리 후 재시도
3. 브라우저 캐시 삭제

### 알림이 오지 않는 경우
1. 알림 권한 확인
2. 브라우저 설정에서 알림 허용
3. 방해 금지 모드 해제

## 📈 다음 단계

### 1주차 완료 사항
- ✅ PWA 매니페스트 설정
- ✅ 서비스 워커 구현
- ✅ 설치 프롬프트 추가
- ✅ 오프라인 기능 구현
- ✅ 성능 모니터링 설정

### 2-5주차 계획
- React Native 개발 환경 구축
- 네이티브 앱 기능 구현
- 앱스토어 출시 준비

## 🎯 성과 목표

- **1-2개월 내**: PWA 사용자 1,000명
- **3개월 내**: 앱 다운로드 10,000명
- **월 수익**: 광고 및 프리미엄 기능으로 100-500만원

---

**쿡매치 PWA** - 냉장고 재료로 맛있는 요리를 더 쉽게! 🍳 