import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { 
  AlertTriangle,
  Save,
  Paperclip,
  Eye
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { inventoryAPI, userManagementAPI, requisitionAPI } from '../../utils/api';
import RequisitionBasicInfo from '../../components/procurement/RequisitionBasicInfo';
import RequisitionLineItems from '../../components/procurement/RequisitionLineItems';
import ItemSelectionModal from '../../components/procurement/ItemSelectionModal';
import { useToastContext } from '../../contexts/ToastContext.jsx';

const RequisitionCreatePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { add } = useToastContext() || { add: () => {} };
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [items, setItems] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [showItemModal, setShowItemModal] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    site_id: '',
    project_id: '',
    needed_by_date: '',
    circle_id: null,
    cluster_id: null,
    lines: []
  });
  const [attachmentFile, setAttachmentFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    fetchItems();
    fetchDepartments();
    fetchSites();
    
    // Auto-select department for non-admin users
    const canChangeDepartment = user?.isSuperuser || user?.roleLevel <= 1;
    if (!canChangeDepartment && user?.departmentId) {
      setFormData(prev => ({
        ...prev,
        department_id: user.departmentId.toString()
      }));
    }
  }, [user]);

  useEffect(() => {
    if (itemSearchTerm) {
      const filtered = items.filter(item => 
        item.name.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        item.item_code.toLowerCase().includes(itemSearchTerm.toLowerCase()) ||
        (item.company_code && item.company_code.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.manufacturer && item.manufacturer.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.hsn_code && item.hsn_code.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.spare_type && item.spare_type.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.sub_category && item.sub_category.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.brand && item.brand.toLowerCase().includes(itemSearchTerm.toLowerCase())) ||
        (item.model && item.model.toLowerCase().includes(itemSearchTerm.toLowerCase()))
      );
      setFilteredItems(filtered);
    } else {
      setFilteredItems(items);
    }
  }, [itemSearchTerm, items]);

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

  const handleCircleChange = (circleId) => {
    setFormData((prev) => ({
      ...prev,
      circle_id: circleId,
      cluster_id: null
    }));
  };

  const handleClusterChange = (clusterId) => {
    setFormData((prev) => ({ ...prev, cluster_id: clusterId }));
  };

  const handleSiteSelect = (siteRow) => {
    setFormData((prev) => ({
      ...prev,
      site_id: siteRow?.site_id != null ? String(siteRow.site_id) : '',
      circle_id: siteRow?.circle_id ?? null,
      cluster_id: siteRow?.cluster_id ?? null
    }));
  };

  const applyReferencePriceToLine = async (index, itemId, quantity) => {
    if (!itemId) return;
    try {
      const res = await requisitionAPI.getReferenceUnitPrice(itemId, quantity || 1);
      if (!res.ok) return;
      const json = await res.json();
      const unitPrice = Number(json?.data?.unit_price || 0);
      if (unitPrice > 0) {
        setFormData((prev) => ({
          ...prev,
          lines: prev.lines.map((line, i) =>
            i === index ? { ...line, unit_price: unitPrice, price_from_master: true } : line
          )
        }));
      }
    } catch (_) {
      /* preview optional */
    }
  };

  const handleLineChange = async (index, field, value) => {
    let priceRefresh = null;
    setFormData((prev) => {
      const lines = prev.lines.map((line, i) => (i === index ? { ...line, [field]: value } : line));
      const updated = lines[index];
      if (field === 'quantity' && updated?.item_id && updated?.isFromItemMaster) {
        priceRefresh = {
          itemId: updated.item_id,
          qty: Math.max(parseFloat(value) || 0, 0.01)
        };
      }
      return { ...prev, lines };
    });
    if (priceRefresh) {
      await applyReferencePriceToLine(index, priceRefresh.itemId, priceRefresh.qty);
    }
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
      needed_by_date: '',
      isFromItemMaster: false
    };

    setFormData(prev => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));
  };

  const selectItem = async (item) => {
    let unitPrice = Number(item.estimated_price || item.standard_cost || 0);
  try {
      const res = await requisitionAPI.getReferenceUnitPrice(item.id, 1);
      if (res.ok) {
        const json = await res.json();
        const ref = Number(json?.data?.unit_price || 0);
        if (ref > 0) unitPrice = ref;
      }
    } catch (_) {
      /* use fallback */
    }

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
      unit_price: unitPrice,
      price_from_master: true,
      specifications: item.specifications || '',
      needed_by_date: formData.needed_by_date || '',
      isFromItemMaster: true
    };

    setFormData((prev) => ({
      ...prev,
      lines: [...prev.lines, newLine]
    }));

    setShowItemModal(false);
    setItemSearchTerm('');
  };

  const linesTotalAmount = formData.lines.reduce((sum, line) => {
    const qty = Number(line.quantity) || 0;
    const up = Number(line.unit_price) || 0;
    return sum + qty * up;
  }, 0);

  const formatInr = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(
      amount || 0
    );

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
      setLoading(true);
      setError(null);

      const linkedSite = formData.site_id
        ? sites.find((s) => String(s.id) === String(formData.site_id))
        : null;

      // Prepare data for submission - ensure proper data types
      const submissionData = {
        ...formData,
        department_id: parseInt(formData.department_id),
        site_id: formData.site_id ? parseInt(formData.site_id) : null,
        project_id: formData.project_id && formData.project_id !== '' ? formData.project_id : null,
        circle_id: linkedSite?.circle_id ?? (formData.circle_id ? parseInt(formData.circle_id, 10) : null),
        cluster_id: linkedSite?.cluster_id ?? (formData.cluster_id ? parseInt(formData.cluster_id, 10) : null),
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

      const response = await requisitionAPI.createRequisition(submissionData);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Validation errors:', errorData);
        
        // Show specific validation errors if available
        if (errorData.errors && errorData.errors.length > 0) {
          const errorMessages = errorData.errors.map(err => `${err.path}: ${err.msg}`).join(', ');
          throw new Error(`Validation failed: ${errorMessages}`);
        }
        
        throw new Error(errorData.message || 'Failed to create requisition');
      }

      const data = await response.json();
      add('Requisition draft created', 'success');
      // If attachment selected, upload it now
      if (attachmentFile) {
        try {
          setUploading(true);
          const up = await requisitionAPI.uploadAttachment(data.data.id, attachmentFile);
          if (!up.ok) {
            const ed = await up.json();
            console.warn('Attachment upload failed:', ed);
          }
        } catch (e) {
          console.warn('Attachment upload error:', e.message);
        } finally {
          setUploading(false);
        }
      }
      navigate('/procurement/pr/requisition-list');
    } catch (err) {
      setError(err.message);
      console.error('Error creating requisition:', err);
    } finally {
      setLoading(false);
    }
  };

  if (error && (error.includes('Invalid requisition ID') || error.includes('Route not found'))) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger mb-4">
              <AlertTriangle size={20} />
              <h2 className="text-lg font-semibold">Requisition System Temporarily Unavailable</h2>
            </div>
            <p className="text-muted mb-4">
              The requisition creation system is currently being configured. Please check back later or contact your system administrator.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/procurement/pr/requisition-list')}
                className="btn btn-secondary"
              >
                Go to Requisitions
              </button>
              <button
                onClick={() => navigate('/procurement/supplier/supplier-management')}
                className="btn btn-primary"
              >
                Go to Suppliers
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
      <div>
        <h1 className="text-2xl font-bold text-fg">Create New Requisition</h1>
        <p className="text-muted">Create a new purchase requisition</p>
      </div>

      {/* Error Display */}
      {error && (
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
          onCircleChange={handleCircleChange}
          onClusterChange={handleClusterChange}
          onSiteSelect={handleSiteSelect}
        />

        {/* Line Items */}
        <RequisitionLineItems
          lines={formData.lines}
          handleLineChange={handleLineChange}
          removeLine={removeLine}
          addManualLine={addManualLine}
          setShowItemModal={setShowItemModal}
          formatCurrency={formatInr}
          totalAmount={linesTotalAmount}
        />

        {/* Attachment + Top Submit */}
        <div className="flex justify-end gap-3">
          <div className="mr-auto">
            <label className="block text-sm font-medium text-fg mb-1">Attach Email (PDF)</label>
            {uploadError && <div className="text-danger text-xs mb-1">{uploadError}</div>}
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
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate('/procurement/pr/requisition-list')}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || formData.lines.length === 0}
            className="btn btn-primary"
          >
            <Save size={16} className="mr-2" />
            {loading ? 'Creating...' : 'Create Requisition'}
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

export default RequisitionCreatePage;
