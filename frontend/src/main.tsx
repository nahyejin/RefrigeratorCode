import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
// 스플래시의 누적 레시피 수(숫자)용 글꼴 Jua 를 앱 안에 함께 넣는다 — 구글 서버에서 받아 오면
// 첫 화면에서 아직 못 받아 기본 글꼴로 보이거나 오프라인이면 끝내 안 바뀐다. 숫자는 latin 파일이면 된다.
import '@fontsource/jua/latin-400.css'
import App from './App.tsx'
import { initErrorTracking } from './utils/errorTracking'

// 앱을 그리기 **전에** 켠다 — 첫 화면에서 터진 것도 잡아야 한다.
// `VITE_SENTRY_DSN` 이 없으면 아무 일도 안 한다.
initErrorTracking()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
