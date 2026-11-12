import React, { forwardRef } from 'react';

const TransferChallanPrint = forwardRef(({ transfer }, ref) => {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB') : '');
  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', color: '#000' }} className="p-6 bg-white">
      <div className="text-center mb-2">
        <div className="text-xl font-bold">INTER-WAREHOUSE TRANSFER CHALLAN</div>
      </div>

      <table className="w-full border border-default text-sm mb-4" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>Transfer No.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.transfer_number}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Status:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.status}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>Challan Date:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(transfer?.challan_date)}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>EWAY Bill No.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.eway_bill_number || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>EWAY Bill Date:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(transfer?.eway_bill_date)}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Origin GST:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.origin_gst_number || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>Destination GST:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.destination_gst_number || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Vehicle No.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.vehicle_number || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>Driver Name:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.driver_name || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Driver Phone:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{transfer?.driver_phone || ''}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border border-default text-sm mb-4" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>#</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Item</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>Qty</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>UOM</th>
          </tr>
        </thead>
        <tbody>
          {(transfer?.lines || []).map((l) => (
            <tr key={l.id}>
              <td style={{ border: '1px solid #ddd' }}>{l.line_number}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.item_id}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.quantity}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.unit_of_measure}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
});

export default TransferChallanPrint;


