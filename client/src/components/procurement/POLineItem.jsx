import React, { useState, useEffect } from 'react';
import { X, IndianRupee, ChevronDown, ChevronUp } from 'lucide-react';

const POLineItem = ({ 
  line, 
  index, 
  handleLineChange, 
  removeLine,
  supplierCircleId = null,
  deliveryCircleId = null,
  isFromItemMaster = false 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate GST based on backend-provided split when available,
  // otherwise fall back to circle-based logic (supplier vs delivery circle).
  const calculateGST = () => {
    const baseAmount = (parseFloat(line.quantity) || 0) * (parseFloat(line.unit_price) || 0);
    const gstRate = parseFloat(line.gst_rate) || 0;

    // Prefer cgst/sgst/igst already present on the line (from backend GST calculator)
    let cgst = parseFloat(line.cgst || 0);
    let sgst = parseFloat(line.sgst || 0);
    let igst = parseFloat(line.igst || 0);

    // Fallback: derive split from circle comparison if no split is present
    if (cgst === 0 && sgst === 0 && igst === 0 && gstRate > 0) {
      const isSameCircle =
        supplierCircleId &&
        deliveryCircleId &&
        supplierCircleId === deliveryCircleId;

      if (isSameCircle) {
        // Same circle → Split GST into CGST and SGST
        cgst = gstRate / 2;
        sgst = gstRate / 2;
        igst = 0;
      } else {
        // Different circle or circles not available → IGST
        cgst = 0;
        sgst = 0;
        igst = gstRate;
      }
    }

    const cgstAmount = (baseAmount * cgst) / 100;
    const sgstAmount = (baseAmount * sgst) / 100;
    const igstAmount = (baseAmount * igst) / 100;
    const totalTax = cgstAmount + sgstAmount + igstAmount;
    const totalAmount = baseAmount + totalTax;
    
    return {
      baseAmount,
      cgst,
      sgst,
      igst,
      cgstAmount,
      sgstAmount,
      igstAmount,
      totalTax,
      totalAmount
    };
  };

  const gstCalc = calculateGST();

  return (
    <div className="card hover:shadow-md transition-shadow">
      <div className="card-body">
        {/* Item Description Row */}
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-semibold text-primary">#{index + 1}</span>
          {isFromItemMaster && (
            <span className="badge badge-success">Master</span>
          )}
          {line.manufacturer && (
            <span className="badge badge-info">{line.manufacturer}</span>
          )}
          <div className="flex-1">
            <div className="font-medium text-fg">{line.item_name}</div>
            <div className="text-xs text-muted">{line.item_code}</div>
          </div>
        </div>

        {/* Single Row: Qty | UOM | Unit Price | CGST | SGST | IGST | Total | Actions */}
        <div className="grid grid-cols-12 gap-3 items-end">
          {/* Quantity */}
          <div className="col-span-1">
            <label className="form-label text-xs text-center block mb-1">Qty</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={line.quantity}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  handleLineChange(index, 'quantity', '');
                  return;
                }
                const numVal = Math.max(parseFloat(raw) || 0, 0.01);
                handleLineChange(index, 'quantity', numVal);
              }}
              required
              className="input w-full h-8 text-center"
            />
          </div>

          {/* UOM */}
          <div className="col-span-1">
            <label className="form-label text-xs text-center block mb-1">UOM</label>
            <div className="text-xs font-medium text-fg bg-muted rounded border border-default flex items-center h-8 justify-center">
              {line.unit_of_measure}
            </div>
          </div>

          {/* Unit Price */}
          <div className="col-span-2">
            <label className="form-label text-xs text-center block mb-1">Unit Price</label>
            <div className="relative">
              <IndianRupee size={12} className="absolute left-2 top-1/2 transform -translate-y-1/2 text-muted" />
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unit_price}
                onChange={(e) => handleLineChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                required
                className="input w-full h-8 pl-7"
              />
            </div>
          </div>

          {/* CGST */}
          <div className="col-span-1">
            <label className="form-label text-xs text-center block mb-1">CGST</label>
            <div className="text-xs text-fg bg-muted rounded border border-default flex items-center h-8 justify-center">
              {gstCalc.cgst > 0 ? `${gstCalc.cgst}%` : '-'}
            </div>
          </div>

          {/* SGST */}
          <div className="col-span-1">
            <label className="form-label text-xs text-center block mb-1">SGST</label>
            <div className="text-xs text-fg bg-muted rounded border border-default flex items-center h-8 justify-center">
              {gstCalc.sgst > 0 ? `${gstCalc.sgst}%` : '-'}
            </div>
          </div>

          {/* IGST */}
          <div className="col-span-1">
            <label className="form-label text-xs text-center block mb-1">IGST</label>
            <div className="text-xs text-fg bg-muted rounded border border-default flex items-center h-8 justify-center">
              {gstCalc.igst > 0 ? `${gstCalc.igst}%` : '-'}
            </div>
          </div>

          {/* Total Amount */}
          <div className="col-span-2">
            <label className="form-label text-xs text-center block mb-1">Total</label>
            <div className="text-xs font-bold text-primary bg-accent rounded border border-default flex items-center h-8 justify-end px-2">
              <IndianRupee size={12} className="mr-1" />
              {gstCalc.totalAmount.toFixed(2)}
            </div>
          </div>

          {/* Actions */}
          <div className="col-span-2 flex items-end justify-end gap-1">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn btn-secondary btn-sm h-8 w-8 p-0 flex items-center justify-center"
              title={isExpanded ? "Show less" : "Show more"}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              type="button"
              onClick={() => removeLine(index)}
              className="btn btn-danger btn-sm h-8 w-8 p-0 flex items-center justify-center"
              title="Remove"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Specifications (Always Visible) */}
        <div className="mt-4 form-group">
          <label className="form-label text-xs">
            Specifications <span className="text-primary">(Optional)</span>
          </label>
          <textarea
            value={line.specifications || ''}
            onChange={(e) => handleLineChange(index, 'specifications', e.target.value)}
            rows={2}
            className="input"
            placeholder="Enter any additional specifications, requirements, or special notes..."
          />
        </div>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="border-t border-default mt-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="form-label text-xs">Manufacturer</label>
                <div className="text-sm text-fg">{line.manufacturer || '-'}</div>
              </div>
              <div>
                <label className="form-label text-xs">Spare Type</label>
                <div className="text-sm text-fg">{line.spare_type || '-'}</div>
              </div>
              <div className="form-group">
                <label className="form-label text-xs">
                  Brand {isFromItemMaster && '(from master)'}
                </label>
                <input
                  type="text"
                  value={line.brand || ''}
                  onChange={(e) => handleLineChange(index, 'brand', e.target.value)}
                  disabled={isFromItemMaster}
                  className={`input ${isFromItemMaster ? 'bg-muted' : ''}`}
                  placeholder="Enter brand"
                />
              </div>
              <div className="form-group">
                <label className="form-label text-xs">
                  Model {isFromItemMaster && '(from master)'}
                </label>
                <input
                  type="text"
                  value={line.model || ''}
                  onChange={(e) => handleLineChange(index, 'model', e.target.value)}
                  disabled={isFromItemMaster}
                  className={`input ${isFromItemMaster ? 'bg-muted' : ''}`}
                  placeholder="Enter model"
                />
              </div>
              <div className="form-group">
                <label className="form-label text-xs">
                  Promised Date
                </label>
                <input
                  type="date"
                  value={line.promised_date || ''}
                  onChange={(e) => handleLineChange(index, 'promised_date', e.target.value)}
                  className="input"
                />
              </div>
              <div className="form-group md:col-span-3">
                <label className="form-label text-xs">
                  Item Description {isFromItemMaster && '(from master)'}
                </label>
                <textarea
                  value={line.item_description || ''}
                  onChange={(e) => handleLineChange(index, 'item_description', e.target.value)}
                  disabled={isFromItemMaster}
                  rows={2}
                  className={`input ${isFromItemMaster ? 'bg-muted' : ''}`}
                  placeholder="Enter item description"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default POLineItem;

