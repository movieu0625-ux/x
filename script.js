pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';

// Optional API base for a separately hosted backend (set this in your HTML or replace below)
const API_BASE = window.API_BASE || '';

// Initialize Cashfree SDK safely
let cashfree;
try {
  if (typeof Cashfree !== 'undefined') {
    cashfree = Cashfree({ mode: 'production' });
  } else {
    console.warn('Cashfree SDK not loaded');
  }
} catch (e) {
  console.error('Error initializing Cashfree:', e);
}

const fileInput = document.getElementById('documents');
const fileList = document.getElementById('file-list');
const customPagesInput = document.getElementById('custom-pages');
const pageSelectionRadios = document.querySelectorAll('input[name="pageSelection"]');
const calculateBtn = document.getElementById('calculate');
const payNowBtn = document.getElementById('pay-now');
const payLaterBtn = document.getElementById('pay-later');
const cancelBtn = document.getElementById('cancel');
const otpSection = document.getElementById('otp-section');
const otpValue = document.getElementById('otp-value');
const previewDiv = document.getElementById('preview');
const mainUi = document.getElementById('main-ui');
const verificationSection = document.getElementById('verification-section');
const statusCard = document.getElementById('status-card');

// Check for order_id on load (Verification Flow)
window.addEventListener('load', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order_id');
  if (orderId) {
    showVerificationUI();
    verifyPayment(orderId);
  }
});

function showVerificationUI() {
  mainUi.style.display = 'none';
  verificationSection.style.display = 'flex';
}

let filesData = {}; // {filename: {file, numPages}}

fileInput.addEventListener('change', handleFiles);
pageSelectionRadios.forEach(radio => radio.addEventListener('change', toggleCustomInput));
calculateBtn.addEventListener('click', calculatePreview);
payNowBtn.addEventListener('click', () => processPayment('payNow'));
payLaterBtn.addEventListener('click', () => processPayment('payLater'));
cancelBtn.addEventListener('click', () => location.reload());

function toggleCustomInput() {
  customPagesInput.disabled = document.querySelector('input[name="pageSelection"]:checked').value !== 'custom';
}

async function handleFiles() {
  fileList.innerHTML = '';
  filesData = {};
  for (let file of fileInput.files) {
    let numPages = 0;
    if (file.type === 'application/pdf') {
      numPages = await getPdfPages(file);
    } else if (file.type.startsWith('image/')) {
      numPages = 1; // Images count as 1 page
    }

    filesData[file.name] = { file, numPages };

    const li = document.createElement('li');
    li.innerHTML = `${file.name} (${numPages} page${numPages !== 1 ? 's' : ''}) 
                    <button onclick="previewFile('${file.name}')">Preview</button> 
                    <button onclick="deleteFile('${file.name}')">Delete</button>`;
    fileList.appendChild(li);
  }
}

async function getPdfPages(file) {
  try {
    if (typeof pdfjsLib === 'undefined') {
      console.warn('PDF.js not loaded');
      return 1; // Fallback
    }
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    return pdf.numPages;
  } catch (e) {
    console.error('Error counting PDF pages:', e);
    return 1;
  }
}

function previewFile(filename) {
  const file = filesData[filename].file;
  const url = URL.createObjectURL(file);
  window.open(url, '_blank');
}

function deleteFile(filename) {
  delete filesData[filename];
  handleFiles(); // Refresh list
}

function parseCustomPages(str, maxPages) {
  if (!str) return [];
  const pages = new Set();
  str.split(',').forEach(part => {
    if (part.includes('-')) {
      const [start, end] = part.split('-').map(Number);
      for (let i = start; i <= end; i++) pages.add(i);
    } else {
      pages.add(Number(part));
    }
  });
  return Array.from(pages).filter(p => p >= 1 && p <= maxPages);
}

function calculatePreview() {
  const copies = parseInt(document.getElementById('copies').value) || 1;
  const pageSelection = document.querySelector('input[name="pageSelection"]:checked').value;
  const customStr = customPagesInput.value;
  const colorMode = document.querySelector('input[name="colorMode"]:checked').value;
  const orientation = document.querySelector('input[name="orientation"]:checked').value;
  const pagesPerSheet = document.querySelector('input[name="pagesPerSheet"]:checked').value;

  let totalPages = 0;
  let selectedPagesDesc = pageSelection === 'all' ? 'All Pages' : `Custom: ${customStr}`;

  Object.values(filesData).forEach(({ numPages }) => {
    let selectedCount;
    if (pageSelection === 'all') {
      selectedCount = numPages;
    } else {
      const selected = parseCustomPages(customStr, numPages);
      if (selected.length === 0) alert(`Invalid custom pages for a file with ${numPages} pages`);
      selectedCount = selected.length;
    }
    totalPages += selectedCount;
  });

  totalPages *= copies;
  const pricePerPage = colorMode === 'bw' ? 1 : 3;
  const price = totalPages * pricePerPage;

  previewDiv.innerHTML = `
    Total Logical Pages: ${totalPages}<br>
    Selected Pages: ${selectedPagesDesc}<br>
    Copies: ${copies}<br>
    Color Mode: ${colorMode === 'bw' ? 'Black & White' : 'Color'}<br>
    Final Price: ₹${price}
  `;

  return { totalPages, selectedPagesDesc, copies, colorMode, price, orientation, pagesPerSheet };
}

async function processPayment(method) {
  const previewData = calculatePreview();
  if (!previewData || Object.keys(filesData).length === 0) return alert('Select files and calculate preview first');

  const formData = new FormData();
  Object.values(filesData).forEach(({ file }) => formData.append('documents', file));
  formData.append('payMethod', method);
  formData.append('options', JSON.stringify({
    copies: previewData.copies,
    pageSelection: previewData.selectedPagesDesc,
    colorMode: previewData.colorMode,
    orientation: previewData.orientation,
    pagesPerSheet: previewData.pagesPerSheet
  }));
  formData.append('price', previewData.price);

  try {
    payNowBtn.disabled = true;
    payLaterBtn.disabled = true;

    const res = await fetch(`${API_BASE}/process`, { method: 'POST', body: formData });
    const data = await res.json();

    if (data.error) {
      alert(data.error);
      payNowBtn.disabled = false;
      payLaterBtn.disabled = false;
      return;
    }

    if (method === 'payLater') {
      showOTP(data.otp);
    } else {
      // Pay Now: Initiate Cashfree
      if (!data.sessionId) {
        console.error('Server did not return sessionId:', data);
        alert('Payment Gateway Error: ' + (data.details || data.error || 'Could not initialize payment session.') + '\n\nPlease use the "Pay Later" button instead.');
        payNowBtn.disabled = false;
        payLaterBtn.disabled = false;
        return;
      }

      console.log('Initiating Cashfree Checkout. Session:', data.sessionId);
      console.log('Order ID:', data.orderId);

      try {
        if (!cashfree) {
          throw new Error('Cashfree SDK not initialized. Please check your internet connection or if the SDK is blocked.');
        }

        const result = await cashfree.checkout({
          paymentSessionId: data.sessionId,
          returnUrl: `${window.location.origin}${window.location.pathname}?order_id=${data.orderId}`
        });

        if (result.error) {
          console.error('Cashfree SDK Error:', result.error);
          alert('Payment Interaction Failed: ' + (result.error.message || 'Unknown error') + '\n\nPlease use "Pay Later" instead.');
          payNowBtn.disabled = false;
          payLaterBtn.disabled = false;
        } else if (result.redirect) {
          console.log('Redirecting to payment page...');
        }
      } catch (e) {
        console.error('Fatal Checkout Error:', e);
        alert('Gateway Interface Error: ' + e.message + '\n\nPlease use "Pay Later" instead.');
        payNowBtn.disabled = false;
        payLaterBtn.disabled = false;
      }
    }
  } catch (err) {
    console.error('Process error:', err);
    alert('Error processing: ' + err.message);
    payNowBtn.disabled = false;
    payLaterBtn.disabled = false;
  }
}

function showOTP(otp) {
  otpSection.style.display = 'block';
  otpValue.textContent = otp;
}

async function verifyPayment(orderId) {
  try {
    const res = await fetch(`${API_BASE}/verify-payment/${orderId}`);
    const data = await res.json();

    if (data.success || data.otp) {
      showSuccess(data.otp);
    } else {
      showError(data.error || 'Payment verification failed.', orderId);
    }
  } catch (err) {
    showError('Network error. Please try again.', orderId);
  }
}

function showSuccess(otp) {
  statusCard.innerHTML = `
        <div class="success-icon">✓</div>
        <h2>Payment Successful!</h2>
        <p>Your print job is ready. Please use this OTP at the booth:</p>
        <div class="otp-display">${otp}</div>
        <button class="btn-home" onclick="window.location.href='/'">Go Home</button>
    `;
}

function showError(msg, orderId) {
  statusCard.innerHTML = `
        <h2 class="error-text">Verification Failed</h2>
        <p>${msg}</p>
        <p>If you have already paid, please contact support with Order ID: <strong>${orderId}</strong></p>
        <button class="btn-home" onclick="window.location.href='/'">Back to Home</button>
    `;
}