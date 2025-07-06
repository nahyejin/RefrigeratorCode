# 🚀 냉털이 개발 가이드

## 📋 개발 워크플로우

### 1. 개발 환경 시작
```bash
# 전체 개발 환경 시작 (백엔드 + 프론트엔드)
start_dev.bat

# 또는 빠른 개발 (프론트엔드만)
quick_dev.bat
```

### 2. 개발 과정
1. **코드 수정** → 파일 저장
2. **즉시 확인** → `http://localhost:5173` 에서 자동 반영
3. **문제 해결** → 개발자 도구로 디버깅
4. **완벽 확인** → 모든 기능 테스트

### 3. 배포
```bash
# Git 커밋 및 푸시
git add .
git commit -m "기능 추가/수정"
git push origin main
```

### 4. 배포 확인
```bash
# 배포 상태 확인
check_deployment.bat
```

## 🌐 환경별 URL

| 환경 | 프론트엔드 | 백엔드 | 용도 |
|------|------------|--------|------|
| **로컬 개발** | http://localhost:5173 | http://localhost:5000 | 코드 수정 즉시 확인 |
| **실제 배포** | https://refrigerator-code.vercel.app/ | Railway | 사용자 접속 |

## 🔧 주요 스크립트

### `start_dev.bat`
- 백엔드 + 프론트엔드 동시 시작
- 브라우저 자동 열기
- 개발 환경 완전 설정

### `quick_dev.bat`
- 프론트엔드만 시작 (백엔드가 이미 실행 중일 때)
- 빠른 개발용

### `check_deployment.bat`
- 배포된 사이트 확인
- Vercel/Railway 대시보드 열기

## 💡 개발 팁

### 코드 수정 후 확인
1. 파일 저장 (Ctrl+S)
2. 브라우저에서 `http://localhost:5173` 새로고침
3. 변경사항 즉시 반영 확인

### API 테스트
- 백엔드 API: `http://localhost:5000/api/health`
- 프론트엔드에서 API 호출 시 자동으로 로컬 백엔드 사용

### 배포 확인
- GitHub 푸시 후 1-2분 대기
- `https://refrigerator-code.vercel.app/` 에서 최종 확인

## 🚨 문제 해결

### 서버가 시작되지 않을 때
1. 포트 충돌 확인 (5000, 5173)
2. Python/Node.js 설치 확인
3. 의존성 설치: `npm install` (frontend 폴더에서)

### 배포가 반영되지 않을 때
1. GitHub 푸시 확인
2. Vercel 빌드 로그 확인
3. 몇 분 더 대기 후 새로고침

## 📁 프로젝트 구조
```
RefrigeratorCode/
├── frontend/          # React 프론트엔드
├── backend/           # Flask 백엔드
├── start_dev.bat      # 개발 환경 시작
├── quick_dev.bat      # 빠른 개발
└── check_deployment.bat # 배포 확인
``` 