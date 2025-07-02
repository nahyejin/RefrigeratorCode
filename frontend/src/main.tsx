import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker, setupInstallListener, setupAppInstalledListener } from './utils/pwa'
import { trackPWAPerformance, trackOfflineUsage, trackServiceWorkerPerformance } from './utils/pwaAnalytics'

// PWA 초기화
registerServiceWorker();
setupInstallListener();
setupAppInstalledListener();

// PWA 성능 추적 초기화
trackPWAPerformance();
trackOfflineUsage();
trackServiceWorkerPerformance();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
