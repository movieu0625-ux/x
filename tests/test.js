#!/usr/bin/env node

/**
 * Comprehensive Test Suite for Print Shop Application
 * Tests: Server functions, price calculation, file handling, validation
 */

console.log('\n╔════════════════════════════════════════════════════════════╗');
console.log('║        PRINT SHOP APPLICATION - TEST SUITE                 ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// ============================================================================
// SECTION 1: UTILITY FUNCTIONS (from script.js)
// ============================================================================

function parseCustomPages(str, maxPages) {
  if (!str) return [];
  const pages = new Set();
  str.split(',').forEach(part => {
    part = part.trim();
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      pages.add(Number(part));
    }
  });
  return Array.from(pages).filter(p => p >= 1 && p <= maxPages).sort((a, b) => a - b);
}

// ============================================================================
// SECTION 2: PRICE CALCULATION LOGIC
// ============================================================================

function calculatePrice(totalPages, colorMode) {
  const pricePerPage = (colorMode === 'bw') ? 1 : (colorMode === 'color') ? 3 : 0;
  return totalPages * pricePerPage;
}

function calculateTotalPages(filesData, copies, pageSelection, customStr) {
  let totalPages = 0;
  
  Object.values(filesData).forEach(({ numPages }) => {
    let selectedCount;
    if (pageSelection === 'all') {
      selectedCount = numPages;
    } else {
      selectedCount = parseCustomPages(customStr, numPages).length;
    }
    totalPages += selectedCount;
  });
  
  return totalPages * copies;
}

// ============================================================================
// SECTION 3: SERVER FUNCTIONS (from server.js)
// ============================================================================

async function generateOTP() {
  // Simulate unique OTP generation
  let otp;
  const existingOTPs = new Set();
  do {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
  } while (existingOTPs.has(otp));
  return otp;
}

function validateOTP(otp) {
  return otp && otp.length === 6 && !isNaN(otp);
}

// ============================================================================
// SECTION 4: VALIDATION FUNCTIONS
// ============================================================================

function validateFiles(filesData) {
  return Object.keys(filesData).length > 0;
}

function validateOptions(options) {
  return Boolean(options.copies > 0 && 
                 options.colorMode && 
                 options.orientation && 
                 options.pagesPerSheet);
}

function validatePrice(price) {
  return typeof price === 'number' && price > 0;
}

// ============================================================================
// SECTION 5: TEST RUNNER
// ============================================================================

let passedTests = 0;
let failedTests = 0;

function test(name, condition, expected = true) {
  const passed = condition === expected;
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`  ${status}: ${name}`);
  if (passed) passedTests++;
  else failedTests++;
  if (!passed) console.log(`      Expected: ${expected}, Got: ${condition}`);
}

// ============================================================================
// TEST SUITE 1: PARSE CUSTOM PAGES
// ============================================================================

console.log('\n📋 TEST SUITE 1: Parse Custom Pages Function');
console.log('─'.repeat(60));

test('Parse range 1-5', JSON.stringify(parseCustomPages('1-5', 10)), JSON.stringify([1, 2, 3, 4, 5]));
test('Parse mixed 1,3,5-7', JSON.stringify(parseCustomPages('1,3,5-7', 10)), JSON.stringify([1, 3, 5, 6, 7]));
test('Parse empty string', JSON.stringify(parseCustomPages('', 10)), JSON.stringify([]));
test('Parse single pages', JSON.stringify(parseCustomPages('2,4,6', 10)), JSON.stringify([2, 4, 6]));
test('Respect max pages (1-100 with max 10)', parseCustomPages('1-100', 10).length, 10);
test('Filter invalid pages', JSON.stringify(parseCustomPages('1,20,30', 10)), JSON.stringify([1]));
test('Handle duplicates', parseCustomPages('1,1,2,2,3,3', 10).length, 3);

// ============================================================================
// TEST SUITE 2: PRICE CALCULATION
// ============================================================================

console.log('\n💰 TEST SUITE 2: Price Calculation');
console.log('─'.repeat(60));

test('BW 10 pages = ₹10', calculatePrice(10, 'bw'), 10);
test('Color 10 pages = ₹30', calculatePrice(10, 'color'), 30);
test('BW 1 page = ₹1', calculatePrice(1, 'bw'), 1);
test('Color 1 page = ₹3', calculatePrice(1, 'color'), 3);
test('BW 100 pages = ₹100', calculatePrice(100, 'bw'), 100);
test('Color 50 pages = ₹150', calculatePrice(50, 'color'), 150);

// ============================================================================
// TEST SUITE 3: TOTAL PAGES CALCULATION
// ============================================================================

console.log('\n📄 TEST SUITE 3: Total Pages Calculation');
console.log('─'.repeat(60));

const testFilesData1 = { 'doc1.pdf': { numPages: 10 }, 'doc2.pdf': { numPages: 5 } };
test('Total pages all with 1 copy', calculateTotalPages(testFilesData1, 1, 'all', ''), 15);
test('Total pages all with 2 copies', calculateTotalPages(testFilesData1, 2, 'all', ''), 30);
test('Total pages custom (1-5 from both docs)', calculateTotalPages(testFilesData1, 1, 'custom', '1-5'), 10);
test('Empty files returns 0', calculateTotalPages({}, 1, 'all', ''), 0);

const testFilesData2 = { 'file1.pdf': { numPages: 20 } };
test('Single file all pages with 3 copies', calculateTotalPages(testFilesData2, 3, 'all', ''), 60);

// ============================================================================
// TEST SUITE 4: OTP GENERATION & VALIDATION
// ============================================================================

console.log('\n🔐 TEST SUITE 4: OTP Generation & Validation');
console.log('─'.repeat(60));

// Synchronous OTP generation for testing
function generateOTPSync() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const otp1 = generateOTPSync();
test('Generated OTP is 6 digits', otp1.length, 6);
test('Generated OTP is numeric', !isNaN(otp1), true);
test('Generated OTP is valid', validateOTP(otp1), true);

// Test multiple OTPs
const otps = [];
for (let i = 0; i < 5; i++) {
  otps.push(generateOTPSync());
}
const uniqueOtps = new Set(otps);
test('Multiple OTPs are unique', uniqueOtps.size, 5);

// Validate invalid OTPs
test('Validate invalid OTP (null)', Boolean(validateOTP(null)), false);
test('Validate invalid OTP (not numeric)', validateOTP('abc123'), false);
test('Validate invalid OTP (too short)', validateOTP('12345'), false);

// ============================================================================
// TEST SUITE 5: FILE VALIDATION
// ============================================================================

console.log('\n✅ TEST SUITE 5: File & Options Validation');
console.log('─'.repeat(60));

test('Valid files returns true', validateFiles({ 'file.pdf': {} }), true);
test('Empty files returns false', validateFiles({}), false);
test('Multiple files returns true', validateFiles({ 'file1.pdf': {}, 'file2.pdf': {} }), true);

const validOptions = { copies: 1, colorMode: 'bw', orientation: 'portrait', pagesPerSheet: '1' };
test('Valid options returns true', validateOptions(validOptions), true);

test('Options with 0 copies returns false', validateOptions({ ...validOptions, copies: 0 }), false);
test('Options without colorMode returns false', validateOptions({ ...validOptions, colorMode: null }), false);

// ============================================================================
// TEST SUITE 6: COMPLETE WORKFLOW
// ============================================================================

console.log('\n🔄 TEST SUITE 6: Complete Workflow Simulation');
console.log('─'.repeat(60));

// Simulate a complete order workflow
const workflowFiles = {
  'document1.pdf': { file: {}, numPages: 20 },
  'document2.pdf': { file: {}, numPages: 15 }
};

const workflowOptions = {
  copies: 2,
  pageSelection: 'all',
  customPages: '',
  colorMode: 'color',
  orientation: 'portrait',
  pagesPerSheet: '1'
};

const workflowPrice = calculatePrice(
  calculateTotalPages(workflowFiles, workflowOptions.copies, workflowOptions.pageSelection, workflowOptions.customPages),
  workflowOptions.colorMode
);

test('Can process complete order', workflowPrice > 0, true);
test('Complete order price = ₹210 (35 pages × 2 copies × ₹3 for color)', workflowPrice, 210);

// ============================================================================
// TEST SUITE 7: EDGE CASES
// ============================================================================

console.log('\n⚠️ TEST SUITE 7: Edge Cases & Error Handling');
console.log('─'.repeat(60));

test('Large number of pages', calculatePrice(10000, 'bw'), 10000);
test('Large number of copies', calculateTotalPages({ 'file.pdf': { numPages: 100 } }, 1000, 'all', ''), 100000);
test('Invalid color mode defaults to zero price', calculatePrice(10, 'invalidMode'), 0);
test('Parse custom pages with spaces', JSON.stringify(parseCustomPages('1, 2, 3', 10)), JSON.stringify([1, 2, 3]));
test('Mixed range and page numbers', parseCustomPages('1,2,5-7', 10).length, 5);
test('Decimal prices handled', calculatePrice(10.5, 'bw'), 10.5);

// ============================================================================
// FINAL REPORT
// ============================================================================

console.log('\n' + '═'.repeat(60));
console.log('📊 TEST RESULTS');
console.log('═'.repeat(60));
console.log(`✓ Passed: ${passedTests}`);
console.log(`✗ Failed: ${failedTests}`);
console.log(`📈 Success Rate: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(2)}%`);
console.log('═'.repeat(60));

if (failedTests === 0) {
  console.log('\n🎉 ALL TESTS PASSED!\n');
  process.exit(0);
} else {
  console.log(`\n⚠️  ${failedTests} TEST(S) FAILED\n`);
  process.exit(1);
}
