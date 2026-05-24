const { v4: uuidv4 } = require('uuid');

/**
 * Generate a simulated CRB Check Report
 * In production, this would connect to TransUnion, Metropol, or Creditinfo APIs
 */
function generateCRBCheckReport(idNumber, fullName) {
  // Deterministic seed from ID number for consistent reports per person
  const seed = hashCode(idNumber);
  const rng = seededRandom(seed);

  const creditScore = Math.floor(rng() * 400) + 300; // 300-700
  const scoreCategory = getCreditCategory(creditScore);

  const loanAccounts = generateLoanAccounts(rng, fullName);
  const inquiries = generateInquiries(rng);

  const report = {
    report_reference: `CRB-CHK-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`,
    report_date: new Date().toISOString(),
    report_type: 'CRB Credit Check',

    personal_info: {
      full_name: fullName,
      id_number: maskIdNumber(idNumber),
      report_generated: new Date().toLocaleDateString('en-KE', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    },

    credit_summary: {
      credit_score: creditScore,
      score_category: scoreCategory,
      score_range: '300 - 700',
      total_accounts: loanAccounts.length,
      active_accounts: loanAccounts.filter(l => l.status === 'Active').length,
      closed_accounts: loanAccounts.filter(l => l.status === 'Closed').length,
      defaulted_accounts: loanAccounts.filter(l => l.status === 'Defaulted').length,
      total_outstanding: loanAccounts
        .filter(l => l.status === 'Active')
        .reduce((sum, l) => sum + l.outstanding_balance, 0),
      total_inquiries_last_12_months: inquiries.length
    },

    loan_accounts: loanAccounts,
    credit_inquiries: inquiries,

    negative_info: {
      bounced_cheques: Math.floor(rng() * 3),
      fraud_alerts: 0,
      court_judgments: 0,
      bankruptcy: false
    },

    disclaimer: 'This report is generated for informational purposes. For official CRB reports, please contact a licensed Credit Reference Bureau (TransUnion, Metropol, or Creditinfo).'
  };

  return report;
}

/**
 * Generate a simulated CRB Clearance Certificate
 */
function generateCRBClearanceCertificate(idNumber, fullName) {
  const seed = hashCode(idNumber);
  const rng = seededRandom(seed);
  const creditScore = Math.floor(rng() * 400) + 300;
  const hasDefaults = creditScore < 400;

  const certificate = {
    certificate_reference: `CRB-CLR-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`,
    certificate_date: new Date().toISOString(),
    certificate_type: 'CRB Clearance Certificate',
    valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days

    personal_info: {
      full_name: fullName,
      id_number: maskIdNumber(idNumber),
      date_issued: new Date().toLocaleDateString('en-KE', {
        year: 'numeric', month: 'long', day: 'numeric'
      }),
      valid_until: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString('en-KE', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    },

    clearance_status: hasDefaults ? 'CONDITIONAL' : 'CLEARED',
    status_description: hasDefaults
      ? 'Applicant has historical defaults that have since been settled. Conditional clearance issued.'
      : 'Applicant has no outstanding negative credit information. Full clearance issued.',

    credit_summary: {
      credit_score: creditScore,
      total_active_loans: Math.floor(rng() * 3),
      outstanding_defaults: 0,
      settled_defaults: hasDefaults ? Math.floor(rng() * 2) + 1 : 0,
      bounced_cheques: 0,
      total_outstanding_debt: Math.floor(rng() * 200000)
    },

    verification: {
      qr_code: `https://crb-verify.co.ke/verify/${uuidv4()}`,
      verification_code: uuidv4().slice(0, 8).toUpperCase(),
      issuing_authority: 'CRB Checker Kenya',
      authorized_signatory: 'Digital Verification System'
    },

    disclaimer: 'This clearance certificate is generated for informational purposes. For official CRB clearance, please contact a licensed Credit Reference Bureau (TransUnion, Metropol, or Creditinfo).'
  };

  return certificate;
}

// --- Helper functions ---

function hashCode(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

function seededRandom(seed) {
  let s = seed;
  return function () {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function getCreditCategory(score) {
  if (score >= 650) return 'Excellent';
  if (score >= 550) return 'Good';
  if (score >= 450) return 'Fair';
  if (score >= 350) return 'Poor';
  return 'Very Poor';
}

function maskIdNumber(id) {
  if (id.length <= 4) return '****';
  return '*'.repeat(id.length - 4) + id.slice(-4);
}

function generateLoanAccounts(rng, fullName) {
  const lenders = [
    'KCB Bank', 'Equity Bank', 'Co-operative Bank', 'NCBA Bank',
    'Absa Bank Kenya', 'Stanbic Bank', 'I&M Bank', 'DTB Bank',
    'M-Shwari', 'KCB M-Pesa', 'Tala', 'Branch', 'Fuliza'
  ];

  const loanTypes = ['Personal Loan', 'Mobile Loan', 'Business Loan', 'Mortgage', 'Car Loan', 'Overdraft'];
  const statuses = ['Active', 'Active', 'Active', 'Closed', 'Closed', 'Defaulted'];

  const count = Math.floor(rng() * 5) + 1;
  const accounts = [];

  for (let i = 0; i < count; i++) {
    const lender = lenders[Math.floor(rng() * lenders.length)];
    const type = loanTypes[Math.floor(rng() * loanTypes.length)];
    const status = statuses[Math.floor(rng() * statuses.length)];
    const amount = Math.floor(rng() * 500000) + 5000;
    const outstanding = status === 'Active' ? Math.floor(amount * rng()) : 0;

    const openDate = new Date(Date.now() - Math.floor(rng() * 3 * 365 * 24 * 60 * 60 * 1000));

    accounts.push({
      lender,
      loan_type: type,
      original_amount: amount,
      outstanding_balance: outstanding,
      status,
      date_opened: openDate.toLocaleDateString('en-KE', { year: 'numeric', month: 'short' }),
      last_payment: status === 'Active'
        ? new Date(Date.now() - Math.floor(rng() * 30 * 24 * 60 * 60 * 1000)).toLocaleDateString('en-KE')
        : 'N/A',
      days_in_arrears: status === 'Defaulted' ? Math.floor(rng() * 180) + 30 : 0
    });
  }

  return accounts;
}

function generateInquiries(rng) {
  const institutions = [
    'Safaricom PLC', 'KCB Bank', 'Equity Bank', 'NCBA Bank',
    'Tala Kenya', 'Branch International', 'Housing Finance'
  ];

  const reasons = ['Loan Application', 'Account Opening', 'Credit Card Application', 'Employment Check'];

  const count = Math.floor(rng() * 4);
  const inquiries = [];

  for (let i = 0; i < count; i++) {
    const date = new Date(Date.now() - Math.floor(rng() * 365 * 24 * 60 * 60 * 1000));
    inquiries.push({
      institution: institutions[Math.floor(rng() * institutions.length)],
      reason: reasons[Math.floor(rng() * reasons.length)],
      date: date.toLocaleDateString('en-KE', { year: 'numeric', month: 'short', day: 'numeric' })
    });
  }

  return inquiries;
}

module.exports = {
  generateCRBCheckReport,
  generateCRBClearanceCertificate
};
