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
const { deleteOldAvatar } = require('../middleware/uploadMiddleware');
const { uploadToCloudinary, deleteFromCloudinary, getPublicIdFromUrl } = require('../config/cloudinary');
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * Google Login
 * POST /api/auth/google
 */
const googleLogin = async (req, res) => {
  try {
    const { token } = req.body;
    
    // Verify Google Token
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const { name, email, picture, sub: googleId } = ticket.getPayload();
    
    let user = await User.findOne({ email });
    
    if (user) {
      // If user exists but doesn't have googleId linked, link it
      if (!user.googleId) {
        user.googleId = googleId;
        // Also update avatar if not set
        if (!user.avatar && picture) {
          user.avatar = picture;
        }
        await user.save();
      }
    } else {
      // Create new user
      // Note: We need a random password if we want to support password login later or just bypass pw
      // But schema now makes password optional if googleId is set.
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture,
        isEmailVerified: true, // Google emails are verified
        password: crypto.randomBytes(16).toString('hex') // Assign random secure password or leave empty if schema allows
      });
    }

    // Check if account is locked
    if (user.loginAttempts?.lockedUntil && user.loginAttempts.lockedUntil > new Date()) {
        // ... (lockout logic copy from login)
         const remainingTime = Math.ceil((user.loginAttempts.lockedUntil - new Date()) / 60000);
         return res.status(423).json({
            success: false,
            error: `Account is locked. Try again in ${remainingTime} minutes`
         });
    }
    
    if (!user.isActive) {
        return res.status(401).json({
            success: false,
            error: 'Account is deactivated. Please contact support.'
        });
    }
    
    // Create session (same as regular login)
    // Update last login
    await User.findByIdAndUpdate(user._id, {
        lastLogin: new Date(),
        lastLoginIP: req.ip || req.connection.remoteAddress,
        lastLoginUserAgent: req.get('User-Agent')
    });
    
    const { token: sessionToken } = await createSession(res, user, req);
    
    const userResponse = {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        avatar: user.avatar,
        mfaEnabled: user.mfaEnabled
    };

    res.json({
        success: true,
        message: 'Google login successful',
        data: {
            user: userResponse,
            token: sessionToken
        }
    });

  } catch (error) {
    console.error('Google login error:', error);
    res.status(401).json({
      success: false,
      error: 'Google login failed'
    });
  }
};

/**
 * Register new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    console.log('=== User Registration Started ===');
    const { name, email, password, phone } = req.body;
    console.log('Registration email:', email);

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.warn('Registration failed: User already exists with email:', email);
      return res.status(400).json({
        success: false,
        error: 'User with this email already exists'
      });
    }

    // Validate password complexity
    const passwordValidation = validatePasswordComplexity(password);
    if (!passwordValidation.isValid) {
      console.warn('Registration failed: Password complexity not met for user:', email);
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

    console.log('Creating user document in database...');
    // Create new user with security fields
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      passwordChangedAt: new Date(),
      passwordExpiresAt,
    });

    console.log('User registered successfully:', email);

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
    console.error('Registration error detail:', error);
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
    console.log('=== Login Attempt Started ===');
    const { email, password } = req.body;
    console.log('Login email:', email);

    // Validate input
    if (!email || !password) {
      console.warn('Login failed: Missing email or password');
      return res.status(400).json({
        success: false,
        error: 'Please provide email and password'
      });
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.warn('Login failed: User not found for email:', email);
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.loginAttempts.lockedUntil && user.loginAttempts.lockedUntil > new Date()) {
      const remainingTime = Math.ceil((user.loginAttempts.lockedUntil - new Date()) / 60000);
      console.warn('Login failed: Account locked for user:', email);
      return res.status(423).json({
        success: false,
        error: `Account is locked. Try again in ${remainingTime} minutes`,
        lockedUntil: user.loginAttempts.lockedUntil
      });
    }

    // Check if user is active
    if (!user.isActive) {
      console.warn('Login failed: Account deactivated for user:', email);
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn('Login failed: Invalid password for user:', email);
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
    console.log('Password verified successfully for user:', email);

    // Check if MFA is enabled
    if (user.mfaEnabled) {
      console.log('MFA is enabled for user:', email, '. Generating temporary token.');
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

    console.log('MFA not enabled. Proceeding with session creation.');

    // Update last login info
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      lastLoginIP: req.ip || req.connection.remoteAddress,
      lastLoginUserAgent: req.get('User-Agent')
    });

    // Check password expiry
    const expiryStatus = isPasswordExpired(user.passwordExpiresAt);

    // Create session and set HTTP-only cookie
    const { token } = await createSession(res, user, req);
    console.log('Session created successfully (normal login) for user:', email);

    // Prepare response
    const userResponse = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      mfaEnabled: user.mfaEnabled,
      avatar: user.avatar
    };

    const response = {
      success: true,
      message: 'Login successful',
      data: {
        user: userResponse,
        token
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

/**
 * Update user profile
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    const { name, phone, firstName, lastName } = req.body;

    // Store user state before update for audit
    const userBefore = { name: req.user.name, phone: req.user.phone };

    // Build update object
    const updateData = {};

    // Handle name update (combine firstName and lastName if provided)
    if (firstName !== undefined || lastName !== undefined) {
      const fName = firstName || req.user.name?.split(' ')[0] || '';
      const lName = lastName || req.user.name?.split(' ').slice(1).join(' ') || '';
      updateData.name = `${fName} ${lName}`.trim();
    } else if (name !== undefined) {
      updateData.name = name;
    }

    if (phone !== undefined) {
      updateData.phone = phone;
    }

    // Update user (sensitive fields excluded by schema select:false)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Create audit log for profile update
    const { createAuditLog } = require('../utils/auditLogger');
    await createAuditLog({
      action: 'UPDATE',
      targetType: 'User',
      targetId: updatedUser._id,
      targetName: updatedUser.name,
      before: userBefore,
      after: { name: updatedUser.name, phone: updatedUser.phone },
      req
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile'
    });
  }
};

/**
 * Upload user avatar
 * POST /api/auth/avatar
 */
const uploadAvatarHandler = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file provided'
      });
    }

    // Get the old avatar path to delete later
    const user = await User.findById(userId);
    const oldAvatar = user?.avatar;

    // Upload to Cloudinary
    const result = await uploadToCloudinary(req.file.buffer, 'avatars');
    const avatarUrl = result.secure_url;

    // Update user with new avatar (sensitive fields excluded by schema select:false)
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { $set: { avatar: avatarUrl } },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete old avatar file if exists (handles both local and Cloudinary)
    if (oldAvatar) {
      await deleteOldAvatar(oldAvatar);
    }

    res.json({
      success: true,
      message: 'Avatar uploaded successfully',
      data: {
        avatar: avatarUrl,
        user: updatedUser
      }
    });
  } catch (error) {
    console.error('Upload avatar error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to upload avatar'
    });
  }
};

// Helper functions for User Agent parsing
const getDeviceType = (ua) => {
  if (/mobile/i.test(ua)) return 'Mobile';
  if (/tablet/i.test(ua)) return 'Tablet';
  return 'Desktop';
};

const getBrowserInfo = (ua) => {
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('SamsungBrowser')) return 'Samsung Internet';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('Trident')) return 'Internet Explorer';
  if (ua.includes('Edge')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  return 'Unknown Browser';
};

const getOSInfo = (ua) => {
  if (ua.includes('Win')) return 'Windows';
  if (ua.includes('Mac')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iOS')) return 'iOS';
  return 'Unknown OS';
};

/**
 * Get active sessions
 * GET /api/auth/sessions
 */
const getSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentToken = req.cookies?.[SESSION_CONFIG.cookieName] || 
                        req.headers.authorization?.split(' ')[1];

    // Find all active sessions for this user
    const Session = require('../models/Session');
    const sessions = await Session.find({ 
      userId,
      expiresAt: { $gt: new Date() } // Only not expired
    }).sort({ lastActivity: -1 });

    // Enhance session data
    const sessionsData = sessions.map(session => ({
      _id: session._id,
      userAgent: session.userAgent,
      ipAddress: session.ipAddress,
      lastActivity: session.lastActivity,
      createdAt: session.createdAt,
      isCurrent: session.token === currentToken,
      deviceType: getDeviceType(session.userAgent), // Helper to parse UA
      browser: getBrowserInfo(session.userAgent),   // Helper to parse UA
      os: getOSInfo(session.userAgent)              // Helper to parse UA
    }));

    res.json({
      success: true,
      data: sessionsData
    });
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sessions'
    });
  }
};

/**
 * Revoke specific session
 * DELETE /api/auth/sessions/:sessionId
 */
const revokeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user._id;

    const Session = require('../models/Session');
    const session = await Session.findOne({ _id: sessionId, userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    await session.deleteOne();

    res.json({
      success: true,
      message: 'Session revoked successfully'
    });
  } catch (error) {
    console.error('Revoke session error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke session'
    });
  }
};

/**
 * Revoke all other sessions
 * DELETE /api/auth/sessions
 */
const revokeAllSessions = async (req, res) => {
  try {
    const userId = req.user._id;
    const currentToken = req.cookies?.[SESSION_CONFIG.cookieName] || 
                        req.headers.authorization?.split(' ')[1];

    const Session = require('../models/Session');
    
    // Delete all sessions for user
    const result = await Session.deleteMany({ 
      userId
    });

    res.json({
      success: true,
      message: 'All sessions revoked successfully',
      revokedCount: result.deletedCount
    });
  } catch (error) {
    console.error('Revoke all sessions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke sessions'
    });
  }
};

/**
 * Delete user avatar
 * DELETE /api/auth/avatar
 */
const deleteAvatar = async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // Delete avatar file if exists (handles both local and Cloudinary)
    if (user.avatar) {
      await deleteOldAvatar(user.avatar);
    }

    // Clear avatar field
    user.avatar = '';
    await user.save();

    res.json({
      success: true,
      message: 'Avatar deleted successfully'
    });
  } catch (error) {
    console.error('Delete avatar error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete avatar'
    });
  }
};

/**
 * Delete user account
 * DELETE /api/auth/account
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const { password } = req.body;

    // Find user
    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    // For users with password (non-Google users), verify password
    if (user.password && !user.googleId) {
      if (!password) {
        return res.status(400).json({
          success: false,
          error: 'Password is required to delete account'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          error: 'Incorrect password'
        });
      }
    }

    // Delete avatar file if exists (handles both local and Cloudinary)
    if (user.avatar) {
      await deleteOldAvatar(user.avatar);
    }

    // Delete user's sessions
    const Session = require('../models/Session');
    await Session.deleteMany({ user: userId });

    // Delete user's notifications
    const Notification = require('../models/Notification');
    await Notification.deleteMany({ user: userId });

    // Optionally: Cancel active bookings or handle them differently
    // For now, we'll leave bookings for record-keeping but could add cancellation logic

    // Delete user
    await User.findByIdAndDelete(userId);

    // Clear session cookie
    clearSession(res);

    res.json({
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete account'
    });
  }
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
  resetPassword,
  updateProfile,
  uploadAvatarHandler,
  deleteAvatar,
  getSessions,
  revokeSession,
  revokeAllSessions,
  googleLogin,
  deleteAccount
};
