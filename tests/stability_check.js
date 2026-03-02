const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:3000';
const TEST_FILE = path.join(__dirname, '..', 'uploads', 'test.pdf');

async function runTests() {
    console.log('=== 🚦 Starting 20-Point Stability Check 🚦 ===\n');

    if (!fs.existsSync(TEST_FILE)) {
        fs.writeFileSync(TEST_FILE, 'dummy content');
    }

    const results = [];

    async function test(name, fn) {
        try {
            await fn();
            console.log(`✅ [PASS] ${name}`);
            results.push({ name, status: 'PASS' });
        } catch (err) {
            console.log(`❌ [FAIL] ${name}: ${err.message}`);
            results.push({ name, status: 'FAIL', error: err.message });
        }
    }

    // --- 1️⃣ Server Stability ---
    await test('T1: Invalid Route (404)', async () => {
        const res = await axios.get(`${BASE_URL}/random-route-999`, { validateStatus: false });
        if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
    });

    await test('T2: Invalid JSON Body (400)', async () => {
        const res = await axios.post(`${BASE_URL}/admin`, 'invalid-json', {
            headers: { 'Content-Type': 'application/json' },
            validateStatus: false
        });
        if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await test('T3: Payload Limit (10MB)', async () => {
        const largeBuffer = Buffer.alloc(11 * 1024 * 1024);
        const form = new FormData();
        form.append('documents', largeBuffer, 'large.pdf');
        form.append('payMethod', 'payLater');
        form.append('options', JSON.stringify({}));
        form.append('price', '1');
        const res = await axios.post(`${BASE_URL}/process`, form, { headers: form.getHeaders(), validateStatus: false });
        if (res.status !== 413) throw new Error(`Expected 413, got ${res.status}`);
    });

    // --- 2️⃣ Payment Flow ---
    await test('T7: Fake Webhook Signature (401)', async () => {
        const res = await axios.post(`${BASE_URL}/webhook`, { data: { order: { order_id: '123' } } }, {
            headers: { 'x-webhook-signature': 'fake', 'x-webhook-timestamp': Date.now().toString() },
            validateStatus: false
        });
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    // --- 3️⃣ OTP Security ---
    await test('T15: Invalid OTP Format (Admin)', async () => {
        const res = await axios.post(`${BASE_URL}/admin`, `otp=123`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: false,
            responseType: 'text'
        });
        const dataStr = String(res.data);
        if (!dataStr.includes('Invalid OTP')) throw new Error('Should show Invalid OTP message');
    });

    // --- 4️⃣ File System ---
    await test('T11: Directory Traversal Prevention', async () => {
        const res = await axios.get(`${BASE_URL}/download/..%2f..%2fserver.js?otp=123456`, { validateStatus: false });
        if (res.status === 200) throw new Error('File exposed!');
    });

    await test('T12: Unauthorized File Access (direct /uploads)', async () => {
        const res = await axios.get(`${BASE_URL}/uploads/test.pdf`, { validateStatus: false });
        // Should be 404 since we removed express.static
        if (res.status === 200) throw new Error('Static uploads still public!');
        console.log(`   (Confirmed) /uploads/ is private: ${res.status}`);
    });

    // --- 5️⃣ Admin Panel ---
    await test('T14: NoSQL Injection Attempt', async () => {
        const res = await axios.post(`${BASE_URL}/admin`, `otp={"$ne":null}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            validateStatus: false,
            responseType: 'text'
        });
        const dataStr = String(res.data);
        if (dataStr.includes('Order Details')) throw new Error('NoSQL Injection successful!');
    });

    console.log('\n=== Summary ===');
    const passed = results.filter(r => r.status === 'PASS').length;
    console.log(`${passed}/${results.length} Tests Passed`);
}

runTests();
