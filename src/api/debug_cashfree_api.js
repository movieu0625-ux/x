const axios = require('axios');

async function debugCashfree() {
    console.log('--- Direct Cashfree API Debug ---');
    try {
        const response = await axios.post('https://api.cashfree.com/pg/orders', {
            order_id: 'debug_' + Date.now(),
            order_amount: 1.00,
            order_currency: 'INR',
            customer_details: {
                customer_id: 'balu',
                customer_phone: '8421007625'
            }
        }, {
            headers: {
                'x-client-id': '1198248c13f43f55595cea82fd08428911',
                'x-client-secret': 'cfsk_ma_prod_a60f034bb029b77f38d094dd3e4197d3_d5eab6ab',
                'x-api-version': '2023-08-01'
            }
        });

        console.log('Status:', response.status);
        console.log('Response Body:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('API Error!');
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Data:', JSON.stringify(error.response.data, null, 2));
        } else {
            console.error('Message:', error.message);
        }
    }
}

debugCashfree();
