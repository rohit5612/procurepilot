import React from 'react';
import {
  FileText,
  Clock,
  CheckCircle,
  XCircle,
  IndianRupee,
  TrendingUp,
  Users,
  Building
} from 'lucide-react';

const RequisitionStats = ({ stats }) => {
  const statCards = [
    {
      title: 'Total Requisitions',
      value: stats.total_requisitions || 0,
      icon: FileText,
      color: 'text-primary',
      bgColor: 'bg-primary',
      iconBg: 'bg-accent'
    },
    {
      title: 'Draft',
      value: stats.draft_count || 0,
      icon: FileText,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      iconBg: 'bg-muted'
    },
    {
      title: 'Submitted',
      value: stats.submitted_count || 0,
      icon: Clock,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent',
      iconBg: 'bg-accent'
    },
    {
      title: 'Pending Approval',
      value: stats.pending_approval_count || 0,
      icon: Clock,
      color: 'text-accent-foreground',
      bgColor: 'bg-accent',
      iconBg: 'bg-accent'
    },
    {
      title: 'Approved',
      value: stats.approved_count || 0,
      icon: CheckCircle,
      color: 'text-success',
      bgColor: 'bg-success',
      iconBg: 'bg-success'
    },
    {
      title: 'Rejected',
      value: stats.rejected_count || 0,
      icon: XCircle,
      color: 'text-danger',
      bgColor: 'bg-danger',
      iconBg: 'bg-danger'
    },
    {
      title: 'Cancelled',
      value: stats.cancelled_count || 0,
      icon: XCircle,
      color: 'text-muted-foreground',
      bgColor: 'bg-muted',
      iconBg: 'bg-muted'
    },
    {
      title: 'Total Amount',
      value: new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR'
      }).format(stats.total_amount || 0),
      icon: IndianRupee,
      color: 'text-primary',
      bgColor: 'bg-primary',
      iconBg: 'bg-accent'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat, index) => {
        const IconComponent = stat.icon;
        return (
          <div key={index} className="card">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted mb-1">{stat.title}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-lg ${stat.iconBg}`}>
                  <IconComponent
                    size={24}
                    className={stat.color}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RequisitionStats;

