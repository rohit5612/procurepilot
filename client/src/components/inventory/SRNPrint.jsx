import React, { forwardRef } from 'react';

const SRNPrint = forwardRef(({ srn }, ref) => {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');

  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', color: '#000' }} className="p-6 bg-white">
      <div className="text-center mb-2">
        <div className="text-xl font-bold">STORE RETURN NOTE</div>
      </div>

      <table className="w-full border border-default text-sm mb-4" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>SRN Number:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{srn?.srn_number || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Status:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{srn?.status || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>Received At:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(srn?.received_at)}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Destination Warehouse:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{srn?.destination_warehouse_id || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>eWay Bill No.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{srn?.eway_bill_number || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>eWay Bill Date:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(srn?.eway_bill_date)}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border border-default text-sm mb-4" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>#</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Item</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Returned</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Accepted</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Rejected</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Condition</th>
          </tr>
        </thead>
        <tbody>
          {(srn?.items || []).map((l, idx) => (
            <tr key={l.id}>
              <td style={{ border: '1px solid #ddd' }}>{idx + 1}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.item_id}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.quantity_returned}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.quantity_accepted}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.quantity_rejected}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.condition}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default SRNPrint;


