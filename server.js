require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const multer = require('multer');
const mongoose = require('mongoose');
const axios = require('axios');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');

const app = express();
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://sdk.cashfree.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'", "https://api.cashfree.com", "https://sandbox.cashfree.com", "https://sdk.cashfree.com"],
      frameSrc: ["'self'", "https://sdk.cashfree.com", "https://api.cashfree.com"],
      upgradeInsecureRequests: [],
    },
  },
}));

// 1. Rate Limiting (Test 16)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/process', limiter);
app.use('/verify-payment', limiter);

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit (Test 3)
});

// Use env vars if available, otherwise fall back to sensible defaults
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/printshop';
const PORT = process.env.PORT || 3000;

// CORS configuration - Restrict in production
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['*'];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin || '*');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false, limit: '1mb' })); // Changed to extended: false to prevent NoSQL injection objects (Test 14)
// Serve specific frontend files now located at repo root
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/script.js', (req, res) => res.sendFile(path.join(__dirname, 'script.js')));
app.get('/style.css', (req, res) => res.sendFile(path.join(__dirname, 'style.css')));
// UPLOADS ARE SECURED: Access only via /download route (Test 12)

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err.message || err));

// Schema
const orderSchema = new mongoose.Schema({
  otp: { type: String, unique: true, index: true },
  files: [String],
  options: Object,
  price: Number,
  status: { type: String, default: 'pending' }, // 'pending', 'paid', 'failed'
  cashfreeOrderId: { type: String, unique: true, sparse: true }, // For idempotency (Test 6)
  createdAt: { type: Date, default: Date.now, expires: '24h' } // Auto-expiry (Test 9)
});
const Order = mongoose.model('Order', orderSchema);

// Generate unique 6-digit OTP
async function generateOTP() {
  let otp;
  do {
    otp = Math.floor(100000 + Math.random() * 900000).toString();
  } while (await Order.findOne({ otp }));
  return otp;
}

// Route for uploading and processing (Pay Now or Pay Later)
app.post('/process', upload.array('documents'), async (req, res) => {
  try {
    const { payMethod, options, price } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const parsedOptions = JSON.parse(options);
    let orderId;
    let isTemp = false;

    if (payMethod === 'payLater') {
      orderId = await generateOTP();
    } else {
      orderId = 'cf_' + Date.now() + Math.random().toString(36).substring(7);
      isTemp = true;
    }
    const uploadDir = path.join(__dirname, 'uploads', orderId);
    await fs.mkdir(uploadDir, { recursive: true });

    const filePaths = await Promise.all(req.files.map(async (file) => {
      const newPath = path.join(uploadDir, file.originalname);
      await fs.rename(file.path, newPath);
      return newPath;
    }));

    // Save to DB
    const newOrder = new Order({
      otp: orderId, // Use temp ID for Pay Now, OTP for Pay Later
      files: filePaths,
      options: parsedOptions,
      price: parseFloat(price),
      status: 'pending'
    });
    await newOrder.save();

    if (payMethod === 'payLater') {
      return res.json({ otp: orderId });
    } else if (payMethod === 'payNow') {
      try {
        const response = await axios.post('https://api.cashfree.com/pg/orders', {
          order_id: orderId,
          order_amount: parseFloat(price),
          order_currency: 'INR',
          customer_details: {
            customer_id: orderId,
            customer_name: parsedOptions.customerName || 'Guest',
            customer_email: parsedOptions.customerEmail || 'customer@example.com',
            customer_phone: parsedOptions.customerPhone || '9999999999'
          },
          order_note: 'Print Order'
        }, {
          headers: {
            'x-client-id': process.env.CASHFREE_APP_ID,
            'x-client-secret': process.env.CASHFREE_SECRET,
            'x-api-version': '2023-08-01'
          }
        });

        console.log('Cashfree Response:', JSON.stringify(response.data, null, 2));

        const sessionId = response.data.payment_session_id;
        console.log(`Order ${orderId} session created:`, sessionId);
        res.json({ sessionId, orderId });
      } catch (paymentErr) {
        console.error('Cashfree API Error:', paymentErr.response?.data || paymentErr.message);
        res.status(500).json({
          error: 'Payment gateway error. Please use Pay Later instead.',
          details: paymentErr.response?.data?.message || paymentErr.message,
          code: 'GATEWAY_ERROR'
        });
      }
    }
  } catch (err) {
    console.error('Process error:', err.message);
    res.status(500).json({ error: 'Failed to process order' });
  }
});

// New endpoint to verify payment and generate OTP
app.get('/verify-payment/:orderId', async (req, res) => {
  const { orderId } = req.params;
  try {
    const order = await Order.findOne({ otp: orderId });
    if (!order) return res.status(404).json({ error: 'Order not found' });
    if (order.status === 'paid') return res.json({ otp: order.otp }); // Already verified

    // Verify with Cashfree
    const response = await axios.get(`https://api.cashfree.com/pg/orders/${orderId}`, {
      headers: {
        'x-client-id': process.env.CASHFREE_APP_ID,
        'x-client-secret': process.env.CASHFREE_SECRET,
        'x-api-version': '2023-08-01'
      }
    });

    if (response.data.order_status === 'PAID') {
      const otp = await generateOTP();
      const oldPath = path.join(__dirname, 'uploads', orderId);
      const newPath = path.join(__dirname, 'uploads', otp);

      console.log(`Payment confirmed for ${orderId}. Generating OTP: ${otp}`);

      try {
        if (fsSync.existsSync(oldPath)) {
          await fs.rename(oldPath, newPath);
        } else {
          console.warn(`Upload folder not found for ${orderId}, skipping rename.`);
        }
      } catch (err) {
        console.warn('Folder rename failed:', err.message);
      }

      const updatedFiles = order.files.map(f => f.replace(orderId, otp));

      await Order.updateOne({ _id: order._id }, {
        otp: otp,
        status: 'paid',
        files: updatedFiles
      });

      res.json({ success: true, otp });
    } else {
      console.log(`Payment status for ${orderId}: ${response.data.order_status}`);
      res.status(400).json({ error: 'Payment not completed', status: response.data.order_status });
    }
  } catch (err) {
    console.error('Verification error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Webhook for Cashfree (Test 4, 6, 7)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const signature = req.headers['x-webhook-signature'];
    const timestamp = req.headers['x-webhook-timestamp'];
    const rawBody = req.body.toString();

    // Verify signature (Test 7)
    const expectedSignature = crypto.createHmac('sha256', process.env.CASHFREE_SECRET)
      .update(timestamp + rawBody)
      .digest('base64');

    if (signature !== expectedSignature) {
      console.error('Webhook: Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const payload = JSON.parse(rawBody);
    const orderId = payload.data.order.order_id;

    if (payload.event === 'PAYMENT_SUCCESS') {
      const order = await Order.findOne({ otp: orderId });
      if (order && order.status !== 'paid') {
        const otp = await generateOTP();
        const oldPath = path.join(__dirname, 'uploads', orderId);
        const newPath = path.join(__dirname, 'uploads', otp);

        if (fsSync.existsSync(oldPath)) {
          await fs.rename(oldPath, newPath);
        }

        const updatedFiles = order.files.map(f => f.replace(orderId, otp));
        await Order.updateOne({ otp: orderId }, {
          otp: otp,
          status: 'paid',
          files: updatedFiles
        });
        console.log(`Webhook: Order ${orderId} marked as paid. New OTP: ${otp}`);
      }
    }
    res.sendStatus(200);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    res.status(500).send('Internal Server Error');
  }
});



// Admin route to view order by OTP
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30, // 30 attempts per 15 mins (Test 8, 10)
  message: { error: 'Too many admin attempts, please try again later.' }
});

app.get('/admin', (req, res) => {
  res.send(`
    <html>
      <body>
        <h1>Admin: Enter OTP</h1>
        <form method="POST" action="/admin">
          <input type="text" name="otp" placeholder="Enter OTP" required>
          <button type="submit">Check</button>
        </form>
      </body>
    </html>
  `);
});

app.post('/admin', adminLimiter, async (req, res) => {
  let { otp } = req.body;
  if (typeof otp !== 'string') otp = String(otp); // Explicit casting (Test 14)

  if (!otp || otp.length < 5 || otp.length > 25) {
    return res.send('<h2>Invalid OTP format</h2>'); // Test 15
  }

  const order = await Order.findOne({ otp });
  if (!order) {
    return res.send('<h2>Invalid OTP</h2>');
  }
  res.send(`
    <h1>Order Details for OTP: ${otp}</h1>
    <p>Status: ${order.status}</p>
    <p>Price: ₹${order.price}</p>
    <p>Options: ${JSON.stringify(order.options)}</p>
    <h2>Files:</h2>
    <ul>${order.files.map(file => `<li><a href="/download/${path.basename(file)}?otp=${otp}" download>${path.basename(file)}</a></li>`).join('')}</ul>
  `);
});

// Serve file downloads (secured by OTP in query)
app.get('/download/:filename', async (req, res, next) => {
  try {
    const { otp } = req.query;
    if (!otp) return res.status(401).send('OTP required');

    // Simple path sanitization
    const filename = path.basename(req.params.filename);
    const filePath = path.join(__dirname, 'uploads', otp, filename);

    try {
      await fs.access(filePath);
      res.download(filePath);
    } catch (err) {
      res.status(404).send('File not found');
    }
  } catch (err) {
    next(err);
  }
});

// 404 Handler (Test 1) - Must be after all other routes
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File size too large. Limit is 10MB.' });
  }
  console.error('Unhandled Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong.' : err.message
  });
});

app.listen(PORT, () => console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`));
