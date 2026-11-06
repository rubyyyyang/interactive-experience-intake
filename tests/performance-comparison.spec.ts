/**
 * performance-comparison.spec.ts
 *
 * Automated performance comparison between production (@57) and test (@HEAD) deployments.
 * Measures payload size and load time for Guide Extraction JSON optimization.
 *
 * Run with: npm run test:performance
 */

import { test as base, expect, chromium, type BrowserContext, type Page } from '@playwright/test';
import { existsSync } from 'fs';

const profileDir = 'playwright/.profile';

if (!existsSync(profileDir)) {
  throw new Error(
    `Persistent browser profile not found at ${profileDir}\n\n` +
    'Run: npm run test:auth-setup'
  );
}

// Deployment URLs
const PRODUCTION_URL = 'https://script.google.com/macros/s/AKfycbwBIUC7oGvLX-MAQ3vR5LmNUS-3taGcQbFNdWjw2XCEQI2iOkMfZU19nBQyMY3_L8yp/exec';
const TEST_URL = 'https://script.google.com/macros/s/AKfycbyW_N668oLpaWMzrR1OXlYh9hTZ6Av33nCtegYUJAw/exec';

const test = base.extend<{ context: BrowserContext; page: Page }>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext(profileDir, {
      headless: true
    });
    await use(context);
    await context.close();
  },
  page: async ({ context }, use) => {
    const page = await context.newPage();
    await use(page);
    await page.close();
  }
});

interface PerformanceMetrics {
  deploymentName: string;
  url: string;
  navigationTime: number;
  tableReadyTime: number;
  submissionsCount: number;
  allSubmissionsSize: number;
  hasGuideJson: boolean;
  guideJsonCount: number;
  consoleErrors: string[];
  missingData: string[];
}

async function measureDeployment(
  page: Page,
  deploymentUrl: string,
  deploymentName: string
): Promise<PerformanceMetrics> {
  const consoleErrors: string[] = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  // Clear cache for cold load
  await page.context().clearCookies();

  const navStart = Date.now();

  // Navigate to Status Tracker (allow time for auth redirects)
  await page.goto(`${deploymentUrl}?page=status`, { waitUntil: 'networkidle', timeout: 60000 });

  const navigationTime = Date.now() - navStart;

  // /exec URLs serve content directly (no iframe), unlike /dev URLs
  // Try to find iframe, but if none exists, use main page
  let contentFrame = page.mainFrame();

  try {
    const iframe = await page.locator('iframe').last().waitFor({ timeout: 3000 });
    const frames = page.frames();
    const appFrame = frames.find(f => f.url().includes('googleusercontent.com/blank'));
    if (appFrame) {
      contentFrame = appFrame;
    }
  } catch (e) {
    // No iframe - direct content (expected for /exec URLs)
  }

  // Wait for table or empty state
  const tableStart = Date.now();
  await Promise.race([
    contentFrame.locator('table tbody tr').first().waitFor({ timeout: 30000 }),
    contentFrame.locator('.empty-state, .processing-state').waitFor({ timeout: 30000 })
  ]);
  const tableReadyTime = Date.now() - tableStart;

  // Extract allSubmissions data from page
  const metrics = await contentFrame.evaluate(() => {
    const win = window as any;
    const submissions = win.allSubmissions || [];

    // Measure serialized size
    const serialized = JSON.stringify(submissions);
    const size = serialized.length;

    // Check for Guide JSON presence
    let hasGuideJson = false;
    let guideJsonCount = 0;

    for (const sub of submissions) {
      // Check top-level property
      if (sub.guideExtractionJson !== undefined) {
        hasGuideJson = true;
        guideJsonCount++;
      }
      // Check metadata object
      if (sub.metadata && sub.metadata['Guide Extraction JSON'] !== undefined) {
        hasGuideJson = true;
        guideJsonCount++;
      }
    }

    // Check for missing critical data
    const missingData: string[] = [];
    if (submissions.length > 0) {
      const sample = submissions[0];
      if (!sample.title) missingData.push('title missing');
      if (!sample.status) missingData.push('status missing');
      if (!sample.creatorName) missingData.push('creatorName missing');
      if (!sample.metadata) missingData.push('metadata object missing');
    }

    return {
      count: submissions.length,
      size: size,
      hasGuideJson: hasGuideJson,
      guideJsonCount: guideJsonCount,
      missingData: missingData
    };
  });

  return {
    deploymentName,
    url: deploymentUrl,
    navigationTime,
    tableReadyTime,
    submissionsCount: metrics.count,
    allSubmissionsSize: metrics.size,
    hasGuideJson: metrics.hasGuideJson,
    guideJsonCount: metrics.guideJsonCount,
    consoleErrors,
    missingData: metrics.missingData
  };
}

test.describe('Performance Comparison: Production vs Test', () => {

  test('Compare payload size and load times (3 runs each)', async ({ page }) => {
    console.log('\n=== Performance Comparison Test ===\n');

    const productionRuns: PerformanceMetrics[] = [];
    const testRuns: PerformanceMetrics[] = [];

    // Alternate runs to reduce cache bias
    for (let i = 0; i < 3; i++) {
      console.log(`\nRun ${i + 1}/3:`);

      // Production
      console.log('  Measuring production @57...');
      const prodMetrics = await measureDeployment(page, PRODUCTION_URL, 'Production @57');
      productionRuns.push(prodMetrics);
      console.log(`    - Submissions: ${prodMetrics.submissionsCount}`);
      console.log(`    - Payload size: ${(prodMetrics.allSubmissionsSize / 1024).toFixed(1)} KB`);
      console.log(`    - Load time: ${prodMetrics.navigationTime + prodMetrics.tableReadyTime}ms`);

      // Wait 2s between runs
      await page.waitForTimeout(2000);

      // Test
      console.log('  Measuring test @HEAD...');
      const testMetrics = await measureDeployment(page, TEST_URL, 'Test @HEAD');
      testRuns.push(testMetrics);
      console.log(`    - Submissions: ${testMetrics.submissionsCount}`);
      console.log(`    - Payload size: ${(testMetrics.allSubmissionsSize / 1024).toFixed(1)} KB`);
      console.log(`    - Load time: ${testMetrics.navigationTime + testMetrics.tableReadyTime}ms`);

      // Wait 2s between runs
      await page.waitForTimeout(2000);
    }

    // Calculate medians
    const median = (arr: number[]) => {
      const sorted = [...arr].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
    };

    const prodSizes = productionRuns.map(r => r.allSubmissionsSize);
    const testSizes = testRuns.map(r => r.allSubmissionsSize);
    const prodTimes = productionRuns.map(r => r.navigationTime + r.tableReadyTime);
    const testTimes = testRuns.map(r => r.navigationTime + r.tableReadyTime);

    const medianProdSize = median(prodSizes);
    const medianTestSize = median(testSizes);
    const medianProdTime = median(prodTimes);
    const medianTestTime = median(testTimes);

    const sizeReduction = medianProdSize - medianTestSize;
    const sizeReductionPct = ((sizeReduction / medianProdSize) * 100).toFixed(1);
    const timeReduction = medianProdTime - medianTestTime;
    const timeReductionPct = ((timeReduction / medianProdTime) * 100).toFixed(1);

    // Print summary
    console.log('\n=== RESULTS SUMMARY ===\n');
    console.log(`Submissions tested: ${productionRuns[0].submissionsCount}`);
    console.log('');
    console.log('Payload Size:');
    console.log(`  Production @57: ${(medianProdSize / 1024).toFixed(1)} KB (median)`);
    console.log(`  Test @HEAD:     ${(medianTestSize / 1024).toFixed(1)} KB (median)`);
    console.log(`  Reduction:      ${(sizeReduction / 1024).toFixed(1)} KB (-${sizeReductionPct}%)`);
    console.log('');
    console.log('Load Time:');
    console.log(`  Production @57: ${medianProdTime}ms (median)`);
    console.log(`  Test @HEAD:     ${medianTestTime}ms (median)`);
    console.log(`  Improvement:    ${timeReduction}ms (-${timeReductionPct}%)`);
    console.log('');
    console.log('Guide JSON Presence:');
    console.log(`  Production @57: ${productionRuns[0].hasGuideJson ? 'Present' : 'Absent'} (${productionRuns[0].guideJsonCount} occurrences)`);
    console.log(`  Test @HEAD:     ${testRuns[0].hasGuideJson ? 'Present' : 'Absent'} (${testRuns[0].guideJsonCount} occurrences)`);
    console.log('');

    // Verify no regressions
    console.log('Regression Checks:');

    // Same submission count
    const sameCount = productionRuns[0].submissionsCount === testRuns[0].submissionsCount;
    console.log(`  ✓ Same submission count: ${sameCount ? 'PASS' : 'FAIL'}`);
    expect(sameCount).toBe(true);

    // No console errors
    const noErrors = testRuns.every(r => r.consoleErrors.length === 0);
    console.log(`  ✓ No console errors: ${noErrors ? 'PASS' : 'FAIL'}`);
    if (!noErrors) {
      console.log('    Errors:', testRuns[0].consoleErrors);
    }
    expect(noErrors).toBe(true);

    // No missing data
    const noMissingData = testRuns.every(r => r.missingData.length === 0);
    console.log(`  ✓ No missing data: ${noMissingData ? 'PASS' : 'FAIL'}`);
    if (!noMissingData) {
      console.log('    Missing:', testRuns[0].missingData);
    }
    expect(noMissingData).toBe(true);

    // Guide JSON removed
    const guideJsonRemoved = !testRuns[0].hasGuideJson;
    console.log(`  ✓ Guide JSON removed: ${guideJsonRemoved ? 'PASS' : 'FAIL'}`);
    expect(guideJsonRemoved).toBe(true);

    // Meaningful size reduction (at least 10%)
    const meaningfulReduction = sizeReduction > (medianProdSize * 0.10);
    console.log(`  ✓ Meaningful size reduction (>10%): ${meaningfulReduction ? 'PASS' : 'FAIL'}`);
    expect(meaningfulReduction).toBe(true);

    console.log('\n=== RECOMMENDATION ===\n');

    const worthPromoting =
      sameCount &&
      noErrors &&
      noMissingData &&
      guideJsonRemoved &&
      meaningfulReduction;

    if (worthPromoting) {
      console.log('✅ PROMOTE TO PRODUCTION');
      console.log(`   - ${sizeReductionPct}% payload reduction achieved`);
      console.log(`   - ${timeReductionPct}% load time improvement`);
      console.log('   - No regressions detected');
      console.log('   - All functionality preserved');
    } else {
      console.log('⚠️  DO NOT PROMOTE');
      console.log('   - Regressions detected (see checks above)');
    }

    console.log('\n');
  });
});
