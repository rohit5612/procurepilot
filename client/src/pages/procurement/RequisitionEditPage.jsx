import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  AlertTriangle,
  Save,
  ArrowLeft
} from 'lucide-react';
import { inventoryAPI, userManagementAPI, requisitionAPI } from '../../utils/api';
import { Paperclip } from 'lucide-react';
import RequisitionBasicInfo from '../../components/procurement/RequisitionBasicInfo';
import RequisitionLineItems from '../../components/procurement/RequisitionLineItems';
import ItemSelectionModal from '../../components/procurement/ItemSelectionModal';

const RequisitionEditPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    site_id: '',
    project_id: '',
    needed_by_date: '',
    circle_id: '',
    cluster_id: '',
    lines: []
  });

  useEffect(() => {
    fetchRequisition();
    fetchItems();
    fetchDepartments();
    fetchSites();
  }, [id]);

  useEffect(() => {
    if (itemSearchTerm) {
      const filtered = items.filter(item =>
        item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        (item.brand && item.brand.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.model && item.model.toLowerCase().includes(itemSearchTerm.toLowerCase()))
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  }, [itemSearchTerm, items]);

  const fetchRequisition = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await requisitionAPI.getRequisition(id);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to fetch requisition');
      }

      const data = await response.json();
      const requisition = data.data;

      // Check if requisition can be edited (only draft status)
      if (requisition.status !== 'draft') {
        throw new Error('Only draft requisitions can be edited');
      }

      // Populate form data
      setFormData({
        title: requisition.title || '',
        description: requisition.description || '',
        department_id: requisition.department_id ? requisition.department_id.toString() : '',
        site_id: requisition.site_id ? requisition.site_id.toString() : '',
        project_id: requisition.project_id || '',
        needed_by_date: requisition.needed_by_date ? requisition.needed_by_date.split('T')[0] : '',
        circle_id: requisition.circle_id ? requisition.circle_id.toString() : '',
        cluster_id: requisition.cluster_id ? requisition.cluster_id.toString() : '',
        lines: (requisition.lines || []).map(line => ({
          item_id: line.item_id,
          item_code: line.item_code || '',
          item_name: line.item_name || '',
          item_description: line.item_description || '',
          manufacturer: line.manufacturer || '',
          spare_type: line.spare_type || '',
          brand: line.brand || '',
          model: line.model || '',
          quantity: line.quantity || 1,
          unit_of_measure: line.unit_of_measure || 'PCS',
          unit_price: line.unit_price || 0,
          specifications: line.specifications || '',
          needed_by_date: line.needed_by_date ? line.needed_by_date.split('T')[0] : '',
          isFromItemMaster: !!line.item_id
        }))
      });
    } catch (err) {
      setError(err.message);
      console.error('Error fetching requisition:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchItems = async () => {
    try {
      // Fetch all items for selection
      const response = await inventoryAPI.getItems('limit=10000');

      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
        setFilteredItems(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch items:', err);
    }
  };

  const fetchDepartments = async () => {
    try {
      const response = await userManagementAPI.getDepartments();

      if (response.ok) {
        const data = await response.json();
        setDepartments(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch departments:', err);
    }
  };

  const fetchSites = async () => {
    try {
      const response = await inventoryAPI.getSites();

      if (response.ok) {
        const data = await response.json();
        setSites(data.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch sites:', err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleLineChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) =>
        i === index ? { ...line, [field]: value } : line
      )
    }));
  };

  const addManualLine = () => {
    const newLine = {
      item_id: null,
      item_code: '',
      item_name: '',
      item_description: '',
      manufacturer: '',
      spare_type: '',
      quantity: 1,
      unit_of_measure: 'PCS',
      unit_price: 0,
      specifications: '',
      brand: '',
      model: '',
      needed_by_date: formData.needed_by_date || '',
      isFromItemMaster: false
    };

    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  const selectItem = (item) => {
    const newLine = {
      item_id: item.id,
      item_code: item.item_code,
      item_name: item.name,
      item_description: item.description || '',
      manufacturer: item.manufacturer || '',
      spare_type: item.spare_type || '',
      brand: item.brand || '',
      model: item.model || '',
      quantity: 1,
      unit_of_measure: item.unit_of_measure || 'PCS',
      unit_price: item.estimated_price || item.standard_cost || 0,
      specifications: item.specifications || '',
      needed_by_date: formData.needed_by_date || '',
      isFromItemMaster: true
    };

    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));

    setShowItemModal(false);
    setItemSearchTerm('');
  };

  const removeLine = (index) => {
    setFormData(prev => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.lines.length === 0) {
      setError('At least one line item is required');
      return;
    }

    // Validate required fields
    if (!formData.department_id) {
      setError('Department is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      // Prepare data for submission - ensure proper data types
      const submissionData = {
        ...formData,
        department_id: parseInt(formData.department_id),
        site_id: formData.site_id ? parseInt(formData.site_id) : null,
        project_id: formData.project_id && formData.project_id !== '' ? formData.project_id : null,
        circle_id: formData.circle_id ? parseInt(formData.circle_id) : null,
        cluster_id: formData.cluster_id ? parseInt(formData.cluster_id) : null,
        lines: formData.lines.map(line => {
          const qty = Math.max(parseFloat(line.quantity) || 0, 0.01);
          const cleanLine = {
            item_id: line.item_id,
            item_code: line.item_code,
            item_name: line.item_name,
            item_description: line.item_description,
            manufacturer: line.manufacturer || null,
            spare_type: line.spare_type || null,
            brand: line.brand,
            model: line.model,
            quantity: qty,
            unit_of_measure: line.unit_of_measure,
            unit_price: line.unit_price ? parseFloat(line.unit_price) : 0,
            specifications: line.specifications
          };

          // Only include needed_by_date if it has a valid value
          if (line.needed_by_date && line.needed_by_date !== '') {
            cleanLine.needed_by_date = line.needed_by_date;
          }

          return cleanLine;
        })
      };

      // Only include needed_by_date if it has a valid value
      if (formData.needed_by_date && formData.needed_by_date !== '') {
        submissionData.needed_by_date = formData.needed_by_date;
      }
      // If project_id is empty/null, don't send it at all
      if (!submissionData.project_id) {
        delete submissionData.project_id;
      }

      const response = await requisitionAPI.updateRequisition(id, submissionData);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Validation errors:', errorData);

        // Show specific validation errors if available
        if (errorData.errors && errorData.errors.length > 0) {
          const errorMessages = errorData.errors.map(err => `${err.path}: ${err.msg}`).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }

        throw new Error(errorData.message || 'Failed to update requisition');
      }

      navigate(`/procurement/pr/requisition-details/${id}`);
    } catch (err) {
      setError(err.message);
      console.error('Error updating requisition:', err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-muted rounded w-1/3"></div>
              <div className="h-4 bg-muted rounded w-1/4"></div>
              <div className="h-32 bg-muted rounded"></div>
              <div className="h-64 bg-muted rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error && (error.includes('not found') || error.includes('cannot be edited'))) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger mb-4">
              <AlertTriangle size={20} />
              <h2 className="text-lg font-semibold">Cannot Edit Requisition</h2>
            </div>
            <p className="text-muted mb-4">{error}</p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/procurement/pr/requisition-list')}
                className="btn btn-secondary"
              >
                Back to List
              </button>
              <button
                onClick={() => navigate(`/procurement/pr/requisition-details/${id}`)}
                className="btn btn-primary"
              >
                View Details
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(`/procurement/pr/requisition-details/${id}`)}
          className="btn btn-secondary btn-sm"
        >
          <ArrowLeft size={16} className="mr-2" />
          Back to Details
        </button>
        <div>
          <h1 className="text-2xl font-bold text-fg">Edit Requisition</h1>
          <p className="text-muted">Update purchase requisition details</p>
        </div>
      </div>

      {/* Error Display */}
      {error && !error.includes('not found') && !error.includes('cannot be edited') && (
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger">
              <AlertTriangle size={20} />
              <p>{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <RequisitionBasicInfo
          formData={formData}
          departments={departments}
          sites={sites}
          handleInputChange={handleInputChange}
        />

        {/* Line Items */}
        <RequisitionLineItems
          lines={formData.lines}
          handleLineChange={handleLineChange}
          removeLine={removeLine}
          addManualLine={addManualLine}
          setShowItemModal={setShowItemModal}
        />

        {/* Attachment + Submit */}
        <div className="flex justify-end gap-3">
          <div className="mr-auto">
            <label className="block text-sm font-medium text-fg mb-1">Attach Email (PDF)</label>
            {uploadError && <div className="text-danger text-xs mb-1">{uploadError}</div>}
            {uploadSuccess && <div className="text-primary text-xs mb-1">{uploadSuccess}</div>}
            <div className="flex items-center gap-2">
              <label className="btn btn-secondary btn-sm cursor-pointer">
                <Paperclip size={14} className="mr-2" />
                Choose PDF
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.type !== 'application/pdf') { setUploadError('Only PDF allowed'); return; }
                    setUploadError(null);
                    setAttachmentFile(f);
                  }}
                />
              </label>
              {attachmentFile && (
                <span className="text-sm text-muted">{attachmentFile.name}</span>
              )}
              {/* On edit, upload immediately when selected */}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={!attachmentFile || uploading}
                onClick={async () => {
                  if (!attachmentFile) return;
                  try {
                    setUploading(true);
                    setUploadSuccess(null);
                    const res = await requisitionAPI.uploadAttachment(id, attachmentFile);
                    if (!res.ok) {
                      const d = await res.json();
                      setUploadError(d.message || 'Upload failed');
                    } else {
                      setAttachmentFile(null);
                      await fetchRequisition();
                      setUploadSuccess('Attachment uploaded successfully');
                      setTimeout(() => setUploadSuccess(null), 3000);
                    }
                  } catch (e) {
                    setUploadError(e.message);
                  } finally {
                    setUploading(false);
                  }
                }}
              >Upload</button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/procurement/pr/requisition-details/${id}`)}
            className="btn btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || formData.lines.length === 0}
            className="btn btn-primary"
          >
            <Save size={16} className="mr-2" />
            {saving ? 'Updating...' : 'Update Requisition'}
          </button>
        </div>
      </form>

      {/* Item Selection Modal */}
      <ItemSelectionModal
        showModal={showItemModal}
        setShowModal={setShowItemModal}
        items={filteredItems}
        itemSearchTerm={itemSearchTerm}
        setItemSearchTerm={setItemSearchTerm}
        selectItem={selectItem}
      />
    </div>
  );
};

export default RequisitionEditPage;
