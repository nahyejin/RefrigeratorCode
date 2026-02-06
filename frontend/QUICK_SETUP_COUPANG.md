# 쿠팡 파트너스 빠른 설정 가이드

## 1단계: 파트너 ID 확인하기

⚠️ **주의**: 프로필 메뉴의 "ID: AF2929738" 같은 것은 파트너 ID가 아닙니다!

### 파트너 ID 찾는 방법:

**방법 1: 대시보드 메인 페이지**
1. [쿠팡 파트너스 대시보드](https://partners.coupang.com/) 로그인
2. 대시보드 메인 페이지에서 확인
   - 우측 상단 또는 좌측 메뉴에 "파트너 ID" 표시
   - 형식: **8자리 숫자** (예: `12345678`)

**방법 2: 프로필 메뉴에서 확인**
1. 우측 상단 **프로필 아이콘** 클릭
2. 드롭다운 메뉴에서 **"파트너 ID"** 또는 **"Partner ID"** 찾기
   - "ID: AF2929738" 같은 것은 계정 ID이므로 파트너 ID가 아닙니다
   - 파트너 ID는 별도로 표시되어 있습니다

**방법 3: 광고 단위 관리 페이지**
1. 좌측 메뉴에서 **"광고 단위 관리"** 클릭
2. 페이지 상단 또는 URL에 파트너 ID 표시

**파트너 ID 형식**: 
- ✅ 올바른 형식: `12345678` (8자리 숫자만)
- ❌ 잘못된 형식: `AF2929738` (알파벳 포함, 계정 ID)

## 2단계: 환경변수 설정하기

### 방법 1: .env.local 파일 생성 (권장)

프로젝트 루트의 `frontend` 폴더에 `.env.local` 파일을 생성하세요:

```env
VITE_COUPANG_PARTNER_ID=여기에_파트너_ID_입력
```

예시:
```env
VITE_COUPANG_PARTNER_ID=12345678
```

### 방법 2: env.development 파일 수정

`frontend/env.development` 파일에 추가:

```env
# Development Environment Variables
VITE_API_BASE_URL=https://refrigeratorcode-production.up.railway.app
VITE_ENV=development
VITE_DEBUG=true
VITE_COUPANG_PARTNER_ID=여기에_파트너_ID_입력
```

## 3단계: 개발 서버 재시작

환경변수를 변경한 후에는 반드시 개발 서버를 재시작해야 합니다:

```bash
# 서버 중지 (Ctrl+C)
# 그 다음 다시 시작
npm run dev
```

## 4단계: 테스트하기

1. 브라우저에서 '냉장고요리' 페이지 접속
2. 부족한 재료가 정확히 1개인 레시피 카드 찾기
3. 레시피 카드 하단에 쿠팡 광고가 표시되는지 확인

개발 모드에서는:
- 환경변수가 설정되지 않으면: 회색 박스로 표시됨
- 환경변수가 설정되면: 실제 쿠팡 광고 링크 표시됨

## 5단계: 프로덕션 환경 설정 (Vercel)

1. Vercel 대시보드 접속
2. 프로젝트 선택 > **Settings** > **Environment Variables**
3. 다음 환경변수 추가:
   - **Key**: `VITE_COUPANG_PARTNER_ID`
   - **Value**: 파트너 ID (예: `12345678`)
   - **Environment**: Production, Preview, Development 모두 선택
4. **Save** 클릭
5. **Redeploy** 클릭하여 재배포

## 확인 사항

✅ 파트너 ID가 올바른지 확인 (8자리 숫자)
✅ 환경변수 파일이 올바른 위치에 있는지 확인 (`frontend/.env.local`)
✅ 개발 서버를 재시작했는지 확인
✅ 브라우저 콘솔에 오류가 없는지 확인

## 문제 해결

### 광고가 표시되지 않는 경우

1. **환경변수 확인**:
   ```bash
   # .env.local 파일 내용 확인
   cat frontend/.env.local
   ```

2. **브라우저 콘솔 확인**:
   - F12 키를 눌러 개발자 도구 열기
   - Console 탭에서 오류 메시지 확인

3. **파트너 ID 확인**:
   - 쿠팡 파트너스 대시보드에서 파트너 ID가 올바른지 확인
   - 숫자만 입력했는지 확인 (공백, 하이픈 등 제거)

### 개발 모드에서 회색 박스가 보이는 경우

정상입니다! 환경변수가 설정되면 실제 광고 링크로 변경됩니다.

