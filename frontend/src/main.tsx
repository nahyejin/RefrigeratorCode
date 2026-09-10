import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
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
