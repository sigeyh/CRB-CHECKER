require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./db/database');
const path = require('path');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const paymentRoutes = require('./routes/payment');
const crbRoutes = require('./routes/crb');
const userRoutes = require('./routes/user');
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy if behind a load balancer (Vercel/Heroku)
app.set('trust proxy', 1);

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net", "https://html2canvas.hertzen.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    }
  }
}));

// Compression middleware
app.use(compression());

// Strict CORS
const allowedOrigins = process.env.ALLOWED_ORIGIN ? process.env.ALLOWED_ORIGIN.split(',') : '*';
app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for APIs to prevent spam
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' }
});

// Apply rate limiter only to API routes
app.use('/api', apiLimiter);

// Request Logging Middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/payment', paymentRoutes);
app.use('/api/crb', crbRoutes);
app.use('/api/user', userRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Catch-all: serve index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  logger.info(`
  ╔═══════════════════════════════════════════════╗
  ║       CRB Checker Kenya - Server Running      ║
  ║                                               ║
  ║   🌐  https://crb-checker-rose.vercel.app/                 ║
  ║   📱  M-Pesa via PayHero Integration          ║
  ║                                               ║
  ║   Services:                                   ║
  ║   • CRB Check     - KES 50                    ║
  ║   • CRB Clearance - KES 100                   ║
  ╚═══════════════════════════════════════════════╝
  `);
});

module.exports = app;
