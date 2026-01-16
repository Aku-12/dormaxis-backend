const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  setupMFA,
  verifySetup,
  verifyMFA,
  useBackupCode,
  disableMFA,
  regenerateBackupCodes,
  getMFAStatus
} = require('../controllers/mfaController');

// Public routes (for login flow)
router.post('/verify', verifyMFA);
router.post('/use-backup', useBackupCode);

// Protected routes (require authentication)
router.use(protect);

// GET /api/mfa/status - Get MFA status
router.get('/status', getMFAStatus);

// POST /api/mfa/setup - Start MFA setup
router.post('/setup', setupMFA);

// POST /api/mfa/verify-setup - Complete MFA setup
router.post('/verify-setup', verifySetup);

// POST /api/mfa/disable - Disable MFA
router.post('/disable', disableMFA);

// POST /api/mfa/backup-codes - Generate new backup codes
router.post('/backup-codes', regenerateBackupCodes);

module.exports = router;
