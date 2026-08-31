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

// Test 6: parseModelJson happy path
test('testParseModelJson_happyPath', () => {
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
  assert(parsed.field_confidence, 'Parsed response must have field_confidence');

  // Test with markdown fences (Gemini sometimes adds these)
  const wrappedJson = '```json\n' + fixtureData + '\n```';
  const parsedWrapped = parseModelJson(wrappedJson);
  assertEquals(parsedWrapped.demo_title, parsed.demo_title, 'parseModelJson must handle markdown fences');

  // Test with leading/trailing whitespace
  const paddedJson = '\n\n  ' + fixtureData + '  \n\n';
  const parsedPadded = parseModelJson(paddedJson);
  assertEquals(parsedPadded.demo_title, parsed.demo_title, 'parseModelJson must handle whitespace');
});

// Test 7: parseModelJson edge cases (existing contract)
test('testParseModelJson_edgeCases', () => {
  const { parseModelJson } = gemini;

  // Empty/null/undefined input should throw
  try {
    parseModelJson('');
    assert(false, 'Should throw on empty input');
  } catch (e) {
    assert(e.message.includes('Empty'), 'Should throw "Empty model content" error');
  }

  try {
    parseModelJson(null);
    assert(false, 'Should throw on null input');
  } catch (e) {
    assert(e.message.includes('Empty'), 'Should throw error on null');
  }

  try {
    parseModelJson(undefined);
    assert(false, 'Should throw on undefined input');
  } catch (e) {
    assert(e.message.includes('Empty'), 'Should throw error on undefined');
  }

  // JSON with BOM (already handled by implementation)
  const withBom = '﻿{"demo_title": "Test with BOM"}';
  const parsed1 = parseModelJson(withBom);
  assertEquals(parsed1.demo_title, 'Test with BOM', 'Should handle BOM');

  // JSON with trailing comma (already repaired by implementation)
  const trailingComma = '{"demo_title": "Test", "items": [1, 2,]}';
  const parsed2 = parseModelJson(trailingComma);
  assertEquals(parsed2.demo_title, 'Test', 'Should repair trailing commas');
  assertArrayEquals(parsed2.items, [1, 2], 'Should parse array with trailing comma');

  // JSON embedded in text (implementation finds first {)
  const embedded = 'Some text before\n{"demo_title": "Embedded"}\nSome text after';
  const parsed3 = parseModelJson(embedded);
  assertEquals(parsed3.demo_title, 'Embedded', 'Should extract JSON from embedded text');

  // Malformed JSON (no opening brace) should throw
  try {
    parseModelJson('not json at all');
    assert(false, 'Should throw on malformed JSON');
  } catch (e) {
    assert(e.message.includes('opening JSON brace'), 'Should throw "No opening JSON brace" error');
  }

  // Incomplete JSON (unclosed brace) should throw
  try {
    parseModelJson('{"demo_title": "Test"');
    assert(false, 'Should throw on incomplete JSON');
  } catch (e) {
    assert(e.message.includes('complete JSON object'), 'Should throw "No complete JSON object found" error');
  }
});

// Test 8: normalizeDraft structure validation
test('testNormalizeDraft_structure', () => {
  const { normalizeDraft } = gemini;

  assert(typeof normalizeDraft === 'function', 'normalizeDraft must be a function');

  const fixtureData = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'fixtures/gemini-response.json'), 'utf8')
  );

  const normalized = normalizeDraft(fixtureData);

  // Verify all expected fields are present with correct types
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

// Test 9: normalizeDraft contract validation (defaults, fallbacks, filtering)
test('testNormalizeDraft_contracts', () => {
  const { normalizeDraft } = gemini;

  // Empty draft should return all defaults
  const empty = normalizeDraft({});
  assertEquals(empty.demo_title, '', 'Empty draft should default demo_title to empty string');
  assertEquals(empty.content_type_suggestion, '', 'content_type_suggestion should always be empty (business rule)');
  assertEquals(empty.group_suggestion, '', 'group_suggestion should always be empty (business rule)');
  assertArrayEquals(empty.language_suggestions, [], 'Empty draft should default arrays to []');
  assertArrayEquals(empty.seo_keywords, [], 'Should default seo_keywords to []');
  assertArrayEquals(empty.other_products_suggestion, [], 'Should default other_products_suggestion to []');
  assertEquals(typeof empty.field_confidence, 'object', 'Should default field_confidence to {}');
  assertArrayEquals(Object.keys(empty.field_confidence), [], 'Empty field_confidence should be {}');

  // Fallback field handling: description_with_gid → description_without_gid
  const withOldField = { description_with_gid: 'Old field value' };
  const normalized1 = normalizeDraft(withOldField);
  assertEquals(normalized1.description_without_gid, 'Old field value', 'Should use description_with_gid as fallback');

  // New field should take precedence over old
  const withBoth = { description_without_gid: 'New', description_with_gid: 'Old' };
  const normalized2 = normalizeDraft(withBoth);
  assertEquals(normalized2.description_without_gid, 'New', 'description_without_gid should take precedence');

  // Single string → array (language_suggestion → language_suggestions)
  const singleString = { language_suggestion: 'English' };
  const normalized3 = normalizeDraft(singleString);
  assert(Array.isArray(normalized3.language_suggestions), 'Should convert single string to array');
  assertEquals(normalized3.language_suggestions.length, 1, 'Should have one element');
  assertEquals(normalized3.language_suggestions[0], 'English', 'Should wrap string in array');

  // Array field should passthrough
  const withArray = { language_suggestions: ['English', 'Spanish'] };
  const normalized4 = normalizeDraft(withArray);
  assertArrayEquals(normalized4.language_suggestions, ['English', 'Spanish'], 'Should preserve array');

  // Group should always be filtered from fields_needing_creator_confirmation (business rule)
  const withGroup = { fields_needing_creator_confirmation: ['TDP', 'Group', 'Sales Tactic', 'group'] };
  const normalized5 = normalizeDraft(withGroup);
  assert(!normalized5.fields_needing_creator_confirmation.includes('Group'), 'Should filter out "Group"');
  assert(!normalized5.fields_needing_creator_confirmation.includes('group'), 'Should filter out "group" (case-insensitive)');
  assertEquals(normalized5.fields_needing_creator_confirmation.length, 2, 'Should have 2 items after filtering');

  // field_confidence wrong type should default to {}
  const badConfidence1 = { field_confidence: 'not an object' };
  const normalized6 = normalizeDraft(badConfidence1);
  assertEquals(typeof normalized6.field_confidence, 'object', 'Should default bad field_confidence to {}');
  assertArrayEquals(Object.keys(normalized6.field_confidence), [], 'Bad field_confidence should become empty object');

  const badConfidence2 = { field_confidence: null };
  const normalized7 = normalizeDraft(badConfidence2);
  assertEquals(typeof normalized7.field_confidence, 'object', 'Should default null field_confidence to {}');
});

// Test 10: Guide extraction format validation (fixture - validates stored output shape only)
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
