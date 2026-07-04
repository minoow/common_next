import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'on-first-retry'
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ],
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: './task1-upload-queue',
      url: 'http://127.0.0.1:5173',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: './task2-file-list',
      url: 'http://127.0.0.1:5174',
      reuseExistingServer: !process.env.CI
    },
    {
      command: 'npm run dev -- --host 127.0.0.1',
      cwd: './task3-chunk-upload',
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: !process.env.CI
    }
  ]
});

