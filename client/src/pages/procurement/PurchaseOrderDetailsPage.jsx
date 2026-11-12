import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { purchaseOrderAPI, inventoryAPI, circleAPI, clusterAPI, systemAPI } from '../../utils/api';
import { approvePurchaseOrderTask, rejectPurchaseOrderTask } from '../../utils/procurementApproval';
import { ArrowLeft, Send, CheckCircle, Truck, Calendar, Building, IndianRupee, AlertTriangle, XCircle, Workflow, Radio, Trash2, Package, FileText, Printer } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { getPOPrintComponent } from '../../clients/printRegistry';
import { usePermissions } from '../../hooks/usePermissions';
import WorkflowTimeline from '../../components/system/WorkflowTimeline';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { formatDate } from '../../utils/date';

const PurchaseOrderDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [po, setPo] = useState(null);
  const [sites, setSites] = useState([]);
  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isIssuing, setIsIssuing] = useState(false);
  const [showPoPrintPreview, setShowPoPrintPreview] = useState(false);
  const printRef = useRef(null);
  const POPrint = getPOPrintComponent();
  const handlePrintPo = useReactToPrint({ contentRef: printRef, documentTitle: po?.po_number ? `PO_${po.po_number}` : 'Purchase_Order' });
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [pendingTasks, setPendingTasks] = useState([]);
  const [taskActionLoading, setTaskActionLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const { hasPermission } = usePermissions();
  const { add } = useToastContext() || { add: () => {} };
  const { open } = useDialog() || { open: () => {} };

  const openPrintPreview = () => setShowPoPrintPreview(true);

  const fetchSites = async () => {
    try {
      const response = await inventoryAPI.getSites();
      if (response.ok) {
        const data = await response.json();
        setSites(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch sites:', e);
    }
  };

  const fetchCircles = async () => {
    try {
      const response = await circleAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setCircles(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch circles:', e);
    }
  };

  const fetchClusters = async () => {
    try {
      const response = await clusterAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setClusters(data.data || []);
      }
    } catch (e) {
      console.error('Failed to fetch clusters:', e);
    }
  };

  const getSiteName = (siteId) => {
    const site = sites.find(s => s.id === siteId);
    return site ? site.name : 'N/A';
  };

  const getSiteDisplay = (siteId) => {
    const site = sites.find(s => s.id === siteId);
    if (!site) return 'N/A';
    const code = site.site_code || site.code || '';
    return code ? `${site.name} (${code})` : site.name;
  };

  const getCircleName = (circleId) => {
    const circle = circles.find(c => c.id === circleId);
    return circle ? circle.name : 'N/A';
  };

  const getClusterName = (clusterId) => {
    const cluster = clusters.find(c => c.id === clusterId);
    return cluster ? cluster.name : 'N/A';
  };

  const poForPrint = useMemo(() => {
    if (!po) return null;
    return {
      ...po,
      circle_name: po.circle_name || (po.circle_id ? getCircleName(po.circle_id) : undefined),
      cluster_name: po.cluster_name || (po.cluster_id ? getClusterName(po.cluster_id) : undefined),
      po_date: po.issued_at || po.po_date
    };
  }, [po, circles, clusters]);

  const fetchPO = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await purchaseOrderAPI.getPO(id);
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.message || 'Failed to fetch purchase order');
      }
      const data = await response.json();
      setPo(data?.data || data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action) => {
    try {
      let res;
      if (action === 'submit') res = await purchaseOrderAPI.submitPO(id);
      else if (action === 'issue') {
        setIsIssuing(true);
        res = await purchaseOrderAPI.issuePO(id);
        setIsIssuing(false);
      }
      else if (action === 'withdraw') {
        if (!window.confirm('Withdraw this Purchase Order?')) return;
        res = await purchaseOrderAPI.withdrawPO(id);
        if (res.ok) {
          add('PO withdrawn', 'success');
          navigate('/procurement/po/po-list');
          return;
        }
      }
      else return;
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Action failed');
      }
      await fetchPO();
      if (action === 'submit') { add('PO submitted', 'success'); open('Submitted', `PO #${id} submitted successfully.`); }
      if (action === 'issue') {
        add('PO issued', 'success');
        setShowPoPrintPreview(true);
      }
      if (action === 'withdraw') { add('PO withdrawn', 'success'); open('Withdrawn', `PO #${id} withdrawn.`); }
    } catch (e) {
      setError(e.message);
      setIsIssuing(false);
    }
  };

  useEffect(() => {
    fetchSites();
    fetchCircles();
    fetchClusters();
  }, []);

  useEffect(() => {
    fetchPO();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (location.state?.showPoPrintPreview && po && (po.status === 'issued' || po.status === 'closed')) {
      setShowPoPrintPreview(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [po?.status, location.state, location.pathname, navigate, po]);

  useEffect(() => {
    if (po?.workflow_instance_id) {
      fetchWorkflowInstance();
      fetchPendingTasks();
    }
  }, [po?.workflow_instance_id]);

  const fetchWorkflowInstance = async () => {
    try {
      setWorkflowLoading(true);
      if (po?.id) {
        const resp = await systemAPI.getWorkflowForEntity('purchase_order', po.id);
        const json = await resp.json().catch(()=>({}));
        if (resp.ok && json?.data) { setWorkflowInstance(json.data); return; }
      }
      if (po?.workflow_instance_id) {
        const response = await systemAPI.getWorkflowInstance(po.workflow_instance_id);
        if (response.ok) {
          const data = await response.json();
          setWorkflowInstance(data.data || data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch workflow instance:', e);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const fetchPendingTasks = async (workflowId = po?.workflow_instance_id) => {
    try {
      if (!workflowId) { setPendingTasks([]); return; }
      const params = new URLSearchParams({ entity_type: 'purchase_order', status: 'pending' }).toString();
      const res = await systemAPI.getWorkflowTasks(params);
      if (res.ok) {
        const json = await res.json();
        const data = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : []);
        const mine = data.filter(t => Number(t.instance_id) === Number(workflowId));
        setPendingTasks(mine);
      } else {
        setPendingTasks([]);
      }
    } catch (_) {
      setPendingTasks([]);
    }
  };

  const canApprovePo = hasPermission('procurement.purchase_order.approve');
  const canCreateGrn = hasPermission('procurement.goods_receipt.create');

  const handleApproveTask = async () => {
    try {
      setTaskActionLoading(true);
      const task = pendingTasks[0];
      if (task) {
        await approvePurchaseOrderTask({ ...task, _source: 'workflow' }, 'Approved via PO details');
        setPendingTasks([]);
        await fetchPendingTasks(task.instance_id);
      } else if (po?.status === 'pending_approval' || po?.status === 'submitted') {
        await approvePurchaseOrderTask({ _source: 'direct', entity_id: Number(id) }, 'Approved via PO details');
      } else {
        return;
      }
      await fetchPO();
      add('PO approved', 'success');
      open('Approved', `PO #${po?.po_number || id} approved successfully.`);
    } catch (e) { setError(e.message); } finally { setTaskActionLoading(false); }
  };

  const handleRejectTask = async () => {
    try {
      if (!rejectReason.trim()) { setError('Rejection reason is required'); return; }
      setTaskActionLoading(true);
      const task = pendingTasks[0];
      if (task) {
        await rejectPurchaseOrderTask({ ...task, _source: 'workflow' }, rejectReason.trim());
        setPendingTasks([]);
        await fetchPendingTasks(task.instance_id);
      } else if (po?.status === 'pending_approval' || po?.status === 'submitted') {
        await rejectPurchaseOrderTask({ _source: 'direct', entity_id: Number(id) }, rejectReason.trim());
      } else {
        return;
      }
      setShowReject(false);
      setRejectReason('');
      await fetchPO();
      add('PO rejected', 'error');
      open('Rejected', `PO #${po?.po_number || id} rejected.`);
    } catch (e) { setError(e.message); } finally { setTaskActionLoading(false); }
  };

  const formatCurrency = (amount) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="card"><div className="card-body"><div className="animate-pulse h-32 bg-muted rounded" /></div></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger mb-4">
              <AlertTriangle size={20} />
              <h2 className="text-lg font-semibold">Error Loading Purchase Order</h2>
            </div>
            <p className="text-muted mb-4">{error}</p>
            <div className="flex gap-3">
              <button onClick={() => navigate('/procurement/po/po-list')} className="btn btn-secondary">Back to List</button>
              <button onClick={fetchPO} className="btn btn-primary">Try Again</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!po) {
    return (
      <div className="space-y-6">
        <div className="card"><div className="card-body text-center py-12">Purchase Order Not Found</div></div>
      </div>
    );
  }

  // Determine where to navigate back based on location state
  const getBackNavigation = () => {
    const from = location.state?.from;
    if (from === 'approvals') {
      return {
        path: '/procurement/po/approval-tasks',
        label: 'Back to Approvals'
      };
    } else if (from === 'generate-from-pr') {
      return {
        path: '/procurement/po/generate-from-pr',
        label: 'Back to Generate from PR'
      };
    } else {
      return {
        path: '/procurement/po/po-list',
        label: 'Back to List'
      };
    }
  };

  const backNav = getBackNavigation();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(backNav.path)} className="btn btn-secondary btn-sm">
            <ArrowLeft size={16} className="mr-2" /> {backNav.label}
          </button>
          <div>
            <h1 className="text-2xl font-bold text-fg">Purchase Order Details</h1>
            <p className="text-muted">#{po.po_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {po?.status === 'draft' && (
            <Link to={`/procurement/po/po-edit/${id}`} className="btn btn-secondary btn-sm">Edit</Link>
          )}
          {po?.status === 'draft' && (
            <button onClick={() => handleAction('submit')} className="btn btn-success btn-sm">
              <Send size={16} className="mr-2" /> Submit
            </button>
          )}
          {(po.status === 'pending_approval' || po.status === 'submitted') && canApprovePo && (
            <>
              <button onClick={handleApproveTask} className="btn btn-success btn-sm" disabled={taskActionLoading}>
                <CheckCircle size={16} className="mr-2" /> Approve
              </button>
              <button onClick={() => setShowReject(true)} className="btn btn-danger btn-sm" disabled={taskActionLoading}>
                <XCircle size={16} className="mr-2" /> Reject
              </button>
            </>
          )}
          {po.status === 'issued' && po.receiving_phase === 'open' && canCreateGrn && (
            <button
              type="button"
              onClick={() => navigate(`/procurement/grn/create-grn?poId=${id}`)}
              className="btn btn-primary btn-sm"
            >
              <Package size={16} className="mr-2" />
              Create GRN
            </button>
          )}
          {po.status === 'approved' && (
            <button 
              onClick={() => handleAction('issue')} 
              className="btn btn-primary btn-sm inline-flex items-center"
              disabled={isIssuing}
            >
              {isIssuing ? (
                <>
                  <div className="spinner w-4 h-4 mr-2 inline-block"></div>
                  <span>Issuing…</span>
                </>
              ) : (
                <>
                  <Truck size={16} className="mr-2" />
                  <span>Issue</span>
                </>
              )}
            </button>
          )}
          {po.status === 'draft' && (
            <button onClick={() => handleAction('withdraw')} className="btn btn-danger btn-sm">
              <Trash2 size={16} className="mr-2" /> Withdraw
            </button>
          )}
          {(po.status === 'issued' || po.status === 'closed') && (
            <button type="button" onClick={openPrintPreview} className="btn btn-secondary btn-sm">
              <Printer size={16} className="mr-2" />
              Print / save PDF
            </button>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">{po.title}</h3>
              <div className="flex gap-2">
                <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
                  po?.status === 'draft' ? 'bg-gray-100 text-gray-700' : 
                  po?.status === 'pending_approval' ? 'bg-yellow-100 text-yellow-800' : 
                  po?.status === 'approved' ? 'bg-green-100 text-green-800' : 
                  po?.status === 'issued' ? 'bg-blue-100 text-blue-800' : 
                  po?.status === 'rejected' ? 'bg-red-100 text-red-800' : 
                  po?.status === 'withdrawn' ? 'bg-gray-100 text-gray-700' :
                  'bg-gray-100 text-gray-700'
                }`}>
                  {(po?.status || '-').split('_').join(' ')}
                </span>
                {po.status === 'issued' && po.receiving_phase && (
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
                    po.receiving_phase === 'open' ? 'bg-amber-100 text-amber-800' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    📦 {po.receiving_phase === 'open' ? 'Receiving open' : 'Receiving closed'}
                  </span>
                )}
                {po.status === 'issued' && po.receiving_status && po.receiving_status !== 'not_received' && (
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase tracking-wide ${
                    po.receiving_status === 'fully_received' ? 'bg-green-100 text-green-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {String(po.receiving_status).split('_').join(' ')}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">Supplier Details</h3></div>
            <div className="card-body">
              <div className="mb-4">
                <h4 className="font-semibold text-lg text-fg">{po.supplier_name || '-'}</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted">Address:</span>
                  <div className="text-fg">{po.supplier_address || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted">Contact:</span>
                  <div className="text-fg">{po.supplier_contact || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted">Email:</span>
                  <div className="text-fg">{po.supplier_email || 'N/A'}</div>
                </div>
                <div>
                  <span className="text-muted">Phone:</span>
                  <div className="text-fg">{po.supplier_phone || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">Delivery Information</h3></div>
            <div className="card-body grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Site</label>
                <div className="flex items-center gap-2">
                  <Building size={16} className="text-muted" />
                  <span>{po.site_id ? getSiteDisplay(po.site_id) : 'N/A'}</span>
                </div>
              </div>
              <div>
                <label className="form-label">Warehouse</label>
                <div className="flex items-center gap-2"><Building size={16} className="text-muted" /><span>{po.warehouse_name || 'N/A'}</span></div>
              </div>
              <div>
                <label className="form-label">Circle</label>
                <div className="flex items-center gap-2"><Radio size={16} className="text-muted" /><span>{po.circle_id ? getCircleName(po.circle_id) : 'N/A'}</span></div>
              </div>
              <div>
                <label className="form-label">Cluster</label>
                <div className="flex items-center gap-2"><Radio size={16} className="text-muted" /><span>{po.cluster_id ? getClusterName(po.cluster_id) : 'N/A'}</span></div>
              </div>
              <div>
                <label className="form-label">Currency</label>
                <div>{po.currency}</div>
              </div>
              <div>
                <label className="form-label">Category</label>
                <div>{po.transaction_category_name || 'N/A'}</div>
              </div>
              <div>
                <label className="form-label">Promised Date</label>
                <div className="flex items-center gap-2"><Calendar size={16} className="text-muted" /><span>{formatDate(po.promised_date)}</span></div>
              </div>
              {po.description && (
                <div className="md:col-span-2">
                  <label className="form-label">Description</label>
                  <p className="text-fg whitespace-pre-wrap">{po.description}</p>
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">Line Items</h3></div>
            <div className="card-body">
              {po.lines && po.lines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Item</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Mfr</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Qty</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Unit Price</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">GST%</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">CGST</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">SGST</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">IGST</th>
                        <th className="px-3 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Line Total</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Received</th>
                        <th className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase">Remaining</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {po.lines.map((line, idx) => {
                        const baseAmt = (Number(line.base_amount) || (Number(line.quantity || 0) * Number(line.unit_price || 0)));
                        const cgst = Number(line.cgst_rate) || 0;
                        const sgst = Number(line.sgst_rate) || 0;
                        const igst = Number(line.igst_rate) || 0;
                        const cgstAmt = Number(line.cgst_amount) || 0;
                        const sgstAmt = Number(line.sgst_amount) || 0;
                        const igstAmt = Number(line.igst_amount) || 0;
                        const totalGst = cgstAmt + sgstAmt + igstAmt;
                        
                        return (
                          <tr key={line.id || idx} className="hover:bg-muted/50">
                            <td className="px-3 py-3">
                              <div className="font-medium text-fg">{line.item_name}</div>
                              <div className="text-xs text-muted">{line.item_code}</div>
                            </td>
                            <td className="px-3 py-3">
                              <div className="text-xs font-medium text-fg">{line.manufacturer || '-'}</div>
                              {line.spare_type && <div className="text-xs text-muted">{line.spare_type}</div>}
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="font-medium">{line.quantity}</div>
                              <div className="text-xs text-muted">{line.unit_of_measure}</div>
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <IndianRupee size={14} className="text-muted" />
                                <span className="font-medium">{(Number(line.unit_price) || 0).toFixed(2)}</span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span className="badge badge-info">{Number(line.gst_rate) || 0}%</span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              {cgst > 0 ? (
                                <div>
                                  <div className="text-xs font-medium">{cgst}%</div>
                                  <div className="text-xs text-muted">{formatCurrency(cgstAmt)}</div>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {sgst > 0 ? (
                                <div>
                                  <div className="text-xs font-medium">{sgst}%</div>
                                  <div className="text-xs text-muted">{formatCurrency(sgstAmt)}</div>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {igst > 0 ? (
                                <div>
                                  <div className="text-xs font-medium">{igst}%</div>
                                  <div className="text-xs text-muted">{formatCurrency(igstAmt)}</div>
                                </div>
                              ) : '-'}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <div className="font-semibold text-primary">{formatCurrency(line.total_price)}</div>
                              <div className="text-xs text-muted">GST: {formatCurrency(totalGst)}</div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="text-sm">{Number(line.received_quantity || 0)}</div>
                              <div className="text-xs text-muted">of {line.quantity}</div>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <div className="text-sm font-medium">{Number(line.remaining_quantity ?? Math.max(Number(line.quantity || 0) - Number(line.received_quantity || 0), 0))}</div>
                              <div className="text-xs text-muted">{line.unit_of_measure}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted">No line items found</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">PO Summary</h3></div>
            <div className="card-body space-y-3">
              {(() => {
                const lines = po.lines || [];
                const totalBase = lines.reduce((sum, l) => sum + (Number(l.base_amount) || (Number(l.quantity || 0) * Number(l.unit_price || 0))), 0);
                const totalCgst = lines.reduce((sum, l) => sum + (Number(l.cgst_amount) || 0), 0);
                const totalSgst = lines.reduce((sum, l) => sum + (Number(l.sgst_amount) || 0), 0);
                const totalIgst = lines.reduce((sum, l) => sum + (Number(l.igst_amount) || 0), 0);
                const totalGst = totalCgst + totalSgst + totalIgst;
                const grandTotal = totalBase + totalGst;
                
                return (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Base Amount:</span>
                      <span className="font-medium">{formatCurrency(totalBase)}</span>
                    </div>
                    {totalCgst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">CGST:</span>
                        <span className="font-medium">{formatCurrency(totalCgst)}</span>
                      </div>
                    )}
                    {totalSgst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">SGST:</span>
                        <span className="font-medium">{formatCurrency(totalSgst)}</span>
                      </div>
                    )}
                    {totalIgst > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted">IGST:</span>
                        <span className="font-medium">{formatCurrency(totalIgst)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm border-t border-default pt-2">
                      <span className="text-muted">Total GST:</span>
                      <span className="font-semibold text-primary">{formatCurrency(totalGst)}</span>
                    </div>
                    <div className="flex justify-between border-t border-default pt-3">
                      <span className="text-fg font-semibold">Grand Total:</span>
                      <span className="font-bold text-lg text-primary">{formatCurrency(grandTotal)}</span>
                    </div>
                  </>
                );
              })()}
              <div className="border-t border-default pt-3 mt-3 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-muted">Total Qty:</span><span className="font-medium">{po.total_quantity || 0}</span></div>
                {'received_quantity' in po && (
                  <div className="flex justify-between text-sm"><span className="text-muted">Received:</span><span className="font-medium">{po.received_quantity}</span></div>
                )}
                {'receiving_phase' in po && po.status === 'issued' && (
                  <div className="flex justify-between text-sm"><span className="text-muted">Receiving:</span><span className="font-medium capitalize">{po.receiving_phase}</span></div>
                )}
                {'receiving_status' in po && (
                  <div className="flex justify-between text-sm"><span className="text-muted">Receipt progress:</span><span className="font-medium">{String(po.receiving_status).split('_').join(' ')}</span></div>
                )}
                <div className="flex justify-between text-sm"><span className="text-muted">Status:</span><span className="font-medium">{po.status}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted">Created:</span><span className="text-sm">{formatDate(po.created_at)}</span></div>
              </div>
            </div>
          </div>

          {/* Workflow */}
          {(workflowInstance?.computed?.steps?.length || workflowInstance?.history?.length || po.submitted_at || po.approved_at || po.rejected_at) && (
            <div className="card">
              <div className="card-header">
                <h3 className="text-lg font-semibold">Workflow</h3>
              </div>
              <div className="card-body">
                {workflowInstance?.computed?.steps?.length ? (
                  <WorkflowTimeline data={workflowInstance.computed} />
                ) : (
                  <div className="space-y-4">
                  {/* 1. Submit for Approval - Always First */}
                  {po.submitted_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium">Submit for Approval</p>
                        <p className="text-xs text-muted">{new Date(po.submitted_at).toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {/* 2. Approval Steps - Middle */}
                  {(workflowInstance?.history || []).map((h, idx) => (
                    <div key={idx} className="flex items-start gap-3">
                      <div className={`w-2 h-2 ${h.action === 'approve' ? 'bg-green-500' : h.action === 'reject' ? 'bg-red-500' : 'bg-blue-500'} rounded-full mt-2`}></div>
                      <div>
                        <p className="text-sm font-medium capitalize">{h.action || 'progressed'}</p>
                        <p className="text-xs text-muted">{new Date(h.at).toLocaleString()}</p>
                        {h.nodeId && <p className="text-xs text-muted mt-1">Step: {h.nodeId}</p>}
                        {h.comment && <p className="text-xs text-muted mt-1">{h.comment}</p>}
                      </div>
                    </div>
                  ))}

                  {/* 3. Final Status - Always Last */}
                  {po.approved_at && (
                    <div className="flex items-start gap-3 pt-2 border-t border-border">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-green-600">PO Fully Approved</p>
                        <p className="text-xs text-muted">{new Date(po.approved_at).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  {po.rejected_at && (
                    <div className="flex items-start gap-3 pt-2 border-t border-border">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-red-600">Rejected</p>
                        <p className="text-xs text-muted">{new Date(po.rejected_at).toLocaleString()}</p>
                        {po.rejection_reason && (
                          <p className="text-xs text-danger mt-1">{po.rejection_reason}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><h3 className="text-lg font-semibold">Quick Actions</h3></div>
            <div className="card-body space-y-2">
              {po.status === 'draft' && (
                <button onClick={() => handleAction('submit')} className="btn btn-success w-full"><Send size={16} className="mr-2" /> Submit for Approval</button>
              )}
              {po.status === 'approved' && (
                <button 
                  onClick={() => handleAction('issue')} 
                  className="btn btn-primary w-full inline-flex items-center justify-center"
                  disabled={isIssuing}
                >
                  {isIssuing ? (
                    <>
                      <div className="spinner w-4 h-4 mr-2 inline-block"></div>
                      <span>Issuing…</span>
                    </>
                  ) : (
                    <>
                      <Truck size={16} className="mr-2" />
                      <span>Issue</span>
                    </>
                  )}
                </button>
              )}
              {po.status === 'draft' && (
                <button onClick={() => handleAction('withdraw')} className="btn btn-danger w-full"><Trash2 size={16} className="mr-2" /> Withdraw</button>
              )}
              <Link to="/procurement/po/po-list" className="btn btn-secondary w-full">Back to List</Link>
            </div>
          </div>
        </div>
      </div>
      {showPoPrintPreview && poForPrint && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-lg shadow-xl w-full max-w-5xl max-h-[90vh] flex flex-col">
            <div className="p-4 border-b border-border flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-fg">Purchase order — supplier copy</h2>
                <p className="text-sm text-muted">
                  Review the PO format below. No email is sent to the supplier; print or save from your browser.
                </p>
              </div>
              <button
                type="button"
                className="text-muted hover:text-fg text-2xl leading-none"
                onClick={() => setShowPoPrintPreview(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-muted/30">
              <div className="bg-white mx-auto shadow-sm max-w-[900px]">
                <POPrint
                  ref={printRef}
                  po={poForPrint}
                  getSiteName={getSiteName}
                  getCircleName={getCircleName}
                  getClusterName={getClusterName}
                  formatDate={formatDate}
                />
              </div>
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => setShowPoPrintPreview(false)}>
                Close
              </button>
              <button type="button" className="btn btn-primary" onClick={() => handlePrintPo()}>
                <Printer size={16} className="mr-2" />
                Print
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showReject && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-card rounded shadow-lg w-full max-w-md">
            <div className="p-4 border-b border-border font-semibold">Reject Approval</div>
            <div className="p-4 space-y-2">
              <label className="form-label">Reason</label>
              <textarea className="textarea" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="Provide reason for rejection" />
            </div>
            <div className="p-4 border-t border-border flex justify-end gap-2">
              <button className="btn btn-secondary" onClick={() => setShowReject(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleRejectTask} disabled={taskActionLoading || !rejectReason.trim()}>
                {taskActionLoading ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PurchaseOrderDetailsPage;


