import React, { useState } from 'react';
import RequisitionLines from './RequisitionLines.jsx';
import ItemSelector from './ItemSelector.jsx';

const RequisitionForm = ({ 
  requisition, 
  departments, 
  sites, 
  onSubmit, 
  onCancel, 
  saving, 
  isEditMode 
}) => {
  const [formData, setFormData] = useState(requisition);
  const [errors, setErrors] = useState({});

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  // Handle line items changes
  const handleLinesChange = (lines) => {
    setFormData(prev => ({
      ...prev,
      lines
    }));
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.department_id) {
      newErrors.department_id = 'Department is required';
    }

    if (formData.lines.length === 0) {
      newErrors.lines = 'At least one line item is required';
    }

    // Validate line items
    formData.lines.forEach((line, index) => {
      if (!line.item_name.trim()) {
        newErrors[`line_${index}_item_name`] = 'Item name is required';
      }
      if (!line.quantity || line.quantity <= 0) {
        newErrors[`line_${index}_quantity`] = 'Quantity must be greater than 0';
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.title ? 'border-red-500' : 'border-gray-300'
              }`}
              placeholder="Enter requisition title"
            />
            {errors.title && (
              <p className="text-red-500 text-sm mt-1">{errors.title}</p>
            )}
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Department *
            </label>
            <select
              value={formData.department_id}
              onChange={(e) => handleInputChange('department_id', e.target.value)}
              className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                errors.department_id ? 'border-red-500' : 'border-gray-300'
              }`}
            >
              <option value="">Select Department</option>
              {departments.map((dept) => (
                <option key={dept.id} value={dept.id}>
                  {dept.name}
                </option>
              ))}
            </select>
            {errors.department_id && (
              <p className="text-red-500 text-sm mt-1">{errors.department_id}</p>
            )}
          </div>

          {/* Project */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Project
            </label>
            <input
              type="text"
              value={formData.project_id || ''}
              onChange={(e) => handleInputChange('project_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Project ID (optional)"
            />
          </div>

          {/* Site */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Site
            </label>
            <select
              value={formData.site_id || ''}
              onChange={(e) => handleInputChange('site_id', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Select Site</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>

          {/* Needed By Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Needed By Date
            </label>
            <input
              type="date"
              value={formData.needed_by_date}
              onChange={(e) => handleInputChange('needed_by_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Description */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            rows="3"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter requisition description"
          />
        </div>
      </div>

      {/* Line Items */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Line Items</h2>
          <ItemSelector onItemSelect={(item) => {
            const newLine = {
              item_id: item.id,
              item_code: item.item_code,
              item_name: item.name,
              item_description: item.description,
              quantity: 1,
              unit_of_measure: item.unit_of_measure || 'PCS',
              unit_price: 0,
              specifications: '',
              brand: '',
              model: '',
              needed_by_date: ''
            };
            handleLinesChange([...formData.lines, newLine]);
          }} />
        </div>

        <RequisitionLines
          lines={formData.lines}
          onChange={handleLinesChange}
          errors={errors}
        />

        {errors.lines && (
          <p className="text-red-500 text-sm mt-2">{errors.lines}</p>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-4">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {saving ? 'Saving...' : (isEditMode ? 'Update Requisition' : 'Create Requisition')}
        </button>
      </div>
    </form>
  );
};

export default RequisitionForm;

