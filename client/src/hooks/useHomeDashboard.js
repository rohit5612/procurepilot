import { useCallback, useEffect, useState } from 'react';
import { goodsReceiptAPI, procurementAnalyticsAPI, purchaseOrderAPI, requisitionAPI } from '../utils/api';
import {
  fetchPurchaseOrderApprovalTasks,
  fetchRequisitionApprovalTasks
} from '../utils/procurementApproval';
import { mergeActivityRows, mapApprovalTaskToRow } from '../utils/dashboardActivity';

const emptyStats = {
  total_requisitions: 0,
  draft_count: 0,
  pending_approval_count: 0,
  approved_count: 0,
  rejected_count: 0,
  cancelled_count: 0,
  total_amount: 0
};

const PR_FETCH_LIMIT = 500;
const PO_PAGE_SIZE = 100;
const PO_MAX_PAGES = 5;

async function readJson(res) {
  if (!res?.ok) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

async function fetchPurchaseOrders() {
  const first = await readJson(
    await purchaseOrderAPI.getPOs(new URLSearchParams({ page: '1', limit: String(PO_PAGE_SIZE) }).toString())
  );
  if (!first) return [];
  const items = [...(first.data || [])];
  const totalPages = Math.min(PO_MAX_PAGES, Number(first.pagination?.totalPages) || 1);
  if (totalPages > 1) {
    const rest = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        purchaseOrderAPI
          .getPOs(new URLSearchParams({ page: String(i + 2), limit: String(PO_PAGE_SIZE) }).toString())
          .then(readJson)
      )
    );
    rest.forEach((page) => items.push(...(page?.data || [])));
  }
  return items;
}

export function useHomeDashboard(
  user,
  { enabled = true, canViewPo = false, canViewGrn = false, canApprovePr = false, canApprovePo = false, analyticsFrom } = {}
) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [stats, setStats] = useState(emptyStats);
  const [requisitions, setRequisitions] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [activityRows, setActivityRows] = useState([]);
  const [approvalRows, setApprovalRows] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [analytics, setAnalytics] = useState({ loading: false, topSuppliers: [], clusters: [] });

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [statsRes, prRes, poList, grnList, prApprovals, poApprovals] = await Promise.all([
        requisitionAPI.getRequisitionStats(),
        requisitionAPI.getRequisitions(new URLSearchParams({ page: '1', limit: String(PR_FETCH_LIMIT) }).toString()),
        canViewPo ? fetchPurchaseOrders() : Promise.resolve([]),
        canViewGrn
          ? goodsReceiptAPI
              .getGRNs(new URLSearchParams({ page: '1', limit: '80' }).toString())
              .then(readJson)
              .then((j) => j?.data || [])
          : Promise.resolve([]),
        canApprovePr ? fetchRequisitionApprovalTasks(user) : Promise.resolve([]),
        canApprovePo ? fetchPurchaseOrderApprovalTasks(user) : Promise.resolve([])
      ]);

      const statsJson = await readJson(statsRes);
      setStats({ ...emptyStats, ...(statsJson?.data || {}) });

      const prJson = await readJson(prRes);
      const prList = prJson?.data?.requisitions || [];

      setRequisitions(prList);
      setPurchaseOrders(poList);
      setActivityRows(mergeActivityRows(prList, poList, grnList, 60));

      const approval = [];
      if (Array.isArray(prApprovals)) approval.push(...prApprovals.map(mapApprovalTaskToRow));
      if (Array.isArray(poApprovals)) approval.push(...poApprovals.map(mapApprovalTaskToRow));
      setApprovalRows(approval);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message || 'Failed to load dashboard');
      console.error('Home dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  }, [enabled, user, canViewPo, canViewGrn, canApprovePr, canApprovePo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!enabled || !canViewPo) return undefined;
    let cancelled = false;
    const params = analyticsFrom ? { from: analyticsFrom } : {};

    setAnalytics((prev) => ({ ...prev, loading: true }));
    Promise.all([
      procurementAnalyticsAPI.getTopSuppliers({ ...params, limit: 8 }).then(readJson),
      procurementAnalyticsAPI.getDepartmentBreakdown(params).then(readJson)
    ])
      .then(([suppliers, clusters]) => {
        if (cancelled) return;
        setAnalytics({
          loading: false,
          topSuppliers: suppliers?.data?.series || [],
          clusters: clusters?.data?.series || []
        });
      })
      .catch((e) => {
        console.error('Dashboard analytics error:', e);
        if (!cancelled) setAnalytics({ loading: false, topSuppliers: [], clusters: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, canViewPo, analyticsFrom, lastUpdated]);

  return {
    loading,
    error,
    stats,
    requisitions,
    purchaseOrders,
    activityRows,
    approvalRows,
    analytics,
    lastUpdated,
    poPendingCount: purchaseOrders.filter((po) => po.status === 'pending_approval').length,
    refresh: load
  };
}
