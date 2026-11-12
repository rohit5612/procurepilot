import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EmailService {
  constructor() {
    // Check if email is disabled
    this.isEnabled = process.env.EMAIL_ENABLED !== 'false';
    
    if (!this.isEnabled) {
      console.log('📧 Email service is disabled (EMAIL_ENABLED=false)');
      return;
    }

    // Prefer explicit SMTP config; fall back to Gmail SMTP with STARTTLS (587)
    const connectionTimeout = parseInt(process.env.EMAIL_CONNECTION_TIMEOUT || '15000', 10); // Increased timeout
    const socketTimeout = parseInt(process.env.EMAIL_SOCKET_TIMEOUT || '15000', 10);
    const greetingTimeout = parseInt(process.env.EMAIL_GREETING_TIMEOUT || '10000', 10);

    const commonOptions = {
      pool: true,
      maxConnections: 1,
      maxMessages: 50,
      connectionTimeout,
      socketTimeout,
      greetingTimeout,
      // Add retry mechanism
      retries: 3,
      retryDelay: 2000
    };

    if (process.env.EMAIL_HOST) {
      const port = parseInt(process.env.EMAIL_PORT || '587', 10);
      const secure = String(process.env.EMAIL_SECURE || '').toLowerCase() === 'true' || port === 465;
      const requireTLS = String(process.env.EMAIL_REQUIRE_TLS || (port === 587 ? 'true' : 'false')).toLowerCase() === 'true';

      const transportOptions = {
        host: process.env.EMAIL_HOST,
        port,
        secure,
        requireTLS,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        ...commonOptions
      };

      // Allow opting-out of TLS verification if provider requires it
      if (String(process.env.EMAIL_TLS_REJECT_UNAUTHORIZED || 'true').toLowerCase() === 'false') {
        transportOptions.tls = { rejectUnauthorized: false };
      }

      this.transporter = nodemailer.createTransport(transportOptions);
    } else {
      // Explicit Gmail SMTP settings (more reliable than service: 'gmail' on PaaS)
      this.transporter = nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false, // STARTTLS
        requireTLS: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        ...commonOptions
      });
    }

    this.fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    this.subjectPrefix = process.env.EMAIL_SUBJECT_PREFIX || '[ERP System]';
    this.frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    this.backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
  }

  /**
   * Send email verification
   */
  async sendVerificationEmail(email, token) {
    if (!this.isEnabled || !this.transporter) {
      console.log('📧 Email service disabled - skipping verification email to:', email);
      return true; // Return success to not break the flow
    }

    const verificationUrl = `${this.backendUrl.replace(/\/$/, '')}/api/auth/verify-email/${token}`;
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: `${this.subjectPrefix} Verify Your Email Address`,
      html: this.getVerificationEmailTemplate(verificationUrl)
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Verification email sent to:', email);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      throw new Error('Failed to send verification email');
    }
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(email, token) {
    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${token}`;
    
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: `${this.subjectPrefix} Password Reset Request`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Password Reset Request</h2>
          
          <p>We received a request to reset your password for your ERP system account.</p>
          
          <p>If you requested this password reset, click the button below to set a new password:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background-color: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p>If the button doesn't work, you can copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          
          <p><strong>Important:</strong> This password reset link will expire in 1 hour.</p>
          
          <p><strong>Security Notice:</strong> If you didn't request this password reset, please ignore this email. Your password will remain unchanged.</p>
          
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
          
          <p style="color: #666; font-size: 12px;">
            This is an automated message, please do not reply.<br>
            For security reasons, this link can only be used once.
          </p>
        </div>
      `
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Password reset email sent to:', email);
    } catch (error) {
      console.error('Failed to send password reset email:', error);
      throw new Error('Failed to send password reset email');
    }
  }

  /**
   * Generic email sending method
   */
  async sendEmail(email, subject, html) {
    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: subject,
      html: html
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Email sent to:', email);
      return true;
    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email');
    }
  }

  /**
   * Send user approval notification
   */
  async sendUserApprovalEmail(email, firstName, username, isApproved, rejectionReason = null) {
    const subject = isApproved 
      ? `${this.subjectPrefix} Account Approved - Welcome!`
      : `${this.subjectPrefix} Account Application Status`;

    const content = isApproved 
      ? this.getApprovalEmailContent(firstName, username)
      : this.getRejectionEmailContent(firstName, rejectionReason);

    const mailOptions = {
      from: this.fromEmail,
      to: email,
      subject: subject,
      html: this.getEmailTemplate(content, isApproved ? 'approved' : 'rejected')
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('User approval email sent to:', email);
    } catch (error) {
      console.error('Failed to send user approval email:', error);
      throw new Error('Failed to send user approval email');
    }
  }

  /**
   * Get verification email content
   */
  getVerificationEmailContent(verificationUrl) {
    return `
      <div style="text-align: center; padding: 20px;">
        <div style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 40px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🎉 Welcome to ERP System!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Complete Your Registration</p>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="margin-bottom: 30px;">
            <h2 style="color: #2d3748; margin-bottom: 15px;">Email Verification Required</h2>
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Thank you for registering with our ERP system! To complete your registration and access your account, 
              please verify your email address by clicking the button below.
            </p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" 
               style="background: linear-gradient(135deg, #4299e1 0%, #3182ce 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(66, 153, 225, 0.3);">
              ✅ Verify Email Address
            </a>
          </div>

          <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="color: #2d3748; margin-bottom: 15px; font-size: 16px;">What happens next?</h3>
            <ul style="text-align: left; color: #4a5568; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Click the verification button above</li>
              <li>Your email will be verified instantly</li>
              <li>An administrator will review your account</li>
              <li>You'll receive approval notification via email</li>
              <li>Once approved, you can log in to the system</li>
            </ul>
          </div>

          <div style="background: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px; border-radius: 4px; margin-bottom: 20px;">
            <p style="margin: 0; color: #2c5282; font-size: 14px;">
              <strong>⏰ Important:</strong> This verification link will expire in 24 hours for security reasons.
            </p>
          </div>

          <div style="background: #f0fff4; border: 1px solid #c6f6d5; border-radius: 8px; padding: 15px;">
            <p style="margin: 0; color: #22543d; font-size: 14px;">
              <strong>🔗 Alternative:</strong> If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="margin: 10px 0 0 0; word-break: break-all; color: #3182ce; font-size: 12px; font-family: monospace;">
              ${verificationUrl}
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get verification email template
   */
  getVerificationEmailTemplate(verificationUrl) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ERP System - Email Verification</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f7fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #f7fafc;">
          ${this.getVerificationEmailContent(verificationUrl)}
          
          <div style="text-align: center; padding: 30px 20px; color: #718096; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              This is an automated message from the ERP System.<br>
              Please do not reply to this email.
            </p>
            <p style="margin: 0;">
              For support, contact your system administrator or email 
              <a href="mailto:support@erp.com" style="color: #3182ce;">support@erp.com</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Get approval email content
   */
  getApprovalEmailContent(firstName, username) {
    return `
      <div style="text-align: center; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 40px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">🎉 Account Approved!</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Welcome to the ERP System</p>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="margin-bottom: 30px;">
            <h2 style="color: #2d3748; margin-bottom: 15px;">Hello ${firstName}!</h2>
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Great news! Your ERP system account has been reviewed and approved by our administrator.
            </p>
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 30px;">
              You can now access the system using your registered credentials.
            </p>
          </div>

          <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="color: #2d3748; margin-bottom: 15px; font-size: 16px;">Your Login Details:</h3>
            <div style="text-align: left;">
              <p style="margin: 5px 0; color: #4a5568;"><strong>Username:</strong> ${username}</p>
              <p style="margin: 5px 0; color: #4a5568;"><strong>Login URL:</strong> <a href="${this.frontendUrl}/login" style="color: #3182ce;">${this.frontendUrl}/login</a></p>
            </div>
          </div>

          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${this.frontendUrl}/login" 
               style="background: linear-gradient(135deg, #48bb78 0%, #38a169 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(72, 187, 120, 0.3);">
              🚀 Access ERP System
            </a>
          </div>

          <div style="background: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #2c5282; font-size: 14px;">
              <strong>💡 Tip:</strong> Keep your login credentials secure and don't share them with anyone.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get rejection email content
   */
  getRejectionEmailContent(firstName, rejectionReason) {
    return `
      <div style="text-align: center; padding: 20px;">
        <div style="background: linear-gradient(135deg, #f56565 0%, #e53e3e 100%); color: white; padding: 40px 20px; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px; font-weight: 600;">📋 Account Status Update</h1>
          <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Application Review Complete</p>
        </div>
        
        <div style="background: white; padding: 40px 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="margin-bottom: 30px;">
            <h2 style="color: #2d3748; margin-bottom: 15px;">Hello ${firstName},</h2>
            <p style="color: #4a5568; line-height: 1.6; margin-bottom: 20px;">
              Thank you for your interest in our ERP system. After careful review of your application, 
              we regret to inform you that your account request has not been approved at this time.
            </p>
          </div>

          ${rejectionReason ? `
            <div style="background: #fed7d7; border: 1px solid #feb2b2; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
              <h3 style="color: #c53030; margin-bottom: 10px; font-size: 16px;">Reason for Rejection:</h3>
              <p style="color: #742a2a; line-height: 1.6; margin: 0;">${rejectionReason}</p>
            </div>
          ` : ''}

          <div style="background: #f7fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin-bottom: 30px;">
            <h3 style="color: #2d3748; margin-bottom: 15px; font-size: 16px;">What's Next?</h3>
            <ul style="text-align: left; color: #4a5568; line-height: 1.6; margin: 0; padding-left: 20px;">
              <li>Review the feedback provided above</li>
              <li>Address any issues mentioned in the rejection reason</li>
              <li>Contact your system administrator if you need clarification</li>
              <li>You may reapply in the future if circumstances change</li>
            </ul>
          </div>

          <div style="background: #ebf8ff; border-left: 4px solid #3182ce; padding: 15px; border-radius: 4px;">
            <p style="margin: 0; color: #2c5282; font-size: 14px;">
              <strong>📞 Need Help?</strong> If you believe this decision was made in error, please contact your system administrator.
            </p>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Get email template wrapper
   */
  getEmailTemplate(content, type) {
    const backgroundColor = type === 'approved' ? '#f0fff4' : '#fff5f5';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>ERP System - Account ${type === 'approved' ? 'Approved' : 'Status Update'}</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: ${backgroundColor}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="max-width: 600px; margin: 0 auto; background-color: ${backgroundColor};">
          ${content}
          
          <div style="text-align: center; padding: 30px 20px; color: #718096; font-size: 12px;">
            <p style="margin: 0 0 10px 0;">
              This is an automated message from the ERP System.<br>
              Please do not reply to this email.
            </p>
            <p style="margin: 0;">
              For support, contact your system administrator or email 
              <a href="mailto:support@erp.com" style="color: #3182ce;">support@erp.com</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Send Purchase Order to supplier
   */
  async sendPurchaseOrderEmail(poDetails, supplierEmail, attachments = []) {
    if (!this.isEnabled || !this.transporter) {
      console.log('📧 Email service disabled - skipping PO email to:', supplierEmail);
      console.log('📋 PO Details would be sent:', {
        po_number: poDetails.po_number,
        supplier: supplierEmail,
        total_amount: poDetails.total_amount
      });
      return true; // Return success to not break the flow
    }

    const subject = 'Release of New Purchase Order From VR Power Equipment Pvt. Ltd.';
    const html = this.getPurchaseOrderEmailTemplate(poDetails);

    const templatesDir = path.resolve(__dirname, '../../templates');
    const footerLogoPath = path.join(templatesDir, 'footerlogo.png');

    const mailOptions = {
      from: this.fromEmail,
      to: supplierEmail,
      subject: subject,
      html: html,
      attachments: [
        ...attachments,
        {
          filename: 'footerlogo.png',
          path: footerLogoPath,
          cid: 'footerLogo'
        }
      ]
    };

    try {
      await this.transporter.sendMail(mailOptions);
      console.log('Purchase Order email sent to:', supplierEmail);
      return true;
    } catch (error) {
      console.error('Failed to send PO email:', error);
      console.log('📧 Email failed but continuing with PO processing...');
      // Don't throw error - just log and continue
      return false;
    }
  }

  /**
   * Get Purchase Order email template (supplier-facing)
   */
  getPurchaseOrderEmailTemplate(po) {
    const formatDate = (dateStr) => {
      if (!dateStr) return '-';
      return new Date(dateStr).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    };

    const formatAmount = (amount) => {
      return Number(amount || 0).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    };

    const poNumber = po.po_number || '-';
    const orderDate = formatDate(po.approved_at || po.issued_at || po.created_at);
    const totalAmount = formatAmount(po.total_amount);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Release of New Purchase Order From VR Power Equipment Pvt. Ltd.</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; font-size: 14px; color: #1a202c;">
        <div style="max-width: 700px; margin: 0 auto; padding: 24px;">
          <p>Dear Partner,</p>

          <p>
            The purchase order <strong>${poNumber}</strong> is attached with this email.
          </p>

          <p>An overview of the purchase order is available below:</p>

          <pre style="font-family: 'Courier New', monospace; font-size: 13px; background-color: #f7fafc; padding: 12px; border: 1px solid #e2e8f0; border-radius: 4px; white-space: pre-wrap;">
----------------------------------------------------------------------------------------
Purchase Order # : ${poNumber}
----------------------------------------------------------------------------------------
Order Date       : ${orderDate}

Amount           : Rs. ${totalAmount}
----------------------------------------------------------------------------------------</pre>

          <p>
            Please go through it, sign and seal the order as confirmation. We look forward to working with you again.
          </p>

          <p>
            Please arrange to submit softcopy of invoice(s) to
            <a href="mailto:accounts1@vrgroup.org">accounts1@vrgroup.org</a> and courier the original seal and sign
            hard copy of invoices along with signed off PO Copy to VRP Jaipur Office.
          </p>

          <p>
            Payments will only be made once hard copy of invoice is received at VRP Jaipur Office.
          </p>

          <p>
            <strong>Address:</strong> VR Group - B - 25, Lohiya Colony, Nemi Nagar Extension, Vaishali Nagar,
            Jaipur, Rajasthan – 302021
          </p>

          <p style="margin-top: 24px;">
            Thanks &amp; Regards<br/>
            <strong>VR Power Equipment Pvt. Ltd.</strong>
          </p>

          <p style="margin-top: 8px;">
            <img src="cid:footerLogo" alt="VR Group" style="max-width: 260px; height: auto;" />
          </p>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Test email configuration
   */
  async testEmailConfig() {
    try {
      await this.transporter.verify();
      console.log('Email configuration is valid');
      return true;
    } catch (error) {
      console.error('Email configuration error:', error);
      return false;
    }
  }
}

export default new EmailService();
