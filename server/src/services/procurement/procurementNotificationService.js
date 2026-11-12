import { query } from '../../database/connection.js';
import emailService from '../auth/emailService.js';

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

class ProcurementNotificationService {
  async getUserEmail(userId) {
    if (!userId) return null;
    const { rows } = await query(
      `SELECT email, first_name, last_name FROM users WHERE id = $1 AND is_active = true`,
      [userId]
    );
    const u = rows[0];
    if (!u?.email) return null;
    return {
      email: u.email,
      name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email
    };
  }

  async getApproverEmails(featureName) {
    const { rows } = await query(
      `SELECT DISTINCT u.email, u.first_name, u.last_name
       FROM users u
       JOIN user_roles ur ON ur.user_id = u.id AND ur.is_active = true
       JOIN role_permissions rp ON rp.role_id = ur.role_id
       JOIN features f ON f.id = rp.feature_id
       WHERE f.name = $1
         AND rp.can_approve = true
         AND u.is_active = true
         AND u.email IS NOT NULL`,
      [featureName]
    );
    return rows.map((r) => ({
      email: r.email,
      name: `${r.first_name || ''} ${r.last_name || ''}`.trim() || r.email
    }));
  }

  async sendMail(to, subject, html) {
    if (!to) return false;
    try {
      await emailService.sendEmail(to, subject, html);
      return true;
    } catch (err) {
      console.warn('Procurement notification email failed:', err.message);
      return false;
    }
  }

  async notifyRequisitionSubmitted(eventData) {
    const subject = `[ProcurePilot] PR submitted: ${eventData.requisition_number || eventData.requisition_id}`;
    const link = `${frontendUrl}/procurement/pr/requisition-details/${eventData.requisition_id}`;
    const html = `
      <p>A purchase requisition was submitted for approval.</p>
      <p><strong>${eventData.title || ''}</strong></p>
      <p>Amount: ${eventData.total_amount ?? '—'}</p>
      <p><a href="${link}">Review requisition</a></p>
    `;
    const approvers = await this.getApproverEmails('purchase_requisition');
    for (const a of approvers) {
      await this.sendMail(a.email, subject, html);
    }
  }

  async notifyRequisitionApproved(eventData) {
    const requester = await this.getUserEmail(eventData.requester_id);
    if (!requester) return;
    const link = `${frontendUrl}/procurement/pr/requisition-details/${eventData.requisition_id}`;
    await this.sendMail(
      requester.email,
      `[ProcurePilot] PR approved: ${eventData.requisition_number || eventData.requisition_id}`,
      `<p>Your requisition was approved.</p><p><a href="${link}">View PR</a></p>`
    );
  }

  async notifyRequisitionRejected(eventData) {
    const requester = await this.getUserEmail(eventData.requester_id);
    if (!requester) return;
    const link = `${frontendUrl}/procurement/pr/requisition-details/${eventData.requisition_id}`;
    await this.sendMail(
      requester.email,
      `[ProcurePilot] PR rejected`,
      `<p>Your requisition was rejected.</p>
       <p>Reason: ${eventData.rejection_reason || '—'}</p>
       <p><a href="${link}">View PR</a></p>`
    );
  }

  async notifyPoSubmitted(eventData) {
    const subject = `[ProcurePilot] PO submitted: ${eventData.po_number || eventData.po_id}`;
    const link = `${frontendUrl}/procurement/po/po-details/${eventData.po_id}`;
    const html = `<p>Purchase order submitted for approval.</p><p>Amount: ${eventData.total_amount ?? '—'}</p><p><a href="${link}">Review PO</a></p>`;
    const approvers = await this.getApproverEmails('purchase_order');
    for (const a of approvers) {
      await this.sendMail(a.email, subject, html);
    }
  }

  async notifyPoApproved(eventData) {
    const creator = await this.getUserEmail(eventData.created_by);
    if (!creator) return;
    const link = `${frontendUrl}/procurement/po/po-details/${eventData.po_id}`;
    await this.sendMail(
      creator.email,
      `[ProcurePilot] PO approved`,
      `<p>Your purchase order was approved.</p><p><a href="${link}">View PO</a></p>`
    );
  }

  async notifyPoRejected(eventData, metadata) {
    const creator = await this.getUserEmail(eventData.created_by);
    if (!creator) return;
    const link = `${frontendUrl}/procurement/po/po-details/${eventData.po_id}`;
    await this.sendMail(
      creator.email,
      `[ProcurePilot] PO rejected`,
      `<p>Your purchase order was rejected.</p>
       <p>Reason: ${metadata?.reason || eventData.reason || '—'}</p>
       <p><a href="${link}">View PO</a></p>`
    );
  }
}

export default new ProcurementNotificationService();
