import React from 'react';
import { 
  FileText, 
  Send, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Ban,
  HelpCircle
} from 'lucide-react';

const RequisitionStatus = ({ status }) => {
  const getStatusConfig = (status) => {
    switch (status) {
      case 'draft':
        return {
          label: 'Draft',
          badgeClass: 'badge-info',
          icon: FileText,
          iconColor: 'text-muted-foreground'
        };
      case 'submitted':
        return {
          label: 'Submitted',
          badgeClass: 'badge-info',
          icon: Send,
          iconColor: 'text-accent-foreground'
        };
      case 'pending_approval':
        return {
          label: 'Pending Approval',
          badgeClass: 'badge-info',
          icon: Clock,
          iconColor: 'text-accent-foreground'
        };
      case 'approved':
        return {
          label: 'Approved',
          badgeClass: 'badge-success',
          icon: CheckCircle,
          iconColor: 'text-success'
        };
      case 'rejected':
        return {
          label: 'Rejected',
          badgeClass: 'badge-danger',
          icon: XCircle,
          iconColor: 'text-danger'
        };
      case 'withdrawn':
        return {
          label: 'Withdrawn',
          badgeClass: 'badge-secondary',
          icon: Ban,
          iconColor: 'text-muted-foreground'
        };
      case 'cancelled':
        return {
          label: 'Cancelled',
          badgeClass: 'badge-danger',
          icon: Ban,
          iconColor: 'text-muted-foreground'
        };
      default:
        return {
          label: 'Unknown',
          badgeClass: 'badge-info',
          icon: HelpCircle,
          iconColor: 'text-muted-foreground'
        };
    }
  };

  const config = getStatusConfig(status);
  const IconComponent = config.icon;

  return (
    <span className={`badge ${config.badgeClass}`}>
      <IconComponent size={14} className={config.iconColor} />
      {config.label}
    </span>
  );
};

export default RequisitionStatus;

