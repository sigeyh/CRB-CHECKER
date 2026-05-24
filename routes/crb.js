const express = require('express');
const router = express.Router();
const db = require('../db/database');
const crbService = require('../services/crb');
const logger = require('../utils/logger');

/**
 * POST /api/crb/check
 * Generate CRB Check Report (requires completed payment)
 */
router.post('/check', async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    // Verify payment
    const transaction = await db.getTransactionByReference(reference);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'completed') {
      return res.status(402).json({
        success: false,
        message: 'Payment not completed. Please complete M-Pesa payment first.'
      });
    }

    if (transaction.service_type !== 'check') {
      return res.status(400).json({
        success: false,
        message: 'This transaction is not for a CRB check'
      });
    }

    // Check if report already generated
    const existingReport = await db.getReportByTransactionId(transaction.id);
    if (existingReport) {
      return res.json({
        success: true,
        report: typeof existingReport.report_data === 'string' 
          ? JSON.parse(existingReport.report_data) 
          : existingReport.report_data
      });
    }

    // Generate CRB Check Report
    const report = crbService.generateCRBCheckReport(
      transaction.id_number,
      transaction.full_name
    );

    // Save report
    await db.createReport({
      transaction_id: transaction.id,
      report_type: 'check',
      report_data: JSON.stringify(report),
      report_reference: report.report_reference
    });

    return res.json({
      success: true,
      report
    });

  } catch (error) {
    logger.error('[CRB] Check report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate CRB report'
    });
  }
});

/**
 * POST /api/crb/clearance
 * Generate CRB Clearance Certificate (requires completed payment)
 */
router.post('/clearance', async (req, res) => {
  try {
    const { reference } = req.body;

    if (!reference) {
      return res.status(400).json({
        success: false,
        message: 'Payment reference is required'
      });
    }

    const transaction = await db.getTransactionByReference(reference);

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    if (transaction.status !== 'completed') {
      return res.status(402).json({
        success: false,
        message: 'Payment not completed. Please complete M-Pesa payment first.'
      });
    }

    if (transaction.service_type !== 'clearance') {
      return res.status(400).json({
        success: false,
        message: 'This transaction is not for CRB clearance'
      });
    }

    // Check if certificate already generated
    const existingReport = await db.getReportByTransactionId(transaction.id);
    if (existingReport) {
      return res.json({
        success: true,
        certificate: typeof existingReport.report_data === 'string'
          ? JSON.parse(existingReport.report_data)
          : existingReport.report_data
      });
    }

    // Generate Clearance Certificate
    const certificate = crbService.generateCRBClearanceCertificate(
      transaction.id_number,
      transaction.full_name
    );

    // Save certificate
    await db.createReport({
      transaction_id: transaction.id,
      report_type: 'clearance',
      report_data: JSON.stringify(certificate),
      report_reference: certificate.certificate_reference
    });

    return res.json({
      success: true,
      certificate
    });

  } catch (error) {
    logger.error('[CRB] Clearance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate clearance certificate'
    });
  }
});

module.exports = router;
