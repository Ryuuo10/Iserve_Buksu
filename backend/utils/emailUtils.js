const nodemailer = require('nodemailer');

const hasEmailConfig = () => Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASSWORD);

// Create transporter using Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Use app password, not regular password
  },
});

// Verify transporter on startup
if (hasEmailConfig()) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('Email transporter error:', error);
    } else {
      console.log('Email service ready:', success);
    }
  });
} else {
  console.warn('Email service not configured: EMAIL_USER and/or EMAIL_PASSWORD are missing.');
}

const sendEmail = async ({ to, subject, html, text }) => {
  if (!hasEmailConfig()) {
    return {
      success: false,
      skipped: true,
      message: 'Email service is not configured',
    };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to,
      subject,
      html,
      text,
    });

    console.log('Email sent:', info.response);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, message: 'Failed to send email', error: error.message };
  }
};

const sendEmailWithCode = async (email, code, userName = 'User') => {
  try {
    const result = await sendEmail({
      to: email,
      subject: 'Password Reset Code - Grievance System',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${userName},</p>
          <p>You requested a password reset for your Grievance System account. Here is your verification code:</p>
          
          <div style="background-color: #f0f0f0; padding: 20px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <h1 style="color: #007bff; letter-spacing: 5px; margin: 0;">${code}</h1>
          </div>
          
          <p><strong>This code will expire in 10 minutes.</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #666; font-size: 12px;">
            This is an automated message from the Grievance System. Please do not reply to this email.
          </p>
        </div>
      `,
    });

    return result;
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, message: 'Failed to send email', error: error.message };
  }
};

module.exports = { hasEmailConfig, sendEmail, sendEmailWithCode, transporter };
