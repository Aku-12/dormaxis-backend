const User = require('../models/User');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { generateToken, createSession, clearSession, SESSION_CONFIG } = require('../middleware/authMiddleware');
const { 
  validatePasswordComplexity, 
  calculatePasswordExpiry,
  isPasswordExpired 
} = require('../validators/passwordValidator');
const securityConfig = require('../config/security.config');
const { sendPasswordResetCode, sendPasswordChangeConfirmation } = require('../utils/emailService');

/**
 * Register new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        errors: passwordValidation.errors.map(err => ({
          field: 'password',
          message: err
        }))
      });
    }

    // Hash password with configured rounds
    const hashedPassword = await bcrypt.hash(password, securityConfig.encryption.bcryptRounds);

    // Calculate password expiry date
    const passwordExpiresAt = calculatePasswordExpiry();

    // Create new user with security fields
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      passwordChangedAt: new Date(),
      passwordExpiresAt,
    });

    // Remove password from response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      createdAt: user.createdAt
    };

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: userResponse
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed'
    });
  }
};

/**
 * Forgot Password - Request reset code
 * POST /api/auth/forgot-password
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    
    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a verification code has been sent.'
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.json({
        success: true,
        message: 'If an account with that email exists, a verification code has been sent.'
      });
    }

    // Generate 6-digit verification code
    const resetCode = crypto.randomInt(100000, 999999).toString();
    
    // Hash the code before storing
    const hashedCode = await bcrypt.hash(resetCode, 10);
    
    // Set expiry to 15 minutes
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000);

    // Save to user
    user.passwordResetCode = hashedCode;
    user.passwordResetExpires = resetExpires;
    await user.save();

    // Send email with reset code
    try {
      await sendPasswordResetCode(user.email, resetCode, user.name);
    } catch (emailError) {
      // Clear reset fields if email fails
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      console.error('Email send error:', emailError);
      return res.status(500).json({
        success: false,
        error: 'Failed to send verification code. Please try again.'
      });
    }

    res.json({
      success: true,
      message: 'Verification code sent to your email',
      data: {
        email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') // Mask email
      }
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process request'
    });
  }
};

/**
 * Verify reset code
 * POST /api/auth/verify-reset-code
 */
const verifyResetCode = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        success: false,
        error: 'Email and verification code are required'
      });
    }

    // Find user with reset fields
    const user = await User.findOne({ email }).select('+passwordResetCode +passwordResetExpires');

    if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired verification code'
      });
    }

    // Check if code expired
    if (user.passwordResetExpires < new Date()) {
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return res.status(400).json({
        success: false,
        error: 'Verification code has expired. Please request a new one.'
      });
    }

    // Verify code
    const isValidCode = await bcrypt.compare(code, user.passwordResetCode);
    if (!isValidCode) {
      return res.status(400).json({
        success: false,
        error: 'Invalid verification code'
      });
    }

    // Generate a temporary reset token (valid for 10 minutes)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    
    // Update user with verified token
    user.passwordResetCode = hashedToken;
    user.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    await user.save();

    res.json({
      success: true,
      message: 'Code verified successfully',
      data: {
        resetToken
      }
    });
  } catch (error) {
    console.error('Verify reset code error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify code'
    });
  }
};

/**
 * Reset Password with token
 * POST /api/auth/reset-password
 */
const resetPassword = async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Email, reset token, and new password are required'
      });
    }

    // Validate new password
    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    // Find user
    const user = await User.findOne({ email }).select('+passwordResetCode +passwordResetExpires +password');

    if (!user || !user.passwordResetCode || !user.passwordResetExpires) {
      return res.status(400).json({
        success: false,
        error: 'Invalid or expired reset session'
      });
    }

    // Check if token expired
    if (user.passwordResetExpires < new Date()) {
      user.passwordResetCode = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return res.status(400).json({
        success: false,
        error: 'Reset session has expired. Please start over.'
      });
    }

    // Verify token
    const isValidToken = await bcrypt.compare(resetToken, user.passwordResetCode);
    if (!isValidToken) {
      return res.status(400).json({
        success: false,
        error: 'Invalid reset token'
      });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, securityConfig.encryption.bcryptRounds);

    // Update password and clear reset fields
    user.password = hashedPassword;
    user.passwordResetCode = undefined;
    user.passwordResetExpires = undefined;
    user.passwordChangedAt = new Date();
    user.passwordExpiresAt = calculatePasswordExpiry();
    user.mustChangePassword = false;
    
    // Reset login attempts
    user.loginAttempts = { count: 0 };
    
    await user.save();

    // Send confirmation email (don't wait)
    sendPasswordChangeConfirmation(user.email, user.name).catch(console.error);

    res.json({
      success: true,
      message: 'Password reset successfully. You can now log in with your new password.'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to reset password'
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.loginAttempts.lockedUntil && user.loginAttempts.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.loginAttempts.lockedUntil - new Date()) / 60000);
      return res.status(423).json({
        success: false,
        error: `Account is locked. Try again in ${remainingTime} minutes`,
        lockedUntil: user.loginAttempts.lockedUntil
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Increment failed login attempts
      await user.incrementLoginAttempts();
      
      const attemptsLeft = 5 - (user.loginAttempts.count + 1);
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        ...(attemptsLeft > 0 && attemptsLeft <= 3 && { 
          warning: `${attemptsLeft} attempt(s) remaining before account lockout` 
        })
      });
    }

    // Reset login attempts on successful password verification
    await user.resetLoginAttempts();

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      const jwt = require('jsonwebtoken');
      const tempToken = jwt.sign(
        { id: user._id, type: 'mfa_pending' },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );

      return res.json({
        success: true,
        mfaRequired: true,
        message: 'MFA verification required',
        data: {
          tempToken,
          mfaMethod: user.mfaMethod || 'totp'
        }
      });
    }

    // Update last login info
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      lastLoginIP: req.ip || req.connection.remoteAddress,
      lastLoginUserAgent: req.get('User-Agent')
    });

    // Check password expiry
    const expiryStatus = isPasswordExpired(user.passwordExpiresAt);

    // Create session and set HTTP-only cookie (handles concurrent limit)
    const { token } = await createSession(res, user, req);

    // Prepare response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      mfaEnabled: user.mfaEnabled
    };

    const response = {
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token // Still included for API clients that need it
      }
    };

    if (expiryStatus.isExpired) {
      response.passwordExpired = true;
      response.message = 'Login successful, but your password has expired.';
    } else if (expiryStatus.shouldWarn) {
      response.passwordExpiryWarning = {
        daysUntilExpiry: expiryStatus.daysUntilExpiry,
        message: `Your password will expire in ${expiryStatus.daysUntilExpiry} days.`
      };
    }

    if (user.mustChangePassword) {
      response.mustChangePassword = true;
      response.message = 'Login successful, but you must change your password.';
    }

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Login failed'
    });
  }
};

/**
 * Get current user profile
 * GET /api/auth/profile
 */
const getProfile = async (req, res) => {
  try {
    const user = req.user;
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get profile'
    });
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    const passwordValidation = validatePasswordComplexity(newPassword);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'New password does not meet security requirements',
        errors: passwordValidation.errors
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, securityConfig.encryption.bcryptRounds);

    await User.findByIdAndUpdate(userId, {
      password: hashedPassword,
      passwordChangedAt: new Date(),
      passwordExpiresAt: calculatePasswordExpiry(),
      mustChangePassword: false
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to change password'
    });
  }
};

/**
 * Logout user
 * POST /api/auth/logout
 */
const logout = async (req, res) => {
  try {
    // Get token from cookie or header
    const token = req.cookies?.[SESSION_CONFIG.cookieName] || 
                  req.headers.authorization?.split(' ')[1];
    
    // Clear session and cookie
    await clearSession(res, token);

    res.json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.json({
      success: true,
      message: 'Logout successful'
    });
  }
};

/**
 * Validate password strength
 * POST /api/auth/validate-password
 */
const validatePassword = (req, res) => {
  const { password } = req.body;
  
  if (!password) {
    return res.status(400).json({
      success: false,
      error: 'Password is required'
    });
  }

  const result = validatePasswordComplexity(password);
  
  res.json({
    success: true,
    data: {
      isValid: result.isValid,
      strength: result.strength,
      strengthLabel: result.strengthLabel,
      errors: result.errors
    }
  });
};

module.exports = {
  register,
  login,
  getProfile,
  changePassword,
  logout,
  validatePassword,
  forgotPassword,
  verifyResetCode,
  resetPassword
};
