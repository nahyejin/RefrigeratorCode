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

### **2. 프론트엔드 개발 서버**
```bash
cd frontend
npm run dev
```
- URL: http://localhost:5173
- API 호출: http://localhost:5000

## 🚀 **운영 환경 빌드**

### **1. 백엔드 운영 서버**
```bash
cd backend
python run_prod.py
```
- URL: http://0.0.0.0:5000
- Debug 모드: 비활성화
- DB: 운영 DB (환경변수 설정 필요)

### **2. 프론트엔드 운영 빌드**
```bash
cd frontend
npm run build:prod
```
- API 호출: 운영 백엔드 URL (환경변수 설정 필요)

## 🔧 **환경변수 설정**

### **운영 환경 설정 시**
1. `backend/env.production` 파일에서 실제 DB 정보 입력
2. `frontend/env.production` 파일에서 실제 백엔드 URL 입력
3. 각 플랫폼(Vercel, Render 등)에서 환경변수 설정

## 📊 **환경별 차이점**

| 구분 | 개발 환경 | 운영 환경 |
|------|-----------|-----------|
| **프론트엔드 URL** | http://localhost:5173 | 실제 도메인 |
| **백엔드 URL** | http://localhost:5000 | 실제 백엔드 URL |
| **DB** | 로컬 MySQL | 운영 DB |
| **Debug 모드** | 활성화 | 비활성화 |
| **CORS** | localhost 허용 | 실제 도메인 허용 |

## ⚠️ **주의사항**

1. **환경변수 파일은 절대 Git에 커밋하지 마세요**
2. **운영 환경에서는 반드시 실제 DB 정보를 사용하세요**
3. **개발 중에는 개발 환경을, 배포 시에는 운영 환경을 사용하세요** 