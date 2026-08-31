/**
 * smoke.spec.ts
 * Read-only Playwright smoke tests for deployed web app.
 * Run with: npm run test:smoke
 *
 * IMPORTANT: These are POST-DEPLOY health verification tests.
 * They verify the deployed app is healthy, but do NOT validate
 * new code before deploy (they run against the already-deployed version).
 *
 * AUTHENTICATION: Uses persistent Chromium profile (playwright/.profile/)
 * to access authenticated Apps Script /dev deployment.
 */

import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'fs';

const profileDir = 'playwright/.profile';

// Check for persistent profile before running tests
if (!existsSync(profileDir)) {
  throw new Error(
    `Persistent browser profile not found at ${profileDir}\n\n` +
    'Run the following to set up authentication:\n' +
    '  export INTAKE_WEB_APP_URL="https://script.google.com/a/macros/redhat.com/s/YOUR_ID/dev"\n' +
    '  npm run test:auth-setup\n'
  );
}

// Get baseURL from environment (same as config)
const baseURL = process.env.INTAKE_WEB_APP_URL;
if (!baseURL) {
  throw new Error('INTAKE_WEB_APP_URL environment variable is required.');
}

// Extend test to use persistent context for authenticated access
const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: true,
      baseURL: baseURL
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    // Create a fresh page instead of reusing the default one
    const page = await context.newPage();
    await use(page);
    await page.close();
  }
});

test('Intake form loads without errors', async ({ page }) => {
  // Capture errors BEFORE navigation
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  // Navigate to deployed web app
  await page.goto(baseURL);

  // Verify page title (authentication worked)
  await expect(page).toHaveTitle(/Interactive Demo Intake/i);

  // Wait for app to fully load
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Apps Script serves content in an iframe - find the content frame
  // Wait for iframe to be present
  await page.locator('iframe').last().waitFor({ timeout: 10000 });

  // Get all frames and find the one with app content
  const frames = page.frames();
  const contentFrame = frames.find(f => f.url().includes('googleusercontent.com/blank'));

  if (!contentFrame) {
    throw new Error('App content iframe not found');
  }

  // Verify main heading is rendered
  await expect(contentFrame.locator('h1, h2, h3').filter({ hasText: 'Interactive Experience Intake' }))
    .toBeVisible({ timeout: 10000 });

  // Verify Extract Content button is visible
  await expect(contentFrame.getByRole('button', { name: 'Extract Content' }))
    .toBeVisible();

  // Verify no console errors
  expect(consoleErrors).toHaveLength(0);

  // Verify no uncaught page errors
  expect(pageErrors).toHaveLength(0);
});

test('Status Tracker loads without errors', async ({ page }) => {
  // Capture errors BEFORE navigation
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message);
  });

  // Navigate to Status Tracker page
  await page.goto(`${baseURL}?page=status`);

  // Verify page title (authentication worked)
  await expect(page).toHaveTitle(/Status Tracker/i);

  // Wait for app to fully load
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  // Apps Script serves content in an iframe - find the content frame
  await page.locator('iframe').last().waitFor({ timeout: 10000 });

  const frames = page.frames();
  const contentFrame = frames.find(f => f.url().includes('googleusercontent.com/blank'));

  if (!contentFrame) {
    throw new Error('App content iframe not found');
  }

  // Verify main heading is rendered
  await expect(contentFrame.locator('h1, h2, h3').filter({ hasText: 'Interactive Experience Status Tracker' }))
    .toBeVisible({ timeout: 10000 });

  // Verify final valid content state appears (not just transient loading)
  // Either: table with data, OR status/empty message
  const finalContent = contentFrame.locator('table, .status-message');
  await expect(finalContent.first()).toBeVisible({ timeout: 10000 });

  // Verify no console errors
  expect(consoleErrors).toHaveLength(0);

  // Verify no uncaught page errors
  expect(pageErrors).toHaveLength(0);
});
