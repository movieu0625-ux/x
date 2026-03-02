require('dotenv').config();
const axios = require('axios');

async function testCashfree() {
    console.log('Testing Cashfree Production API...');
    console.log('App ID:', process.env.CASHFREE_APP_ID);

    try {
        const response = await axios.post('https://api.cashfree.com/pg/orders', {
            order_id: 'test_' + Date.now(),
            order_amount: 1.00,
            order_currency: 'INR',
            customer_details: {
                customer_id: 'balu',
                customer_phone: '8421007625'
            }
        }, {
            headers: {
                'x-client-id': process.env.CASHFREE_APP_ID,
                'x-client-secret': process.env.CASHFREE_SECRET,
                'x-api-version': '2023-08-01'
            }
        });

        console.log('SUCCESS!');
        console.log('Response Status:', response.status);
        console.log('Order ID:', response.data.order_id);
        console.log('Payment Session ID:', response.data.payment_session_id);
    } catch (error) {
        console.error('FAILURE!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
    }
}

testCashfree();
