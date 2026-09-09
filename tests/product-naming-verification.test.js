/**
 * Product-Level Naming Verification
 *
 * Verifies that product-level names use "Interactive Experience"
 * while content-type labels preserve "Interactive Demo" where appropriate.
 */

const fs = require('fs');
const path = require('path');

const realConsole = console;

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      realConsole.log(`✅ ${name}`);
      passed++;
    } catch (error) {
      realConsole.error(`❌ ${name}: ${error.message}`);
      failed++;
    }
  }

  function assertIncludes(text, substring, message) {
    if (!text.includes(substring)) {
      throw new Error(`${message}: expected to include "${substring}"`);
    }
  }

  function assertNotIncludes(text, substring, message) {
    if (text.includes(substring)) {
      throw new Error(`${message}: should NOT include "${substring}"`);
    }
  }

  // Read files
  const codeJs = fs.readFileSync(path.join(__dirname, '..', 'Code.js'), 'utf8');
  const indexHtml = fs.readFileSync(path.join(__dirname, '..', 'Index.html'), 'utf8');
  const statusHtml = fs.readFileSync(path.join(__dirname, '..', 'StatusTracker.html'), 'utf8');
  const geminiJs = fs.readFileSync(path.join(__dirname, '..', 'IA_Gemini.js'), 'utf8');

  // Test 1: Intake browser title uses "Interactive Experience Intake"
  test("Intake browser title is 'Interactive Experience Intake'", () => {
    assertIncludes(indexHtml, '<title>Interactive Experience Intake</title>', "Index.html should have correct title tag");
    assertIncludes(codeJs, ".setTitle('Interactive Experience Intake')", "Code.js should set correct title");
  });

  // Test 2: Status Tracker browser title uses "Interactive Experience Status Tracker"
  test("Status Tracker browser title is 'Interactive Experience Status Tracker'", () => {
    assertIncludes(statusHtml, '<title>Interactive Experience Status Tracker</title>', "StatusTracker.html should have correct title tag");
    assertIncludes(codeJs, ".setTitle('Interactive Experience Status Tracker')", "Code.js should set correct title");
  });

  // Test 3: Intake visible heading uses "Interactive Experience Intake"
  test("Intake visible heading is 'Interactive Experience Intake'", () => {
    assertIncludes(indexHtml, '<h1>Interactive Experience Intake</h1>', "Index.html should have correct h1");
  });

  // Test 4: Status Tracker visible heading uses "Interactive Experience Status Tracker"
  test("Status Tracker visible heading is 'Interactive Experience Status Tracker'", () => {
    assertIncludes(statusHtml, 'Interactive Experience Status Tracker', "StatusTracker.html should have correct heading");
  });

  // Test 5: User-Agent uses "Interactive Experience Intake Assistant"
  test("User-Agent is 'Interactive Experience Intake Assistant'", () => {
    assertIncludes(geminiJs, "'User-Agent': 'Interactive Experience Intake Assistant'", "IA_Gemini.js should use correct User-Agent");
  });

  // Test 6: No product-level "Interactive Demo Intake" remains
  test("No product-level 'Interactive Demo Intake' remains", () => {
    assertNotIncludes(codeJs, "Interactive Demo Intake", "Code.js should not have old product name");
    assertNotIncludes(indexHtml, "Interactive Demo Intake", "Index.html should not have old product name");
  });

  // Test 7: No product-level "Interactive Demo Status Tracker" remains
  test("No product-level 'Interactive Demo Status Tracker' remains", () => {
    assertNotIncludes(codeJs, "Interactive Demo Status Tracker", "Code.js should not have old product name");
    assertNotIncludes(statusHtml, "Interactive Demo Status Tracker", "StatusTracker.html should not have old product name");
  });

  // Test 8: No old User-Agent remains
  test("No old 'Interactive Demo Intake Assistant' User-Agent remains", () => {
    assertNotIncludes(geminiJs, "Interactive Demo Intake Assistant", "IA_Gemini.js should not have old User-Agent");
  });

  realConsole.log(`\n✅ ${passed} passed, ${failed > 0 ? '❌ ' + failed + ' failed' : 'all tests passed'}`);
  return failed === 0;
}

if (require.main === module) {
  const success = runTests();
  process.exit(success ? 0 : 1);
}
