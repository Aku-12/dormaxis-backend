const speakeasy = require('speakeasy');
const QRCode = require('qrcode');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const User = require('../models/User');
const { generateToken, createSession } = require('../middleware/authMiddleware');
const { sendMFAEnabledConfirmation, sendMFADisabledConfirmation } = require('../utils/emailService');

/**
 * Generate MFA setup (secret + QR code)
 * POST /api/mfa/setup
 */
const setupMFA = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+mfaSecret');

    if (user.mfaEnabled) {
      return res.status(400).json({
        success: false,
        error: 'MFA is already enabled'
      });
    }

    // Generate secret
    const secret = speakeasy.generateSecret({
      name: `DormAxis:${user.email}`,
      issuer: 'DormAxis',
      length: 20
    });

    // Save secret temporarily (not enabled yet)
    user.mfaSecret = secret.base32;
    await user.save();

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(secret.otpauth_url);

    res.json({
      success: true,
      data: {
        secret: secret.base32,
        qrCode: qrCodeUrl,
        message: 'Scan the QR code with your authenticator app'
      }
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to setup MFA'
    });
  }
};

/**
 * Verify TOTP and enable MFA
 * POST /api/mfa/verify-setup
 */
const verifySetup = async (req, res) => {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id).select('+mfaSecret');

    if (!user.mfaSecret) {
      return res.status(400).json({
        success: false,
        error: 'MFA setup not initiated. Please start setup first.'
      });
    }

    // Verify the token
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: token,
      window: 1 // Allow 1 step before/after for clock drift
    });

    if (!verified) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Generate backup codes
    const backupCodes = generateBackupCodes();
    const hashedCodes = await Promise.all(
      backupCodes.map(async (code) => ({
        code: await bcrypt.hash(code, 10),
        used: false
      }))
    );

    // Enable MFA and save backup codes
    user.mfaEnabled = true;
    user.mfaBackupCodes = hashedCodes;
    await user.save();

    // Send confirmation email (async, don't wait)
    sendMFAEnabledConfirmation(user.email, user.name).catch(console.error);

    res.json({
      success: true,
      message: 'MFA enabled successfully',
      data: {
        backupCodes,
        warning: 'Save these backup codes securely. They will not be shown again.'
      }
    });
  } catch (error) {
    console.error('MFA verify setup error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify MFA setup'
    });
  }
};

/**
 * Verify MFA token during login
 * POST /api/mfa/verify
 */
const verifyMFA = async (req, res) => {
  try {
    console.log('=== MFA Verification Started ===');
    const { tempToken, mfaToken } = req.body;

    if (!tempToken || !mfaToken) {
      console.warn('Missing tempToken or mfaToken');
      return res.status(400).json({
        success: false,
        error: 'Temporary token and MFA code are required'
      });
    }

    // Decode temp token to get user ID
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      console.log('Temp token verified for user ID:', decoded.id);
    } catch (err) {
      console.error('Temp token verification failed:', err.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired temporary token'
      });
    }

    const user = await User.findById(decoded.id).select('+mfaSecret');

    if (!user || !user.mfaEnabled) {
      console.warn('User not found or MFA not enabled for user:', decoded.id);
      return res.status(400).json({
        success: false,
        error: 'MFA not enabled for this user'
      });
    }

    console.log('Verifying TOTP token for user:', user.email);
    // Verify TOTP
    const verified = speakeasy.totp.verify({
      secret: user.mfaSecret,
      encoding: 'base32',
      token: mfaToken,
      window: 1
    });

    if (!verified) {
      console.warn('Invalid MFA token provided for user:', user.email);
      return res.status(401).json({
        success: false,
        error: 'Invalid MFA code'
      });
    }

    console.log('MFA Token verified successfully. Creating full session...');

    // Generate full auth token and set cookie
    const { token: sessionToken } = await createSession(res, user, req);
    console.log('Session created successfully for user:', user.email);

    res.json({
      success: true,
      message: 'MFA verification successful',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        },
        token: sessionToken
      }
    });
  } catch (error) {
    console.error('MFA verify error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify MFA'
    });
  }
};

/**
 * Use backup code for login
 * POST /api/mfa/use-backup
 */
const useBackupCode = async (req, res) => {
  try {
    console.log('=== Backup Code Verification Started ===');
    const { tempToken, backupCode } = req.body;

    if (!tempToken || !backupCode) {
      console.warn('Missing tempToken or backupCode');
      return res.status(400).json({
        success: false,
        error: 'Temporary token and backup code are required'
      });
    }

    // Decode temp token
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET);
      console.log('Temp token verified for user ID:', decoded.id);
    } catch (err) {
      console.error('Temp token verification failed:', err.message);
      return res.status(401).json({
        success: false,
        error: 'Invalid or expired temporary token'
      });
    }

    const user = await User.findById(decoded.id).select('+mfaBackupCodes.code');

    if (!user || !user.mfaEnabled) {
      console.warn('User not found or MFA not enabled for user:', decoded.id);
      return res.status(400).json({
        success: false,
        error: 'MFA not enabled for this user'
      });
    }

    console.log('Verifying backup code for user:', user.email);
    // Find and verify backup code
    let codeFound = false;
    for (let i = 0; i < user.mfaBackupCodes.length; i++) {
      const backup = user.mfaBackupCodes[i];
      if (!backup.used) {
        const isMatch = await bcrypt.compare(backupCode.toUpperCase(), backup.code);
        if (isMatch) {
          user.mfaBackupCodes[i].used = true;
          codeFound = true;
          break;
        }
      }
    }

    if (!codeFound) {
      console.warn('Invalid or used backup code provided for user:', user.email);
      return res.status(401).json({
        success: false,
        error: 'Invalid or already used backup code'
      });
    }

    await user.save();
    console.log('Backup code verified. Creating full session...');

    // Generate full auth token and set cookie
    const { token: sessionToken } = await createSession(res, user, req);
    console.log('Session created successfully (via backup code) for user:', user.email);

    // Count remaining codes
    const remainingCodes = user.mfaBackupCodes.filter(c => !c.used).length;

    res.json({
      success: true,
      message: 'Backup code verified',
      data: {
        user: {
          _id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          avatar: user.avatar
        },
        token: sessionToken,
        remainingBackupCodes: remainingCodes,
        warning: remainingCodes < 3 ? 'You have few backup codes left. Consider generating new ones.' : null
      }
    });
  } catch (error) {
    console.error('Backup code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify backup code'
    });
  }
};

/**
 * Disable MFA
 * POST /api/mfa/disable
 */
const disableMFA = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user.mfaEnabled) {
      return res.status(400).json({
        success: false,
        error: 'MFA is not enabled'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Disable MFA
    user.mfaEnabled = false;
    user.mfaSecret = undefined;
    user.mfaBackupCodes = [];
    await user.save();

    // Send confirmation email (async, don't wait)
    sendMFADisabledConfirmation(user.email, user.name).catch(console.error);

    res.json({
      success: true,
      message: 'MFA disabled successfully'
    });
  } catch (error) {
    console.error('MFA disable error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to disable MFA'
    });
  }
};

/**
 * Generate new backup codes
 * POST /api/mfa/backup-codes
 */
const regenerateBackupCodes = async (req, res) => {
  try {
    const { password } = req.body;
    const user = await User.findById(req.user._id).select('+password');

    if (!user.mfaEnabled) {
      return res.status(400).json({
        success: false,
        error: 'MFA is not enabled'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid password'
      });
    }

    // Generate new backup codes
    const backupCodes = generateBackupCodes();
    const hashedCodes = await Promise.all(
      backupCodes.map(async (code) => ({
        code: await bcrypt.hash(code, 10),
        used: false
      }))
    );

    user.mfaBackupCodes = hashedCodes;
    await user.save();

    res.json({
      success: true,
      message: 'New backup codes generated',
      data: {
        backupCodes,
        warning: 'Save these backup codes securely. Previous codes are now invalid.'
      }
    });
  } catch (error) {
    console.error('Regenerate backup codes error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate backup codes'
    });
  }
};

/**
 * Get MFA status
 * GET /api/mfa/status
 */
const getMFAStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('+mfaBackupCodes');

    const remainingCodes = user.mfaEnabled 
      ? user.mfaBackupCodes?.filter(c => !c.used).length || 0 
      : 0;

    res.json({
      success: true,
      data: {
        mfaEnabled: user.mfaEnabled,
        mfaMethod: user.mfaMethod || 'totp',
        remainingBackupCodes: remainingCodes
      }
    });
  } catch (error) {
    console.error('MFA status error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get MFA status'
    });
  }
};

/**
 * Helper: Generate 10 backup codes
 */
function generateBackupCodes() {
  const codes = [];
  for (let i = 0; i < 10; i++) {
    // Generate 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(code);
  }
  return codes;
}

module.exports = {
  setupMFA,
  verifySetup,
  verifyMFA,
  useBackupCode,
  disableMFA,
  regenerateBackupCodes,
  getMFAStatus
};
