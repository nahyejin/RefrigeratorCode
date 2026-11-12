import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { rmSync } from 'node:fs'
import { resolve } from 'node:path'

// 앱(Capacitor)에 들어가는 `dist/` 에서 웹 전용·미사용 큰 파일을 뺀다 (2026-11-12).
// 배경 — `public/` 의 파일은 전부 `dist/` 로 복사되고 `cap sync` 가 그대로 앱 파일(assets)에 넣는다.
//   - ingredient_substitute_table.csv (약 30MB): 화면은 11-07 부터 작은 `_lite.json` 만 쓴다. 이 CSV 는 매일 배치가
//     다시 만들어 커밋하고 서버(backend/app.py)가 로컬 폴백으로 읽으니 `public/` 에는 그대로 둬야 한다(위치·배치 불변).
//   - threads/ (약 10MB): 스레드 자동 게시가 공개 주소(https://refrigerator-code.vercel.app/threads/…)로 쓰는 사진·영상. 앱 화면은 안 쓴다.
// Vercel(웹 배포)은 환경변수 VERCEL 이 있으니 그대로 둔다 → 웹에서는 두 주소가 계속 열린다.
// 웹 빌드를 로컬에서 하면서 이 파일들이 필요하면 KEEP_WEB_ONLY_FILES=1 로 빌드.
const APP_EXCLUDED_PUBLIC_FILES = ['ingredient_substitute_table.csv', 'threads']
const excludeWebOnlyFilesFromAppBuild = (): Plugin => ({
  name: 'exclude-web-only-files-from-app-build',
  apply: 'build',
  closeBundle() {
    if (process.env.VERCEL || process.env.KEEP_WEB_ONLY_FILES) return
    for (const name of APP_EXCLUDED_PUBLIC_FILES) {
      rmSync(resolve(__dirname, 'dist', name), { recursive: true, force: true })
    }
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), excludeWebOnlyFilesFromAppBuild()],
  server: {
    port: 5178,
    host: true,
    logLevel: 'info'
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom']
        }
      }
    }
  },
  define: {
    __PWA_ENABLED__: true
  }
})
