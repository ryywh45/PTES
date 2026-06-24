import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const apiProxy = process.env.VITE_API_PROXY || 'http://localhost:8000'
const devPort = Number(process.env.VITE_DEV_PORT || 5173)

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
  server: {
    port: devPort,
    strictPort: !!process.env.VITE_DEV_PORT,
    proxy: {
      '/api': {
        target: apiProxy,
        changeOrigin: true,
      },
    },
  },
})
