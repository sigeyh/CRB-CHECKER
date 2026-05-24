const express = require('express');
const router = express.Router();
const db = require('../db/database');
const logger = require('../utils/logger');

/**
 * GET /api/user/:reference
 * Retrieve stored user data (full name, ID, phone) for a transaction reference.
 * No authentication required – the reference acts as a simple identifier.
 */
router.get('/id/:idNumber', async (req, res) => {
  try {
    const { idNumber } = req.params;
    const user = await db.getUserByIdNumber(idNumber);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const { full_name, phone_number, created_at, updated_at } = user;
    return res.json({
      success: true,
      idNumber,
      full_name,
      phone_number,
      created_at,
      updated_at
    });
  } catch (error) {
    logger.error('[User] Retrieval by ID error:', error);
    return res.status(500).json({ success: false, message: 'Server error retrieving user data' });
  }
});

module.exports = router;
