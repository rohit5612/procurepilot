import React, { forwardRef } from 'react';
import { BRAND_NAME } from '../../constants/branding';

/**
 * Printable PO layout — mirrors PRPrint structure for consistent supplier/internal copies.
 */
const POPrint = forwardRef(
  (
    {
      po,
      getSiteName,
      getCircleName,
      getClusterName,
      formatDate
    },
    ref
  ) => {
    if (!po) return null;

    const lines = Array.isArray(po.lines) ? po.lines : [];
    const fmt = formatDate || ((d) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

    const grandTotal = lines.reduce((sum, l) => sum + (Number(l.total_price) || 0), 0);

    return (
      <div ref={ref} style={{ padding: '16px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <div style={{ fontSize: '20px', fontWeight: 700 }}>{BRAND_NAME}</div>
          <div style={{ fontSize: '14px', marginTop: '8px', fontWeight: 600 }}>Purchase Order (PO)</div>
        </div>

        <div style={{ border: '1px solid #000', marginTop: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000' }}>
            <div style={{ padding: '8px', borderRight: '1px solid #000' }}>
              <div><strong>PO Number:</strong> {po.po_number || '-'}</div>
              <div><strong>Site ID:</strong> {po.site_code || po.site_id || '-'}</div>
              <div>
                <strong>Site Name:</strong>{' '}
                {po.site_name || (po.site_id && getSiteName ? getSiteName(po.site_id) : '-')}
              </div>
              <div><strong>Cluster:</strong> {po.cluster_name || (getClusterName ? getClusterName(po.cluster_id) : '-')}</div>
              <div><strong>Circle:</strong> {po.circle_name || (getCircleName ? getCircleName(po.circle_id) : '-')}</div>
            </div>
            <div style={{ padding: '8px' }}>
              <div><strong>PO Date:</strong> {fmt(po.po_date || po.issued_at || po.created_at)}</div>
              <div><strong>Issue Date:</strong> {fmt(po.issued_at)}</div>
              <div><strong>Supplier:</strong> {po.supplier_name || '-'}</div>
              <div><strong>Warehouse:</strong> {po.warehouse_name || '-'}</div>
              {po.requisition_number || po.indent_number ? (
                <div>
                  <strong>Against PR:</strong> {po.requisition_number || po.indent_number}
                </div>
              ) : null}
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
                <th style={th}>PO Quantity</th>
                <th style={th}>Unit Price (INR)</th>
                <th style={th}>Line Total (INR)</th>
                <th style={th}>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, idx) => (
                <tr key={l.id || idx}>
                  <td style={tdCenter}>{idx + 1}</td>
                  <td style={td}>{l.company_code || '-'}</td>
                  <td style={td}>{l.item_code || '-'}</td>
                  <td style={td}>{l.item_name || l.description || '-'}</td>
                  <td style={tdCenter}>{l.unit_of_measure || '-'}</td>
                  <td style={td}>{l.brand || l.manufacturer || '-'}</td>
                  <td style={tdRight}>{Number(l.quantity || 0)}</td>
                  <td style={tdRight}>{Number(l.unit_price || 0).toFixed(2)}</td>
                  <td style={tdRight}>{Number(l.total_price || 0).toFixed(2)}</td>
                  <td style={td}>{l.remarks || l.line_notes || '-'}</td>
                </tr>
              ))}
              {lines.length === 0 && (
                <tr>
                  <td style={tdCenter} colSpan={10}>
                    No line items
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              borderTop: '1px solid #000',
              fontSize: '12px'
            }}
          >
            <div style={{ padding: '8px', borderRight: '1px solid #000' }}>
              <div><strong>Remarks:</strong></div>
              <div style={{ minHeight: '48px', whiteSpace: 'pre-wrap' }}>{po.description || ''}</div>
            </div>
            <div style={{ padding: '8px', minWidth: '180px' }}>
              <div>
                <strong>Grand total (INR):</strong> {grandTotal.toFixed(2)}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

const th = { border: '1px solid #000', padding: '6px', textAlign: 'left', fontSize: '12px' };
const td = { border: '1px solid #000', padding: '6px', fontSize: '12px' };
const tdCenter = { ...td, textAlign: 'center' };
const tdRight = { ...td, textAlign: 'right' };

export default POPrint;
