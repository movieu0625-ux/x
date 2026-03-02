const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

async function testRefinedFlow() {
    const baseUrl = 'http://localhost:3000';
    console.log('--- Testing Refined Pay Now Flow ---\n');

    try {
        // 1. Create Pay Now Intent (Initial Order)
        console.log('1. Creating Pay Now intent...');
        const form = new FormData();
        const testFilePath = path.join(__dirname, '..', 'uploads', 'test.pdf');
        form.append('documents', fs.createReadStream(testFilePath));
        form.append('payMethod', 'payNow');
        form.append('options', JSON.stringify({
            copies: 1,
            pageSelection: 'All Pages',
            colorMode: 'bw',
            orientation: 'portrait',
            pagesPerSheet: '1'
        }));
        form.append('price', '1');

        const res1 = await axios.post(`${baseUrl}/process`, form, {
            headers: form.getHeaders()
        });

        const { sessionId, orderId } = res1.data;
        console.log('Initial Response:', { sessionId: sessionId ? 'Received' : 'MISSING', orderId });

        if (orderId && orderId.startsWith('cf_')) {
            console.log('✓ Success: Received temporary ID:', orderId);
        } else {
            throw new Error('✗ Failure: Did not receive a temporary ID');
        }

        // 2. Simulate Payment Verification (Mocking successful payment)
        // Since I cannot actually pay, I will check the response of /verify-payment
        // It should return 400 "Payment not completed" if not paid in Cashfree.
        console.log('\n2. Testing /verify-payment (expected failure as not paid)...');
        try {
            const resVerify = await axios.get(`${baseUrl}/verify-payment/${orderId}`);
            console.log('Unexpected Verify Success:', resVerify.data);
        } catch (e) {
            if (e.response && e.response.status === 400 && e.response.data.error === 'Payment not completed') {
                console.log('✓ Success: Correctly identified unpaid order');
            } else {
                console.error('✗ Failure: Unexpected error during verification:', e.message);
            }
        }

        // 3. Test Pay Later Flow (Should still work normally)
        console.log('\n3. Testing Pay Later Flow...');
        const form2 = new FormData();
        form2.append('documents', fs.createReadStream(testFilePath));
        form2.append('payMethod', 'payLater');
        form2.append('options', JSON.stringify({ copies: 1, pageSelection: 'All Pages', colorMode: 'bw', orientation: 'portrait', pagesPerSheet: '1' }));
        form2.append('price', '1');

        const res2 = await axios.post(`${baseUrl}/process`, form2, { headers: form2.getHeaders() });
        console.log('Pay Later Response:', res2.data);
        if (res2.data.otp && res2.data.otp.length === 6) {
            console.log('✓ Success: Received 6-digit OTP for Pay Later');
        }

    } catch (error) {
        console.error('Test Failed!');
        console.error(error.message);
    }
}

testRefinedFlow();
