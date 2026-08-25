# 🚀 개발/운영 환경 분리 가이드

## 📋 **환경별 설정 파일**

### **프론트엔드**
- `frontend/env.development` - 개발 환경 설정
- `frontend/env.production` - 운영 환경 설정

### **백엔드**
- `backend/env.development` - 개발 환경 설정
- `backend/env.production` - 운영 환경 설정

## 🛠️ **개발 환경 실행**

### **1. 백엔드 개발 서버**
```bash
cd backend
python run_dev.py
```
- URL: http://localhost:5000
- Debug 모드: 활성화
- DB: 로컬 MySQL
- CORS: localhost 허용

### **2. 프론트엔드 개발 서버**
```bash
cd frontend
npm run dev
```
- URL: http://localhost:5178  (vite.config.ts 에 5178 로 고정)
- API 호출: http://localhost:5000
- Hot Reload: 활성화

### **3. 통합 개발 환경 실행**
```bash
# Windows
start_dev.bat

# macOS/Linux
./start_dev.sh
```

## 🚀 **운영 환경 빌드**

### **1. 백엔드 운영 서버**
```bash
cd backend
python run_prod.py
```
- URL: http://0.0.0.0:5000
- Debug 모드: 비활성화
- DB: 운영 DB (환경변수 설정 필요)
- CORS: 운영 도메인만 허용

### **2. 프론트엔드 운영 빌드**
```bash
cd frontend
npm run build:prod
```
- API 호출: 운영 백엔드 URL (환경변수 설정 필요)
- 최적화된 빌드 파일 생성

### **3. 프론트엔드 미리보기**
```bash
# 개발 환경 미리보기
npm run preview:dev

# 운영 환경 미리보기
npm run preview:prod
```

## 🔧 **환경변수 설정**

### **프론트엔드 환경변수**

#### 개발 환경 (env.development)
```bash
VITE_API_BASE_URL=http://localhost:5000
VITE_ENV=development
VITE_DEBUG=true
```

#### 운영 환경 (env.production)
```bash
VITE_API_BASE_URL=https://api.cookmatch.com
VITE_ENV=production
VITE_DEBUG=false
```

### **백엔드 환경변수**

#### 개발 환경 (env.development)
```bash
FLASK_ENV=development
FLASK_DEBUG=true
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=sk784512!!
DB_NAME=refrigerator
DB_PORT=3306
CORS_ORIGIN=http://localhost:5173,http://localhost:5177,http://localhost:5178
```

#### 운영 환경 (env.production)
```bash
FLASK_ENV=production
FLASK_DEBUG=false
DB_HOST=your-production-db-host.com
DB_USER=your-production-db-user
DB_PASSWORD=your-production-db-password
DB_NAME=refrigerator_production
DB_PORT=3306
CORS_ORIGIN=https://your-production-frontend-url.com
```

### **운영 환경 설정 시 주의사항**
1. `backend/env.production` 파일에서 실제 DB 정보 입력
2. `frontend/env.production` 파일에서 실제 백엔드 URL 입력
3. 각 플랫폼(Vercel, Render 등)에서 환경변수 설정
4. **절대 Git에 민감한 정보를 커밋하지 마세요**

## 📊 **환경별 차이점**

| 구분 | 개발 환경 | 운영 환경 |
|------|-----------|-----------|
| **프론트엔드 URL** | http://localhost:5178 | 실제 도메인 |
| **백엔드 URL** | http://localhost:5000 | 실제 백엔드 URL |
| **DB** | 로컬 MySQL | 운영 DB |
| **Debug 모드** | 활성화 | 비활성화 |
| **CORS** | localhost 허용 | 실제 도메인 허용 |
| **빌드 최적화** | 개발용 | 운영용 (압축, 최적화) |
| **에러 표시** | 상세 에러 | 일반 에러 |

## 🔍 **환경 확인 방법**

### **프론트엔드 환경 확인**
```javascript
// 브라우저 콘솔에서 확인
console.log(import.meta.env.VITE_ENV);
console.log(import.meta.env.VITE_API_BASE_URL);
```

### **백엔드 환경 확인**
```bash
# 헬스 체크 API 호출
curl http://localhost:5000/api/health
```

## ⚠️ **주의사항**

1. **환경변수 파일은 절대 Git에 커밋하지 마세요**
2. **운영 환경에서는 반드시 실제 DB 정보를 사용하세요**
3. **개발 중에는 개발 환경을, 배포 시에는 운영 환경을 사용하세요**
4. **CORS 설정을 올바르게 구성하세요**
5. **운영 환경에서는 Debug 모드를 비활성화하세요**

## 🚨 **문제 해결**

### **API 연결 안됨**
1. 백엔드 서버가 실행 중인지 확인
2. 환경변수 URL이 올바른지 확인
3. CORS 설정 확인

### **환경변수 로드 안됨**
1. 파일명이 정확한지 확인 (env.development, env.production)
2. 파일 위치가 올바른지 확인
3. .gitignore에서 제외되었는지 확인

### **빌드 오류**
1. Node.js 버전 확인
2. 의존성 설치 확인: `npm install`
3. TypeScript 오류 확인 