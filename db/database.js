const admin = require('firebase-admin');
const logger = require('../utils/logger');

// Initialize Firebase Admin
try {
  let serviceAccount = null;

  // Option 1: Base64 encoded JSON in environment variable (best for Vercel/Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    const buffer = Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, 'base64');
    serviceAccount = JSON.parse(buffer.toString('utf-8'));
  } 
  // Option 2: Path to JSON file
  else if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    serviceAccount = require(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  }

  if (serviceAccount) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    logger.info('[DB] Firebase initialized successfully');
  } else {
    logger.warn('[DB] No Firebase credentials found. Running in mock/offline mode (Data will not persist!)');
  }
} catch (error) {
  logger.error('[DB] Firebase initialization failed:', error);
}

const db = admin.apps.length ? admin.firestore() : null;

// Mock in-memory DB if Firebase is not configured
const mockDb = { transactions: [], reports: [], users: [] };

// Helper to generate IDs for mock db
const generateId = () => Date.now() + Math.floor(Math.random() * 1000);

// --- Transactions ---
const createTransaction = async (data) => {
  const newTx = {
    reference: data.reference,
    phone_number: data.phone_number,
    id_number: data.id_number,
    full_name: data.full_name,
    amount: parseFloat(data.amount),
    service_type: data.service_type,
    status: data.status || 'pending',
    payhero_reference: null,
    checkout_request_id: null,
    mpesa_receipt: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (db) {
    try {
      // Use reference as the document ID for quick lookups
      await db.collection('transactions').doc(newTx.reference).set(newTx);
      return { success: true, id: newTx.reference };
    } catch (error) {
      logger.error('Error creating transaction in Firebase:', error);
      throw error;
    }
  } else {
    // Fallback
    newTx.id = generateId();
    mockDb.transactions.push(newTx);
    return { success: true, id: newTx.id };
  }
};

const getTransactionByReference = async (reference) => {
  if (db) {
    try {
      const doc = await db.collection('transactions').doc(reference).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching transaction ${reference}:`, error);
      throw error;
    }
  } else {
    return mockDb.transactions.find(tx => tx.reference === reference) || null;
  }
};

const updateTransactionStatus = async (reference, status, extra = {}) => {
  if (db) {
    try {
      const updates = {
        status,
        updated_at: new Date().toISOString()
      };
      if (extra.payhero_reference !== undefined) updates.payhero_reference = extra.payhero_reference;
      if (extra.checkout_request_id !== undefined) updates.checkout_request_id = extra.checkout_request_id;
      if (extra.mpesa_receipt !== undefined) updates.mpesa_receipt = extra.mpesa_receipt;

      await db.collection('transactions').doc(reference).update(updates);
      return { success: true };
    } catch (error) {
      logger.error(`Error updating transaction ${reference}:`, error);
      throw error;
    }
  } else {
    const tx = mockDb.transactions.find(t => t.reference === reference);
    if (tx) {
      tx.status = status;
      tx.updated_at = new Date().toISOString();
      if (extra.payhero_reference !== undefined) tx.payhero_reference = extra.payhero_reference;
      if (extra.checkout_request_id !== undefined) tx.checkout_request_id = extra.checkout_request_id;
      if (extra.mpesa_receipt !== undefined) tx.mpesa_receipt = extra.mpesa_receipt;
      return { success: true };
    }
    return { success: false };
  }
};

// --- Reports ---
const createReport = async (data) => {
  const newReport = {
    transaction_id: data.transaction_id,
    report_type: data.report_type,
    report_data: data.report_data,
    report_reference: data.report_reference,
    created_at: new Date().toISOString()
  };

  if (db) {
    try {
      await db.collection('reports').doc(newReport.report_reference).set(newReport);
      return { success: true, id: newReport.report_reference };
    } catch (error) {
      logger.error('Error creating report in Firebase:', error);
      throw error;
    }
  } else {
    newReport.id = generateId();
    mockDb.reports.push(newReport);
    return { success: true, id: newReport.id };
  }
};

const getReportByTransactionId = async (transactionId) => {
  if (db) {
    try {
      const snapshot = await db.collection('reports')
        .where('transaction_id', '==', transactionId)
        .limit(1)
        .get();
      
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching report by tx ${transactionId}:`, error);
      throw error;
    }
  } else {
    return mockDb.reports.find(r => r.transaction_id === transactionId) || null;
  }
};

const getReportByReference = async (reference) => {
  if (db) {
    try {
      const doc = await db.collection('reports').doc(reference).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching report ${reference}:`, error);
      throw error;
    }
  } else {
    return mockDb.reports.find(r => r.report_reference === reference) || null;
  }
};

// --- Users ---
/**
 * Store a user record without any authentication layer.
 * Fields: full_name, id_number, phone_number, created_at, updated_at
 */
const createUser = async (data) => {
  const newUser = {
    full_name: data.full_name,
    id_number: data.id_number,
    phone_number: data.phone_number,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  if (db) {
    try {
      // Use id_number as document ID for quick lookup
      await db.collection('users').doc(newUser.id_number).set(newUser);
      return { success: true, id: newUser.id_number };
    } catch (error) {
      logger.error('Error creating user in Firebase:', error);
      throw error;
    }
  } else {
    newUser.id = generateId();
    mockDb.users.push(newUser);
    return { success: true, id: newUser.id };
  }
};

const getUserByIdNumber = async (idNumber) => {
  if (db) {
    try {
      const doc = await db.collection('users').doc(idNumber).get();
      if (doc.exists) {
        return { id: doc.id, ...doc.data() };
      }
      return null;
    } catch (error) {
      logger.error(`Error fetching user ${idNumber}:`, error);
      throw error;
    }
  } else {
    return mockDb.users.find(u => u.id_number === idNumber) || null;
  }
};

module.exports = {
  createTransaction,
  getTransactionByReference,
  updateTransactionStatus,
  createReport,
  getReportByTransactionId,
  getReportByReference,
  createUser,
  getUserByIdNumber
};
