import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5174',
    trace: 'on-first-retry',
    ...devices['Desktop Chrome'],
  },
  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
  webServer: [
    {
      command:
        'python -c "import os; [os.remove(f) for f in (\'e2e.db\',\'e2e.db-journal\',\'e2e.db-wal\',\'e2e.db-shm\') if os.path.exists(f)]" && python -m uvicorn app.main:app --port 8001',
      cwd: './backend',
      url: 'http://localhost:8001/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        DATABASE_URL: 'sqlite:///./e2e.db',
        GEMINI_API_KEY: '',
        GOOGLE_API_KEY: '',
        FRONTEND_URL: 'http://localhost:5174',
      },
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:5174',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        VITE_DEV_PORT: '5174',
        VITE_API_PROXY: 'http://localhost:8001',
      },
    },
  ],
})
