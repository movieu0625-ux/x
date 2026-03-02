require('dotenv').config();
const axios = require('axios');

async function checkCashfree() {
    console.log('Checking Cashfree Connection...');
    console.log('App ID:', process.env.CASHFREE_APP_ID);
    console.log('Secret (masked):', process.env.CASHFREE_SECRET ? 'SET' : 'NOT SET');

    try {
        const response = await axios.post('https://api.cashfree.com/pg/orders', {
            order_id: 'test_' + Date.now(),
            order_amount: 1.00,
            order_currency: 'INR',
            customer_details: {
                customer_id: 'cust_test',
                customer_name: 'Test',
                customer_email: 'test@example.com',
                customer_phone: '9999999999'
            }
        }, {
            headers: {
                'x-client-id': process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET,
                'x-api-version': '2023-08-01'
            }
        });
        console.log('Success! Response:', response.data);
    } catch (error) {
        console.error('Error:', error.response ? error.response.data : error.message);
    }
}

checkCashfree();
