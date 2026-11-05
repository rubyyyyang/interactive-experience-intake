/**
 * Unified Recommendation Test
 * Verifies consistent evidence presentation and heading hierarchy
 */

const assert = require('assert');
const fs = require('fs');

console.log('Running unified recommendation test...\n');

const html = fs.readFileSync('/Users/rubyyang/arcade-intake-app/StatusTracker.html', 'utf8');

function testRecommendationHeadingColor() {
  console.log('Test: Recommendation heading uses #202124');

  const updateNeededColor = /font-size:1rem;font-weight:600;color:#202124;">Update needed/.test(html);
  const retirementReviewColor = /font-size:1rem;font-weight:600;color:#202124;">Retirement review/.test(html);

  assert.ok(updateNeededColor, 'Update needed should use #202124');
  assert.ok(retirementReviewColor, 'Retirement review should use #202124');

  console.log('  ✓ Recommendation heading color correct\n');
}

function testSectionHeadingColors() {
  console.log('Test: Section headings use #3c4043');

  const lifecycleColor = /font-size:0\.9rem;font-weight:600;color:#3c4043;">Lifecycle timeline/.test(html);
  const performanceColor = /font-size:0\.9rem;font-weight:600;color:#3c4043;">Performance snapshot/.test(html);
  const metadataColor = /font-size:0\.9rem;font-weight:600;color:#3c4043;">Submitted metadata/.test(html);

  assert.ok(lifecycleColor, 'Lifecycle timeline should use #3c4043');
  assert.ok(performanceColor, 'Performance snapshot should use #3c4043');
  assert.ok(metadataColor, 'Submitted metadata should use #3c4043');

  console.log('  ✓ Section heading colors correct\n');
}

function testSubsectionHeadingColor() {
  console.log('Test: Subsection headings use #80868b');

  const subsectionColor = /font-size:0\.7rem;text-transform:uppercase;letter-spacing:0\.04em;color:#80868b;/.test(html);

  assert.ok(subsectionColor, 'DETAILS/DESCRIPTION/REFERENCE should use #80868b');

  console.log('  ✓ Subsection heading color correct\n');
}

function testUnifiedEvidencePresentation() {
  console.log('Test: Both recommendations use unified evidence format');

  // Should have reason headline (bold, #202124)
  const updateReasonHeadline = /font-size:0\.88rem;font-weight:600;color:#202124.*>Low completion rate</.test(html);
  const retirementReasonHeadline = /font-size:0\.88rem;font-weight:600;color:#202124.*retirementEvidence\.headline/.test(html);

  // Should have evidence sentence (muted, #5f6368)
  const updateEvidenceSentence = /buildCompletionEvidence_\(sub\.perfSignals/.test(html) && /font-size:0\.85rem;color:#5f6368.*evidenceSentence/.test(html);
  const retirementEvidenceSentence = /buildRetirementEvidence_\(sub\.perfSignals/.test(html) && /font-size:0\.85rem;color:#5f6368.*retirementEvidence\.sentence/.test(html);

  assert.ok(updateReasonHeadline, 'Update needed should have bold reason headline');
  assert.ok(retirementReasonHeadline, 'Retirement review should have bold reason headline');
  assert.ok(updateEvidenceSentence, 'Update needed should have muted evidence sentence');
  assert.ok(retirementEvidenceSentence, 'Retirement review should have muted evidence sentence');

  console.log('  ✓ Unified evidence presentation\n');
}

function testNoMultilineEvidence() {
  console.log('Test: Evidence is single sentence, not stacked lines');

  // Old pattern used flex-direction:column and multiple divs
  // New pattern uses single sentence
  const hasOldPattern = /margin-top:10px;display:flex;flex-direction:column;gap:4px/.test(html);

  assert.strictEqual(hasOldPattern, false, 'Should not use old stacked evidence pattern');

  console.log('  ✓ No stacked evidence lines\n');
}

function testNextStepHeading() {
  console.log('Test: Response form uses "What\'s your next step?"');

  const nextStepHeading = /What\\'s your next step\?<\/h4>/.test(html);
  const nextStepColor = /font-size:0\.9rem;font-weight:600;color:#202124;">What\\'s your next step/.test(html);

  assert.ok(nextStepHeading, 'Should use "What\'s your next step?" heading');
  assert.ok(nextStepColor, 'Next step heading should use 14px, #202124');

  console.log('  ✓ Next step heading correct\n');
}

function testResponseFormDivider() {
  console.log('Test: Response form has divider above it');

  const hasDivider = /margin-top:20px;padding-top:20px;border-top:1px solid #e8eaed;[\s\S]{0,200}What\\'s your next step/.test(html);

  assert.ok(hasDivider, 'Response form should have divider separator');

  console.log('  ✓ Response form divider present\n');
}

function testSectionDividers() {
  console.log('Test: Section dividers use #e8eaed');

  const performanceDivider = /border-top:1px solid #e8eaed;[\s\S]{0,400}Performance snapshot/.test(html);
  const formDivider = /border-top:1px solid #e8eaed[\s\S]{0,200}What\\'s your next step/.test(html);

  assert.ok(performanceDivider, 'Performance snapshot should have #e8eaed divider');
  assert.ok(formDivider, 'Response form should have #e8eaed divider');

  console.log('  ✓ Section dividers consistent\n');
}

function testEvidenceFunctions() {
  console.log('Test: New evidence builder functions exist');

  const hasCompletionEvidence = /function buildCompletionEvidence_\(signalsStr, completionRate, playersPerMonth\)/.test(html);
  const hasRetirementEvidence = /function buildRetirementEvidence_\(signalsStr, mtOpportunity, mtWon, actionReason, contentAge, playersPerMonth\)/.test(html);

  assert.ok(hasCompletionEvidence, 'Should have buildCompletionEvidence_ function');
  assert.ok(hasRetirementEvidence, 'Should have buildRetirementEvidence_ function');

  console.log('  ✓ Evidence builder functions present\n');
}

// Run all tests
try {
  testRecommendationHeadingColor();
  testSectionHeadingColors();
  testSubsectionHeadingColor();
  testUnifiedEvidencePresentation();
  testNoMultilineEvidence();
  testNextStepHeading();
  testResponseFormDivider();
  testSectionDividers();
  testEvidenceFunctions();

  console.log('✅ All unified recommendation tests passed');
  console.log('\n📋 Verified consistency:');
  console.log('  ✓ Recommendation heading: 16px, #202124');
  console.log('  ✓ Section headings: 14px, semibold, #3c4043');
  console.log('  ✓ Subsection headings: 11px, uppercase, #80868b');
  console.log('  ✓ Unified evidence: Bold headline + muted sentence');
  console.log('  ✓ No stacked evidence lines');
  console.log('  ✓ "What\'s your next step?" before forms');
  console.log('  ✓ Consistent #e8eaed dividers');
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
