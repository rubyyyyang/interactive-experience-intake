/**
 * smoke.spec.ts
 * Read-only Playwright smoke tests for deployed web app.
 * Run with: npm run test:smoke
 *
 * IMPORTANT: These are POST-DEPLOY health verification tests.
 * They verify the deployed app is healthy, but do NOT validate
 * new code before deploy (they run against the already-deployed version).
 */

import { test, expect } from '@playwright/test';

test('Intake form loads without errors', async ({ page }) => {
  // Listen for console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Navigate to deployed web app
  await page.goto('/');

  // Verify title
  await expect(page).toHaveTitle(/Interactive Demo Intake/i);

  // Verify form elements render
  const textInputs = page.locator('input[type="text"], input[type="url"], input[type="email"]');
  await expect(textInputs.first()).toBeVisible();

  const buttons = page.locator('button');
  await expect(buttons.first()).toBeVisible();

  // Verify no console errors
  expect(consoleErrors).toHaveLength(0);
});

test('Status Tracker loads without errors', async ({ page }) => {
  // Listen for console errors
  const consoleErrors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Navigate to Status Tracker page
  await page.goto('/?page=status');

  // Verify title
  await expect(page).toHaveTitle(/Status Tracker/i);

  // Verify either table or status message renders
  const tableOrMessage = page.locator('table, .status-message, .loading, #submissions-table');
  await expect(tableOrMessage.first()).toBeVisible({ timeout: 10000 });

  // Verify no console errors
  expect(consoleErrors).toHaveLength(0);
});
