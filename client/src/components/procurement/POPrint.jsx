import React, { forwardRef } from 'react';

// Printable Purchase Order layout for VR Power, aligned with PO_Format.xlsx
// Expects a full `po` object as returned by purchaseOrderAPI.getPO(id)
const POPrint = forwardRef(({ po, company = { name: 'V R POWER EQUIPMENTS (P) LTD.' } }, ref) => {
  if (!po) return null;

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);

  const lines = Array.isArray(po.lines) ? po.lines : [];

  const totals = (() => {
    const totalBase = lines.reduce(
      (sum, l) =>
        sum + (Number(l.base_amount) || (Number(l.quantity || 0) * Number(l.unit_price || 0))),
      0
    );
    const totalCgst = lines.reduce((sum, l) => sum + (Number(l.cgst_amount) || 0), 0);
    const totalSgst = lines.reduce((sum, l) => sum + (Number(l.sgst_amount) || 0), 0);
    const totalIgst = lines.reduce((sum, l) => sum + (Number(l.igst_amount) || 0), 0);
    const totalGst = totalCgst + totalSgst + totalIgst;
    const grandTotal = totalBase + totalGst;
    return { totalBase, totalCgst, totalSgst, totalIgst, totalGst, grandTotal };
  })();

  return (
    <div
      ref={ref}
      style={{ padding: '16px', fontFamily: 'Arial, sans-serif', color: '#000' }}
    >
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <div style={{ fontSize: '20px', fontWeight: 700 }}>{company.name}</div>
        <div style={{ fontSize: '14px', marginTop: '8px', fontWeight: 600 }}>PURCHASE ORDER</div>
      </div>

      {/* PO + Supplier / Delivery Info */}
      <div style={{ border: '1px solid #000', marginBottom: '8px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1.5fr 1fr',
            borderBottom: '1px solid #000'
          }}
        >
          {/* PO Details */}
          <div style={{ padding: '8px', borderRight: '1px solid #000', fontSize: '12px' }}>
            <div>
              <strong>PO Number:</strong> {po.po_number || '-'}
            </div>
            <div>
              <strong>PO Date:</strong>{' '}
              {fmtDate(po.po_date || po.created_at || po.issued_at)}
            </div>
            {po.transaction_category_name && (
              <div>
                <strong>Category:</strong> {po.transaction_category_name}
              </div>
            )}
          </div>

          {/* Supplier */}
          <div style={{ padding: '8px', borderRight: '1px solid #000', fontSize: '12px' }}>
            <div>
              <strong>Supplier:</strong> {po.supplier_name || '-'}
            </div>
            {po.supplier_address && (
              <div style={{ marginTop: '4px' }}>
                <strong>Address:</strong> {po.supplier_address}
              </div>
            )}
            {(po.supplier_phone || po.supplier_email) && (
              <div style={{ marginTop: '4px' }}>
                <strong>Contact:</strong>{' '}
                {[po.supplier_phone, po.supplier_email].filter(Boolean).join(' / ')}
              </div>
            )}
          </div>

          {/* Delivery / Site */}
          <div style={{ padding: '8px', fontSize: '12px' }}>
            <div>
              <strong>Site:</strong> {po.site_name || '-'}
            </div>
            <div>
              <strong>Warehouse:</strong> {po.warehouse_name || '-'}
            </div>
            {po.circle_name && (
              <div>
                <strong>Circle:</strong> {po.circle_name}
              </div>
            )}
            {po.cluster_name && (
              <div>
                <strong>Cluster:</strong> {po.cluster_name}
              </div>
            )}
          </div>
        </div>

        {/* PO Description / Remarks */}
        {po.description && (
          <div style={{ padding: '8px', borderBottom: '1px solid #000', fontSize: '12px' }}>
            <div>
              <strong>Description:</strong>
            </div>
            <div style={{ whiteSpace: 'pre-wrap', minHeight: '32px' }}>{po.description}</div>
          </div>
        )}

        {/* Line Items */}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>S. No.</th>
              <th style={th}>Item Code</th>
              <th style={th}>Item Description</th>
              <th style={th}>Mfr</th>
              <th style={th}>UoM</th>
              <th style={th}>Qty</th>
              <th style={th}>Unit Price</th>
              <th style={th}>GST %</th>
              <th style={th}>CGST</th>
              <th style={th}>SGST</th>
              <th style={th}>IGST</th>
              <th style={th}>Line Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td style={tdCenter} colSpan={12}>
                  No line items
                </td>
              </tr>
            )}
            {lines.map((l, idx) => {
              const cgst = Number(l.cgst_amount) || 0;
              const sgst = Number(l.sgst_amount) || 0;
              const igst = Number(l.igst_amount) || 0;
              return (
                <tr key={l.id || idx}>
                  <td style={tdCenter}>{idx + 1}</td>
                  <td style={td}>{l.item_code || '-'}</td>
                  <td style={td}>{l.item_name || l.description || '-'}</td>
                  <td style={td}>{l.manufacturer || '-'}</td>
                  <td style={tdCenter}>{l.unit_of_measure || '-'}</td>
                  <td style={tdRight}>{Number(l.quantity || 0)}</td>
                  <td style={tdRight}>
                    {Number(l.unit_price || 0).toFixed(2)}
                  </td>
                  <td style={tdCenter}>{Number(l.gst_rate || 0)}%</td>
                  <td style={tdRight}>{cgst ? formatCurrency(cgst) : '-'}</td>
                  <td style={tdRight}>{sgst ? formatCurrency(sgst) : '-'}</td>
                  <td style={tdRight}>{igst ? formatCurrency(igst) : '-'}</td>
                  <td style={tdRight}>{formatCurrency(l.total_price || 0)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            borderTop: '1px solid #000',
            fontSize: '12px'
          }}
        >
          {/* Terms / Notes placeholder */}
          <div style={{ padding: '8px', borderRight: '1px solid #000', minHeight: '64px' }}>
            <div>
              <strong>Terms &amp; Conditions:</strong>
            </div>
            <div style={{ minHeight: '48px' }}>
              {/* The detailed terms can be hard-coded or later loaded from master data */}
            </div>
          </div>

          {/* Numeric totals */}
          <div style={{ padding: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span>
                <strong>Base Amount:</strong>
              </span>
              <span>{formatCurrency(totals.totalBase)}</span>
            </div>
            {totals.totalCgst > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>
                  <strong>CGST:</strong>
                </span>
                <span>{formatCurrency(totals.totalCgst)}</span>
              </div>
            )}
            {totals.totalSgst > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>
                  <strong>SGST:</strong>
                </span>
                <span>{formatCurrency(totals.totalSgst)}</span>
              </div>
            )}
            {totals.totalIgst > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>
                  <strong>IGST:</strong>
                </span>
                <span>{formatCurrency(totals.totalIgst)}</span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 4,
                paddingTop: 4,
                borderTop: '1px solid #000'
              }}
            >
              <span>
                <strong>Grand Total:</strong>
              </span>
              <span style={{ fontWeight: 700 }}>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Signatures */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '16px',
          fontSize: '12px',
          marginTop: '16px'
        }}
      >
        <div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 8 }}>Prepared By</div>
          <div style={{ minHeight: 32 }}></div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 8 }}>Checked By</div>
          <div style={{ minHeight: 32 }}></div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #000', marginBottom: 8 }}>Approved By</div>
          <div style={{ minHeight: 32 }}></div>
        </div>
      </div>
    </div>
  );
});

const th = {
  border: '1px solid #000',
  padding: '4px',
  textAlign: 'left',
  fontSize: '11px',
  backgroundColor: '#f5f5f5'
};
const td = { border: '1px solid #000', padding: '4px', fontSize: '11px' };
const tdCenter = { ...td, textAlign: 'center' };
const tdRight = { ...td, textAlign: 'right' };

export default POPrint;


