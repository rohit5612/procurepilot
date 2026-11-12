import React from 'react';

const RequisitionLines = ({ lines, onChange, errors }) => {
  const handleLineChange = (index, field, value) => {
    const updatedLines = [...lines];
    updatedLines[index] = {
      ...updatedLines[index],
      [field]: value
    };
    onChange(updatedLines);
  };

  const handleRemoveLine = (index) => {
    const updatedLines = lines.filter((_, i) => i !== index);
    onChange(updatedLines);
  };

  const addEmptyLine = () => {
    const newLine = {
      item_id: null,
      item_code: '',
      item_name: '',
      item_description: '',
      quantity: 1,
      unit_of_measure: 'PCS',
      unit_price: 0,
      specifications: '',
      brand: '',
      model: '',
      needed_by_date: ''
    };
    onChange([...lines, newLine]);
  };

  const calculateLineTotal = (line) => {
    return (line.quantity || 0) * (line.unit_price || 0);
  };

  const calculateGrandTotal = () => {
    return lines.reduce((total, line) => total + calculateLineTotal(line), 0);
  };

  if (lines.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 mb-4">No line items added yet</p>
        <button
          type="button"
          onClick={addEmptyLine}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md"
        >
          Add Line Item
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Line Items Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qty
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                UoM
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Unit Price
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total
              </th>
              <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {lines.map((line, index) => (
              <tr key={index} className="hover:bg-gray-50">
                {/* Item Name */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={line.item_name || ''}
                    onChange={(e) => handleLineChange(index, 'item_name', e.target.value)}
                    className={`w-full px-2 py-1 border rounded text-sm ${
                      errors[`line_${index}_item_name`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                    placeholder="Item name"
                  />
                  {errors[`line_${index}_item_name`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`line_${index}_item_name`]}</p>
                  )}
                </td>

                {/* Quantity */}
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0.001"
                    step="0.001"
                    value={line.quantity || ''}
                    onChange={(e) => handleLineChange(index, 'quantity', parseFloat(e.target.value) || 0)}
                    className={`w-20 px-2 py-1 border rounded text-sm ${
                      errors[`line_${index}_quantity`] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors[`line_${index}_quantity`] && (
                    <p className="text-red-500 text-xs mt-1">{errors[`line_${index}_quantity`]}</p>
                  )}
                </td>

                {/* Unit of Measure */}
                <td className="px-3 py-2">
                  <input
                    type="text"
                    value={line.unit_of_measure || ''}
                    onChange={(e) => handleLineChange(index, 'unit_of_measure', e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="PCS"
                  />
                </td>

                {/* Unit Price */}
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.unit_price || ''}
                    onChange={(e) => handleLineChange(index, 'unit_price', parseFloat(e.target.value) || 0)}
                    className="w-24 px-2 py-1 border border-gray-300 rounded text-sm"
                    placeholder="0.00"
                  />
                </td>

                {/* Total */}
                <td className="px-3 py-2 text-sm font-medium">
                  ${calculateLineTotal(line).toFixed(2)}
                </td>

                {/* Actions */}
                <td className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(index)}
                    className="text-red-600 hover:text-red-900 text-sm"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Additional Line Item Fields (Collapsible) */}
      {lines.map((line, index) => (
        <div key={`details-${index}`} className="mt-4 p-4 bg-gray-50 rounded-md">
          <h4 className="text-sm font-medium text-gray-900 mb-3">
            Additional Details for Line {index + 1}
          </h4>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Item Code */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Item Code
              </label>
              <input
                type="text"
                value={line.item_code || ''}
                onChange={(e) => handleLineChange(index, 'item_code', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Item code"
              />
            </div>

            {/* Brand */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={line.brand || ''}
                onChange={(e) => handleLineChange(index, 'brand', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Brand"
              />
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Model
              </label>
              <input
                type="text"
                value={line.model || ''}
                onChange={(e) => handleLineChange(index, 'model', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Model"
              />
            </div>

            {/* Specifications */}
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Specifications
              </label>
              <textarea
                value={line.specifications || ''}
                onChange={(e) => handleLineChange(index, 'specifications', e.target.value)}
                rows="2"
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
                placeholder="Technical specifications"
              />
            </div>

            {/* Needed By Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Needed By
              </label>
              <input
                type="date"
                value={line.needed_by_date || ''}
                onChange={(e) => handleLineChange(index, 'needed_by_date', e.target.value)}
                className="w-full px-2 py-1 border border-gray-300 rounded text-sm"
              />
            </div>
          </div>
        </div>
      ))}

      {/* Add Line Button and Total */}
      <div className="flex justify-between items-center mt-4">
        <button
          type="button"
          onClick={addEmptyLine}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm"
        >
          Add Line Item
        </button>
        
        <div className="text-right">
          <div className="text-lg font-medium text-gray-900">
            Grand Total: ${calculateGrandTotal().toFixed(2)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RequisitionLines;

