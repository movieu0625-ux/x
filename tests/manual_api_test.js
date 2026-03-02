const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testApiFlows() {
    const baseUrl = 'http://localhost:3000';
    console.log('--- Testing API Flows at', baseUrl, '---\n');

    try {
        // 1. Test Pay Later Flow
        console.log('1. Testing Pay Later Flow...');
        const form1 = new FormData();
        const testFilePath = path.join(__dirname, '..', 'uploads', 'test.pdf');
        form1.append('documents', fs.createReadStream(testFilePath));
        form1.append('payMethod', 'payLater');
        form1.append('options', JSON.stringify({
            copies: 1,
            pageSelection: 'All Pages',
            colorMode: 'bw',
            orientation: 'portrait',
            pagesPerSheet: '1'
        }));
        form1.append('price', '1');

        const res1 = await axios.post(`${baseUrl}/process`, form1, {
            headers: form1.getHeaders()
        });

        console.log('Pay Later Response:', res1.data);
        const otp = res1.data.otp;
        if (otp && otp.length === 6) {
            console.log('✓ Success: Received 6-digit OTP:', otp);
        } else {
            console.error('✗ Failure: Invalid OTP received');
        }

        // 2. Test Admin Flow (Verification of Order)
        console.log('\n2. Testing Admin Flow (Verification)...');
        // The admin route is POST /admin with {otp}
        const resAdmin = await axios.post(`${baseUrl}/admin`, `otp=${otp}`, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        if (resAdmin.data.includes(`Order Details for OTP: ${otp}`)) {
            console.log('✓ Success: Order found in Admin panel');
            if (resAdmin.data.includes('Status: pending')) {
                console.log('✓ Success: Order status is "pending"');
            }
        } else {
            console.error('✗ Failure: Order not found in Admin panel or error in response');
        }

        // 3. Test Pay Now Flow (Production Cashfree Integration)
        console.log('\n3. Testing Pay Now Flow (Cashfree Production)...');
        const form2 = new FormData();
        form2.append('documents', fs.createReadStream(testFilePath));
        form2.append('payMethod', 'payNow');
        form2.append('options', JSON.stringify({
            copies: 2,
            pageSelection: 'All Pages',
            colorMode: 'color',
            orientation: 'portrait',
            pagesPerSheet: '1'
        }));
        form2.append('price', '6'); // 2 copies * 1 page * ₹3

        const res2 = await axios.post(`${baseUrl}/process`, form2, {
            headers: form2.getHeaders()
        });

        console.log('Pay Now Response:', res2.data);
        if (res2.data.sessionId) {
            console.log('✓ Success: Received Production Payment Session ID:', res2.data.sessionId);
        } else if (res2.data.warning) {
            console.log('! Warning Received:', res2.data.warning);
        } else {
            console.error('✗ Failure: No session ID or warning returned');
        }

    } catch (error) {
        console.error('API Test Failed!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', error.response.data);
        } else {
            console.error('Message:', error.message);
        }
    }
}

testApiFlows();
