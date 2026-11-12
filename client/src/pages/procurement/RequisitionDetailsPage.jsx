import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import {
  ArrowLeft,
  Edit,
  Trash2,
  Send,
  CheckCircle,
  XCircle,
  Calendar,
  User,
  Building,
  IndianRupee,
  FileText,
  AlertTriangle,
  Package,
  Clock,
  Radio,
  ShoppingCart,
  Paperclip
} from 'lucide-react';
import { requisitionAPI, rfqAPI, userManagementAPI, inventoryAPI, systemAPI, circleAPI, clusterAPI } from '../../utils/api';
import { approveRequisitionTask, rejectRequisitionTask } from '../../utils/procurementApproval';
import { useReactToPrint } from 'react-to-print';
import { getPRPrintComponent } from '../../clients/printRegistry';
import WorkflowTimeline from '../../components/system/WorkflowTimeline';
import { useToastContext } from '../../contexts/ToastContext.jsx';
import { useDialog } from '../../contexts/DialogContext.jsx';
import { formatDate } from '../../utils/date';

const RequisitionDetailsPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const location = useLocation();
  const [requisition, setRequisition] = useState(null);
  const { add } = useToastContext() || { add: () => {} };
  const { open } = useDialog() || { open: () => {} };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [sites, setSites] = useState([]);
  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [workflowInstance, setWorkflowInstance] = useState(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadSuccess, setUploadSuccess] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState('');
  const [pendingTasks, setPendingTasks] = useState([]);
  const [taskActionLoading, setTaskActionLoading] = useState(false);
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const printRef = useRef(null);
  const PRPrint = getPRPrintComponent();
  const handlePrint = useReactToPrint({ contentRef: printRef });

  const getCookie = (name) => {
    if (typeof document === 'undefined') return null;
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  };

  const fetchPendingTasks = async (workflowId = requisition?.workflow_instance_id) => {
    try {
      if (!workflowId) { setPendingTasks([]); return; }
      const params = new URLSearchParams({ entity_type: 'requisition', status: 'pending' }).toString();
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

  const viewAttachment = async () => {
    try {
      const token = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('accessToken'))
        || localStorage.getItem('accessToken')
        || getCookie('accessToken');
      const url = requisitionAPI.getAttachmentUrl(requisition.id);
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) {
        throw new Error('Failed to load attachment');
      }
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    } catch (e) {
      setUploadError(e.message || 'Unable to view attachment');
    }
  };

  useEffect(() => {
    fetchRequisition();
    fetchDepartments();
    fetchSites();
    fetchCircles();
    fetchClusters();
  }, [id]);

  useEffect(() => {
    fetchPendingTasks();
  }, [requisition?.workflow_instance_id]);

  const canApprovePr =
    user?.isSuperuser ||
    (Number(user?.roleLevel) <= 1) ||
    hasPermission('procurement.purchase_requisition.approve');

  const handleApproveTask = async () => {
    try {
      setTaskActionLoading(true);
      const task = pendingTasks[0];
      if (task) {
        await approveRequisitionTask({ ...task, _source: 'workflow' }, 'Approved via PR details');
        setPendingTasks([]);
        await fetchPendingTasks(task.instance_id);
      } else if (requisition?.status === 'pending_approval') {
        await approveRequisitionTask({ _source: 'direct', entity_id: Number(id) }, 'Approved via PR details');
      } else {
        return;
      }
      await fetchRequisition();
      const ref = requisition?.requisition_number || id;
      add('Requisition approved', 'success');
      open('Approved', `PR #${ref} approved successfully.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setTaskActionLoading(false);
    }
  };

  const handleRejectTask = async () => {
    try {
      if (!rejectReason.trim()) {
        setError('Rejection reason is required');
        return;
      }
      setTaskActionLoading(true);
      const task = pendingTasks[0];
      if (task) {
        await rejectRequisitionTask({ ...task, _source: 'workflow' }, rejectReason.trim());
        setPendingTasks([]);
        await fetchPendingTasks(task.instance_id);
      } else if (requisition?.status === 'pending_approval') {
        await rejectRequisitionTask({ _source: 'direct', entity_id: Number(id) }, rejectReason.trim());
      } else {
        return;
      }
      setShowReject(false);
      setRejectReason('');
      await fetchRequisition();
      const ref = requisition?.requisition_number || id;
      add('Requisition rejected', 'error');
      open('Rejected', `PR #${ref} rejected.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setTaskActionLoading(false);
    }
  };

  useEffect(() => {
    if (requisition?.workflow_instance_id) {
      fetchWorkflowInstance();
    }
  }, [requisition]);

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
      setRequisition(data.data);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching requisition:', err);
    } finally {
      setLoading(false);
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

  const fetchCircles = async () => {
    try {
      const response = await circleAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setCircles(data.data || []);
      } else {
        console.error('Failed to fetch circles, status:', response.status);
        setCircles([]);
      }
    } catch (err) {
      console.error('Failed to fetch circles:', err);
      setCircles([]);
    }
  };

  const fetchClusters = async () => {
    try {
      const response = await clusterAPI.getAll();
      if (response.ok) {
        const data = await response.json();
        setClusters(data.data || []);
      } else {
        console.error('Failed to fetch clusters, status:', response.status);
        setClusters([]);
      }
    } catch (err) {
      console.error('Failed to fetch clusters:', err);
      setClusters([]);
    }
  };

  const fetchWorkflowInstance = async () => {
    try {
      setWorkflowLoading(true);
      if (requisition?.id) {
        const resp = await systemAPI.getWorkflowForEntity('requisition', requisition.id);
        const json = await resp.json().catch(()=>({}));
        if (resp.ok && json?.data) { setWorkflowInstance(json.data); return; }
      }
      if (requisition?.workflow_instance_id) {
        const response = await systemAPI.getWorkflowInstance(requisition.workflow_instance_id);
        if (response.ok) {
          const data = await response.json();
          const instance = data.instance || data.data || data;
          setWorkflowInstance(instance);
        }
      }
    } catch (err) {
      console.error('Failed to fetch workflow instance:', err);
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleAction = async (action, requisitionId, data = {}) => {
    try {
      let response;

      switch (action) {
        case 'submit':
          response = await requisitionAPI.submitRequisition(requisitionId);
          break;
        case 'approve':
          response = await requisitionAPI.approveRequisition(requisitionId, data);
          break;
        case 'reject':
          response = await requisitionAPI.rejectRequisition(requisitionId, data);
          break;
        case 'withdraw':
          response = await requisitionAPI.withdrawRequisition(requisitionId);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Action failed');
      }

      // Refresh requisition data
      await fetchRequisition();
      const ref = requisition?.requisition_number || requisitionId;
      if (action === 'submit') { add('Requisition submitted', 'success'); open('Submitted', `PR #${ref} submitted successfully.`); }
      if (action === 'approve') { add('Requisition approved', 'success'); open('Approved', `PR #${ref} approved successfully.`); }
      if (action === 'reject') { add('Requisition rejected', 'error'); open('Rejected', `PR #${ref} rejected.`); }
      if (action === 'withdraw') { add('Requisition withdrawn', 'success'); open('Withdrawn', `PR #${ref} withdrawn.`); }
    } catch (err) {
      setError(err.message);
      console.error(`Error performing ${action}:`, err);
    }
  };

  const handleAttachmentUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Only PDF files are allowed');
      return;
    }
    try {
      setUploading(true);
      setUploadError(null);
      setUploadSuccess(null);
      setSelectedFileName(file.name);
      const res = await requisitionAPI.uploadAttachment(id, file);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Upload failed');
      }
      await fetchRequisition();
      setUploadSuccess('Attachment uploaded successfully');
      setTimeout(() => setUploadSuccess(null), 3000);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount || 0);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { color: 'bg-gray-100 text-gray-800', label: 'Draft' },
      submitted: { color: 'bg-blue-100 text-blue-800', label: 'Submitted' },
      pending_approval: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending Approval' },
      approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
      rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
      cancelled: { color: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
      withdrawn: { color: 'bg-gray-100 text-gray-800', label: 'Withdrawn' }
    };

    const config = statusConfig[status] || statusConfig.draft;
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getDepartmentName = (deptId) => {
    const dept = departments.find(d => d.id === deptId);
    return dept ? dept.name : 'N/A';
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
    if (!circleId) return '-';
    const circle = circles.find(c => c.id === circleId);
    if (circle) return circle.name;
    // If circles array is empty, it's still loading
    return circles.length === 0 ? 'Loading...' : `Circle #${circleId}`;
  };

  const getClusterName = (clusterId) => {
    if (!clusterId) return '-';
    const cluster = clusters.find(c => c.id === clusterId);
    if (cluster) return cluster.name;
    // If clusters array is empty, it's still loading
    return clusters.length === 0 ? 'Loading...' : `Cluster #${clusterId}`;
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

  if (error) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body">
            <div className="flex items-center gap-2 text-danger mb-4">
              <AlertTriangle size={20} />
              <h2 className="text-lg font-semibold">Error Loading Requisition</h2>
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
                onClick={fetchRequisition}
                className="btn btn-primary"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!requisition) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="card-body text-center py-12">
            <FileText size={48} className="text-muted mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-fg mb-2">Requisition Not Found</h3>
            <p className="text-muted mb-6">The requested requisition could not be found.</p>
            <Link
              to="/procurement/pr/requisition-list"
              className="btn btn-primary"
            >
              Back to Requisitions
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const fromApprovals = location.state && location.state.from === 'approvals';
              if (fromApprovals) {
                navigate('/procurement/pr/approval-tasks');
              } else {
                navigate('/procurement/pr/requisition-list');
              }
            }}
            className="btn btn-secondary btn-sm"
          >
            <ArrowLeft size={16} className="mr-2" />
            {location.state && location.state.from === 'approvals' ? 'Back to Approvals' : 'Back to List'}
          </button>
          <div>
            <h1 className="text-2xl font-bold text-fg">Requisition Details</h1>
            <p className="text-muted">#{requisition.requisition_number}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePrint} className="btn btn-secondary btn-sm">
            <FileText size={16} className="mr-2" /> Print
          </button>
          {requisition.status === 'draft' && (
            <>
              <Link
                to={`/procurement/pr/requisition-edit/${requisition.id}`}
                className="btn btn-secondary btn-sm"
              >
                <Edit size={16} className="mr-2" />
                Edit
              </Link>
              <button
                onClick={() => handleAction('withdraw', requisition.id)}
                className="btn btn-danger btn-sm"
              >
                <Trash2 size={16} className="mr-2" />
                Withdraw
              </button>
              <button
                onClick={() => handleAction('submit', requisition.id)}
                className="btn btn-success btn-sm"
                title="Submit for approval"
              >
                <Send size={16} className="mr-2" />
                Submit
              </button>
            </>
          )}
          {requisition.status === 'approved' && 
           hasPermission('procurement.purchase_order.create') && 
           (user?.isSuperuser || user?.roleLevel <= 2) && (
            <button
              onClick={() => navigate(`/procurement/po/generate-from-pr/${requisition.id}`, { state: { from: 'pr-details' } })}
              className="btn btn-primary btn-sm"
            >
              <ShoppingCart size={16} className="mr-2" />
              Generate PO
            </button>
          )}
          {requisition.status === 'approved' && hasPermission('procurement.request_quotation.create') && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={async () => {
                try {
                  const res = await rfqAPI.createFromRequisition(requisition.id, { title: requisition.title });
                  const json = await res.json();
                  if (!res.ok) throw new Error(json.message || 'Failed to create RFQ');
                  navigate(`/procurement/rfq/rfq-details/${json.data.id}`);
                } catch (e) {
                  add(e.message, 'error');
                }
              }}
            >
              <FileText size={16} className="mr-2" />
              Create RFQ
            </button>
          )}
          {requisition.status === 'pending_approval' && canApprovePr && (
            <>
              <button
                onClick={handleApproveTask}
                className="btn btn-success btn-sm"
                disabled={taskActionLoading}
              >
                <CheckCircle size={16} className="mr-2" /> Approve
              </button>
              <button
                onClick={() => setShowReject(true)}
                className="btn btn-danger btn-sm"
                disabled={taskActionLoading}
              >
                <XCircle size={16} className="mr-2" /> Reject
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status Banner */}
      <div className="card">
        <div className="card-body">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-semibold">{requisition.title}</h3>
              {getStatusBadge(requisition.status)}
            </div>
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
            {requisition.rejection_reason && (
              <div className="text-danger text-sm">
                <strong>Rejection Reason:</strong> {requisition.rejection_reason}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Offscreen printable area (not display:none) */}
        <div style={{ position: 'absolute', left: '-10000px', top: 0, width: 0, height: 0, overflow: 'hidden' }}>
          <PRPrint
            ref={printRef}
            requisition={requisition}
            getDepartmentName={getDepartmentName}
            getSiteName={getSiteName}
            getCircleName={getCircleName}
            getClusterName={getClusterName}
            formatDate={formatDate}
          />
        </div>
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Information */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Basic Information</h3>
            </div>
            <div className="card-body">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Title</label>
                  <p className="text-fg">{requisition.title}</p>
                </div>
                <div>
                  <label className="form-label">Requisition Number</label>
                  <p className="text-fg">#{requisition.requisition_number}</p>
                </div>
                <div>
                  <label className="form-label">Requester</label>
                  <div className="flex items-center gap-2">
                    <User size={16} className="text-muted" />
                    <span>{requisition.requester_name || 'N/A'}</span>
                  </div>
                </div>
                <div>
                  <label className="form-label">Department</label>
                  <div className="flex items-center gap-2">
                    <Building size={16} className="text-muted" />
                    <span>{getDepartmentName(requisition.department_id)}</span>
                  </div>
                </div>
                <div>
                  <label className="form-label">Site</label>
                  <span>{requisition.site_id ? getSiteDisplay(requisition.site_id) : 'N/A'}</span>
                </div>
                <div>
                  <label className="form-label">Project</label>
                  <span>{requisition.project_id || 'N/A'}</span>
                </div>
                <div>
                  <label className="form-label">
                    <Radio size={16} className="inline mr-1" />
                    Telecom Circle
                  </label>
                  <span>{getCircleName(requisition.circle_id)}</span>
                </div>
                <div>
                  <label className="form-label">
                    <Radio size={16} className="inline mr-1" />
                    Cluster
                  </label>
                  <span>{getClusterName(requisition.cluster_id)}</span>
                </div>
                <div>
                  <label className="form-label">Needed By Date</label>
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-muted" />
                    <span>{formatDate(requisition.needed_by_date)}</span>
                  </div>
                </div>
                <div>
                  <label className="form-label">Created Date</label>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-muted" />
                    <span>{formatDate(requisition.created_at)}</span>
                  </div>
                </div>
              </div>
              {requisition.description && (
                <div className="mt-4">
                  <label className="form-label">Description</label>
                  <p className="text-fg whitespace-pre-wrap">{requisition.description}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Line Items</h3>
            </div>
            <div className="card-body">
              {requisition.lines && requisition.lines.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Item
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Manufacturer
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Quantity
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Unit Price
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Total
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">
                          Needed By
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {requisition.lines.map((line, index) => (
                        <tr key={line.id || index}>
                          <td className="px-4 py-3">
                            <div>
                              <div className="font-medium text-fg">
                                {line.item_name}
                              </div>
                              <div className="text-sm text-muted">
                                {line.item_code && `Code: ${line.item_code}`}
                                {line.brand && ` | Brand: ${line.brand}`}
                                {line.model && ` | Model: ${line.model}`}
                              </div>
                              {line.specifications && (
                                <div className="text-sm text-muted mt-1">
                                  {line.specifications}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-sm font-medium text-fg">
                              {line.manufacturer || '-'}
                            </div>
                            {line.spare_type && (
                              <div className="text-xs text-muted">
                                {line.spare_type}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Package size={16} className="text-muted" />
                              <span>{line.quantity} {line.unit_of_measure}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <IndianRupee size={16} className="text-muted" />
                              <span>{formatCurrency(line.unit_price)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <IndianRupee size={16} className="text-muted" />
                              <span>{formatCurrency(line.total_price)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Calendar size={16} className="text-muted" />
                              <span>{formatDate(line.needed_by_date)}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package size={48} className="text-muted mx-auto mb-4" />
                  <p className="text-muted">No line items found</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Summary */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Summary</h3>
            </div>
            <div className="card-body">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-muted">Total Items:</span>
                  <span className="font-medium">{requisition.total_quantity || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total Amount:</span>
                  <span className="font-medium">{formatCurrency(requisition.total_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Status:</span>
                  <span>{getStatusBadge(requisition.status)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Created:</span>
                  <span className="text-sm">{formatDate(requisition.created_at)}</span>
                </div>
                {requisition.submitted_at && (
                  <div className="flex justify-between">
                    <span className="text-muted">Submitted:</span>
                    <span className="text-sm">{formatDate(requisition.submitted_at)}</span>
                  </div>
                )}
                {requisition.approved_at && (
                  <div className="flex justify-between">
                    <span className="text-muted">Approved:</span>
                    <span className="text-sm">{formatDate(requisition.approved_at)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Email Attachment */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-lg font-semibold">Email Attachment (PDF)</h3>
            </div>
            <div className="card-body space-y-3">
              {uploadError && (
                <div className="text-danger text-sm">{uploadError}</div>
              )}
              <div className="flex items-center gap-3">
                <label className="btn btn-secondary btn-sm cursor-pointer">
                  <Paperclip size={14} className="mr-2" />
                  Choose PDF
                  <input type="file" accept="application/pdf" onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fakeEvt = { target: { files: [file] } };
                    handleAttachmentUpload(fakeEvt);
                  }} disabled={uploading || requisition.status !== 'draft'} className="hidden" />
                </label>
                {selectedFileName && (
                  <span className="text-sm text-muted">{selectedFileName}</span>
                )}
                {uploading && <span className="text-sm text-muted">Uploading...</span>}
              </div>
              {uploadSuccess && (
                <div className="text-sm text-primary">{uploadSuccess}</div>
              )}
              {requisition.email_attachment_path ? (
                <button type="button" onClick={viewAttachment} className="btn btn-secondary btn-sm">View attached email</button>
              ) : (
                <div className="text-sm text-muted">No attachment uploaded yet. PDF is required to submit PR.</div>
              )}
            </div>
          </div>

          {/* Workflow */}
          {(workflowInstance?.computed?.steps?.length || workflowInstance?.history?.length || requisition.submitted_at || requisition.approved_at || requisition.rejected_at) && (
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
                  {requisition.submitted_at && (
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium">Submit for Approval</p>
                        <p className="text-xs text-muted">{new Date(requisition.submitted_at).toLocaleString()}</p>
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
                  {requisition.approved_at && (
                    <div className="flex items-start gap-3 pt-2 border-t border-border">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-green-600">PR Fully Approved</p>
                        <p className="text-xs text-muted">{new Date(requisition.approved_at).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                  {requisition.rejected_at && (
                    <div className="flex items-start gap-3 pt-2 border-t border-border">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium text-red-600">Rejected</p>
                        <p className="text-xs text-muted">{new Date(requisition.rejected_at).toLocaleString()}</p>
                        {requisition.rejection_reason && (
                          <p className="text-xs text-danger mt-1">{requisition.rejection_reason}</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RequisitionDetailsPage;
