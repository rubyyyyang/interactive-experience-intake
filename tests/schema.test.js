/**
 * schema.test.js
 * Local deterministic tests for IA_Config.js and IA_Gemini.js
 * Run with: node tests/schema.test.js
 * No Apps Script runtime required.
 */

const fs = require('fs');
const path = require('path');
const { loadAppsScriptFile } = require('./node-loader.js');

// Load production code
const config = loadAppsScriptFile('./IA_Config.js');

// Inject config globals for IA_Gemini dependencies
Object.keys(config).forEach(key => {
  if (config[key] !== undefined) {
    global[key] = config[key];
  }
});
global.PREFERRED_ARCADE_SHARE_URL_EXAMPLE = 'https://interact.redhat.com/share/ArcadeID';

const gemini = loadAppsScriptFile('./IA_Gemini.js');

// Test results
const results = {
  passed: 0,
  failed: 0,
  tests: []
};

function test(name, fn) {
  try {
    fn();
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    console.log(`✓ ${name}`);
  } catch (e) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: e.message });
    console.log(`✗ ${name}`);
    console.log(`  Error: ${e.message}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertArrayEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(message || `Arrays not equal: ${JSON.stringify(actual)} vs ${JSON.stringify(expected)}`);
  }
}

console.log('\n=== ARCADE INTAKE APP - SCHEMA TESTS ===\n');

// Test 1: FIELD_OPTIONS structure validation
test('testFieldOptionsStructure', () => {
  const { FIELD_OPTIONS } = config;

  assert(FIELD_OPTIONS, 'FIELD_OPTIONS must be defined');
  assert(typeof FIELD_OPTIONS === 'object', 'FIELD_OPTIONS must be an object');

  const keys = Object.keys(FIELD_OPTIONS);
  assert(keys.length > 0, 'FIELD_OPTIONS must have at least one key');

  keys.forEach(key => {
    const values = FIELD_OPTIONS[key];
    assert(Array.isArray(values), `FIELD_OPTIONS.${key} must be an array`);
    assert(values.length > 0, `FIELD_OPTIONS.${key} must not be empty`);

    values.forEach((value, index) => {
      assert(typeof value === 'string', `FIELD_OPTIONS.${key}[${index}] must be a string`);
      assert(value.trim() === value, `FIELD_OPTIONS.${key}[${index}] must be trimmed (no leading/trailing spaces)`);
      assert(value.length > 0, `FIELD_OPTIONS.${key}[${index}] must not be empty string`);
    });

    // Check for duplicates
    const uniqueValues = new Set(values);
    assert(uniqueValues.size === values.length, `FIELD_OPTIONS.${key} contains duplicate values`);
  });
});

// Test 2: FIELD_TO_OPTIONS_ references validation
test('testFieldToOptionsReferences', () => {
  const { FIELD_TO_OPTIONS_, FIELD_OPTIONS, STATUS_TRACKER_COLUMNS } = config;

  assert(FIELD_TO_OPTIONS_, 'FIELD_TO_OPTIONS_ must be defined');

  const fieldNames = Object.keys(FIELD_TO_OPTIONS_);
  const columnValues = Object.values(STATUS_TRACKER_COLUMNS);
  const optionKeys = Object.keys(FIELD_OPTIONS);

  fieldNames.forEach(fieldName => {
    const optionsKey = FIELD_TO_OPTIONS_[fieldName];

    // Verify the field name exists in STATUS_TRACKER_COLUMNS values
    assert(
      columnValues.includes(fieldName),
      `FIELD_TO_OPTIONS_ key "${fieldName}" not found in STATUS_TRACKER_COLUMNS values`
    );

    // Verify the options key exists in FIELD_OPTIONS
    assert(
      optionKeys.includes(optionsKey),
      `FIELD_TO_OPTIONS_["${fieldName}"] references "${optionsKey}" which doesn't exist in FIELD_OPTIONS`
    );
  });
});

// Test 3: STATUS_TRACKER_COLUMNS validation
test('testColumnConstantsAreStrings', () => {
  const { STATUS_TRACKER_COLUMNS } = config;

  assert(STATUS_TRACKER_COLUMNS, 'STATUS_TRACKER_COLUMNS must be defined');
  assert(typeof STATUS_TRACKER_COLUMNS === 'object', 'STATUS_TRACKER_COLUMNS must be an object');

  const values = Object.values(STATUS_TRACKER_COLUMNS);
  assert(values.length > 0, 'STATUS_TRACKER_COLUMNS must have at least one column');

  values.forEach((value, index) => {
    assert(typeof value === 'string', `STATUS_TRACKER_COLUMNS value at index ${index} must be a string`);
    assert(value.trim() === value, `STATUS_TRACKER_COLUMNS value "${value}" must be trimmed`);
    assert(value.length > 0, `STATUS_TRACKER_COLUMNS value at index ${index} must not be empty`);
  });

  // Check for duplicate column names
  const uniqueValues = new Set(values);
  assert(
    uniqueValues.size === values.length,
    'STATUS_TRACKER_COLUMNS contains duplicate column names'
  );
});

// Test 4: EDITABLE_METADATA_FIELDS_ references validation
test('testEditableMetadataFieldsReferences', () => {
  const { EDITABLE_METADATA_FIELDS_, STATUS_TRACKER_COLUMNS } = config;

  assert(EDITABLE_METADATA_FIELDS_, 'EDITABLE_METADATA_FIELDS_ must be defined');
  assert(Array.isArray(EDITABLE_METADATA_FIELDS_), 'EDITABLE_METADATA_FIELDS_ must be an array');

  const columnValues = Object.values(STATUS_TRACKER_COLUMNS);

  EDITABLE_METADATA_FIELDS_.forEach((field, index) => {
    assert(field.key, `EDITABLE_METADATA_FIELDS_[${index}] must have a 'key' property`);
    assert(field.label, `EDITABLE_METADATA_FIELDS_[${index}] must have a 'label' property`);
    assert(field.group, `EDITABLE_METADATA_FIELDS_[${index}] must have a 'group' property`);

    // Verify key exists in STATUS_TRACKER_COLUMNS values
    assert(
      columnValues.includes(field.key),
      `EDITABLE_METADATA_FIELDS_[${index}].key "${field.key}" not found in STATUS_TRACKER_COLUMNS`
    );
  });
});

// Test 5: CTA_LINK_CATALOG structure validation
test('testCtaLinkCatalogStructure', () => {
  const { CTA_LINK_CATALOG } = config;

  assert(CTA_LINK_CATALOG, 'CTA_LINK_CATALOG must be defined');
  assert(Array.isArray(CTA_LINK_CATALOG), 'CTA_LINK_CATALOG must be an array');
  assert(CTA_LINK_CATALOG.length > 0, 'CTA_LINK_CATALOG must not be empty');

  const seenUrls = new Set();

  CTA_LINK_CATALOG.forEach((entry, index) => {
    assert(entry.label, `CTA_LINK_CATALOG[${index}] must have a 'label' property`);
    assert(entry.url, `CTA_LINK_CATALOG[${index}] must have a 'url' property`);
    assert(entry.category, `CTA_LINK_CATALOG[${index}] must have a 'category' property`);
    assert(Array.isArray(entry.products), `CTA_LINK_CATALOG[${index}].products must be an array`);
    assert(Array.isArray(entry.bestFor), `CTA_LINK_CATALOG[${index}].bestFor must be an array`);

    // Validate URL is well-formed
    assert(
      entry.url.startsWith('https://'),
      `CTA_LINK_CATALOG[${index}].url must start with https:// (got: ${entry.url})`
    );

    // Check for duplicate URLs
    assert(
      !seenUrls.has(entry.url),
      `CTA_LINK_CATALOG contains duplicate URL: ${entry.url}`
    );
    seenUrls.add(entry.url);
  });
});

// Test 6: Gemini JSON parsing (fixture)
test('testGeminiJsonParsing_fixture', () => {
  const { parseModelJson } = gemini;

  assert(typeof parseModelJson === 'function', 'parseModelJson must be a function');

  const fixtureData = fs.readFileSync(
    path.join(__dirname, 'fixtures/gemini-response.json'),
    'utf8'
  );

  // Test with clean JSON
  const parsed = parseModelJson(fixtureData);
  assert(parsed, 'parseModelJson must return a value');
  assert(typeof parsed === 'object', 'parseModelJson must return an object');
  assert(parsed.demo_title, 'Parsed response must have demo_title');

  // Test with markdown fences (Gemini sometimes adds these)
  const wrappedJson = '```json\n' + fixtureData + '\n```';
  const parsedWrapped = parseModelJson(wrappedJson);
  assert(parsedWrapped.demo_title, 'parseModelJson must handle markdown fences');

  // Test with leading/trailing whitespace
  const paddedJson = '\n\n  ' + fixtureData + '  \n\n';
  const parsedPadded = parseModelJson(paddedJson);
  assert(parsedPadded.demo_title, 'parseModelJson must handle whitespace');
});

// Test 7: normalizeDraft (fixture)
test('testNormalizeDraft_fixture', () => {
  const { normalizeDraft } = gemini;

  assert(typeof normalizeDraft === 'function', 'normalizeDraft must be a function');

  const fixtureData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures/gemini-response.json'), 'utf8')
  );

  const normalized = normalizeDraft(fixtureData);

  // Verify all expected fields are present
  assert(typeof normalized.demo_title === 'string', 'normalized.demo_title must be a string');
  assert(typeof normalized.content_type_suggestion === 'string', 'normalized.content_type_suggestion must be a string');
  assert(typeof normalized.description_without_gid === 'string', 'normalized.description_without_gid must be a string');
  assert(typeof normalized.description_for_seo === 'string', 'normalized.description_for_seo must be a string');
  assert(Array.isArray(normalized.language_suggestions), 'normalized.language_suggestions must be an array');
  assert(Array.isArray(normalized.cta_link_suggestions), 'normalized.cta_link_suggestions must be an array');
  assert(Array.isArray(normalized.seo_keywords), 'normalized.seo_keywords must be an array');
  assert(typeof normalized.vertical_suggestion === 'string', 'normalized.vertical_suggestion must be a string');
  assert(typeof normalized.event_or_project_suggestion === 'string', 'normalized.event_or_project_suggestion must be a string');
  assert(typeof normalized.primary_product_suggestion === 'string', 'normalized.primary_product_suggestion must be a string');
  assert(Array.isArray(normalized.other_products_suggestion), 'normalized.other_products_suggestion must be an array');
  assert(typeof normalized.tdp_suggestion === 'string', 'normalized.tdp_suggestion must be a string');
  assert(typeof normalized.sales_tactic_suggestion === 'string', 'normalized.sales_tactic_suggestion must be a string');
  assert(typeof normalized.marketing_program_suggestion === 'string', 'normalized.marketing_program_suggestion must be a string');
  assert(Array.isArray(normalized.tour_highlights), 'normalized.tour_highlights must be an array');
  assert(typeof normalized.field_confidence === 'object', 'normalized.field_confidence must be an object');
  assert(Array.isArray(normalized.confidence_notes), 'normalized.confidence_notes must be an array');
  assert(Array.isArray(normalized.fields_needing_creator_confirmation), 'normalized.fields_needing_creator_confirmation must be an array');

  // Verify CTA link suggestions have correct structure
  normalized.cta_link_suggestions.forEach((cta, index) => {
    assert(cta.label, `CTA link ${index} must have a label`);
    assert(cta.url, `CTA link ${index} must have a URL`);
    assert(cta.reason, `CTA link ${index} must have a reason`);
  });
});

// Test 8: Guide extraction format validation (fixture - validates stored output shape only)
test('testGuideExtractionStoredFormat_fixture', () => {
  // NOTE: This test validates the stored guide extraction JSON format.
  // It does NOT run the extraction parser - it only checks the output shape.

  const fixtureData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures/guide-extraction.json'), 'utf8')
  );

  // Validate required top-level fields
  assert(typeof fixtureData.arcadeId === 'string', 'arcadeId must be a string');
  assert(typeof fixtureData.title === 'string', 'title must be a string');
  assert(typeof fixtureData.guideUrl === 'string', 'guideUrl must be a string');
  assert(typeof fixtureData.shareUrl === 'string', 'shareUrl must be a string');
  assert(typeof fixtureData.duration === 'string', 'duration must be a string');
  assert(Array.isArray(fixtureData.steps), 'steps must be an array');
  assert(Array.isArray(fixtureData.links), 'links must be an array');
  assert(typeof fixtureData.bodyText === 'string', 'bodyText must be a string');
  assert(typeof fixtureData.extractedAt === 'string', 'extractedAt must be a string');

  // Validate step structure
  fixtureData.steps.forEach((step, index) => {
    assert(typeof step.stepNumber === 'number', `steps[${index}].stepNumber must be a number`);
    assert(typeof step.text === 'string', `steps[${index}].text must be a string`);
    assert(typeof step.imageUrl === 'string', `steps[${index}].imageUrl must be a string`);
    assert(typeof step.imageAlt === 'string', `steps[${index}].imageAlt must be a string`);
  });

  // Validate link structure
  fixtureData.links.forEach((link, index) => {
    assert(typeof link.label === 'string', `links[${index}].label must be a string`);
    assert(typeof link.href === 'string', `links[${index}].href must be a string`);
  });
});

// Print summary
console.log('\n=== TEST SUMMARY ===\n');
console.log(`Total: ${results.passed + results.failed}`);
console.log(`Passed: ${results.passed}`);
console.log(`Failed: ${results.failed}`);

if (results.failed > 0) {
  console.log('\nFailed tests:');
  results.tests.filter(t => t.status === 'FAIL').forEach(t => {
    console.log(`  - ${t.name}: ${t.error}`);
  });
  process.exit(1);
} else {
  console.log('\n✓ All tests passed!\n');
  process.exit(0);
}
