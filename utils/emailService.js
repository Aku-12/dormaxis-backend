const nodemailer = require('nodemailer');

/**
 * Email Transporter Configuration
 * Uses Gmail service with App Password
 */
const createTransporter = () => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  
  console.log('📧 Email Config:', {
    user: emailUser ? `${emailUser.substring(0, 5)}***` : 'NOT SET',
    pass: emailPass ? '***SET***' : 'NOT SET'
  });

  if (!emailUser || !emailPass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in .env file');
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: emailUser,
      pass: emailPass,
    },
  });
};

/**
 * Send password reset verification code
 */
const sendPasswordResetCode = async (email, code, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `${process.env.FROM_NAME || 'DormAxis'} <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Reset Verification Code - DormAxis',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-block; width: 60px; height: 60px; background: #4A90B8; border-radius: 12px; line-height: 60px; font-size: 30px;">
                🏠
              </div>
              <h1 style="color: #333; margin: 10px 0 0; font-size: 24px;">DormAxis</h1>
            </div>
            
            <h2 style="color: #333; text-align: center; margin-bottom: 10px;">Password Reset Request</h2>
            <p style="color: #666; text-align: center; margin-bottom: 30px;">
              Hi ${name || 'there'},<br>
              Use the verification code below to reset your password.
            </p>
            
            <div style="background: linear-gradient(135deg, #4A90B8, #357A9A); border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
              <p style="color: rgba(255,255,255,0.8); margin: 0 0 10px; font-size: 14px;">Your Verification Code</p>
              <div style="font-size: 36px; font-weight: bold; color: white; letter-spacing: 8px; font-family: monospace;">
                ${code}
              </div>
            </div>
            
            <p style="color: #999; font-size: 13px; text-align: center; margin-bottom: 20px;">
              This code will expire in <strong>15 minutes</strong>.<br>
              If you didn't request this, please ignore this email.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} DormAxis. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending password reset email:', error.message);
    throw new Error('Failed to send password reset email');
  }
};

/**
 * Send password change confirmation email
 */
const sendPasswordChangeConfirmation = async (email, name) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: `${process.env.FROM_NAME || 'DormAxis'} <${process.env.FROM_EMAIL || process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Password Changed Successfully - DormAxis',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
        <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 16px; padding: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 30px;">
              <div style="display: inline-block; width: 60px; height: 60px; background: #22C55E; border-radius: 50%; line-height: 60px; font-size: 30px;">
                ✓
              </div>
            </div>
            
            <h2 style="color: #333; text-align: center; margin-bottom: 10px;">Password Changed!</h2>
            <p style="color: #666; text-align: center; margin-bottom: 30px;">
              Hi ${name || 'there'},<br>
              Your password has been successfully changed.
            </p>
            
            <p style="color: #999; font-size: 13px; text-align: center;">
              If you didn't make this change, please contact support immediately.
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
              © ${new Date().getFullYear()} DormAxis. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log('✅ Password change confirmation sent');
    return { success: true };
  } catch (error) {
    console.error('❌ Error sending confirmation email:', error.message);
  }
};

module.exports = {
  sendPasswordResetCode,
  sendPasswordChangeConfirmation
};
