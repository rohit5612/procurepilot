import React, { forwardRef } from 'react';
import { BRAND_NAME } from '../../constants/branding';

/** Printable GRN — same visual language as PRPrint / POPrint. */
const GRNPrint = forwardRef(({ grn, formatDate }, ref) => {
  if (!grn) return null;

  const fmt =
    formatDate ||
    ((d) =>
      d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

  const lines = Array.isArray(grn.lines) ? grn.lines : [];
  const grandTotal = lines.reduce((sum, l) => {
    const qty = Number(l.accepted_qty || l.received_qty || 0);
    const rate = Number(l.unit_price || 0);
    return sum + (Number(l.line_total) || qty * rate);
  }, 0);

  return (
    <div ref={ref} style={{ padding: '16px', fontFamily: 'Arial, sans-serif', color: '#000' }}>
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>{BRAND_NAME}</div>
        <div style={{ fontSize: '14px', marginTop: '8px', fontWeight: 600 }}>Goods Receipt Note (GRN)</div>
      </div>

      <div style={{ border: '1px solid #000', marginTop: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid #000' }}>
          <div style={{ padding: '8px', borderRight: '1px solid #000' }}>
            <div><strong>GRN Number:</strong> {grn.grn_number || '-'}</div>
            <div><strong>PO Number:</strong> {grn.po_number || '-'}</div>
            <div><strong>Supplier:</strong> {grn.supplier_name || '-'}</div>
            <div><strong>Supplier code:</strong> {grn.supplier_code || '-'}</div>
          </div>
          <div style={{ padding: '8px' }}>
            <div><strong>GRN Date:</strong> {fmt(grn.posted_at || grn.created_at)}</div>
            <div><strong>PO Date:</strong> {fmt(grn.po_date)}</div>
            <div><strong>Warehouse:</strong> {grn.warehouse_name || '-'}</div>
            <div><strong>Site:</strong> {grn.site_name || '-'}</div>
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
              <th style={th}>Accepted Qty</th>
              <th style={th}>Unit Price (INR)</th>
              <th style={th}>Line Total (INR)</th>
              <th style={th}>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, idx) => {
              const qty = Number(l.accepted_qty || l.received_qty || 0);
              const rate = Number(l.unit_price || 0);
              const lineTotal = Number(l.line_total) || qty * rate;
              return (
                <tr key={l.id || idx}>
                  <td style={tdCenter}>{idx + 1}</td>
                  <td style={td}>{l.company_code || '-'}</td>
                  <td style={td}>{l.item_code || '-'}</td>
                  <td style={td}>{l.item_name || '-'}</td>
                  <td style={tdCenter}>{l.unit_of_measure || '-'}</td>
                  <td style={td}>{l.brand || l.manufacturer || '-'}</td>
                  <td style={tdRight}>{qty}</td>
                  <td style={tdRight}>{rate.toFixed(2)}</td>
                  <td style={tdRight}>{lineTotal.toFixed(2)}</td>
                  <td style={td}>{l.remarks || '-'}</td>
                </tr>
              );
            })}
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
            <div style={{ minHeight: '48px', whiteSpace: 'pre-wrap' }}>{grn.remarks || ''}</div>
            {grn.warehouse_address ? (
              <div style={{ marginTop: '8px' }}>
                <strong>Warehouse address:</strong> {grn.warehouse_address}
              </div>
            ) : null}
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
});

const th = { border: '1px solid #000', padding: '6px', textAlign: 'left', fontSize: '12px' };
const td = { border: '1px solid #000', padding: '6px', fontSize: '12px' };
const tdCenter = { ...td, textAlign: 'center' };
const tdRight = { ...td, textAlign: 'right' };

export default GRNPrint;
