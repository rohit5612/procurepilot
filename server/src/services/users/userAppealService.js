import { query } from '../../database/connection.js';
import emailService from '../auth/emailService.js';

class UserAppealService {
  /**
   * Submit a new appeal
   */
  async submitAppeal(userId, appealData) {
    try {
      // Check if user exists and is suspended
      const userResult = await query(
        'SELECT id, email, first_name, last_name, status FROM users WHERE id = $1',
        [userId]
      );

      if (userResult.rows.length === 0) {
        throw new Error('User not found');
      }

      const user = userResult.rows[0];
      if (user.status !== 'suspended') {
        throw new Error('Only suspended users can submit appeals');
      }

      // Check if user already has a pending appeal
      const existingAppeal = await query(
        'SELECT id FROM user_appeals WHERE user_id = $1 AND status = $2',
        [userId, 'pending']
      );

      if (existingAppeal.rows.length > 0) {
        throw new Error('You already have a pending appeal');
      }

      // Create the appeal
      const appealResult = await query(
        `INSERT INTO user_appeals (user_id, appeal_reason, appeal_details)
         VALUES ($1, $2, $3)
         RETURNING id, user_id, appeal_reason, appeal_details, status, created_at`,
        [userId, appealData.reason, appealData.details]
      );

      const appeal = appealResult.rows[0];

      // Send notification email to superadmin
      await this.sendAppealNotificationToAdmin(appeal, user);

      return {
        success: true,
        message: 'Appeal submitted successfully',
        appeal: {
          id: appeal.id,
          status: appeal.status,
          submittedAt: appeal.created_at
        }
      };
    } catch (error) {
      throw new Error(`Failed to submit appeal: ${error.message}`);
    }
  }

  /**
   * Get all appeals (for admin)
   */
  async getAllAppeals(filters = {}) {
    try {
      let sqlQuery = `
        SELECT 
          ua.id, ua.appeal_reason, ua.appeal_details, ua.status, ua.admin_notes,
          ua.created_at, ua.reviewed_at, ua.updated_at,
          u.id as user_id, u.email, u.first_name, u.last_name, u.full_name,
          u.suspension_reason, u.suspended_at,
          admin.first_name as admin_first_name, admin.last_name as admin_last_name
        FROM user_appeals ua
        JOIN users u ON ua.user_id = u.id
        LEFT JOIN users admin ON ua.reviewed_by = admin.id
        WHERE 1=1
      `;

      const queryParams = [];
      let paramCount = 0;

      // Add status filter
      if (filters.status && filters.status !== 'all') {
        paramCount++;
        sqlQuery += ` AND ua.status = $${paramCount}`;
        queryParams.push(filters.status);
      }

      // Add search filter
      if (filters.search) {
        paramCount++;
        sqlQuery += ` AND (
          u.first_name ILIKE $${paramCount} OR 
          u.last_name ILIKE $${paramCount} OR 
          u.email ILIKE $${paramCount} OR
          ua.appeal_reason ILIKE $${paramCount}
        )`;
        queryParams.push(`%${filters.search}%`);
      }

      sqlQuery += ` ORDER BY ua.created_at DESC`;

      // Add pagination
      if (filters.limit) {
        paramCount++;
        sqlQuery += ` LIMIT $${paramCount}`;
        queryParams.push(filters.limit);

        if (filters.offset) {
          paramCount++;
          sqlQuery += ` OFFSET $${paramCount}`;
          queryParams.push(filters.offset);
        }
      }

      const result = await query(sqlQuery, queryParams);

      return result.rows;
    } catch (error) {
      throw new Error(`Failed to fetch appeals: ${error.message}`);
    }
  }

  /**
   * Get appeal by ID
   */
  async getAppealById(appealId) {
    try {
      const result = await query(
        `SELECT 
          ua.id, ua.appeal_reason, ua.appeal_details, ua.status, ua.admin_notes,
          ua.created_at, ua.reviewed_at, ua.updated_at,
          u.id as user_id, u.email, u.first_name, u.last_name, u.full_name,
          u.suspension_reason, u.suspended_at, u.suspended_by,
          admin.first_name as admin_first_name, admin.last_name as admin_last_name,
          suspended_by_admin.first_name as suspended_by_first_name, 
          suspended_by_admin.last_name as suspended_by_last_name
        FROM user_appeals ua
        JOIN users u ON ua.user_id = u.id
        LEFT JOIN users admin ON ua.reviewed_by = admin.id
        LEFT JOIN users suspended_by_admin ON u.suspended_by = suspended_by_admin.id
        WHERE ua.id = $1`,
        [appealId]
      );

      if (result.rows.length === 0) {
        throw new Error('Appeal not found');
      }

      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to fetch appeal: ${error.message}`);
    }
  }

  /**
   * Review an appeal (approve/reject)
   */
  async reviewAppeal(appealId, adminId, reviewData) {
    try {
      const { status, notes } = reviewData;

      // Validate status
      if (!['approved', 'rejected'].includes(status)) {
        throw new Error('Invalid status. Must be approved or rejected');
      }

      // Get appeal details
      const appeal = await this.getAppealById(appealId);
      if (appeal.status !== 'pending') {
        throw new Error('Appeal has already been reviewed');
      }

      // Update appeal
      await query(
        `UPDATE user_appeals 
         SET status = $1, admin_notes = $2, reviewed_by = $3, reviewed_at = CURRENT_TIMESTAMP
         WHERE id = $4`,
        [status, notes, adminId, appealId]
      );

      // If approved, reactivate the user
      if (status === 'approved') {
        await query(
          `UPDATE users 
           SET status = 'active', updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [appeal.user_id]
        );
      }

      // Send notification email to user
      await this.sendAppealDecisionNotification(appeal, status, notes);

      return {
        success: true,
        message: `Appeal ${status} successfully`,
        appeal: {
          id: appealId,
          status,
          reviewedAt: new Date()
        }
      };
    } catch (error) {
      throw new Error(`Failed to review appeal: ${error.message}`);
    }
  }

  /**
   * Get appeals count by status
   */
  async getAppealsStats() {
    try {
      const result = await query(`
        SELECT 
          COUNT(*) as total_appeals,
          COUNT(CASE WHEN ua.status = 'pending' THEN 1 END) as pending_appeals,
          COUNT(CASE WHEN ua.status = 'approved' THEN 1 END) as approved_appeals,
          COUNT(CASE WHEN ua.status = 'rejected' THEN 1 END) as rejected_appeals
        FROM user_appeals ua
        JOIN users u ON ua.user_id = u.id
        WHERE 1=1
      `);

      return result.rows[0];
    } catch (error) {
      throw new Error(`Failed to fetch appeal stats: ${error.message}`);
    }
  }

  /**
   * Send appeal notification to admin
   */
  async sendAppealNotificationToAdmin(appeal, user) {
    try {
      const subject = `New Appeal Submitted - ${user.full_name}`;
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>New Appeal Submitted</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f8fafc;
            }
            
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            
            .header {
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            
            .header h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            
            .header p {
              font-size: 16px;
              opacity: 0.9;
            }
            
            .content {
              padding: 40px 30px;
            }
            
            .alert-badge {
              display: inline-block;
              padding: 12px 24px;
              background-color: #fef3c7;
              color: #92400e;
              border: 2px solid #fde68a;
              border-radius: 50px;
              font-weight: 600;
              font-size: 16px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 24px;
            }
            
            .greeting {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 16px;
              color: #1f2937;
            }
            
            .message {
              font-size: 16px;
              line-height: 1.7;
              margin-bottom: 24px;
              color: #4b5563;
            }
            
            .user-info {
              background-color: #f8fafc;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 20px;
              margin: 24px 0;
            }
            
            .user-info h3 {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 12px;
              color: #1f2937;
            }
            
            .info-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 8px;
              font-size: 14px;
            }
            
            .info-label {
              font-weight: 600;
              color: #374151;
            }
            
            .info-value {
              color: #6b7280;
            }
            
            .appeal-details {
              background-color: #f9fafb;
              border-left: 4px solid #f59e0b;
              padding: 20px;
              margin: 24px 0;
              border-radius: 0 8px 8px 0;
            }
            
            .appeal-details h3 {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 12px;
              color: #1f2937;
            }
            
            .appeal-reason {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 16px;
              padding: 12px;
              background-color: #ffffff;
              border-radius: 6px;
              border: 1px solid #e5e7eb;
            }
            
            .appeal-text {
              font-size: 14px;
              color: #4b5563;
              line-height: 1.6;
              white-space: pre-wrap;
            }
            
            .action-section {
              background-color: #fef3c7;
              padding: 24px;
              border-radius: 8px;
              margin: 24px 0;
              text-align: center;
            }
            
            .action-button {
              display: inline-block;
              padding: 14px 28px;
              background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              transition: all 0.3s ease;
            }
            
            .action-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(245, 158, 11, 0.3);
            }
            
            .footer {
              background-color: #f8fafc;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            
            .footer p {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            
            .company-info {
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
            }
            
            .company-logo {
              width: 40px;
              height: 40px;
              border-radius: 8px;
              margin: 0 auto 12px;
              display: block;
            }
            
            .company-name {
              font-size: 16px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 4px;
            }
            
            .company-subtitle {
              font-size: 12px;
              color: #6b7280;
            }
            
            @media (max-width: 600px) {
              .email-container {
                margin: 0;
                border-radius: 0;
              }
              
              .header, .content, .footer {
                padding: 20px;
              }
              
              .header h1 {
                font-size: 24px;
              }
              
              .info-row {
                flex-direction: column;
                margin-bottom: 12px;
              }
              
              .info-value {
                margin-top: 4px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>New Appeal Submitted</h1>
              <p>Nuvorn Nexus ERP Suite</p>
            </div>
            
            <div class="content">
              <div class="alert-badge">
                ⚠️ Action Required
              </div>
              
              <div class="greeting">
                Dear Administrator,
              </div>
              
              <div class="message">
                A new account appeal has been submitted and requires your review. 
                Please review the details below and take appropriate action.
              </div>
              
              <div class="user-info">
                <h3>User Information</h3>
                <div class="info-row">
                  <span class="info-label">Name:</span>
                  <span class="info-value">${user.full_name}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Email:</span>
                  <span class="info-value">${user.email}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">User ID:</span>
                  <span class="info-value">#${user.id}</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Account Status:</span>
                  <span class="info-value">Suspended</span>
                </div>
                <div class="info-row">
                  <span class="info-label">Appeal Submitted:</span>
                  <span class="info-value">${new Date(appeal.created_at).toLocaleString()}</span>
                </div>
              </div>
              
              <div class="appeal-details">
                <h3>Appeal Details</h3>
                <div class="appeal-reason">
                  <strong>Reason:</strong> ${appeal.appeal_reason}
                </div>
                <div class="appeal-text">${appeal.appeal_details}</div>
              </div>
              
              <div class="action-section">
                <p style="margin-bottom: 20px; font-size: 16px; color: #92400e;">
                  <strong>Review Required</strong>
                </p>
                <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard/appeals" class="action-button">
                  Review Appeal
                </a>
              </div>
              
              <div class="message">
                Please review this appeal promptly and take appropriate action. 
                The user is currently unable to access the system while their appeal is pending.
              </div>
            </div>
            
            <div class="footer">
              <p>Best regards,</p>
              <p><strong>Nuvorn Nexus ERP System</strong></p>
              
              <div class="company-info">
                <img src="${process.env.FRONTEND_URL || 'http://localhost:5173'}/src/assets/images/nuvorn%20axis%20logo.png" 
                     alt="Nuvorn Nexus Logo" class="company-logo">
                <div class="company-name">Nuvorn Nexus Pvt. Ltd.</div>
                <div class="company-subtitle">ERP Suite</div>
              </div>
              
              <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send to superadmin (you might want to get admin emails from database)
      await emailService.sendEmail(
        'admin@erp.com', // Replace with actual admin email
        subject,
        html
      );
    } catch (error) {
      console.error('Failed to send appeal notification to admin:', error);
      // Don't throw error - email failure shouldn't break appeal submission
    }
  }

  /**
   * Send appeal decision notification to user
   */
  async sendAppealDecisionNotification(appeal, decision, adminNotes) {
    try {
      const isApproved = decision === 'approved';
      const subject = `Account Appeal Decision - ${isApproved ? 'Approved' : 'Rejected'}`;
      
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Appeal Decision</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              background-color: #f8fafc;
            }
            
            .email-container {
              max-width: 600px;
              margin: 0 auto;
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            }
            
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              padding: 40px 30px;
              text-align: center;
              color: white;
            }
            
            .header h1 {
              font-size: 28px;
              font-weight: 700;
              margin-bottom: 8px;
            }
            
            .header p {
              font-size: 16px;
              opacity: 0.9;
            }
            
            .content {
              padding: 40px 30px;
            }
            
            .status-badge {
              display: inline-block;
              padding: 12px 24px;
              border-radius: 50px;
              font-weight: 600;
              font-size: 16px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 24px;
            }
            
            .status-approved {
              background-color: #dcfce7;
              color: #166534;
              border: 2px solid #bbf7d0;
            }
            
            .status-rejected {
              background-color: #fef2f2;
              color: #dc2626;
              border: 2px solid #fecaca;
            }
            
            .greeting {
              font-size: 18px;
              font-weight: 600;
              margin-bottom: 16px;
              color: #1f2937;
            }
            
            .message {
              font-size: 16px;
              line-height: 1.7;
              margin-bottom: 24px;
              color: #4b5563;
            }
            
            .admin-notes {
              background-color: #f9fafb;
              border-left: 4px solid #3b82f6;
              padding: 20px;
              margin: 24px 0;
              border-radius: 0 8px 8px 0;
            }
            
            .admin-notes h3 {
              font-size: 16px;
              font-weight: 600;
              margin-bottom: 8px;
              color: #1f2937;
            }
            
            .admin-notes p {
              font-size: 14px;
              color: #6b7280;
              line-height: 1.6;
            }
            
            .action-section {
              background-color: #f8fafc;
              padding: 24px;
              border-radius: 8px;
              margin: 24px 0;
              text-align: center;
            }
            
            .action-button {
              display: inline-block;
              padding: 14px 28px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              font-size: 16px;
              transition: all 0.3s ease;
            }
            
            .action-button:hover {
              transform: translateY(-2px);
              box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
            }
            
            .footer {
              background-color: #f8fafc;
              padding: 30px;
              text-align: center;
              border-top: 1px solid #e5e7eb;
            }
            
            .footer p {
              font-size: 14px;
              color: #6b7280;
              margin-bottom: 8px;
            }
            
            .company-info {
              margin-top: 16px;
              padding-top: 16px;
              border-top: 1px solid #e5e7eb;
            }
            
            .company-logo {
              width: 40px;
              height: 40px;
              border-radius: 8px;
              margin: 0 auto 12px;
              display: block;
            }
            
            .company-name {
              font-size: 16px;
              font-weight: 600;
              color: #1f2937;
              margin-bottom: 4px;
            }
            
            .company-subtitle {
              font-size: 12px;
              color: #6b7280;
            }
            
            @media (max-width: 600px) {
              .email-container {
                margin: 0;
                border-radius: 0;
              }
              
              .header, .content, .footer {
                padding: 20px;
              }
              
              .header h1 {
                font-size: 24px;
              }
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>Account Appeal Decision</h1>
              <p>Nuvorn Nexus ERP Suite</p>
            </div>
            
            <div class="content">
              <div class="status-badge ${isApproved ? 'status-approved' : 'status-rejected'}">
                ${isApproved ? '✓ Approved' : '✗ Rejected'}
              </div>
              
              <div class="greeting">
                Dear ${appeal.first_name} ${appeal.last_name},
              </div>
              
              <div class="message">
                We have reviewed your account appeal and reached a decision. 
                ${isApproved 
                  ? 'We are pleased to inform you that your appeal has been approved and your account has been reactivated.'
                  : 'After careful consideration, we regret to inform you that your appeal has been rejected.'
                }
              </div>
              
              ${adminNotes ? `
                <div class="admin-notes">
                  <h3>Administrator Notes:</h3>
                  <p>${adminNotes}</p>
                </div>
              ` : ''}
              
              <div class="action-section">
                ${isApproved ? `
                  <p style="margin-bottom: 20px; font-size: 16px; color: #059669;">
                    <strong>Your account is now active!</strong>
                  </p>
                  <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login" class="action-button">
                    Login to Your Account
                  </a>
                ` : `
                  <p style="margin-bottom: 20px; font-size: 16px; color: #dc2626;">
                    <strong>Your account remains suspended.</strong>
                  </p>
                  <p style="font-size: 14px; color: #6b7280;">
                    If you have any questions or need further assistance, please contact our support team.
                  </p>
                `}
              </div>
              
              <div class="message">
                ${isApproved 
                  ? 'You can now access all features of the ERP system. We appreciate your patience and understanding during this process.'
                  : 'We understand this may be disappointing, but this decision was made after careful review of your case. If you believe there has been an error, you may contact our support team for further clarification.'
                }
              </div>
              
              <div class="message">
                Thank you for your understanding and cooperation.
              </div>
            </div>
            
            <div class="footer">
              <p>Best regards,</p>
              <p><strong>Nuvorn Nexus ERP Support Team</strong></p>
              
              <div class="company-info">
                <img src="${process.env.FRONTEND_URL || 'http://localhost:5173'}/src/assets/images/nuvorn%20axis%20logo.png" 
                     alt="Nuvorn Nexus Logo" class="company-logo">
                <div class="company-name">Nuvorn Nexus Pvt. Ltd.</div>
                <div class="company-subtitle">ERP Suite</div>
              </div>
              
              <p style="margin-top: 20px; font-size: 12px; color: #9ca3af;">
                This is an automated message. Please do not reply to this email.
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await emailService.sendEmail(
        appeal.email,
        subject,
        html
      );
    } catch (error) {
      console.error('Failed to send appeal decision notification:', error);
      // Don't throw error - email failure shouldn't break appeal review
    }
  }

  /**
   * Update user suspension details when suspending
   */
  async updateSuspensionDetails(userId, adminId, suspensionData) {
    try {
      const { reason, notes } = suspensionData;
      
      await query(
        `UPDATE users 
         SET suspension_reason = $1, suspended_at = CURRENT_TIMESTAMP, 
             suspended_by = $2, suspension_notes = $3
         WHERE id = $4`,
        [reason, adminId, notes, userId]
      );
    } catch (error) {
      throw new Error(`Failed to update suspension details: ${error.message}`);
    }
  }
}

export default new UserAppealService();
