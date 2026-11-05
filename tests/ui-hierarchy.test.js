/**
 * UI Hierarchy Test
 * Verifies section order and heading consistency
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running UI hierarchy test...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');

function testSectionOrder() {
  console.log('Test: Expanded detail rendering order');

  // Find the rendering order in td.innerHTML
  const renderOrder = /td\.innerHTML = '<div class="detail-panel">' \+ buildActionBanner\(sub\) \+ buildLifecycle\(sub\) \+ buildPerformanceSnapshot\(sub\) \+ buildDetailSections\(sub\)/.test(html);

  assert.ok(renderOrder, 'Should render: Recommendation → Lifecycle → Performance → Details');

  console.log('  ✓ Correct section order\n');
}

function testLifecycleHeading() {
  console.log('Test: Lifecycle timeline heading');

  // Should have "Lifecycle timeline" heading
  const hasHeading = /Lifecycle timeline<\/h4>/.test(html);

  // Should use 0.9rem font-size
  const correctSize = /font-size:0\.9rem;font-weight:600;color:#3c4043;">Lifecycle timeline/.test(html);

  assert.ok(hasHeading, 'Should have "Lifecycle timeline" heading');
  assert.ok(correctSize, 'Should use 0.9rem, semibold, dark gray');

  console.log('  ✓ Lifecycle heading correct\n');
}

function testPerformanceHeading() {
  console.log('Test: Performance snapshot heading');

  // Should have "Performance snapshot" heading
  const hasHeading = /Performance snapshot<\/h4>/.test(html);

  // Should use 0.9rem font-size
  const correctSize = /font-size:0\.9rem;font-weight:600;color:#5f6368;">Performance snapshot/.test(html);

  assert.ok(hasHeading, 'Should have "Performance snapshot" heading');
  assert.ok(correctSize, 'Should use 0.9rem, semibold, muted color');

  console.log('  ✓ Performance heading correct\n');
}

function testSubmittedMetadataHeading() {
  console.log('Test: Submitted metadata heading');

  // Should have "Submitted metadata" heading
  const hasHeading = /Submitted metadata<\/h4>/.test(html);

  // Should use 0.9rem font-size
  const correctSize = /font-size:0\.9rem;font-weight:600;color:#3c4043;">Submitted metadata/.test(html);

  // Should wrap buildDetailSectionsContent
  const wrapsContent = /function buildDetailSections[\s\S]{0,300}buildDetailSectionsContent\(sub\)/.test(html);

  assert.ok(hasHeading, 'Should have "Submitted metadata" heading');
  assert.ok(correctSize, 'Should use 0.9rem, semibold, dark gray');
  assert.ok(wrapsContent, 'Should wrap buildDetailSectionsContent');

  console.log('  ✓ Submitted metadata heading correct\n');
}

function testSubheadingsUppercase() {
  console.log('Test: Detail subsection headings uppercase');

  // DETAILS, DESCRIPTION, REFERENCE should remain uppercase 11px
  const detailsUppercase = /font-size:0\.7rem;text-transform:uppercase.*>Details<\/h4>/.test(html);
  const descriptionUppercase = /font-size:0\.7rem;text-transform:uppercase.*>Description<\/h4>/.test(html);
  const referenceUppercase = /font-size:0\.7rem;text-transform:uppercase.*>Reference<\/h4>/.test(html);

  assert.ok(detailsUppercase, 'DETAILS should be uppercase 11px');
  assert.ok(descriptionUppercase, 'DESCRIPTION should be uppercase 11px');
  assert.ok(referenceUppercase, 'REFERENCE should be uppercase 11px');

  console.log('  ✓ Subsection headings uppercase\n');
}

function testRecommendationHeadingSize() {
  console.log('Test: Recommendation heading size ~16px');

  // Update needed and Retirement review should use 1rem (16px)
  const updateNeededSize = /font-size:1rem;font-weight:600.*>Update needed<\/h3>/.test(html);
  const retirementReviewSize = /font-size:1rem;font-weight:600.*>Retirement review<\/h3>/.test(html);

  assert.ok(updateNeededSize, 'Update needed should use 1rem (16px)');
  assert.ok(retirementReviewSize, 'Retirement review should use 1rem (16px)');

  console.log('  ✓ Recommendation heading ~16px\n');
}

function testSectionSpacing() {
  console.log('Test: Section spacing 24-32px');

  // Lifecycle should have margin:28px 0 24px 0
  const lifecycleSpacing = /margin:28px 0 24px 0;[\s\S]{0,100}Lifecycle timeline/.test(html);

  // Performance should have margin:32px 0 28px 0 and border-top separator
  const performanceSpacing = /margin:32px 0 28px 0;padding-top:28px;border-top:1px solid/.test(html);

  // Submitted metadata should have margin:28px 0 0 0
  const metadataSpacing = /margin:28px 0 0 0;[\s\S]{0,100}Submitted metadata/.test(html);

  assert.ok(lifecycleSpacing, 'Lifecycle should have ~28px spacing');
  assert.ok(performanceSpacing, 'Performance should have ~32px top spacing with separator');
  assert.ok(metadataSpacing, 'Submitted metadata should have ~28px top spacing');

  console.log('  ✓ Section spacing correct\n');
}

// Run all tests
try {
  testSectionOrder();
  testLifecycleHeading();
  testPerformanceHeading();
  testSubmittedMetadataHeading();
  testSubheadingsUppercase();
  testRecommendationHeadingSize();
  testSectionSpacing();

  console.log('✅ All UI hierarchy tests passed');
  console.log('\n📋 Verified structure:');
  console.log('  1. Recommendation (when active, ~16px)');
  console.log('  2. Lifecycle timeline (14px, semibold)');
  console.log('  3. Performance snapshot (14px, semibold)');
  console.log('  4. Submitted metadata (14px, semibold)');
  console.log('     - DETAILS (11px, uppercase)');
  console.log('     - DESCRIPTION (11px, uppercase)');
  console.log('     - REFERENCE (11px, uppercase)');
  console.log('  ✓ Equal heading hierarchy for main sections');
  console.log('  ✓ Clear 24-32px spacing between sections');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
