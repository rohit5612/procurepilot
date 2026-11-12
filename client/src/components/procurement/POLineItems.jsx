import React from 'react';
import { Package, Plus } from 'lucide-react';
import POLineItem from './POLineItem';

const POLineItems = ({ 
  lines, 
  handleLineChange, 
  removeLine, 
  addManualLine, 
  setShowItemModal,
  supplierCircleId,
  deliveryCircleId
}) => {
  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={20} />
            <h3 className="text-lg font-semibold">Line Items</h3>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={addManualLine}
              className="btn btn-secondary"
            >
              <Plus size={16} className="mr-2" />
              Add Manual
            </button>
            <button
              type="button"
              onClick={() => setShowItemModal(true)}
              className="btn btn-primary"
            >
              <Plus size={16} className="mr-2" />
              Select Item
            </button>
          </div>
        </div>
      </div>
      <div className="card-body">
        {lines.length === 0 ? (
          <div className="text-center py-8">
            <Package size={48} className="text-muted mx-auto" />
            <p className="text-muted mt-4">No line items added yet.</p>
            <div className="mt-4 flex justify-center gap-2">
              <button
                type="button"
                onClick={addManualLine}
                className="btn btn-secondary"
              >
                <Plus size={16} className="mr-2" />
                Add Manual Item
              </button>
              <button
                type="button"
                onClick={() => setShowItemModal(true)}
                className="btn btn-primary"
              >
                <Plus size={16} className="mr-2" />
                Select from Master
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {lines.map((line, index) => (
              <POLineItem
                key={index}
                line={line}
                index={index}
                handleLineChange={handleLineChange}
                removeLine={removeLine}
                supplierCircleId={supplierCircleId}
                deliveryCircleId={deliveryCircleId}
                isFromItemMaster={line.isFromItemMaster}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default POLineItems;

