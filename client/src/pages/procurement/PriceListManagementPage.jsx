import React, { useState, useEffect } from 'react';
import { Upload, FileText, Users, CheckCircle, AlertCircle, XCircle, Download, Eye } from 'lucide-react';
import { procurementAPI } from '../../utils/api';

const PriceListManagementPage = () => {
  const [activeTab, setActiveTab] = useState('import');
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [importForm, setImportForm] = useState({
    price_list_name: '',
    description: '',
    currency: 'INR'
  });
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [priceLists, setPriceLists] = useState([]);
  const [importLogs, setImportLogs] = useState([]);
  const [selectedPriceList, setSelectedPriceList] = useState(null);
  const [manageSearch, setManageSearch] = useState('');
  const [manageSupplierFilter, setManageSupplierFilter] = useState('');
  const [managePage, setManagePage] = useState(1);
  const [managePerPage, setManagePerPage] = useState(25);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    fetchSuppliers();
    fetchPriceLists();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const response = await procurementAPI.getSuppliersForImport();
      if (response.ok) {
        const data = await response.json();
        console.log('Suppliers loaded:', data);
        setSuppliers(data.data || []);
      } else {
        console.error('Failed to fetch suppliers:', response.status);
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchPriceLists = async () => {
    try {
      const response = await procurementAPI.getPriceLists('limit=1000');
      if (response.ok) {
        const data = await response.json();
        console.log('Price lists loaded:', data);
        setPriceLists(data.data || []);
      } else {
        console.error('Failed to fetch price lists:', response.status);
      }
    } catch (error) {
      console.error('Error fetching price lists:', error);
    }
  };

  // Derived lists for Manage tab
  const filteredPriceLists = priceLists
    .filter((pl) =>
      (!manageSupplierFilter || String(pl.supplier_id) === String(manageSupplierFilter)) &&
      (!manageSearch || (
        (pl.name || '').toLowerCase().includes(manageSearch.toLowerCase()) ||
        (pl.description || '').toLowerCase().includes(manageSearch.toLowerCase()) ||
        (pl.supplier_name || '').toLowerCase().includes(manageSearch.toLowerCase()) ||
        (pl.supplier_code || '').toLowerCase().includes(manageSearch.toLowerCase())
      ))
    );

  const manageTotalPages = Math.max(1, Math.ceil(filteredPriceLists.length / managePerPage));
  const manageFirstIndex = (managePage - 1) * managePerPage;
  const manageCurrent = filteredPriceLists.slice(manageFirstIndex, manageFirstIndex + managePerPage);

  useEffect(() => {
    setManagePage(1);
  }, [manageSearch, manageSupplierFilter, managePerPage]);

  const openDetails = async (pl) => {
    try {
      setSelectedPriceList(pl);
      setImportLogs([]);
      setShowDetails(true);
      const res = await procurementAPI.getImportLogs(pl.id);
      if (res.ok) {
        const data = await res.json();
        setImportLogs(data.data || []);
      }
    } catch (e) {
      console.error('Failed to load import logs', e);
    }
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);
    setPreviewData(null);
    setImportResult(null);

    // Preview the file
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await procurementAPI.previewPriceListFile(formData);
      if (response.ok) {
        const data = await response.json();
        console.log('Preview data:', data);
        setPreviewData(data.data);
      } else {
        const errorData = await response.json();
        alert(`Preview failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error previewing file:', error);
      alert(`Preview failed: ${error.message}`);
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !selectedSupplier) {
      alert('Please select a file and supplier');
      return;
    }

    setImporting(true);
    setImportResult(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('supplier_id', selectedSupplier);
      formData.append('price_list_name', importForm.price_list_name);
      formData.append('description', importForm.description);
      formData.append('currency', importForm.currency);

      const response = await procurementAPI.importPriceList(formData);
      if (response.ok) {
        const data = await response.json();
        console.log('Import result:', data);
        setImportResult(data.data);
        setActiveTab('results');
        fetchPriceLists(); // Refresh price lists
      } else {
        const errorData = await response.json();
        alert(`Import failed: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error importing price list:', error);
      alert(`Import failed: ${error.message}`);
    } finally {
      setImporting(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success" />;
      case 'processing':
        return <AlertCircle className="w-5 h-5 text-warning" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-danger" />;
      default:
        return <AlertCircle className="w-5 h-5 text-muted" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'processing':
        return 'badge-warning';
      case 'failed':
        return 'badge-danger';
      default:
        return 'badge-secondary';
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-fg mb-2">Price List Management</h1>
        <p className="text-muted">Import and manage supplier price lists from Excel/CSV files</p>
      </div>

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-default">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('import')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'import'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-fg hover:border-muted'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Import Price List
            </button>
            <button
              onClick={() => setActiveTab('manage')}
              className={`py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'manage'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted hover:text-fg hover:border-muted'
              }`}
            >
              <FileText className="w-4 h-4 inline mr-2" />
              Manage Price Lists
            </button>
            {importResult && (
              <button
                onClick={() => setActiveTab('results')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'results'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted hover:text-fg hover:border-muted'
                }`}
              >
                <CheckCircle className="w-4 h-4 inline mr-2" />
                Import Results
              </button>
            )}
          </nav>
        </div>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Import Form */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">Import Price List</h3>
            </div>
            <div className="card-body space-y-4">
              {/* Supplier Selection */}
              <div className="form-group">
                <label className="form-label">Select Supplier</label>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="input"
                  required
                >
                  <option value="">Choose a supplier...</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name} ({supplier.supplier_code})
                    </option>
                  ))}
                </select>
              </div>

              {/* File Upload */}
              <div className="form-group">
                <label className="form-label">Upload Price List File</label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileSelect}
                  className="input"
                  required
                />
                <div className="text-xs text-muted mt-1">
                  Supported formats: CSV, Excel (.xlsx, .xls)
                </div>
              </div>

              {/* Price List Name */}
              <div className="form-group">
                <label className="form-label">Price List Name</label>
                <input
                  type="text"
                  value={importForm.price_list_name}
                  onChange={(e) => setImportForm({...importForm, price_list_name: e.target.value})}
                  className="input"
                  placeholder="Enter price list name..."
                />
              </div>

              {/* Description */}
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  value={importForm.description}
                  onChange={(e) => setImportForm({...importForm, description: e.target.value})}
                  className="input"
                  rows="3"
                  placeholder="Enter description..."
                />
              </div>

              {/* Currency */}
              <div className="form-group">
                <label className="form-label">Currency</label>
                <select
                  value={importForm.currency}
                  onChange={(e) => setImportForm({...importForm, currency: e.target.value})}
                  className="input"
                >
                  <option value="INR">INR (₹)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              {/* Import Button */}
              <button
                onClick={handleImport}
                disabled={!selectedFile || !selectedSupplier || importing}
                className="btn btn-primary w-full"
              >
                {importing ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Import Price List
                  </>
                )}
              </button>
            </div>
          </div>

          {/* File Preview */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">File Preview</h3>
            </div>
            <div className="card-body">
              {previewData ? (
                <div>
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">File: {selectedFile?.name}</span>
                      <span className={`badge ${previewData.supportedFormat ? 'badge-success' : 'badge-warning'}`}>
                        {previewData.supportedFormat ? 'Supported Format' : 'Unsupported Format'}
                      </span>
                    </div>
                    <div className="text-sm text-muted">
                      Total Rows: {previewData.totalRows} | Columns: {previewData.headers.length}
                    </div>
                  </div>

                  {previewData.supportedFormat ? (
                    <div className="overflow-x-auto">
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            {previewData.headers.map((header, index) => (
                              <th key={index} className="text-xs">{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {previewData.previewRows.map((row, index) => (
                            <tr key={index}>
                              {previewData.headers.map((header, headerIndex) => (
                                <td key={headerIndex} className="text-xs">
                                  {row[header] || '-'}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 text-warning mx-auto mb-4" />
                      <p className="text-muted">File format not supported</p>
                      <p className="text-xs text-muted mt-2">
                        Expected columns: Part Number, Part Description, Basic Rate, GST Rate
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-muted mx-auto mb-4" />
                  <p className="text-muted">Select a file to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Manage Tab */}
      {activeTab === 'manage' && (
        <div className="card">
          <div className="card-header">
            <div className="flex items-center justify-between w-full">
              <h3 className="card-title">Price Lists</h3>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={manageSearch}
                  onChange={(e) => setManageSearch(e.target.value)}
                  className="input h-9 w-56"
                  placeholder="Search name or supplier..."
                />
                <select
                  value={manageSupplierFilter}
                  onChange={(e) => setManageSupplierFilter(e.target.value)}
                  className="input h-9"
                >
                  <option value="">All suppliers</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
                <select
                  value={managePerPage}
                  onChange={(e) => setManagePerPage(parseInt(e.target.value) || 25)}
                  className="input h-9"
                >
                  <option value={10}>10 / page</option>
                  <option value={25}>25 / page</option>
                  <option value={50}>50 / page</option>
                  <option value={100}>100 / page</option>
                </select>
              </div>
            </div>
          </div>
          <div className="card-body">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Supplier</th>
                    <th>Currency</th>
                    <th>Import Stats</th>
                    <th>Imported</th>
                    <th>Import Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manageCurrent.map((priceList) => {
                    const total = priceList.total_items || 0;
                    const imported = priceList.imported_items || 0;
                    const failed = priceList.failed_items || 0;
                    const skipped = Math.max(total - imported - failed, 0);
                    const pct = total > 0 ? Math.round((imported / total) * 100) : 0;
                    return (
                      <tr key={priceList.id}>
                        <td>
                          <div className="font-medium">{priceList.name}</div>
                          <div className="text-sm text-muted">{priceList.description}</div>
                        </td>
                        <td>
                          <div className="font-medium">{priceList.supplier_name}</div>
                          <div className="text-sm text-muted">{priceList.supplier_code}</div>
                        </td>
                        <td>{priceList.currency}</td>
                        <td>
                          <div className="w-48">
                            <div className="h-2 bg-muted rounded">
                              <div
                                className="h-2 bg-success rounded"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs mt-1 text-muted">
                              <span>{pct}%</span>
                              <span>{imported}/{total}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="text-sm">
                            <span className="text-success font-medium">{imported}</span>
                            {failed > 0 && (
                              <span className="text-danger ml-2">{failed} failed</span>
                            )}
                            {skipped > 0 && (
                              <span className="text-muted ml-2">{skipped} skipped</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {priceList.import_date && new Date(priceList.import_date).toLocaleString()}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button
                              onClick={() => openDetails(priceList)}
                              className="btn btn-sm btn-secondary"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted">
                Showing {manageFirstIndex + 1}-{Math.min(manageFirstIndex + managePerPage, filteredPriceLists.length)} of {filteredPriceLists.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setManagePage((p) => Math.max(1, p - 1))}
                  disabled={managePage === 1}
                >
                  Prev
                </button>
                <div className="text-sm">Page {managePage} / {manageTotalPages}</div>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setManagePage((p) => Math.min(manageTotalPages, p + 1))}
                  disabled={managePage >= manageTotalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Tab */}
      {activeTab === 'results' && importResult && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Import Results</h3>
          </div>
          <div className="card-body">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-success">{importResult.statistics.successfulImports}</div>
                <div className="text-sm text-muted">Successful</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-warning">{importResult.statistics.skippedImports}</div>
                <div className="text-sm text-muted">Skipped</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-danger">{importResult.statistics.failedImports}</div>
                <div className="text-sm text-muted">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-fg">{importResult.statistics.totalRows}</div>
                <div className="text-sm text-muted">Total Rows</div>
              </div>
            </div>

            <div className="text-center">
              <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-fg mb-2">Import Completed Successfully!</h4>
              <p className="text-muted">
                Price list has been imported with {importResult.statistics.successfulImports} items processed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetails && selectedPriceList && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="card w-full max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
            <div className="card-header flex items-center justify-between">
              <div>
                <div className="card-title">{selectedPriceList.name}</div>
                <div className="text-sm text-muted">{selectedPriceList.supplier_name} ({selectedPriceList.supplier_code})</div>
              </div>
              <button className="btn btn-secondary" onClick={() => setShowDetails(false)}>Close</button>
            </div>
            <div className="card-body overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div>
                  <div className="text-xs text-muted">Total Items</div>
                  <div className="text-lg font-semibold">{selectedPriceList.total_items || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Imported</div>
                  <div className="text-lg font-semibold text-success">{selectedPriceList.imported_items || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Failed</div>
                  <div className="text-lg font-semibold text-danger">{selectedPriceList.failed_items || 0}</div>
                </div>
                <div>
                  <div className="text-xs text-muted">Import Date</div>
                  <div className="text-lg font-semibold">{selectedPriceList.import_date && new Date(selectedPriceList.import_date).toLocaleString()}</div>
                </div>
              </div>
              <div className="mb-3 font-medium">Import Logs</div>
              {importLogs.length === 0 ? (
                <div className="text-sm text-muted">No logs found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Started</th>
                        <th>Completed</th>
                        <th>Status</th>
                        <th>Total</th>
                        <th>Success</th>
                        <th>Failed</th>
                        <th>Skipped</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importLogs.map((log) => (
                        <tr key={log.id}>
                          <td>{log.id}</td>
                          <td>{log.started_at && new Date(log.started_at).toLocaleString()}</td>
                          <td>{log.completed_at && new Date(log.completed_at).toLocaleString()}</td>
                          <td><span className={`badge ${getStatusColor(log.import_status)}`}>{log.import_status}</span></td>
                          <td>{log.total_rows}</td>
                          <td>{log.successful_imports}</td>
                          <td>{log.failed_imports}</td>
                          <td>{log.skipped_imports}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PriceListManagementPage;