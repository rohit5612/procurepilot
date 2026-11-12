import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, RefreshCw, Shield, Loader2 } from 'lucide-react';
import PageToolbar from '../../components/layout/PageToolbar';
import ConfirmDialog from '../../components/common/ConfirmDialog';
import PolicyOverviewTable from '../../components/procurepilot/PolicyOverviewTable';
import PolicyEditModal from '../../components/procurepilot/PolicyEditModal';
import PolicySimulatorModal from '../../components/procurepilot/PolicySimulatorModal';
import PolicySpendAuditPanel from '../../components/procurepilot/PolicySpendAuditPanel';
import { ROLE_LEVELS } from '../../utils/procurePilotAccess';
import {
  draftToSavePayload,
  isDraftDirty,
  rolePolicyToDraft,
  summarizePolicyChanges
} from '../../utils/procurePilotPolicyForm';
import {
  loadPolicyAdminData,
  saveRolePolicy,
  PolicyApiError
} from '../../services/procurePilotPolicyService';

/**
 * @typedef {import('../../types/procurePilotPolicy').PolicyFormDraft} PolicyFormDraft
 * @typedef {import('../../types/procurePilotPolicy').PolicyCatalogData} PolicyCatalogData
 * @typedef {import('../../types/procurePilotPolicy').RolePolicyRecord} RolePolicyRecord
 */

export default function PolicyAdminPage() {
  const [catalog, setCatalog] = useState/** @type {PolicyCatalogData} */ ({ categories: [] });
  const [rows, setRows] = useState/** @type {RolePolicyRecord[]} */ ([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState/** @type {{ type: 'success' | 'error'; message: string } | null} */ (null);

  const [editLevel, setEditLevel] = useState/** @type {number | null} */ (null);
  const [editBaseline, setEditBaseline] = useState/** @type {PolicyFormDraft | null} */ (null);
  const [pendingSaveDraft, setPendingSaveDraft] = useState/** @type {PolicyFormDraft | null} */ (null);
  const [saving, setSaving] = useState(false);

  const [simulatorOpen, setSimulatorOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  const categoryLabel = useCallback(
    (id) => catalog.categories?.find((c) => c.id === id)?.label || id,
    [catalog.categories]
  );

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError('');
    try {
      const data = await loadPolicyAdminData();
      setCatalog(data.catalog);
      setRows(data.rolePolicies);
    } catch (e) {
      setError(e instanceof PolicyApiError ? e.message : e.message || 'Failed to load policies');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const openEdit = (level) => {
    const row = rows.find((r) => Number(r.role_level) === level);
    const draft = rolePolicyToDraft(row);
    setEditLevel(level);
    setEditBaseline(draft);
    setPendingSaveDraft(null);
  };

  const closeEdit = () => {
    setEditLevel(null);
    setEditBaseline(null);
    setPendingSaveDraft(null);
  };

  /** @param {PolicyFormDraft} currentDraft */
  const handleAttemptClose = (currentDraft) => {
    if (editBaseline && isDraftDirty(editBaseline, currentDraft)) {
      setDiscardConfirmOpen(true);
      return;
    }
    closeEdit();
  };

  /** @param {PolicyFormDraft} draft */
  const handleRequestSave = (draft) => {
    setPendingSaveDraft(draft);
    setSaveConfirmOpen(true);
  };

  const confirmSave = async () => {
    if (editLevel == null || !pendingSaveDraft) return;
    setSaving(true);
    try {
      const payload = draftToSavePayload(pendingSaveDraft);
      await saveRolePolicy(editLevel, payload);
      setSaveConfirmOpen(false);
      setToast({ type: 'success', message: `Policy updated for L${editLevel}` });
      closeEdit();
      await load(true);
    } catch (e) {
      setToast({
        type: 'error',
        message: e instanceof PolicyApiError ? e.message : e.message || 'Save failed'
      });
    } finally {
      setSaving(false);
    }
  };

  const confirmDiscard = () => {
    setDiscardConfirmOpen(false);
    closeEdit();
  };

  const editMeta = ROLE_LEVELS.find((l) => l.level === editLevel);
  const editRow = rows.find((r) => Number(r.role_level) === editLevel);
  const editInitialDraft = editRow ? rolePolicyToDraft(editRow) : null;

  const saveSummary =
    editBaseline && pendingSaveDraft
      ? summarizePolicyChanges(editBaseline, pendingSaveDraft, categoryLabel)
      : [];

  return (
    <div className="max-w-6xl space-y-6">
      <PageToolbar description="Configure spend caps, procurement segments, and approval thresholds by role level.">
        <button
          type="button"
          className="btn btn-secondary btn-sm inline-flex items-center gap-2"
          onClick={() => load(true)}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          type="button"
          className="btn btn-primary btn-sm inline-flex items-center gap-2"
          onClick={() => setSimulatorOpen(true)}
        >
          <FlaskConical className="h-4 w-4" />
          Policy simulator
        </button>
      </PageToolbar>

      <div className="page-panel p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none" />
        <div className="relative flex gap-4">
          <div className="h-12 w-12 rounded-xl bg-secondary flex items-center justify-center shrink-0">
            <Shield className="h-6 w-6 text-secondary-foreground" />
          </div>
          <div className="space-y-2 max-w-2xl">
            <h2 className="text-lg font-semibold text-fg">Policy & budgets</h2>
            <p className="text-sm text-muted leading-relaxed">
              Enterprise spend controls tied to RBAC levels L1–L5. The policy engine runs on the server for every offer
              comparison — AI explains outcomes but cannot override caps, segments, or deadlines.
            </p>
            <ul className="text-xs text-muted grid sm:grid-cols-3 gap-2 pt-1">
              <li className="page-panel px-3 py-2 border-dashed">Deterministic evaluation</li>
              <li className="page-panel px-3 py-2 border-dashed">Audit on save</li>
              <li className="page-panel px-3 py-2 border-dashed">Monthly ledger ready</li>
            </ul>
          </div>
        </div>
      </div>

      {toast ? (
        <div
          role="status"
          className={`page-panel px-4 py-3 text-sm flex justify-between items-center ${
            toast.type === 'success'
              ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
              : 'border-red-200 bg-red-50/60 text-red-800'
          }`}
        >
          <span>{toast.message}</span>
          <button type="button" className="text-xs underline" onClick={() => setToast(null)}>
            Dismiss
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="page-panel p-4 text-sm text-destructive border-destructive/30" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="card p-12 flex items-center justify-center text-muted gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading policy matrix…
        </div>
      ) : (
        <PolicyOverviewTable rows={rows} onEdit={openEdit} />
      )}

      <PolicySpendAuditPanel />

      {editLevel != null && editInitialDraft && editMeta ? (
        <PolicyEditModal
          open={editLevel != null}
          roleLevel={editLevel}
          roleLabel={editMeta.label}
          roleHint={editMeta.hint}
          initialDraft={editInitialDraft}
          categories={catalog.categories || []}
          saving={saving}
          onAttemptClose={handleAttemptClose}
          onRequestSave={handleRequestSave}
        />
      ) : null}

      <PolicySimulatorModal
        open={simulatorOpen}
        categories={catalog.categories || []}
        onClose={() => setSimulatorOpen(false)}
      />

      <ConfirmDialog
        open={discardConfirmOpen}
        title="Discard unsaved changes?"
        description="Your edits to this role policy have not been saved."
        confirmLabel="Discard"
        cancelLabel="Keep editing"
        variant="danger"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardConfirmOpen(false)}
      />

      <ConfirmDialog
        open={saveConfirmOpen}
        title={`Apply policy for L${editLevel}?`}
        description="These limits will apply immediately to all users at this role level (user overrides still take precedence)."
        confirmLabel="Save policy"
        cancelLabel="Back"
        variant="primary"
        loading={saving}
        onConfirm={confirmSave}
        onCancel={() => {
          if (!saving) setSaveConfirmOpen(false);
        }}
      >
        {saveSummary.length ? (
          <ul className="list-disc pl-5 space-y-1 text-muted">
            {saveSummary.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : (
          <p className="text-muted">No field changes detected.</p>
        )}
      </ConfirmDialog>
    </div>
  );
}
