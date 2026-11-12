import React, { useEffect, useState } from 'react';
import { systemAPI } from '../../utils/api';

// Generic tasks panel for an entity. Assumes backend workflow APIs exist (already in systemAPI in this project).
// Props: { entityType: string, entityId: number|string }
const WorkflowTasksPanel = ({ entityType, entityId, afterApprove }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tasks, setTasks] = useState([]);

  const load = async () => {
    try {
      if (!entityId) return;
      setLoading(true); setError(null);
      // Reuse system workflow tasks endpoint with filters
      const res = await systemAPI.getWorkflowTasks(`?entity_type=${encodeURIComponent(entityType)}&entity_id=${encodeURIComponent(entityId)}&status=pending`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load tasks');
      setTasks(data.data || []);
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [entityType, entityId]);

  const complete = async (taskId, action, comment = '') => {
    try {
      setLoading(true);
      const res = await systemAPI.completeWorkflowTask(taskId, { action, comment });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to complete task');
      // If approved, optionally run afterApprove callback (e.g., post the document)
      if (action === 'approve' && typeof afterApprove === 'function') {
        try { await afterApprove(); } catch (_) {}
      }
      await load();
    } catch (e) { setError(e.message); } finally { setLoading(false); }
  };

  return (
    <div className="card">
      <div className="card-header font-semibold">Approval Tasks</div>
      <div className="card-body">
        {loading && <div className="text-muted">Loading…</div>}
        {error && <div className="alert alert-danger">{error}</div>}
        {!loading && tasks.length === 0 && (
          <div className="text-muted">No pending tasks.</div>
        )}
        {!loading && tasks.length > 0 && (
          <div className="space-y-3">
            {tasks.map(t => (
              <div key={t.id} className="flex items-center justify-between p-3 border border-default rounded">
                <div>
                  <div className="font-medium text-fg">{t.name || t.task_name || `Task #${t.id}`}</div>
                  <div className="text-sm text-muted">{t.description || t.status}</div>
                </div>
                <div className="flex gap-2">
                  <button className="btn btn-secondary" onClick={() => complete(t.id, 'approve')}>Approve</button>
                  <button className="btn btn-secondary" onClick={() => complete(t.id, 'reject')}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowTasksPanel;


