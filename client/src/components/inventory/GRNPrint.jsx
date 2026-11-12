import React, { forwardRef } from 'react';

// Simple print-friendly GRN layout based on GoodsReceiptDetails data
const GRNPrint = forwardRef(({ grn }, ref) => {
  if (!grn) return null;

  const fmt = (d) =>
    d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  return (
    <div
      ref={ref}
      style={{ fontFamily: 'Arial, sans-serif', color: '#000' }}
      className="p-6 bg-white"
    >
      <div className="text-center mb-2">
        <div className="text-xl font-bold">GOODS RECEIPT NOTE</div>
      </div>

      {/* Header block */}
      <table
        className="w-full border border-default text-sm mb-4"
        cellPadding={6}
        style={{ borderCollapse: 'collapse' }}
      >
        <tbody>
          <tr>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>GRN No.:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{grn.grn_number || ''}</td>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>GRN Date:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(grn.created_at || grn.posted_at)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>Vendor Code:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{grn.supplier_code || ''}</td>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>Vendor Name:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{grn.supplier_name || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>Vendor PO No.:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{grn.po_number || ''}</td>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>Vendor PO Date:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(grn.po_date)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>Vendor Address:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }} colSpan={3}>
              {grn.supplier_address || ''}
            </td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>Warehouse:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{grn.warehouse_name || ''}</td>
            <td style={{ border: '1px solid #ddd' }}>
              <strong>Warehouse Address:</strong>
            </td>
            <td style={{ border: '1px solid #ddd' }}>{grn.warehouse_address || ''}</td>
          </tr>
        </tbody>
      </table>

      {/* Line items */}
      <table
        className="w-full border border-default text-sm mb-4"
        cellPadding={6}
        style={{ borderCollapse: 'collapse' }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>S. No.</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Company Code</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Item Code</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Item Description</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>HSN/SAC</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>UoM</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'right' }}>Accepted Qty</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'right' }}>Unit Price</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'right' }}>GST %</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'right' }}>Line Total</th>
          </tr>
        </thead>
        <tbody>
          {(grn.lines || []).map((l, idx) => {
            const qty = Number(l.accepted_qty || l.received_qty || 0);
            const rate = Number(l.unit_price || 0);
            const base = qty * rate;
            const gstRate = Number(l.gst_rate || 0);

            return (
              <tr key={l.id || idx}>
                <td style={{ border: '1px solid #ddd' }}>{idx + 1}</td>
                <td style={{ border: '1px solid #ddd' }}>{l.company_code || ''}</td>
                <td style={{ border: '1px solid #ddd' }}>{l.item_code || ''}</td>
                <td style={{ border: '1px solid #ddd' }}>{l.item_name || ''}</td>
                <td style={{ border: '1px solid #ddd' }}>{l.hsn_code || ''}</td>
                <td style={{ border: '1px solid #ddd' }}>{l.unit_of_measure || ''}</td>
                <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{qty}</td>
                <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{rate}</td>
                <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{gstRate}</td>
                <td style={{ border: '1px solid #ddd', textAlign: 'right' }}>{base}</td>
              </tr>
            );
          })}
          {(!grn.lines || grn.lines.length === 0) && (
            <tr>
              <td style={{ border: '1px solid #ddd', textAlign: 'center' }} colSpan={10}>
                No line items
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {grn.remarks && (
        <div className="mb-2 text-sm">
          <strong>Remarks:</strong> {grn.remarks}
        </div>
      )}
    </div>
  );
});

export default GRNPrint;

