const axios = require('axios');

const PAYHERO_BASE_URL = 'https://backend.payhero.co.ke/api/v2';

/**
 * Generate Basic Auth header from PayHero credentials
 */
function getAuthHeader() {
  const username = process.env.PAYHERO_API_USERNAME;
  const password = process.env.PAYHERO_API_PASSWORD;

  if (!username || !password || username === 'your_api_username') {
    throw new Error('PayHero API credentials not configured. Please update your .env file.');
  }

  const token = Buffer.from(`${username}:${password}`).toString('base64');
  return `Basic ${token}`;
}

/**
 * Initiate M-Pesa STK Push via PayHero
 * @param {number} amount - Amount in KES
 * @param {string} phoneNumber - Phone number in 2547XXXXXXXX format
 * @param {string} externalReference - Unique reference for this transaction
 * @returns {Promise<object>} PayHero response
 */
async function initiateSTKPush(amount, phoneNumber, externalReference) {
  try {
    const channelId = parseInt(process.env.PAYHERO_CHANNEL_ID);
    if (!channelId || isNaN(channelId)) {
      throw new Error('PayHero Channel ID not configured. Please update your .env file.');
    }

    const payload = {
      amount: amount,
      phone_number: phoneNumber,
      channel_id: channelId,
      provider: 'm-pesa',
      external_reference: externalReference,
      callback_url: process.env.CALLBACK_URL || 'https://crb-checker-rose.vercel.app/api/payment/callback'
    };

    console.log('[PayHero] Initiating STK Push:', {
      amount,
      phone: phoneNumber,
      reference: externalReference,
      channel: channelId
    });

    const response = await axios.post(`${PAYHERO_BASE_URL}/payments`, payload, {
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    console.log('[PayHero] STK Push Response:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[PayHero] STK Push Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to initiate payment'
    };
  }
}

/**
 * Check transaction status via PayHero
 * @param {string} externalReference - The external reference used when initiating
 * @returns {Promise<object>} Transaction status
 */
async function checkTransactionStatus(externalReference) {
  try {
    const response = await axios.get(`${PAYHERO_BASE_URL}/transaction-status`, {
      params: {
        reference: externalReference
      },
      headers: {
        'Authorization': getAuthHeader(),
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    console.log('[PayHero] Status Check:', response.data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('[PayHero] Status Check Error:', error.response?.data || error.message);
    return {
      success: false,
      error: error.response?.data?.message || error.message || 'Failed to check status'
    };
  }
}

module.exports = {
  initiateSTKPush,
  checkTransactionStatus
};
