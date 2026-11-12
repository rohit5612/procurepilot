import React, { forwardRef } from 'react';
import { BRAND_NAME } from '../../constants/branding';

// Printable PR layout — expects `requisition` with header and lines, plus helper formatters.
const PRPrint = forwardRef(({ requisition, getDepartmentName, getSiteName, getCircleName, getClusterName, formatDate }, ref) => {
  if (!requisition) return null;

  return (
    <div ref={ref} style={{ padding: '16px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>{BRAND_NAME}</div>
        <div style={{ fontSize: '14px', marginTop: '8px', fontWeight: 600 }}>Purchase Requisition (PR)</div>
      </div>

      <div style={{ border: '1px solid #000', marginTop: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000' }}>
          <div style={{ padding: '8px', borderRight: '1px solid #000' }}>
            <div><strong>PR Number:</strong> {requisition.requisition_number || '-'}</div>
            <div><strong>Site ID:</strong> {requisition.site_code || requisition.site_id || '-'}</div>
            <div><strong>Site Name:</strong> {requisition.site_id ? getSiteName(requisition.site_id) : '-'}</div>
            <div><strong>Cluster:</strong> {getClusterName(requisition.cluster_id)}</div>
          </div>
          <div style={{ padding: '8px' }}>
            <div><strong>PR Raise Date:</strong> {formatDate(requisition.created_at)}</div>
            <div><strong>PR Raiser:</strong> {requisition.requester_name || '-'}</div>
            <div><strong>PR Approval Date:</strong> {formatDate(requisition.approved_at)}</div>
            <div><strong>PR Approver:</strong> {requisition.approver_name || '-'}</div>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>S. No.</th>
              <th style={th}>Company Code</th>
              <th style={th}>Item Code</th>
              <th style={th}>Item Description</th>
              <th style={th}>UoM</th>
              <th style={th}>Make</th>
              <th style={th}>PR Quantity</th>
              <th style={th}>Approved Quantity</th>
              <th style={th}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {(requisition.lines || []).map((l, idx) => (
              <tr key={l.id || idx}>
                <td style={tdCenter}>{idx + 1}</td>
                <td style={td}>{l.company_code || '-'}</td>
                <td style={td}>{l.item_code || '-'}</td>
                <td style={td}>{l.item_name || l.description || '-'}</td>
                <td style={tdCenter}>{l.unit_of_measure || '-'}</td>
                <td style={td}>{l.brand || l.manufacturer || '-'}</td>
                <td style={tdRight}>{Number(l.quantity || 0)}</td>
                <td style={tdRight}>{Number(l.quantity || 0)}</td>
                <td style={td}>{l.remarks || '-'}</td>
              </tr>
            ))}
            {(!requisition.lines || requisition.lines.length === 0) && (
              <tr>
                <td style={tdCenter} colSpan={9}>No line items</td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ padding: '8px', borderTop: '1px solid #000' }}>
          <div><strong>Remarks:</strong></div>
          <div style={{ minHeight: '48px' }}>{requisition.description || ''}</div>
        </div>
      </div>
    </div>
  );
});

const th = { border: '1px solid #000', padding: '6px', textAlign: 'left', fontSize: '12px' };
const td = { border: '1px solid #000', padding: '6px', fontSize: '12px' };
const tdCenter = { ...td, textAlign: 'center' };
const tdRight = { ...td, textAlign: 'right' };

export default PRPrint;
