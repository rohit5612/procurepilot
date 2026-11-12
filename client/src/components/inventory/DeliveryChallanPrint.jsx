import React, { forwardRef } from 'react';

// Simple print-friendly Delivery Challan layout matching the provided sample
const DeliveryChallanPrint = forwardRef(({ challan, company = { name: 'V R POWER EQUIPMENTS (P) LTD.' } }, ref) => {
  const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '');

  return (
    <div ref={ref} style={{ fontFamily: 'Arial, sans-serif', color: '#000' }} className="p-6 bg-white">
      <div className="text-center mb-2">
        <div className="text-xl font-bold">{company.name}</div>
        <div className="text-base font-semibold mt-1">DELIVERY CHALLAN</div>
      </div>

      <table className="w-full border border-default text-sm mb-4" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>CHALLAN NO.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.challan_number || challan?.issue_number || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>CHALLAN DATE:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(challan?.challan_date)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>DESTINATION TYPE:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.destination_type || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>EWAY Bill No.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.eway_bill_number || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>DESTINATION:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{(challan?.destination_type === 'VENDOR' ? (challan?.vendor_name || `Vendor #${challan?.vendor_id || ''}`) : (challan?.site_name || `Site #${challan?.site_id || ''}`))}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>EWAY Bill Date:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{fmt(challan?.eway_bill_date)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>TT No.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.tt_number || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Vehicle No.:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.vehicle_number || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>CLUSTER:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.cluster_name || ''}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Origin GST:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.origin_gst_number || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>MATERIAL REQUEST TYPE:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.material_request_type || 'Internal Transfer'}</td>
            <td style={{ border: '1px solid #ddd' }}><strong>Destination GST:</strong></td>
            <td style={{ border: '1px solid #ddd' }}>{challan?.destination_gst_number || ''}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #ddd' }}><strong>DESTINATION ADDRESS:</strong></td>
            <td style={{ border: '1px solid #ddd' }} colSpan={3}>{challan?.destination_address || ''}</td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border border-default text-sm mb-4" cellPadding={6} style={{ borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: '#f5f5f5' }}>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>S. NO.</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>COMPANY CODE</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>ITEM CODE</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>ITEM DESCRIPTION</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>UOM</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>REQUESTED</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>APPROVED</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>ISSUED</th>
            <th style={{ border: '1px solid #ddd', textAlign: 'left' }}>R-ABLE</th>
          </tr>
        </thead>
        <tbody>
          {(challan?.lines || []).map((l, idx) => (
            <tr key={l.id}>
              <td style={{ border: '1px solid #ddd' }}>{idx + 1}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.company_code || ''}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.item_code || ''}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.item_description || l.item_id}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.unit_of_measure}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.requested_qty ?? l.quantity}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.approved_qty ?? l.quantity}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.issued_qty ?? l.quantity}</td>
              <td style={{ border: '1px solid #ddd' }}>{l.is_returnable ? 'Yes' : 'No'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {challan?.remarks && (
        <div className="mb-2 text-sm"><strong>REMARKS:</strong> {challan.remarks}</div>
      )}
      {challan?.note && (
        <div className="mb-2 text-sm"><strong>NOTE:</strong> {challan.note}</div>
      )}

      <div className="grid grid-cols-3 gap-4 text-sm mt-6 mb-4">
        <div>
          <div style={{ borderBottom: '1px solid #ddd', marginBottom: 8 }}>Request By:</div>
          <div style={{ height: 32 }}></div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #ddd', marginBottom: 8 }}>Approved By:</div>
          <div style={{ height: 32 }}></div>
        </div>
        <div>
          <div style={{ borderBottom: '1px solid #ddd', marginBottom: 8 }}>Issued By:</div>
          <div style={{ height: 32 }}></div>
        </div>
      </div>

      {challan?.warehouse_address && (
        <div className="text-sm"><strong>WAREHOUSE ADDRESS:</strong> {challan.warehouse_address}</div>
      )}
    </div>
  );
});

export default DeliveryChallanPrint;


