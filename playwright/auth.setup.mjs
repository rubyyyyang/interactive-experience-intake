/**
 * playwright/auth.setup.mjs
 * One-time manual authentication using persistent browser profile.
 *
 * Run with: npm run test:auth-setup
 *
 * This script:
 * 1. Launches Chromium with a dedicated persistent profile
 * 2. Navigates to the Apps Script /dev URL
 * 3. Waits for you to manually log in via Red Hat SSO/MFA if needed
 * 4. Waits for the Intake form to load
 * 5. Browser state persists in playwright/.profile/
 */

import { chromium } from '@playwright/test';

const baseURL = process.env.INTAKE_WEB_APP_URL;

if (!baseURL) {
  console.error('ERROR: INTAKE_WEB_APP_URL environment variable is required.');
  console.error('Set it to your Apps Script /dev deployment URL.\n');
  console.error('Example:');
  console.error('  export INTAKE_WEB_APP_URL="https://script.google.com/a/macros/redhat.com/s/YOUR_ID/dev"');
  console.error('  npm run test:auth-setup\n');
  process.exit(1);
}

const userDataDir = 'playwright/.profile';

console.log('\n=== Playwright Persistent Profile Experiment ===\n');
console.log(`Target URL: ${baseURL}`);
console.log(`Profile dir: ${userDataDir}\n`);

// Launch persistent context (headed browser)
const context = await chromium.launchPersistentContext(userDataDir, {
  headless: false
});

const page = context.pages()[0] || await context.newPage();

console.log('Opening browser...\n');
console.log('If login required:');
console.log('1. Complete Red Hat Google Workspace SSO/MFA');
console.log('2. Script will auto-detect when the Intake form loads\n');

// Navigate to the app
await page.goto(baseURL);

// Wait for authenticated app to load (up to 3 minutes for manual SSO/MFA)
console.log('Waiting for Intake app to load (up to 3 minutes for SSO/MFA)...');
try {
  // Wait until we've left auth.redhat.com and are back on script.google.com
  let currentURL = page.url();
  let attempts = 0;
  const maxAttempts = 90; // 3 minutes at 2s intervals

  while (currentURL.includes('auth.redhat.com') && attempts < maxAttempts) {
    await page.waitForTimeout(2000);
    currentURL = page.url();
    attempts++;

    if (attempts % 15 === 0) {
      console.log(`  Still waiting for redirect from auth.redhat.com... (${attempts * 2}s elapsed)`);
    }
  }

  if (currentURL.includes('auth.redhat.com')) {
    throw new Error('Timeout: Still on auth.redhat.com after 3 minutes');
  }

  console.log(`✓ Left auth.redhat.com, now on: ${currentURL.substring(0, 60)}...`);

  // Wait a moment for page to stabilize
  await page.waitForLoadState('load', { timeout: 30000 });

  // Wait for Intake-specific content (not generic form inputs)
  // Look for the heading or Extract Content button
  const intakeSignals = [
    page.locator('text=Interactive Experience Intake'),
    page.locator('text=Interactive Demo Intake'),
    page.locator('button:has-text("Extract Content")'),
    page.locator('h1, h2').filter({ hasText: /Intake/i })
  ];

  let signalFound = false;
  for (const signal of intakeSignals) {
    try {
      await signal.waitFor({ timeout: 10000, state: 'visible' });
      const text = await signal.textContent();
      console.log(`✓ Intake app content detected: "${text}"`);
      signalFound = true;
      break;
    } catch {
      // Try next signal
    }
  }

  if (!signalFound) {
    console.warn('WARNING: Could not find Intake-specific heading/button.');
    console.warn('The app may have loaded but content detection failed.');
  }

  // Check if page/context is still alive
  if (page.isClosed()) {
    throw new Error('Page was closed unexpectedly during navigation');
  }

  const finalTitle = await page.title().catch(() => 'Unable to get title');
  const finalURL = page.url();

  console.log('\n✓ Intake app loaded successfully');
  console.log(`  Title: ${finalTitle}`);
  console.log(`  URL: ${finalURL.substring(0, 80)}...`);
  console.log(`✓ Browser profile state saved to ${userDataDir}\n`);
} catch (error) {
  console.error('\nERROR: Intake app did not load successfully.');
  console.error(error.message);

  // Try to get current state before closing
  try {
    if (!page.isClosed()) {
      const currentURL = page.url();
      console.error(`  Last known URL: ${currentURL}`);
    }
  } catch {}

  if (!context.closed) {
    await context.close();
  }
  process.exit(1);
}

await context.close();
console.log('✓ Browser closed normally\n');
