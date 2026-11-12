/**
 * Centralized API Service Layer
 * Provides consistent API calls across the frontend
 */

function resolveApiBaseUrl() {
  let base =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || 'http://localhost:5000';
  if (base.endsWith('/api')) base = base.slice(0, -4);
  return base.replace(/\/$/, '');
}
const API_BASE_URL = resolveApiBaseUrl();

// Cookie helpers for session-mode tokens
const getCookie = (name) => {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
};
const setCookie = (name, value, maxAgeSeconds) => {
  if (typeof document === 'undefined') return;
  const parts = [`${name}=${encodeURIComponent(value)}`, 'path=/'];
  if (maxAgeSeconds && Number.isFinite(maxAgeSeconds)) parts.push(`max-age=${Math.floor(maxAgeSeconds)}`);
  document.cookie = parts.join('; ');
};

/**
 * Base fetch function with authentication and error handling
 */
const apiFetch = async (endpoint, options = {}) => {
  const token = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('accessToken'))
    || localStorage.getItem('accessToken')
    || getCookie('accessToken');
  
  // Don't set Content-Type for FormData (browser will set it automatically with boundary)
  const isFormData = options.body instanceof FormData;
  
  const defaultOptions = {
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    }
  };

  const config = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    
    // Handle 401 Unauthorized: attempt token refresh
    if (response.status === 401) {
      const rememberMe = localStorage.getItem('rememberMe') === 'true';
      const refreshToken = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('refreshToken'))
        || localStorage.getItem('refreshToken')
        || getCookie('refreshToken');
      if (refreshToken) {
        try {
          const rtRes = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          if (rtRes.ok) {
            const rtData = await rtRes.json();
            const newAccess = rtData?.tokens?.accessToken || rtData?.accessToken;
            if (newAccess) {
              if (rememberMe) {
                localStorage.setItem('accessToken', newAccess);
                setCookie('accessToken', newAccess, 60 * 60 * 24 * 30);
              } else {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem('accessToken', newAccess);
                }
                setCookie('accessToken', newAccess);
              }
              // retry original request with new token
              config.headers.Authorization = `Bearer ${newAccess}`;
              return await fetch(`${API_BASE_URL}${endpoint}`, config);
            }
          }
        } catch (_) {
          // fall through to return original 401
        }
      }
    }

    // Handle 403 errors with permission refresh
    if (response.status === 403) {
      console.log('🔄 403 error detected, attempting permission refresh...');

      // Get current user to get userId
      const userStr = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user'))
        || localStorage.getItem('user')
        || getCookie('user');
      let userId = null;
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          userId = user.id;
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }

      if (userId) {
        // Use self-refresh endpoint so non-admins can refresh their own token
        const refreshResponse = await fetch(`${API_BASE_URL}/api/permissions/refresh/self`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });

        if (refreshResponse.ok) {
          const refreshData = await refreshResponse.json();
          if (refreshData.success && refreshData.data) {
            // Store new access token if provided
            if (refreshData.data.accessToken) {
              const rememberMe = localStorage.getItem('rememberMe') === 'true';
              // Store token in appropriate storage
              if (rememberMe) {
                localStorage.setItem('accessToken', refreshData.data.accessToken);
                setCookie('accessToken', refreshData.data.accessToken, 60 * 60 * 24 * 30);
              } else {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem('accessToken', refreshData.data.accessToken);
                }
                setCookie('accessToken', refreshData.data.accessToken);
              }
              // Update config with new token for retry
              config.headers.Authorization = `Bearer ${refreshData.data.accessToken}`;
            }

            // Update user data in localStorage if permissions were updated
            if (refreshData.data.permissions) {
              const rememberMe = localStorage.getItem('rememberMe') === 'true';
              const currentUser = JSON.parse(((typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user')) || localStorage.getItem('user') || getCookie('user') || '{}'));
              currentUser.permissions = refreshData.data.permissions;
              if (rememberMe) {
                localStorage.setItem('user', JSON.stringify(currentUser));
                setCookie('user', JSON.stringify(currentUser), 60 * 60 * 24 * 30);
              } else {
                if (typeof sessionStorage !== 'undefined') {
                  sessionStorage.setItem('user', JSON.stringify(currentUser));
                }
                setCookie('user', JSON.stringify(currentUser));
              }
            }

            console.log('🔄 Permissions refreshed successfully, retrying request...');
            // Retry the original request with new token
            return await fetch(`${API_BASE_URL}${endpoint}`, config);
          }
        }
      }
    }
    
    return response;
  } catch (error) {
    console.error('API fetch error:', error);
    throw error;
  }
};

/**
 * Generic API methods
 */
export const api = {
  // GET request
  get: (endpoint) => apiFetch(endpoint),
  
  // POST request
  post: (endpoint, data) => apiFetch(endpoint, {
    method: 'POST',
    body: data instanceof FormData ? data : JSON.stringify(data)
  }),
  
  // PUT request
  put: (endpoint, data) => apiFetch(endpoint, {
    method: 'PUT',
    body: data instanceof FormData ? data : JSON.stringify(data)
  }),
  
  // DELETE request
  delete: (endpoint) => apiFetch(endpoint, {
    method: 'DELETE'
  }),
  
  // PATCH request
  patch: (endpoint, data) => apiFetch(endpoint, {
    method: 'PATCH',
    body: data instanceof FormData ? data : JSON.stringify(data)
  })
};

/**
 * Inventory API endpoints
 */
export const inventoryAPI = {
  // Items
  getItems: (params = '') => api.get(`/api/inventory/items${params ? `?${params}` : ''}`),
  getItem: (id) => api.get(`/api/inventory/items/${id}`),
  createItem: (data) => api.post('/api/inventory/items', data),
  updateItem: (id, data) => api.put(`/api/inventory/items/${id}`, data),
  deleteItem: (id) => api.delete(`/api/inventory/items/${id}`),
  
  // Categories
  getCategories: (params = '') => api.get(`/api/inventory/item-categories${params ? params : ''}`),
  getCategory: (id) => api.get(`/api/inventory/item-categories/${id}`),
  getCategoryHierarchy: () => api.get('/api/inventory/item-categories/hierarchy'),
  getCategoriesByType: (type) => api.get(`/api/inventory/item-categories/type/${type}`),
  getDefaultCategory: () => api.get('/api/inventory/item-categories/default'),
  createCategory: (data) => api.post('/api/inventory/item-categories', data),
  updateCategory: (id, data) => api.put(`/api/inventory/item-categories/${id}`, data),
  deleteCategory: (id) => api.delete(`/api/inventory/item-categories/${id}`),
  
  // Warehouses
  getWarehouses: () => api.get('/api/inventory/warehouses'),
  getWarehouse: (id) => api.get(`/api/inventory/warehouses/${id}`),
  createWarehouse: (data) => api.post('/api/inventory/warehouses', data),
  updateWarehouse: (id, data) => api.put(`/api/inventory/warehouses/${id}`, data),
  toggleWarehouseStatus: (id, status) => api.patch(`/api/inventory/warehouses/${id}/toggle-status`, { status }),
  deleteWarehouse: (id) => api.delete(`/api/inventory/warehouses/${id}`),
  getWarehouseBins: (warehouseId) => api.get(`/api/inventory/warehouses/${warehouseId}/bins`),
  
  // Bins
  getBins: () => api.get('/api/inventory/bins'),
  getBin: (id) => api.get(`/api/inventory/bins/${id}`),
  createBin: (data) => api.post('/api/inventory/bins', data),
  updateBin: (id, data) => api.put(`/api/inventory/bins/${id}`, data),
  deleteBin: (id) => api.delete(`/api/inventory/bins/${id}`),
  
  // Units of Measure
  getUnitsOfMeasure: () => api.get('/api/inventory/units-of-measure'),
  createUnitOfMeasure: (data) => api.post('/api/inventory/units-of-measure', data),
  updateUnitOfMeasure: (id, data) => api.put(`/api/inventory/units-of-measure/${id}`, data),
  deleteUnitOfMeasure: (id) => api.delete(`/api/inventory/units-of-measure/${id}`),
  
  // Sites
  getSites: () => api.get('/api/inventory/sites'),
  getSite: (id) => api.get(`/api/inventory/sites/${id}`),
  createSite: (data) => api.post('/api/inventory/sites', data),
  updateSite: (id, data) => api.put(`/api/inventory/sites/${id}`, data),
  deleteSite: (id, hardDelete = true) => api.delete(`/api/inventory/sites/${id}?hardDelete=${hardDelete}`),
  toggleSiteStatus: (id, status) => api.patch(`/api/inventory/sites/${id}/toggle-status`, { status }),

  // Employee Master (Inventory view over HR employees)
  getEmployees: (params = '') => api.get(`/api/inventory/employees${params ? `?${params}` : ''}`),
  getEmployee: (id) => api.get(`/api/inventory/employees/${id}`),
  
  // Items
  getItems: (params = '') => api.get(`/api/inventory/items${params ? `?${params}` : ''}`),
  getItem: (id) => api.get(`/api/inventory/items/${id}`),
  createItem: (data) => api.post('/api/inventory/items', data),
  updateItem: (id, data) => api.put(`/api/inventory/items/${id}`, data),
  deleteItem: (id) => api.delete(`/api/inventory/items/${id}`),
  toggleItemStatus: (id, status) => api.patch(`/api/inventory/items/${id}/toggle-status`, { status }),

  // Transaction Categories (Masters)
  getTransactionCategories: (includeInactive = false) => api.get(`/api/inventory/transaction-categories${includeInactive ? '?include_inactive=true' : ''}`),
  getTransactionCategory: (id) => api.get(`/api/inventory/transaction-categories/${id}`),
  createTransactionCategory: (data) => api.post('/api/inventory/transaction-categories', data),
  updateTransactionCategory: (id, data) => api.put(`/api/inventory/transaction-categories/${id}`, data),
  deleteTransactionCategory: (id) => api.delete(`/api/inventory/transaction-categories/${id}`)
};

// Stock endpoints
export const stockAPI = {
  getOnHand: (params = '') => api.get(`/api/inventory/stock/on-hand${params ? `?${params}` : ''}`),
  getValuation: (params = '') => api.get(`/api/inventory/stock/valuation${params ? `?${params}` : ''}`),
  getMovements: (params = '') => api.get(`/api/inventory/stock/movements${params ? `?${params}` : ''}`)
};

// Inventory operations endpoints (Phase 5)
export const inventoryOpsAPI = {
  // Transfers
  createTransfer: (data) => api.post('/api/inventory/transfers', data),
  updateTransfer: (id, data) => api.put(`/api/inventory/transfers/${id}`, data),
  postTransfer: (id) => api.post(`/api/inventory/transfers/${id}/post`),
  getTransfers: (params = '') => api.get(`/api/inventory/transfers${params ? `?${params}` : ''}`),
  getTransfer: (id) => api.get(`/api/inventory/transfers/${id}`),
  uploadTransferAttachment: (id, file) => { const form = new FormData(); form.append('file', file); return api.post(`/api/inventory/transfers/${id}/attachment`, form); },
  getTransferAttachmentUrl: (id) => `/api/inventory/transfers/${id}/attachment`,
  deleteTransfer: (id) => api.delete(`/api/inventory/transfers/${id}`),
  withdrawTransfer: (id) => api.post(`/api/inventory/transfers/${id}/withdraw`),
  exportTransfers: (params = '') => api.get(`/api/inventory/transfers/export${params ? `?${params}` : ''}`),

  // Adjustments
  createAdjustment: (data) => api.post('/api/inventory/adjustments', data),
  updateAdjustment: (id, data) => api.put(`/api/inventory/adjustments/${id}`, data),
  postAdjustment: (id) => api.post(`/api/inventory/adjustments/${id}/post`),
  getAdjustments: (params = '') => api.get(`/api/inventory/adjustments${params ? `?${params}` : ''}`),
  getAdjustment: (id) => api.get(`/api/inventory/adjustments/${id}`),
  uploadAdjustmentAttachment: (id, file) => { const form = new FormData(); form.append('file', file); return api.post(`/api/inventory/adjustments/${id}/attachment`, form); },
  getAdjustmentAttachmentUrl: (id) => `/api/inventory/adjustments/${id}/attachment`,
  deleteAdjustment: (id) => api.delete(`/api/inventory/adjustments/${id}`),
  withdrawAdjustment: (id) => api.post(`/api/inventory/adjustments/${id}/withdraw`),
  exportAdjustments: (params = '') => api.get(`/api/inventory/adjustments/export${params ? `?${params}` : ''}`),

  // Issues
  createIssue: (data) => api.post('/api/inventory/issues', data),
  updateIssue: (id, data) => api.put(`/api/inventory/issues/${id}`, data),
  postIssue: (id) => api.post(`/api/inventory/issues/${id}/post`),
  getIssues: (params = '') => api.get(`/api/inventory/issues${params ? `?${params}` : ''}`),
  getIssue: (id) => api.get(`/api/inventory/issues/${id}`),
  deleteIssue: (id) => api.delete(`/api/inventory/issues/${id}`),
  withdrawIssue: (id) => api.post(`/api/inventory/issues/${id}/withdraw`),
  exportIssues: (params = '') => api.get(`/api/inventory/issues/export${params ? `?${params}` : ''}`),
  exportIssueXlsx: (id) => api.get(`/api/inventory/issues/${id}/export-xlsx`),

  // Store Return Notes (SRN)
  createSRN: (data) => api.post('/api/inventory/srn', data),
  updateSRN: (id, data) => api.put(`/api/inventory/srn/${id}`, data),
  postSRN: (id) => api.post(`/api/inventory/srn/${id}/post`),
  getSRNs: (params = '') => api.get(`/api/inventory/srn${params ? `?${params}` : ''}`),
  getSRN: (id) => api.get(`/api/inventory/srn/${id}`),
  uploadSrnAttachment: (id, file) => { const form = new FormData(); form.append('file', file); return api.post(`/api/inventory/srn/${id}/attachment`, form); },
  getSrnAttachmentUrl: (id) => `/api/inventory/srn/${id}/attachment`,
  deleteSRN: (id) => api.delete(`/api/inventory/srn/${id}`),
  withdrawSRN: (id) => api.post(`/api/inventory/srn/${id}/withdraw`),
  exportSRNs: (params = '') => api.get(`/api/inventory/srn/export${params ? `?${params}` : ''}`)
};

// Stock Count endpoints
export const stockCountAPI = {
  create: (data) => api.post('/api/inventory/stock-counts', data),
  list: (params = '') => api.get(`/api/inventory/stock-counts${params ? `?${params}` : ''}`),
  get: (id) => api.get(`/api/inventory/stock-counts/${id}`),
  post: (id) => api.post(`/api/inventory/stock-counts/${id}/post`),
  updateLine: (id, lineId, counted_qty) => api.patch(`/api/inventory/stock-counts/${id}/lines/${lineId}`, { counted_qty }),
  updateHeader: (id, data) => api.patch(`/api/inventory/stock-counts/${id}`, data)
};

/**
 * Procurement API endpoints
 */
export const procurementAPI = {
  // Suppliers
  getSuppliers: (params = '') => api.get(`/api/procurement/suppliers${params ? `?${params}` : ''}`),
  getSupplier: (id) => api.get(`/api/procurement/suppliers/${id}`),
  createSupplier: (data) => api.post('/api/procurement/suppliers', data),
  updateSupplier: (id, data) => api.put(`/api/procurement/suppliers/${id}`, data),
  deleteSupplier: (id) => api.delete(`/api/procurement/suppliers/${id}`),
  toggleSupplierStatus: (id, status) => api.patch(`/api/procurement/suppliers/${id}/toggle-status`, { status }),
  getAppliedPriceList: (supplierId) => api.get(`/api/procurement/suppliers/${supplierId}/applied-price-list`),
  setAppliedPriceList: (supplierId, priceListId) => api.put(`/api/procurement/suppliers/${supplierId}/applied-price-list`, { price_list_id: priceListId }),
  
  // GST Calculation
  calculateGst: (data) => api.post('/api/procurement/calculate-gst', data),
  
  // Supplier Items
  getSupplierItems: (supplierId) => api.get(`/api/procurement/suppliers/${supplierId}/items`),
  getAllSupplierItems: () => api.get('/api/procurement/supplier-items'),
  createSupplierItem: (data) => api.post('/api/procurement/supplier-items', data),
  updateSupplierItem: (id, data) => api.put(`/api/procurement/supplier-items/${id}`, data),
  deleteSupplierItem: (id) => api.delete(`/api/procurement/supplier-items/${id}`),
  
  // Price Lists
  getPriceLists: (params = '') => api.get(`/api/procurement/price-lists${params ? `?${params}` : ''}`),
  getPriceList: (id) => api.get(`/api/procurement/price-lists/${id}`),
  createPriceList: (data) => api.post('/api/procurement/price-lists', data),
  updatePriceList: (id, data) => api.put(`/api/procurement/price-lists/${id}`, data),
  deletePriceList: (id) => api.delete(`/api/procurement/price-lists/${id}`),
  
  // Price List Import
  getSuppliersForImport: () => api.get('/api/procurement/price-list-import/suppliers'),
  previewPriceListFile: (formData) => api.post('/api/procurement/price-list-import/preview', formData),
  importPriceList: (formData) => api.post('/api/procurement/price-list-import/import', formData),
  getImportLogs: (priceListId) => api.get(`/api/procurement/price-list-import/logs/${priceListId}`),
  getImportItemLogs: (importLogId) => api.get(`/api/procurement/price-list-import/logs/items/${importLogId}`),
  
  // Item Prices
  getItemPrices: (priceListId) => api.get(`/api/procurement/price-lists/${priceListId}/prices`),
  createItemPrice: (data) => api.post('/api/procurement/item-prices', data),
  updateItemPrice: (id, data) => api.put(`/api/procurement/item-prices/${id}`, data),
  deleteItemPrice: (id) => api.delete(`/api/procurement/item-prices/${id}`)
};

/**
 * Requisition API endpoints
 */
export const requisitionAPI = {
  // Requisitions
  getRequisitions: (params = '') => api.get(`/api/procurement/requisitions${params ? `?${params}` : ''}`),
  getRequisition: (id) => api.get(`/api/procurement/requisitions/${id}`),
  createRequisition: (data) => api.post('/api/procurement/requisitions', data),
  updateRequisition: (id, data) => api.put(`/api/procurement/requisitions/${id}`, data),
  deleteRequisition: (id) => api.delete(`/api/procurement/requisitions/${id}`),
  withdrawRequisition: (id) => api.post(`/api/procurement/requisitions/${id}/withdraw`),
  
  // Requisition export
  exportRequisitions: (params = '') => api.get(`/api/procurement/requisitions/export${params ? `?${params}` : ''}`),
  
  // Requisition actions
  submitRequisition: (id) => api.post(`/api/procurement/requisitions/${id}/submit`),
  approveRequisition: (id, data) => api.post(`/api/procurement/requisitions/${id}/approve`, data),
  rejectRequisition: (id, data) => api.post(`/api/procurement/requisitions/${id}/reject`, data),
  uploadAttachment: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/api/procurement/requisitions/${id}/attachment`, form);
  },
  getAttachmentUrl: (id) => `/api/procurement/requisitions/${id}/attachment`,
  
  // Requisition utilities
  getRequisitionStats: () => api.get('/api/procurement/requisitions/stats'),
  searchItems: (search) => api.get(`/api/procurement/requisitions/search/items?search=${encodeURIComponent(search)}`),
  getVendorOptions: (id) => api.get(`/api/procurement/requisitions/${id}/vendor-options`)
};

/**
 * Purchase Order API endpoints
 */
export const purchaseOrderAPI = {
  // Create
  createPO: (data) => api.post('/api/procurement/purchase-orders', data),
  createFromRequisition: (requisitionId, data) => api.post(`/api/procurement/purchase-orders/from-requisition/${requisitionId}`, data),
  // Read
  getPOs: (params = '') => api.get(`/api/procurement/purchase-orders${params ? `?${params}` : ''}`),
  getPO: (id) => api.get(`/api/procurement/purchase-orders/${id}`),
  updatePO: (id, data) => api.put(`/api/procurement/purchase-orders/${id}`, data),
  exportPOs: (params = '') => api.get(`/api/procurement/purchase-orders/export${params ? `?${params}` : ''}`),
  exportPOXlsx: (id) => api.get(`/api/procurement/purchase-orders/${id}/export-xlsx`),
  exportPOPdf: (id) => api.get(`/api/procurement/purchase-orders/${id}/export-pdf`),
  // Actions
  submitPO: (id) => api.post(`/api/procurement/purchase-orders/${id}/submit`),
  approvePO: (id, data = {}) => api.post(`/api/procurement/purchase-orders/${id}/approve`, data),
  rejectPO: (id, data = {}) => api.post(`/api/procurement/purchase-orders/${id}/reject`, data),
  issuePO: (id) => api.post(`/api/procurement/purchase-orders/${id}/issue`),
  deletePO: (id) => api.delete(`/api/procurement/purchase-orders/${id}`),
  withdrawPO: (id) => api.post(`/api/procurement/purchase-orders/${id}/withdraw`),
  cancelIssuedPO: (id, data = {}) => api.post(`/api/procurement/purchase-orders/${id}/cancel-issued`, data),
  amendPO: (id, data) => api.post(`/api/procurement/purchase-orders/${id}/amend`, data)
};

export const rfqAPI = {
  list: (params = '') => api.get(`/api/procurement/rfqs${params ? `?${params}` : ''}`),
  get: (id) => api.get(`/api/procurement/rfqs/${id}`),
  createFromRequisition: (requisitionId, data) =>
    api.post(`/api/procurement/rfqs/from-requisition/${requisitionId}`, data),
  invite: (id, supplierIds) => api.post(`/api/procurement/rfqs/${id}/invite`, { supplier_ids: supplierIds }),
  submitQuotation: (id, data) => api.post(`/api/procurement/rfqs/${id}/quotations`, data),
  compare: (id) => api.get(`/api/procurement/rfqs/${id}/compare`),
  award: (id, quotationId) => api.post(`/api/procurement/rfqs/${id}/award`, { quotation_id: quotationId })
};

export const supplierInvoiceAPI = {
  list: () => api.get('/api/procurement/supplier-invoices'),
  get: (id) => api.get(`/api/procurement/supplier-invoices/${id}`),
  capture: (data) => api.post('/api/procurement/supplier-invoices', data),
  rematch: (id) => api.post(`/api/procurement/supplier-invoices/${id}/rematch`),
  handoffFinance: (id) => api.post(`/api/procurement/supplier-invoices/${id}/handoff-finance`)
};

export const storeReturnAPI = {
  list: () => api.get('/api/procurement/store-returns'),
  get: (id) => api.get(`/api/procurement/store-returns/${id}`),
  createFromGrn: (grnId, data) => api.post(`/api/procurement/store-returns/from-grn/${grnId}`, data),
  post: (id) => api.post(`/api/procurement/store-returns/${id}/post`)
};

// Procurement Analytics endpoints
export const procurementAnalyticsAPI = {
  getMonthlySpend: (params = {}) => {
    const sp = new URLSearchParams(params);
    const qs = sp.toString();
    return api.get(`/api/procurement/analytics/procurement/spend${qs ? `?${qs}` : ''}`);
  },
  getDepartmentBreakdown: (params = {}) => {
    const sp = new URLSearchParams(params);
    const qs = sp.toString();
    return api.get(`/api/procurement/analytics/procurement/by-department${qs ? `?${qs}` : ''}`);
  },
  getTopSuppliers: (params = {}) => {
    const sp = new URLSearchParams(params);
    const qs = sp.toString();
    return api.get(`/api/procurement/analytics/procurement/top-suppliers${qs ? `?${qs}` : ''}`);
  }
};

/**
 * Goods Receipt API endpoints
 */
export const goodsReceiptAPI = {
  createGRN: (data) => api.post('/api/procurement/goods-receipts', data),
  submitGRN: (id) => api.post(`/api/procurement/goods-receipts/${id}/submit`),
  postGRN: (id) => api.post(`/api/procurement/goods-receipts/${id}/post`),
  getGRNs: (params = '') => api.get(`/api/procurement/goods-receipts${params ? `?${params}` : ''}`),
  getGRN: (id) => api.get(`/api/procurement/goods-receipts/${id}`),
  updateGRN: (id, data) => api.put(`/api/procurement/goods-receipts/${id}`, data),
  deleteGRN: (id) => api.delete(`/api/procurement/goods-receipts/${id}`),
  withdrawGRN: (id) => api.post(`/api/procurement/goods-receipts/${id}/withdraw`),
  exportGRNs: (params = '') => api.get(`/api/procurement/goods-receipts/export${params ? `?${params}` : ''}`),
  exportGRNXlsx: (id) => api.get(`/api/procurement/goods-receipts/${id}/export-xlsx`)
};

// User Approval (direct endpoints used by existing page)
export const userApprovalAPI = {
  getAll: (params = '') => api.get(`/api/user-approval/all${params ? `?${params}` : ''}`),
  getStats: () => api.get('/api/user-approval/stats'),
  approve: (userId, data) => api.post(`/api/user-approval/approve/${userId}`, data),
  reject: (userId, data) => api.post(`/api/user-approval/reject/${userId}`, data)
};
/**
 * User Management API endpoints
 */
export const userManagementAPI = {
  // Users
  getUsers: (params = '') => api.get(`/api/users/directory${params ? `?${params}` : ''}`),
  getUser: (id) => api.get(`/api/users/${id}`),
  getBasicUserInfo: (id) => api.get(`/api/users/basic/${id}`), // For approval tasks - no special permissions required
  updateUser: (id, data) => api.put(`/api/users/${id}`, data),
  deleteUser: (id) => api.delete(`/api/users/${id}`),
  
  // User Approval
  getPendingUsers: (params = '') => api.get(`/api/users/pending/approval${params ? `?${params}` : ''}`),
  approveUser: (id) => api.post(`/api/user-approval/approve/${id}`),
  rejectUser: (id, reason) => api.post(`/api/user-approval/reject/${id}`, { reason }),
  getApprovalStats: () => api.get('/api/user-approval/stats'),
  
  // User Assignment
  getAssignmentStats: () => api.get('/api/users/assignment/statistics'),
  getAvailableUsers: () => api.get('/api/users/assignment/available'),
  assignUser: (data) => api.post('/api/users/assignment/assign', data),
  transferUser: (userId, data) => api.post(`/api/users/assignment/${userId}/transfer`, data),
  unassignUser: (userId) => api.post(`/api/users/assignment/${userId}/unassign`),
  
  // Departments
  getDepartments: () => api.get('/api/departments'),
  getDepartment: (id) => api.get(`/api/departments/${id}`),
  createDepartment: (data) => api.post('/api/departments', data),
  updateDepartment: (id, data) => api.put(`/api/departments/${id}`, data),
  deleteDepartment: (id) => api.delete(`/api/departments/${id}`),
  getDepartmentModules: () => api.get('/api/departments/modules'),
  assignModulesToDepartment: (id, modules) => api.post(`/api/departments/${id}/modules`, { modules }),
  
  // Roles
  getRoles: (params = '') => api.get(`/api/roles${params ? `?${params}` : ''}`),
  getRole: (id) => api.get(`/api/roles/${id}`),
  createRole: (data) => api.post('/api/roles', data),
  updateRole: (id, data) => api.put(`/api/roles/${id}`, data),
  deleteRole: (id) => api.delete(`/api/roles/${id}`),
  getAvailablePermissions: () => api.get('/api/roles/permissions/available'),
  getDepartmentRoles: (departmentId) => api.get(`/api/roles/department/${departmentId}`),
  
  // Appeals
  getAppeals: (params = '') => api.get(`/api/user-appeals${params ? `?${params}` : ''}`),
  reviewAppeal: (id, data) => api.post(`/api/user-appeals/${id}/review`, data),
  checkAppeal: (userId) => api.get(`/api/user-appeals/check/${userId}`),
  submitAppeal: (userId, data) => api.post(`/api/user-appeals/submit/${userId}`, data)
};

/**
 * System API endpoints
 */
export const systemAPI = {
  // Health check
  getHealth: () => api.get('/health'),
  
  // API info
  getApiInfo: () => api.get('/api'),
  
  // Modules
  getModules: () => api.get('/api/system/modules'),
  getFeatures: () => api.get('/api/system/modules/features'),
  
  // Logs
  getAuditLogs: (params = '') => api.get(`/api/system/audit-logs${params ? `?${params}` : ''}`),
  getActivityLogs: (params = '') => api.get(`/api/system/activity-logs${params ? `?${params}` : ''}`),
  getErrorLogs: (params = '') => api.get(`/api/system/error-logs${params ? `?${params}` : ''}`),
  resolveErrorLog: (id, data = {}) => api.patch(`/api/system/error-logs/${id}/resolve`, data),
  
  // Workflows
  getWorkflowDefinitions: () => api.get('/api/system/workflows/definitions'),
  createWorkflowDefinition: (data) => api.post('/api/system/workflows/definitions', data),
  updateWorkflowDefinition: (id, data) => api.put(`/api/system/workflows/definitions/${id}`, data),
  deleteWorkflowDefinition: (id) => api.delete(`/api/system/workflows/definitions/${id}`),
  
  getWorkflowInstances: (params = '') => api.get(`/api/system/workflows/instances${params ? `?${params}` : ''}`),
  getWorkflowInstance: (id) => api.get(`/api/system/workflows/instances/${id}`),
  executeWorkflowAction: (id, action) => api.post(`/api/system/workflows/instances/${id}/action`, { action }),
  createWorkflowInstance: (data) => api.post('/api/system/workflows/instances', data),
  submitViaBinding: (data) => api.post('/api/system/workflows/submit', data),

  // Workflow read models
  getWorkflowForEntity: (type, id) => api.get(`/api/system/workflows/for-entity?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`),
  getPendingApproversForEntity: (type, id) => api.get(`/api/system/workflows/pending-assignees?type=${encodeURIComponent(type)}&id=${encodeURIComponent(id)}`),

  // Workflow Tasks
  getWorkflowTasks: (params = '') => api.get(`/api/system/workflows/tasks${params ? (params.startsWith('?') ? params : `?${params}`) : ''}`),
  getWorkflowTask: (id) => api.get(`/api/system/workflows/tasks/${id}`),
  updateWorkflowTask: (id, data) => api.put(`/api/system/workflows/tasks/${id}`, data),
  completeWorkflowTask: (id, data) => api.post(`/api/system/workflows/tasks/${id}/complete`, data)
};

/**
 * Reports API endpoints
 */
export const reportsAPI = {
  run: (payload) => api.post('/api/reports/run', payload),
  export: (payload) => api.post('/api/reports/export', payload),
  getPresets: (reportType) => {
    const params = reportType ? `?report_type=${encodeURIComponent(reportType)}` : '';
    return api.get(`/api/reports/presets${params}`);
  },
  savePreset: (payload) => api.post('/api/reports/presets', payload),
  deletePreset: (id) => api.delete(`/api/reports/presets/${id}`),
  updatePreset: (id, payload) => api.put(`/api/reports/presets/${id}`, payload)
};

/**
 * Authentication API endpoints
 */
export const authAPI = {
  login: (credentials) => api.post('/api/auth/login', credentials),
  register: (userData) => api.post('/api/auth/register', userData),
  verifyEmail: (token) => api.post('/api/auth/verify-email', { token }),
  forgotPassword: (email) => api.post('/api/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/api/auth/reset-password', { token, password }),
  refreshToken: (refreshToken) => api.post('/api/auth/refresh-token', { refreshToken }),
  logout: () => api.post('/api/auth/logout'),
  getMe: () => api.get('/api/auth/me'),
  getAssignmentStatus: () => api.get('/api/users/assignment-status')
};

// HR API endpoints (Phase 1)
export const hrAPI = {
  // Organization masters
  list: (entity) => api.get(`/api/hr/organization/${encodeURIComponent(entity)}`),
  create: (entity, data) => api.post(`/api/hr/organization/${encodeURIComponent(entity)}`, data),
  update: (entity, id, data) => api.put(`/api/hr/organization/${encodeURIComponent(entity)}/${id}`, data),
  remove: (entity, id) => api.delete(`/api/hr/organization/${encodeURIComponent(entity)}/${id}`),
  getSupervisorMap: () => api.get('/api/hr/organization/supervisors/map'),
  setSupervisor: (data) => api.post('/api/hr/organization/supervisors/set', data),

  // Org: Holiday calendars
  listHolidayCalendars: () => api.get('/api/hr/organization/holiday-calendars'),
  createHolidayCalendar: (data) => api.post('/api/hr/organization/holiday-calendars', data),
  updateHolidayCalendar: (id, data) => api.put(`/api/hr/organization/holiday-calendars/${id}`, data),
  deleteHolidayCalendar: (id) => api.delete(`/api/hr/organization/holiday-calendars/${id}`),
  listHolidays: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.calendar_id) params.set('calendar_id', opts.calendar_id);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    const qs = params.toString();
    return api.get(`/api/hr/organization/holidays${qs ? `?${qs}` : ''}`);
  },
  createHoliday: (data) => api.post('/api/hr/organization/holidays', data),
  updateHoliday: (id, data) => api.put(`/api/hr/organization/holidays/${id}`, data),
  deleteHoliday: (id) => api.delete(`/api/hr/organization/holidays/${id}`),

  // Org: Company profile (single master)
  getCompanyProfile: () => api.get('/api/hr/organization/company-profile'),
  updateCompanyProfile: (data) => api.put('/api/hr/organization/company-profile', data),

  // Employees
  getEmployees: (params = '') => api.get(`/api/hr/employees${params ? `?${params}` : ''}`),
  getEmployee: (id) => api.get(`/api/hr/employees/${id}`),
  createEmployee: (data) => api.post('/api/hr/employees', data),
  updateEmployee: (id, data) => api.put(`/api/hr/employees/${id}`, data),
  deactivateEmployee: (id) => api.patch(`/api/hr/employees/${id}/deactivate`),
  linkUser: (id, user_id) => api.post(`/api/hr/employees/${id}/link-user`, { user_id }),
  uploadEmployeeDocument: (id, file, doc_type, extra = {}) => {
    const form = new FormData();
    form.append('file', file);
    form.append('doc_type', doc_type);
    if (extra && typeof extra === 'object') {
      if (extra.doc_number) form.append('doc_number', String(extra.doc_number));
      if (extra.doc_meta !== undefined) {
        const meta = typeof extra.doc_meta === 'string' ? extra.doc_meta : JSON.stringify(extra.doc_meta);
        form.append('doc_meta', meta);
      }
    }
    return api.post(`/api/hr/employees/${id}/documents`, form);
  },
  listEmployeeDocuments: (id) => api.get(`/api/hr/employees/${id}/documents`),
  deleteEmployeeDocument: (id, docId) => api.delete(`/api/hr/employees/${id}/documents/${docId}`),
  downloadEmployeeDocument: (id, docId, inline = true) =>
    api.get(`/api/hr/employees/${id}/documents/${docId}/download?inline=${inline ? 'true' : 'false'}`),

  // Banking
  listEmployeeBankAccounts: (id) => api.get(`/api/hr/employees/${id}/bank-accounts`),
  createEmployeeBankAccount: (id, data) => api.post(`/api/hr/employees/${id}/bank-accounts`, data),
  updateEmployeeBankAccount: (id, accountId, data) => api.put(`/api/hr/employees/${id}/bank-accounts/${accountId}`, data),
  deleteEmployeeBankAccount: (id, accountId) => api.delete(`/api/hr/employees/${id}/bank-accounts/${accountId}`),

  // Employee related tables (Phase: deep profile)
  listEmployeeDependents: (id) => api.get(`/api/hr/employees/${id}/dependents`),
  createEmployeeDependent: (id, data) => api.post(`/api/hr/employees/${id}/dependents`, data),
  updateEmployeeDependent: (id, dependentId, data) => api.put(`/api/hr/employees/${id}/dependents/${dependentId}`, data),
  deleteEmployeeDependent: (id, dependentId) => api.delete(`/api/hr/employees/${id}/dependents/${dependentId}`),

  listEmployeeNominees: (id) => api.get(`/api/hr/employees/${id}/nominees`),
  createEmployeeNominee: (id, data) => api.post(`/api/hr/employees/${id}/nominees`, data),
  updateEmployeeNominee: (id, nomineeId, data) => api.put(`/api/hr/employees/${id}/nominees/${nomineeId}`, data),
  deleteEmployeeNominee: (id, nomineeId) => api.delete(`/api/hr/employees/${id}/nominees/${nomineeId}`),

  listEmployeeEducation: (id) => api.get(`/api/hr/employees/${id}/education`),
  createEmployeeEducation: (id, data) => api.post(`/api/hr/employees/${id}/education`, data),
  updateEmployeeEducation: (id, educationId, data) => api.put(`/api/hr/employees/${id}/education/${educationId}`, data),
  deleteEmployeeEducation: (id, educationId) => api.delete(`/api/hr/employees/${id}/education/${educationId}`),

  listEmployeeExperience: (id) => api.get(`/api/hr/employees/${id}/experience`),
  createEmployeeExperience: (id, data) => api.post(`/api/hr/employees/${id}/experience`, data),
  updateEmployeeExperience: (id, experienceId, data) => api.put(`/api/hr/employees/${id}/experience/${experienceId}`, data),
  deleteEmployeeExperience: (id, experienceId) => api.delete(`/api/hr/employees/${id}/experience/${experienceId}`),

  listEmployeeTransfers: (id) => api.get(`/api/hr/employees/${id}/transfers`),
  createEmployeeTransfer: (id, data) => api.post(`/api/hr/employees/${id}/transfers`, data),
  deleteEmployeeTransfer: (id, transferId) => api.delete(`/api/hr/employees/${id}/transfers/${transferId}`),

  // Attendance (Phase 2)
  getAttendanceStaging: (status = 'pending', limit, offset) => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (limit) params.set('limit', limit);
    if (offset) params.set('offset', offset);
    const qs = params.toString();
    return api.get(`/api/hr/attendance/staging${qs ? `?${qs}` : ''}`);
  },
  ingestAttendance: (records) => api.post('/api/hr/attendance/staging', { records }),
  normalizeAttendance: () => api.post('/api/hr/attendance/normalize'),
  getAttendanceLogs: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/attendance/logs${qs ? `?${qs}` : ''}`);
  },
  listShiftTemplates: () => api.get('/api/hr/attendance/shifts'),
  createShiftTemplate: (data) => api.post('/api/hr/attendance/shifts', data),
  listRoster: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/attendance/roster${qs ? `?${qs}` : ''}`);
  },
  assignRoster: (assignments) => api.post('/api/hr/attendance/roster', { assignments }),
  listAttendancePeriods: () => api.get('/api/hr/attendance/periods'),
  openAttendancePeriod: (period_month, period_year) => api.post('/api/hr/attendance/periods', { period_month, period_year }),
  transitionAttendancePeriod: (id, action) => api.post(`/api/hr/attendance/periods/${id}/transition`, { action }),
  listAttendanceSummaries: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.period_id) params.set('period_id', opts.period_id);
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/attendance/summaries${qs ? `?${qs}` : ''}`);
  },
  listOvertime: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.status) params.set('status', opts.status);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/attendance/overtime${qs ? `?${qs}` : ''}`);
  },
  createOvertime: (data) => api.post('/api/hr/attendance/overtime', data),
  transitionOvertime: (id, action) => api.post(`/api/hr/attendance/overtime/${id}/transition`, { action })

  ,
  // Leave (Phase 3)
  listLeaveCategories: () => api.get('/api/hr/leave/categories'),
  createLeaveCategory: (data) => api.post('/api/hr/leave/categories', data),
  updateLeaveCategory: (id, data) => api.put(`/api/hr/leave/categories/${id}`, data),
  deleteLeaveCategory: (id) => api.delete(`/api/hr/leave/categories/${id}`),

  listLeavePolicies: () => api.get('/api/hr/leave/policies'),
  createLeavePolicy: (data) => api.post('/api/hr/leave/policies', data),
  updateLeavePolicy: (id, data) => api.put(`/api/hr/leave/policies/${id}`, data),
  deleteLeavePolicy: (id) => api.delete(`/api/hr/leave/policies/${id}`),

  listLeaveBalances: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.category_id) params.set('category_id', opts.category_id);
    const qs = params.toString();
    return api.get(`/api/hr/leave/balances${qs ? `?${qs}` : ''}`);
  },
  adjustLeaveBalance: (data) => api.post('/api/hr/leave/balances/adjust', data),
  adjustLeaveBalancesBatch: (data) => api.post('/api/hr/leave/balances/adjust/batch', data),
  listLeaveLedger: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.category_id) params.set('category_id', opts.category_id);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/leave/ledger${qs ? `?${qs}` : ''}`);
  },
  getLeaveCalendar: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    const qs = params.toString();
    return api.get(`/api/hr/leave/calendar${qs ? `?${qs}` : ''}`);
  },
  runLeaveAccruals: (data = {}) => api.post('/api/hr/leave/accruals/run', data),
  runLeaveCarryForward: (data = {}) => api.post('/api/hr/leave/carry-forward/run', data),
  listLeaveCarryForwardHistory: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.period_key) params.set('period_key', opts.period_key);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/leave/carry-forward/history${qs ? `?${qs}` : ''}`);
  },
  listLeaveEncashments: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/leave/encashment${qs ? `?${qs}` : ''}`);
  },
  createLeaveEncashment: (data) => api.post('/api/hr/leave/encashment', data),
  listCompOffCredits: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/leave/comp-off/credits${qs ? `?${qs}` : ''}`);
  },
  createCompOffCredit: (data) => api.post('/api/hr/leave/comp-off/credits', data),
  listLeaveAccrualHistory: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.period_key) params.set('period_key', opts.period_key);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/leave/accruals/history${qs ? `?${qs}` : ''}`);
  },

  // Payroll (Phase 1)
  listPayrollComponents: () => api.get('/api/hr/payroll/components'),
  createPayrollComponent: (data) => api.post('/api/hr/payroll/components', data),
  updatePayrollComponent: (id, data) => api.put(`/api/hr/payroll/components/${id}`, data),
  deletePayrollComponent: (id) => api.delete(`/api/hr/payroll/components/${id}`),

  listPayrollStructures: () => api.get('/api/hr/payroll/structures'),
  getPayrollStructure: (id) => api.get(`/api/hr/payroll/structures/${id}`),
  createPayrollStructure: (data) => api.post('/api/hr/payroll/structures', data),
  updatePayrollStructure: (id, data) => api.put(`/api/hr/payroll/structures/${id}`, data),
  deletePayrollStructure: (id) => api.delete(`/api/hr/payroll/structures/${id}`),
  upsertPayrollStructureLines: (id, lines = []) => api.put(`/api/hr/payroll/structures/${id}/lines`, { lines }),

  listPayrollAssignments: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.structure_id) params.set('structure_id', opts.structure_id);
    if (opts.active_only !== undefined) params.set('active_only', String(opts.active_only));
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/payroll/assignment${qs ? `?${qs}` : ''}`);
  },
  createPayrollAssignment: (data) => api.post('/api/hr/payroll/assignment', data),
  updatePayrollAssignment: (id, data) => api.put(`/api/hr/payroll/assignment/${id}`, data),
  deletePayrollAssignment: (id) => api.delete(`/api/hr/payroll/assignment/${id}`),

  listPayrollRuns: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/payroll/runs${qs ? `?${qs}` : ''}`);
  },
  runPayroll: (data) => api.post('/api/hr/payroll/pay-run', data),
  listPayslips: (runId) => api.get(`/api/hr/payroll/runs/${runId}/payslips`),
  getPayslipItems: (runId, employeeId) => api.get(`/api/hr/payroll/runs/${runId}/payslips/${employeeId}/items`),

  // Payroll Inputs + Statutory (Phase 2)
  listPayrollInputs: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.period_key) params.set('period_key', opts.period_key);
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/payroll/inputs${qs ? `?${qs}` : ''}`);
  },
  upsertPayrollInput: (data) => api.post('/api/hr/payroll/inputs', data),
  deletePayrollInput: (id) => api.delete(`/api/hr/payroll/inputs/${id}`),
  getPayrollStatutory: () => api.get('/api/hr/payroll/statutory'),
  updatePayrollStatutory: (data) => api.put('/api/hr/payroll/statutory', data),

  // Payroll Period data (paid days / LOP)
  listPayrollPeriodData: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.period_key) params.set('period_key', opts.period_key);
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/payroll/period-data${qs ? `?${qs}` : ''}`);
  },
  upsertPayrollPeriodData: (data) => api.post('/api/hr/payroll/period-data', data),
  deletePayrollPeriodData: (id) => api.delete(`/api/hr/payroll/period-data/${id}`),
  getPayslipExportModel: (runId, employeeId) => api.get(`/api/hr/payroll/runs/${runId}/payslips/${employeeId}/export-model`),

  // Employee salary structure override
  getEmployeeSalaryStructure: (employeeId, opts = {}) => {
    const params = new URLSearchParams();
    if (opts.period_key) params.set('period_key', opts.period_key);
    const qs = params.toString();
    return api.get(`/api/hr/payroll/employees/${employeeId}/salary-structure${qs ? `?${qs}` : ''}`);
  },
  upsertEmployeeSalaryStructure: (employeeId, data) => api.put(`/api/hr/payroll/employees/${employeeId}/salary-structure`, data),
  deleteEmployeeSalaryStructure: (employeeId) => api.delete(`/api/hr/payroll/employees/${employeeId}/salary-structure`),

  listLeaveRequests: (opts = {}) => {
    const params = new URLSearchParams();
    if (opts.status) params.set('status', opts.status);
    if (opts.employee_id) params.set('employee_id', opts.employee_id);
    if (opts.from) params.set('from', opts.from);
    if (opts.to) params.set('to', opts.to);
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.offset) params.set('offset', opts.offset);
    const qs = params.toString();
    return api.get(`/api/hr/leave/requests${qs ? `?${qs}` : ''}`);
  },
  createLeaveRequest: (data) => api.post('/api/hr/leave/requests', data),
  transitionLeaveRequest: (id, action, comment) => api.post(`/api/hr/leave/requests/${id}/transition`, { action, comment })
};

export default {
  api,
  inventoryAPI,
  stockAPI,
  inventoryOpsAPI,
  procurementAPI,
  purchaseOrderAPI,
  goodsReceiptAPI,
  requisitionAPI,
  userManagementAPI,
  systemAPI,
  authAPI
};

// Aggregated search
export const searchAPI = {
  global: (q) => api.get(`/api/system/search?q=${encodeURIComponent(q || '')}`)
};

// Circles API
export const circleAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    const queryString = params.toString();
    return api.get(`/api/system/circles${queryString ? '?' + queryString : ''}`);
  },
  getById: (id) => api.get(`/api/system/circles/${id}`),
  getRegions: () => api.get('/api/system/circles/regions'),
  create: (data) => api.post('/api/system/circles', data),
  update: (id, data) => api.put(`/api/system/circles/${id}`, data),
  delete: (id) => api.delete(`/api/system/circles/${id}`)
};

// Clusters API
export const clusterAPI = {
  getAll: (filters = {}) => {
    const params = new URLSearchParams(filters);
    const queryString = params.toString();
    return api.get(`/api/system/clusters${queryString ? '?' + queryString : ''}`);
  },
  getById: (id) => api.get(`/api/system/clusters/${id}`),
  getByCircle: (circleId) => api.get(`/api/system/clusters/circle/${circleId}`),
  create: (data) => api.post('/api/system/clusters', data),
  update: (id, data) => api.put(`/api/system/clusters/${id}`, data),
  delete: (id) => api.delete(`/api/system/clusters/${id}`)
};

// Supplier Coverage API
export const procurePilotAiBuyApi = {
  getStatus: () => api.get('/api/procurepilot/ai-buy/status'),
  getActivity: () => api.get('/api/procurepilot/ai-buy/activity'),
  extract: (text) => api.post('/api/procurepilot/ai-buy/extract', { text }),
  compare: (body) => api.post('/api/procurepilot/ai-buy/compare', body),
  submitPr: (body) => api.post('/api/procurepilot/ai-buy/submit-pr', body)
};

export const procurePilotPayPalApi = {
  getConfig: () => api.get('/api/procurepilot/paypal/config'),
  createOrder: (body) => api.post('/api/procurepilot/paypal/orders', body),
  capture: (body) => api.post('/api/procurepilot/paypal/capture', body)
};

export const procurePilotPolicyApi = {
  getCatalog: () => api.get('/api/procurepilot/policy/catalog'),
  getMyPolicy: () => api.get('/api/procurepilot/policy/me'),
  listRolePolicies: () => api.get('/api/procurepilot/policy/roles'),
  updateRolePolicy: (roleLevel, data) => api.put(`/api/procurepilot/policy/roles/${roleLevel}`, data),
  updateUserPolicy: (userId, data) => api.put(`/api/procurepilot/policy/users/${userId}`, data),
  evaluate: (body) => api.post('/api/procurepilot/policy/evaluate', body),
  getSpendAudit: () => api.get('/api/procurepilot/policy/spend-audit')
};

export const supplierCoverageAPI = {
  getAll: () => api.get('/api/procurement/supplier-coverage'),
  getSupplierCircles: (supplierId) => api.get(`/api/procurement/suppliers/${supplierId}/circles`),
  getSupplierClusters: (supplierId) => api.get(`/api/procurement/suppliers/${supplierId}/clusters`),
  updateSupplierCircles: (supplierId, circleIds) => 
    api.put(`/api/procurement/suppliers/${supplierId}/circles`, { circle_ids: circleIds }),
  updateSupplierClusters: (supplierId, clusterIds) => 
    api.put(`/api/procurement/suppliers/${supplierId}/clusters`, { cluster_ids: clusterIds })
};
