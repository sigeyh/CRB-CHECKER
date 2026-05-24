/**
 * CRB Checker Kenya — Frontend Application
 * Handles service selection, payment flow, and report display
 */

// ===== STATE =====
let selectedService = null; // 'check' or 'clearance'
let currentReference = null;
let pollInterval = null;
let countdownInterval = null;
let countdownSeconds = 90;

// ===== NAVIGATION =====
window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (window.scrollY > 50) {
    navbar.classList.add('scrolled');
  } else {
    navbar.classList.remove('scrolled');
  }
});

function toggleMobileMenu() {
  const menu = document.getElementById('mobile-menu');
  const toggleBtn = document.getElementById('mobile-toggle');
  menu.classList.toggle('active');
  if (toggleBtn) toggleBtn.classList.toggle('active');
}

function closeMobileMenu() {
  document.getElementById('mobile-menu').classList.remove('active');
  const toggleBtn = document.getElementById('mobile-toggle');
  if (toggleBtn) toggleBtn.classList.remove('active');
}

function scrollToServices() {
  document.getElementById('services').scrollIntoView({ behavior: 'smooth' });
}

// ===== SCROLL ANIMATIONS =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.animate-on-scroll').forEach((el) => {
    observer.observe(el);
  });
});

// ===== FAQ =====
function toggleFaq(element) {
  const isActive = element.classList.contains('active');
  // Close all
  document.querySelectorAll('.faq-item').forEach((item) => {
    item.classList.remove('active');
  });
  // Open clicked if it wasn't active
  if (!isActive) {
    element.classList.add('active');
  }
}

// ===== SERVICE SELECTION =====
function selectService(type) {
  selectedService = type;

  const isCheck = type === 'check';
  document.getElementById('modal-title').textContent = isCheck ? 'CRB Check' : 'CRB Clearance';
  document.getElementById('modal-subtitle').textContent = 'Enter your details to proceed';
  document.getElementById('summary-service').textContent = isCheck ? 'CRB Check' : 'CRB Clearance Certificate';
  document.getElementById('summary-amount').textContent = isCheck ? 'KES 50' : 'KES 100';
  document.getElementById('mpesa-display-amount').textContent = isCheck ? 'KES 50' : 'KES 100';

  // Show modal with details step
  showStep('step-details');
  openModal();
}

// ===== MODAL MANAGEMENT =====
function openModal() {
  document.getElementById('payment-modal').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('payment-modal').classList.remove('active');
  document.body.style.overflow = '';

  // Clean up
  clearPolling();
  clearCountdown();

  // Reset form after animation
  setTimeout(() => {
    document.getElementById('payment-form').reset();
    showStep('step-details');
    document.getElementById('btn-pay').disabled = false;
    document.getElementById('btn-pay').innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="2" y="5" width="20" height="14" rx="2"/>
        <path d="M2 10h20"/>
      </svg>
      Pay with M-Pesa
    `;
  }, 300);
}

function showStep(stepId) {
  document.querySelectorAll('.modal-step').forEach((step) => {
    step.classList.add('hidden');
  });
  document.getElementById(stepId).classList.remove('hidden');
}

function resetToDetails() {
  showStep('step-details');
  document.getElementById('btn-pay').disabled = false;
  document.getElementById('btn-pay').innerHTML = `
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <rect x="2" y="5" width="20" height="14" rx="2"/>
      <path d="M2 10h20"/>
    </svg>
    Pay with M-Pesa
  `;
}

// ===== PAYMENT FLOW =====
async function handlePaymentSubmit(event) {
  event.preventDefault();

  const btn = document.getElementById('btn-pay');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;"></span> Processing...';

  const fullName = document.getElementById('full_name').value.trim();
  const idNumber = document.getElementById('id_number').value.trim();
  let phoneNumber = document.getElementById('phone_number').value.trim();

  // Auto-format phone number
  phoneNumber = formatPhoneNumber(phoneNumber);

  try {
    const response = await fetch('/api/payment/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: fullName,
        id_number: idNumber,
        phone_number: phoneNumber,
        service_type: selectedService
      })
    });

    const data = await response.json();

    if (data.success) {
      currentReference = data.reference;

      // AUTO-CLICK: Immediately show processing step (M-Pesa prompt on phone)
      showStep('step-processing');
      document.getElementById('processing-text').textContent = 'Waiting for payment...';

      // Start countdown timer
      startCountdown();

      // Start polling for payment status
      startPolling();
    } else {
      showError(data.message || 'Failed to initiate payment. Please try again.');
    }
  } catch (error) {
    console.error('Payment error:', error);
    showError('Network error. Please check your connection and try again.');
  }
}

// ===== POLLING =====
function startPolling() {
  clearPolling();

  // Poll every 3 seconds
  pollInterval = setInterval(async () => {
    try {
      const response = await fetch(`/api/payment/status/${currentReference}`);
      const data = await response.json();

      if (data.success) {
        if (data.status === 'completed') {
          clearPolling();
          clearCountdown();
          document.getElementById('processing-text').textContent = 'Payment confirmed! Generating report...';

          // Brief delay for UX, then fetch report
          setTimeout(() => fetchReport(), 1000);
        } else if (data.status === 'failed' || data.status === 'cancelled') {
          clearPolling();
          clearCountdown();
          showError('Payment was not completed. Please try again.');
        }
        // 'processing' or 'pending' — keep polling
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  }, 3000);
}

function clearPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
    pollInterval = null;
  }
}

// ===== COUNTDOWN =====
function startCountdown() {
  countdownSeconds = 90;
  updateCountdownDisplay();

  clearCountdown();
  countdownInterval = setInterval(() => {
    countdownSeconds--;
    updateCountdownDisplay();

    if (countdownSeconds <= 0) {
      clearCountdown();
      clearPolling();
      showError('Payment timed out. Please try again.');
    }
  }, 1000);
}

function clearCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
    countdownInterval = null;
  }
}

function updateCountdownDisplay() {
  const minutes = Math.floor(countdownSeconds / 60);
  const seconds = countdownSeconds % 60;
  const el = document.getElementById('timer-countdown');
  if (el) {
    el.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
}

// ===== FETCH REPORT =====
async function fetchReport() {
  try {
    const endpoint = selectedService === 'check' ? '/api/crb/check' : '/api/crb/clearance';
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reference: currentReference })
    });

    const data = await response.json();

    if (data.success) {
      if (selectedService === 'check') {
        renderCheckReport(data.report);
      } else {
        renderClearanceCertificate(data.certificate);
      }
      showStep('step-success');
    } else {
      showError(data.message || 'Failed to generate report.');
    }
  } catch (error) {
    console.error('Report fetch error:', error);
    showError('Failed to load report. Please contact support.');
  }
}

// ===== RENDER CRB CHECK REPORT =====
function renderCheckReport(report) {
  const container = document.getElementById('report-content');
  const cs = report.credit_summary;
  const scoreClass = getScoreClass(cs.score_category);
  const scorePercent = ((cs.credit_score - 300) / 400) * 100;

  let loansHtml = '';
  report.loan_accounts.forEach((loan) => {
    const statusColor = loan.status === 'Active' ? 'var(--green-light)' :
                        loan.status === 'Defaulted' ? 'var(--red-light)' : 'var(--text-muted)';
    loansHtml += `
      <div class="report-row">
        <span class="report-row-label">${loan.lender} — ${loan.loan_type}</span>
        <span class="report-row-value" style="color:${statusColor}">${loan.status}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label" style="padding-left:12px;font-size:0.8rem">Outstanding: KES ${loan.outstanding_balance.toLocaleString()}</span>
        <span class="report-row-value" style="font-size:0.8rem;color:var(--text-muted)">${loan.date_opened}</span>
      </div>
    `;
  });

  container.innerHTML = `
    <div class="report-section">
      <div class="report-section-title">Personal Information</div>
      <div class="report-row">
        <span class="report-row-label">Name</span>
        <span class="report-row-value">${report.personal_info.full_name}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">ID Number</span>
        <span class="report-row-value">${report.personal_info.id_number}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Report Date</span>
        <span class="report-row-value">${report.personal_info.report_generated}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Reference</span>
        <span class="report-row-value" style="font-size:0.75rem">${report.report_reference}</span>
      </div>
    </div>

    <div class="report-section">
      <div class="report-section-title">Credit Score</div>
      <div class="score-display">
        <div class="score-number ${scoreClass}">${cs.credit_score}</div>
        <div class="score-category" style="color:var(--text-secondary)">${cs.score_category} (${cs.score_range})</div>
        <div class="score-bar">
          <div class="score-fill ${scoreClass}" style="width:${scorePercent}%;background:currentColor"></div>
        </div>
      </div>
    </div>

    <div class="report-section">
      <div class="report-section-title">Account Summary</div>
      <div class="report-row">
        <span class="report-row-label">Total Accounts</span>
        <span class="report-row-value">${cs.total_accounts}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Active Accounts</span>
        <span class="report-row-value" style="color:var(--green-light)">${cs.active_accounts}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Closed Accounts</span>
        <span class="report-row-value">${cs.closed_accounts}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Defaulted Accounts</span>
        <span class="report-row-value" style="color:${cs.defaulted_accounts > 0 ? 'var(--red-light)' : 'var(--text-primary)'}">${cs.defaulted_accounts}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Total Outstanding</span>
        <span class="report-row-value">KES ${cs.total_outstanding.toLocaleString()}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Inquiries (12 months)</span>
        <span class="report-row-value">${cs.total_inquiries_last_12_months}</span>
      </div>
    </div>

    <div class="report-section">
      <div class="report-section-title">Loan Accounts</div>
      ${loansHtml || '<p style="color:var(--text-muted);font-size:0.88rem">No loan accounts found.</p>'}
    </div>

    <div class="report-section">
      <div class="report-section-title">Negative Information</div>
      <div class="report-row">
        <span class="report-row-label">Bounced Cheques</span>
        <span class="report-row-value">${report.negative_info.bounced_cheques}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Fraud Alerts</span>
        <span class="report-row-value">${report.negative_info.fraud_alerts}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Court Judgments</span>
        <span class="report-row-value">${report.negative_info.court_judgments}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Bankruptcy</span>
        <span class="report-row-value">${report.negative_info.bankruptcy ? 'Yes' : 'No'}</span>
      </div>
    </div>

    <p style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:12px;line-height:1.5">
      ${report.disclaimer}
    </p>
  `;
}

// ===== RENDER CLEARANCE CERTIFICATE =====
function renderClearanceCertificate(cert) {
  const container = document.getElementById('report-content');
  const isCleared = cert.clearance_status === 'CLEARED';

  container.innerHTML = `
    <div class="report-section" style="border-color:var(--gold);border-width:2px;">
      <div class="certificate-header">
        <h3>CRB Clearance Certificate</h3>
        <p style="font-size:0.8rem;color:var(--text-muted)">Republic of Kenya</p>
        <div class="certificate-status ${isCleared ? 'status-cleared' : 'status-conditional'}">
          ${cert.clearance_status}
        </div>
      </div>
      
      <div class="report-row">
        <span class="report-row-label">Name</span>
        <span class="report-row-value">${cert.personal_info.full_name}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">ID Number</span>
        <span class="report-row-value">${cert.personal_info.id_number}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Date Issued</span>
        <span class="report-row-value">${cert.personal_info.date_issued}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Valid Until</span>
        <span class="report-row-value" style="color:var(--gold)">${cert.personal_info.valid_until}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Certificate Ref</span>
        <span class="report-row-value" style="font-size:0.72rem">${cert.certificate_reference}</span>
      </div>
    </div>

    <div class="report-section">
      <div class="report-section-title">Status Details</div>
      <p style="font-size:0.88rem;color:var(--text-secondary);line-height:1.6;margin-bottom:16px">
        ${cert.status_description}
      </p>
      <div class="report-row">
        <span class="report-row-label">Credit Score</span>
        <span class="report-row-value">${cert.credit_summary.credit_score}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Active Loans</span>
        <span class="report-row-value">${cert.credit_summary.total_active_loans}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Outstanding Defaults</span>
        <span class="report-row-value" style="color:${cert.credit_summary.outstanding_defaults > 0 ? 'var(--red-light)' : 'var(--green-light)'}">${cert.credit_summary.outstanding_defaults}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Outstanding Debt</span>
        <span class="report-row-value">KES ${cert.credit_summary.total_outstanding_debt.toLocaleString()}</span>
      </div>
    </div>

    <div class="report-section">
      <div class="report-section-title">Verification</div>
      <div class="report-row">
        <span class="report-row-label">Verification Code</span>
        <span class="report-row-value" style="color:var(--gold);font-family:var(--font-display);letter-spacing:0.1em">${cert.verification.verification_code}</span>
      </div>
      <div class="report-row">
        <span class="report-row-label">Issuing Authority</span>
        <span class="report-row-value">${cert.verification.issuing_authority}</span>
      </div>
    </div>

    <p style="font-size:0.75rem;color:var(--text-muted);text-align:center;margin-top:12px;line-height:1.5">
      ${cert.disclaimer}
    </p>
  `;
}

// ===== PDF DOWNLOAD =====
async function downloadReport() {
  const btn = document.getElementById('btn-download');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner" style="width:18px;height:18px;border-width:2px;"></span> Generating PDF...';

  try {
    // Dynamically load html2canvas and jsPDF if not already loaded
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');

    const reportEl = document.getElementById('report-content');

    // Temporarily style for PDF capture
    reportEl.style.background = '#111827';
    reportEl.style.padding = '20px';
    reportEl.style.borderRadius = '0';

    const canvas = await html2canvas(reportEl, {
      backgroundColor: '#111827',
      scale: 2,
      useCORS: true,
      logging: false
    });

    // Reset styles
    reportEl.style.background = '';
    reportEl.style.padding = '';
    reportEl.style.borderRadius = '';

    const imgData = canvas.toDataURL('image/png');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    // Add header
    pdf.setFillColor(0, 107, 63);
    pdf.rect(0, 0, pdfWidth, 15, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(12);
    pdf.setFont(undefined, 'bold');
    pdf.text('CRB Checker Kenya', pdfWidth / 2, 10, { align: 'center' });

    // Add content
    if (pdfHeight > pdf.internal.pageSize.getHeight() - 30) {
      // Scale down to fit
      const scaledHeight = pdf.internal.pageSize.getHeight() - 30;
      const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
      pdf.addImage(imgData, 'PNG', (pdfWidth - scaledWidth) / 2, 20, scaledWidth, scaledHeight);
    } else {
      pdf.addImage(imgData, 'PNG', 0, 20, pdfWidth, pdfHeight);
    }

    const filename = selectedService === 'check'
      ? `CRB_Check_Report_${Date.now()}.pdf`
      : `CRB_Clearance_Certificate_${Date.now()}.pdf`;

    pdf.save(filename);
  } catch (error) {
    console.error('PDF generation error:', error);
    alert('Failed to generate PDF. Please try again or take a screenshot.');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Download PDF
    `;
  }
}

// ===== HELPERS =====
function formatPhoneNumber(phone) {
  // Remove spaces, dashes
  let cleaned = phone.replace(/[\s\-\+]/g, '');

  // Remove leading zeros for the +254 prefix
  if (cleaned.startsWith('0')) {
    cleaned = cleaned.substring(1);
  }

  // If it already starts with 254, use as-is
  if (cleaned.startsWith('254')) {
    return cleaned;
  }

  // Otherwise prepend 254
  return '254' + cleaned;
}

function getScoreClass(category) {
  const map = {
    'Excellent': 'score-excellent',
    'Good': 'score-good',
    'Fair': 'score-fair',
    'Poor': 'score-poor',
    'Very Poor': 'score-verypoor'
  };
  return map[category] || 'score-fair';
}

function showError(message) {
  document.getElementById('error-message').textContent = message;
  showStep('step-error');
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

// Close modal on overlay click
document.getElementById('payment-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    closeModal();
  }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});
