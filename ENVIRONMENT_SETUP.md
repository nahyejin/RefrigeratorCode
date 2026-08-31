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

### **LLM(Gemini) 키 — 두 개로 나눠 쓰기 권장**

| 환경변수 | 쓰는 곳 | 없으면 |
|---|---|---|
| `GEMINI_API_KEY` | 재료 추출 배치(`llm_ingredient_extraction.py`) | 배치가 동작하지 않음 |
| `GEMINI_API_KEY_CHAT` | **요리 챗봇(`/api/chat`) 전용** | `GEMINI_API_KEY` 를 함께 씀 |
| `GEMINI_API_KEY_VISION` | **사진 재료 인식(`/api/ingredients/recognize`) 전용** | `GEMINI_API_KEY_CHAT` → `GEMINI_API_KEY` 순으로 내려감 |
| `GEMINI_VISION_MODEL` | 이미지 인식에 쓸 모델 | `GEMINI_MODEL` → `gemini-3.5-flash-lite` |
| `INGREDIENT_DICT_CSV` | 재료 사전 CSV 경로를 직접 지정 | `frontend/public/` → `backend/` → 루트 순으로 탐색 |
| `LLM_DAILY_LIMIT` | 챗봇 + 사진 인식의 앱 자체 호출 상한 (기본 250) | 250 |

> 사진 인식은 챗봇과 **같은 하루 한도**를 공유합니다. 사진을 여러 장 올려도
> LLM 호출은 1회라 한도도 1만 씁니다. 자세한 내용은
> `INGREDIENT_RECOGNITION_FEATURE.md` 참고.

**왜 나눠야 하나**: 무료 티어 한도(하루 500회)는 **API 키 단위**입니다.
재료 추출 배치가 하루 450회를 쓰도록 잡혀 있어서, 같은 키를 공유하면 챗봇 몫이
50회뿐입니다. 실제로 이게 소진돼 챗봇이 하루 종일 `429 Quota exceeded` 로
응답하지 못한 일이 있었습니다.

**키 하나 더 만드는 방법** (5분)
1. [Google AI Studio](https://aistudio.google.com/apikey) 접속 → 구글 계정 로그인
2. `Create API key` → **`Create API key in new project`** 를 고름
   (⚠️ 기존 프로젝트에 키를 하나 더 만들면 **한도를 공유**해서 의미가 없습니다.
   반드시 **새 프로젝트**로 만들어야 별도 500회를 받습니다)
3. 만들어진 키를 복사
4. 넣을 곳
   - 로컬: `backend/.env` 에 `GEMINI_API_KEY_CHAT=붙여넣기`
   - 운영: Railway → 프로젝트 → **Variables** → `GEMINI_API_KEY_CHAT` 추가
5. 백엔드 재시작(로컬) / 자동 재배포(Railway) 후, 챗봇에 아무 말이나 걸어 확인

> 새 키를 만들어도 **배치가 쓰는 `GEMINI_API_KEY` 는 그대로 두세요.**
> 둘 다 있어야 배치와 챗봇이 각자의 한도를 씁니다.

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