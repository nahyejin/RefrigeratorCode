import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5178,
    host: true,
    logLevel: 'info'
  },
  build: {
    rollupOptions: {
      external: ['react-datepicker'],
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
