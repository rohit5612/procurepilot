import React from 'react';

const WorkflowTimeline = ({ data }) => {
  if (!data) return null;
  
  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };
  
  return (
    <div className="space-y-4">
      {/* Submission */}
      {data.submission && (
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 mt-2 rounded-full bg-blue-500"></div>
          <div>
            <p className="text-sm font-medium text-fg">Submitted for Approval</p>
            <p className="text-xs text-muted mt-1">
              Submitted by {data.submission.submitted_by}
            </p>
            <p className="text-xs text-muted">{formatDateTime(data.submission.submitted_at)}</p>
          </div>
        </div>
      )}
      
      {/* Approval Steps */}
      {Array.isArray(data.steps) && data.steps.map((s, idx) => (
        <div key={s.id || idx} className="flex items-start gap-3">
          <div className={`w-2 h-2 mt-2 rounded-full ${
            s.status === 'completed'
              ? (() => {
                  const a = String(s.approvedBy?.action || '').toLowerCase();
                  const isRejected = a === 'reject' || a === 'rejected';
                  return isRejected ? 'bg-red-500' : 'bg-green-500';
                })()
              : s.status === 'current'
                ? 'bg-yellow-500'
                : 'bg-gray-400'
          }`}></div>
          <div>
            {s.status === 'completed' && s.approvedBy ? (
              <>
                <p className={`text-sm font-medium ${(() => { const a = String(s.approvedBy.action || '').toLowerCase(); return (a === 'reject' || a === 'rejected') ? 'text-red-600' : 'text-fg'; })()}`}>
                  {(() => {
                    const a = String(s.approvedBy.action || '').toLowerCase();
                    const isRejected = a === 'reject' || a === 'rejected';
                    return `${isRejected ? 'Rejected by' : 'Approved by'} ${s.approvedBy.role || 'Approver'}`;
                  })()}
                </p>
                <p className="text-xs text-muted mt-1">{s.approvedBy.name}</p>
                <p className="text-xs text-muted">{formatDateTime(s.approvedBy.date)}</p>
                {s.approvedBy.reason && (
                  <p className="text-xs text-danger mt-1">Reason: {s.approvedBy.reason}</p>
                )}
              </>
            ) : s.status === 'current' ? (
              <>
                <p className="text-sm font-medium text-fg">Pending for Approval</p>
                {Array.isArray(s.assignees) && s.assignees.length > 0 && (
                  <p className="text-xs text-muted mt-1">
                    Assigned to: {s.assignees.map(a => `${a.name}${a.role ? `, ${a.role}` : ''}`).join(' • ')}
                  </p>
                )}
              </>
            ) : (
              <>
                <p className="text-sm font-medium text-muted">Pending - {s.name || 'Approval'}</p>
                {Array.isArray(s.assignees) && s.assignees.length > 0 && (
                  <p className="text-xs text-muted mt-1">
                    Will be assigned to: {s.assignees.map(a => `${a.name}${a.role ? `, ${a.role}` : ''}`).join(' • ')}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      ))}
      
      {/* Final Approval */}
      {data.finalApproval && (
        <div className="flex items-start gap-3">
          <div className="w-2 h-2 mt-2 rounded-full bg-green-500"></div>
          <div>
            <p className="text-sm font-medium text-green-600">{data.finalApproval.message}</p>
            <p className="text-xs text-muted">{formatDateTime(data.finalApproval.date)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default WorkflowTimeline;
