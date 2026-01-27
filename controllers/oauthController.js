/**
 * OAuth Controller
 * Handles OAuth 2.0 Authorization Code flow with PKCE for Google Sign-In
 */

const crypto = require('crypto');
const User = require('../models/User');
const { createSession } = require('../middleware/authMiddleware');

// Google OAuth configuration
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5173/auth/google/callback';

console.log('--- OAuth Configuration Check ---');
console.log('GOOGLE_CLIENT_ID:', GOOGLE_CLIENT_ID ? 'LOADED' : 'MISSING');
console.log('GOOGLE_CLIENT_SECRET:', GOOGLE_CLIENT_SECRET ? 'LOADED' : 'MISSING');
console.log('GOOGLE_REDIRECT_URI:', GOOGLE_REDIRECT_URI);
console.log('---------------------------------');

/**
 * Generate Google OAuth URL
 * GET /api/auth/google/url
 */
const getGoogleAuthUrl = async (req, res) => {
  try {
    const { code_challenge, code_challenge_method, state } = req.query;

    if (!code_challenge) {
      return res.status(400).json({
        success: false,
        error: 'code_challenge is required'
      });
    }

    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: GOOGLE_REDIRECT_URI,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
      code_challenge: code_challenge,
      code_challenge_method: code_challenge_method || 'S256'
    });

    // Add state if provided (optional for CSRF protection)
    if (state) {
      params.append('state', state);
    }

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    res.json({
      success: true,
      data: { authUrl }
    });
  } catch (error) {
    console.error('Get Google auth URL error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate OAuth URL'
    });
  }
};

/**
 * Handle Google OAuth callback
 * POST /api/auth/google/callback
 */
const googleCallback = async (req, res) => {
  try {
    console.log('=== Google OAuth Callback Started ===');
    const { code, code_verifier, state } = req.body;

    console.log('Received code:', code ? `${code.substring(0, 30)}...` : 'NONE');
    console.log('Received code_verifier:', code_verifier ? `${code_verifier.substring(0, 15)}...` : 'NONE');
    console.log('Client ID:', GOOGLE_CLIENT_ID ? `${GOOGLE_CLIENT_ID.substring(0, 20)}...` : 'MISSING');
    console.log('Client Secret:', GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING!!!');
    console.log('Redirect URI:', GOOGLE_REDIRECT_URI);

    if (!code || !code_verifier) {
      console.error('Missing code or code_verifier');
      return res.status(400).json({
        success: false,
        error: 'Authorization code and code verifier are required'
      });
    }

    console.log('Exchanging code for tokens with Google...');

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code: code,
        code_verifier: code_verifier,
        grant_type: 'authorization_code',
        redirect_uri: GOOGLE_REDIRECT_URI
      }).toString()
    });

    const tokenData = await tokenResponse.json();
    console.log('Token response status:', tokenResponse.status);
    console.log('Token data:', tokenResponse.ok ? 'SUCCESS' : tokenData);

    if (!tokenResponse.ok) {
      console.error('Token exchange failed:', tokenData);
      return res.status(401).json({
        success: false,
        error: tokenData.error_description || 'Token exchange failed'
      });
    }

    const { id_token, access_token } = tokenData;

    // Decode ID token to get user info (it's a JWT)
    const payload = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64').toString());
    
    const { name, email, picture, sub: googleId } = payload;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email not provided by Google'
      });
    }

    // Find or create user
    let user = await User.findOne({ email });

    if (user) {
      // If user exists but doesn't have googleId linked, link it
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatar && picture) {
          user.avatar = picture;
        }
        await user.save();
      }
    } else {
      // Create new user
      user = await User.create({
        name,
        email,
        googleId,
        avatar: picture,
        isEmailVerified: true,
        password: crypto.randomBytes(16).toString('hex')
      });
    }

    // Check if account is locked
    if (user.loginAttempts?.lockedUntil && user.loginAttempts.lockedUntil > new Date()) {
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

    // Update last login
    await User.findByIdAndUpdate(user._id, {
      lastLogin: new Date(),
      lastLoginIP: req.ip || req.connection.remoteAddress,
      lastLoginUserAgent: req.get('User-Agent')
    });

    // Create session
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
    console.error('Google callback error:', error);
    res.status(500).json({
      success: false,
      error: 'Google authentication failed'
    });
  }
};

module.exports = {
  getGoogleAuthUrl,
  googleCallback
};
