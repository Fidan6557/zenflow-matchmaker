import { defineConfig, devices } from '@playwright/test'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export default defineConfig({
  testDir: './tests', timeout: 45000, expect: { timeout: 10000 },
  fullyParallel: false, workers: 1, retries: 0, reporter: 'list',
  outputDir: join(tmpdir(), 'zen-flow-playwright-results'),
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1536, height: 1024 } } }],
})
