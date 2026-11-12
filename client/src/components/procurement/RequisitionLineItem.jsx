import React, { useState } from 'react';
import { Package, X, IndianRupee, ChevronDown, ChevronUp } from 'lucide-react';

const RequisitionLineItem = ({
  line,
  index,
  handleLineChange,
  removeLine,
  isFromItemMaster = false,
  formatCurrency
}) => {
  const qty = Number(line.quantity) || 0;
  const unitPrice = Number(line.unit_price) || 0;
  const lineTotal = qty * unitPrice;
  const fmt =
    formatCurrency ||
    ((n) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
        n || 0
      ));
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="card hover:shadow-md transition-shadow">
      {/* Compact Header Row */}
      <div className="card-body">
        <div className="grid grid-cols-12 gap-3 items-center">
          {/* Line Number & Item Info */}
          <div className="col-span-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-primary">#{index + 1}</span>
              {isFromItemMaster && (
                <span className="badge badge-success">Master</span>
              )}
              {line.manufacturer && (
                <span className="badge badge-info">
                  {line.manufacturer}
                </span>
              )}
            </div>
            <input
              type="text"
              value={line.item_name}
              onChange={(e) => handleLineChange(index, 'item_name', e.target.value)}
              disabled={isFromItemMaster}
              required
              className={`text-sm font-medium w-full border-0 p-0 focus:ring-0 bg-transparent ${isFromItemMaster ? 'text-muted' : 'text-fg'}`}
              placeholder="Item name"
            />
            <input
              type="text"
              value={line.item_code}
              onChange={(e) => handleLineChange(index, 'item_code', e.target.value)}
              disabled={isFromItemMaster}
              className={`text-xs w-full border-0 p-0 focus:ring-0 bg-transparent ${isFromItemMaster ? 'text-muted' : 'text-fg'}`}
              placeholder="Item code"
            />
          </div>

          {/* Manufacturer */}
          <div className="col-span-2">
            <label className="form-label text-xs">Manufacturer</label>
            <div className="text-sm font-medium text-fg bg-muted rounded border border-default flex items-center h-8" style={{padding: '0.25rem 0.75rem'}}>
              {line.manufacturer || '-'}
            </div>
          </div>

          {/* Spare Type */}
          <div className="col-span-2">
            <label className="form-label text-xs">Spare Type</label>
            <div className="text-sm font-medium text-fg bg-muted rounded border border-default flex items-center h-8" style={{padding: '0.25rem 0.75rem'}}>
              {line.spare_type || '-'}
            </div>
          </div>

          {/* Quantity */}
          <div className="col-span-2 form-group">
            <label className="form-label text-xs">Quantity *</label>
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
              className="input w-full"
              placeholder="1.00"
            />
          </div>

          {/* UOM */}
          <div className="col-span-1">
            <label className="form-label text-xs">UOM</label>
            <div className="text-sm font-medium text-fg bg-muted rounded border border-default flex items-center h-8 justify-center">
              {line.unit_of_measure}
            </div>
          </div>

          {/* Actions */}
          <div className="col-span-1 flex items-end justify-end gap-1">
            <button
              type="button"
              onClick={() => setIsExpanded(!isExpanded)}
              className="btn btn-secondary btn-sm"
              title={isExpanded ? "Show less" : "Show more"}
            >
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button
              type="button"
              onClick={() => removeLine(index)}
              className="btn btn-danger btn-sm"
              title="Remove item"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3 max-w-lg">
          <div className="form-group">
            <label className="form-label text-xs flex items-center gap-1">
              <IndianRupee size={12} />
              Unit price
              {line.price_from_master && (
                <span className="text-[10px] text-muted font-normal">(from master)</span>
              )}
            </label>
            {isFromItemMaster ? (
              <div className="input bg-muted text-fg">{fmt(unitPrice)}</div>
            ) : (
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.unit_price ?? ''}
                onChange={(e) => handleLineChange(index, 'unit_price', e.target.value)}
                className="input w-full"
                placeholder="0.00"
              />
            )}
          </div>
          <div className="form-group">
            <label className="form-label text-xs">Line total</label>
            <div className="input bg-muted font-medium text-fg">{fmt(lineTotal)}</div>
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
                  Needed By Date
                </label>
                <div className="text-sm text-muted bg-muted rounded border border-default flex items-center h-8" style={{padding: '0.25rem 0.75rem'}}>
                  {line.needed_by_date || 'As per PR date'}
                </div>
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

export default RequisitionLineItem;
