import React, { useEffect, useState } from 'react';
import { systemAPI } from '../../utils/api';

const WorkflowStatusCard = ({ instanceId, title = 'Workflow Status' }) => {
  const [instance, setInstance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      if (!instanceId) return;
      try {
        setLoading(true);
        setError(null);
        const res = await systemAPI.getWorkflowInstance(instanceId);
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to fetch workflow instance');
        setInstance(data.data || data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [instanceId]);

  const formatDate = (d) => (d ? new Date(d).toLocaleString() : '-');

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <div className="card-body">
        {!instanceId ? (
          <div className="text-sm text-muted">No workflow instance yet.</div>
        ) : loading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
          </div>
        ) : error ? (
          <div className="text-danger text-sm">{error}</div>
        ) : instance ? (
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted">Workflow ID:</span>
              <span className="font-mono text-sm">{instance.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted">Current Status:</span>
              <span
                className={`px-2 py-1 text-xs font-medium rounded-full ${
                  instance.state === 'active'
                    ? 'bg-blue-100 text-blue-800'
                    : instance.state === 'completed'
                    ? 'bg-green-100 text-green-800'
                    : instance.state === 'cancelled'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {instance.state}
              </span>
            </div>
            {instance.current_node_id && (
              <div className="flex justify-between">
                <span className="text-muted">Current Step:</span>
                <span className="text-sm">{instance.current_node_id}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted">Created:</span>
              <span className="text-sm">{formatDate(instance.created_at)}</span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted">Workflow information not available</div>
        )}
      </div>
    </div>
  );
};

export default WorkflowStatusCard;


