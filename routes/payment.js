const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const payheroService = require('../services/payhero');
const db = require('../db/database');
const logger = require('../utils/logger');

/**
 * POST /api/payment/initiate
 * Start M-Pesa STK Push payment
 */
router.post('/initiate', async (req, res) => {
  try {
    const { phone_number, id_number, full_name, service_type } = req.body;

    // Validate inputs
    if (!phone_number || !id_number || !full_name || !service_type) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields: phone_number, id_number, full_name, service_type'
      });
    }

    if (!['check', 'clearance'].includes(service_type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid service_type. Must be "check" or "clearance"'
      });
    }

    // Normalize phone number to 2547XXXXXXXX format
    const normalizedPhone = normalizePhoneNumber(phone_number);
    if (!normalizedPhone) {
      return res.status(400).json({
        success: false,
        message: 'Invalid phone number. Use format: 07XXXXXXXX or 2547XXXXXXXX'
      });
    }

    // Validate ID number (Kenyan ID: 7-8 digits)
    const cleanId = id_number.replace(/\s/g, '');
    if (!/^\d{7,}$/.test(cleanId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ID number. Must be at least 7 digits.'
      });
    }

    // Set amount based on service type
    const amount = service_type === 'check' ? 50 : 100;

    // Generate unique reference
    const reference = `CRB-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;

    // Save transaction to DB
    await db.createTransaction({
      reference,
      phone_number: normalizedPhone,
      id_number: cleanId,
      full_name: full_name.trim(),
      amount,
      service_type,
      status: 'pending'
    });

    // Store user details separately (no auth)
    await db.createUser({
      full_name: full_name.trim(),
      id_number: cleanId,
      phone_number: normalizedPhone
    });

    // Initiate STK Push via PayHero
    const result = await payheroService.initiateSTKPush(amount, normalizedPhone, reference);

    if (result.success) {
      // Update transaction with PayHero reference
      await db.updateTransactionStatus(reference, 'processing', {
        checkout_request_id: result.data?.checkout_request_id || null,
        payhero_reference: result.data?.reference || null
      });

      return res.json({
        success: true,
        message: 'STK Push sent! Check your phone for M-Pesa prompt.',
        reference,
        amount
      });
    } else {
      await db.updateTransactionStatus(reference, 'failed');
      return res.status(500).json({
        success: false,
        message: result.error || 'Failed to initiate payment. Please try again.'
      });
    }
  } catch (error) {
    logger.error('[Payment] Initiate error:', error);
    return res.status(500).json({
      success: false,
      message: 'An unexpected error occurred. Please try again.'
    });
  }
});

/**
 * GET /api/payment/status/:reference
 * Check payment status
 */
router.get('/status/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    // First check our local DB
    const transaction = await db.getTransactionByReference(reference);
    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    // If already completed or failed, return local status
    if (['completed', 'failed', 'cancelled'].includes(transaction.status)) {
      return res.json({
        success: true,
        status: transaction.status,
        service_type: transaction.service_type,
        reference: transaction.reference
      });
    }

    // Poll PayHero for latest status
    const result = await payheroService.checkTransactionStatus(reference);

    if (result.success && result.data) {
      const payheroStatus = parsePayHeroStatus(result.data);

      if (payheroStatus !== transaction.status) {
        await db.updateTransactionStatus(reference, payheroStatus, {
          mpesa_receipt: result.data?.mpesa_receipt || result.data?.MpesaReceiptNumber || null
        });
      }

      return res.json({
        success: true,
        status: payheroStatus,
        service_type: transaction.service_type,
        reference: transaction.reference
      });
    }

    // Return current DB status if PayHero check fails
    return res.json({
      success: true,
      status: transaction.status,
      service_type: transaction.service_type,
      reference: transaction.reference
    });

  } catch (error) {
    logger.error('[Payment] Status check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

/**
 * POST /api/payment/callback
 * PayHero webhook callback for payment confirmation
 */
router.post('/callback', async (req, res) => {
  try {
    logger.info('[PayHero Callback] Received data');

    const data = req.body;
    const externalRef = data.ExternalReference || data.external_reference;

    if (!externalRef) {
      logger.error('[PayHero Callback] No external reference in callback');
      return res.status(200).json({ received: true });
    }

    const transaction = await db.getTransactionByReference(externalRef);
    if (!transaction) {
      logger.error(`[PayHero Callback] Transaction not found: ${externalRef}`);
      return res.status(200).json({ received: true });
    }

    // Determine status from callback
    const resultCode = data.ResultCode || data.result_code;
    const status = (resultCode === 0 || resultCode === '0') ? 'completed' : 'failed';

    await db.updateTransactionStatus(externalRef, status, {
      mpesa_receipt: data.MpesaReceiptNumber || data.mpesa_receipt || null,
      checkout_request_id: data.CheckoutRequestID || data.checkout_request_id || null
    });

    logger.info(`[PayHero Callback] Transaction ${externalRef} updated to: ${status}`);

    // Always respond 200 to acknowledge receipt
    return res.status(200).json({ received: true, status });

  } catch (error) {
    logger.error('[PayHero Callback] Error:', error);
    return res.status(200).json({ received: true });
  }
});

// --- Helper functions ---

function normalizePhoneNumber(phone) {
  // Remove spaces, dashes, plus signs
  let cleaned = phone.replace(/[\\s\\-\\+]/g, '');

  // Handle various formats
  if (cleaned.startsWith('07') && cleaned.length === 10) {
    return '254' + cleaned.slice(1);
  }
  if (cleaned.startsWith('01') && cleaned.length === 10) {
    return '254' + cleaned.slice(1);
  }
  if (cleaned.startsWith('2547') && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith('2541') && cleaned.length === 12) {
    return cleaned;
  }
  if (cleaned.startsWith('7') && cleaned.length === 9) {
    return '254' + cleaned;
  }
  if (cleaned.startsWith('1') && cleaned.length === 9) {
    return '254' + cleaned;
  }

  return null;
}

function parsePayHeroStatus(data) {
  // PayHero may return status in different formats
  const status = (data.status || data.Status || '').toString().toLowerCase();

  if (['success', 'completed', 'paid'].includes(status)) return 'completed';
  if (['failed', 'failure', 'rejected'].includes(status)) return 'failed';
  if (['cancelled', 'canceled'].includes(status)) return 'cancelled';
  return 'processing';
}

module.exports = router;
