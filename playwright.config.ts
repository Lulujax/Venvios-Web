import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    channel: 'chrome',
    trace: 'retain-on-failure',
    locale: 'es-VE',
  },
  webServer: [
    {
      command: 'npm run dev -w backend',
      url: 'http://localhost:4000/api/salud',
      reuseExistingServer: true,
      timeout: 60_000,
      env: { PORT: '4000', LOG_LEVEL: 'warn' },
    },
    {
      command: 'npm run dev -w frontend',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});
