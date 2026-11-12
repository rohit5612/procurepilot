import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  RefreshCw, 
  X,
  Building,
  Calendar,
  User,
  Radio
} from 'lucide-react';
import { userManagementAPI, circleAPI, clusterAPI } from '../../utils/api';

const RequisitionFilters = ({ filters, onFilterChange, onRefresh }) => {
  const [departments, setDepartments] = useState([]);
  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchDepartments();
    fetchCircles();
    fetchClusters();
  }, []);

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

  const fetchCircles = async () => {
    try {
      const response = await circleAPI.getAll();
      const data = await response.json();
      setCircles(data.data || []);
    } catch (err) {
      console.error('Failed to fetch circles:', err);
    }
  };

  const fetchClusters = async () => {
    try {
      const response = await clusterAPI.getAll();
      const data = await response.json();
      setClusters(data.data || []);
    } catch (err) {
      console.error('Failed to fetch clusters:', err);
    }
  };

  const handleClearFilters = () => {
    onFilterChange({
      page: 1,
      limit: 10,
      status: '',
      search: '',
      department_id: '',
      circle_id: '',
      cluster_id: ''
    });
  };

  const hasActiveFilters = filters.status || filters.search || filters.department_id || filters.circle_id || filters.cluster_id;

  return (
    <div className="card">
      <div className="card-header">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={20} />
            <h3 className="text-lg font-semibold">Filters</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary"
            >
              {showFilters ? <X size={16} /> : <Filter size={16} />}
              {showFilters ? 'Hide' : 'Show'} Filters
            </button>
            <button
              onClick={onRefresh}
              className="btn btn-secondary"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="card-body">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div className="form-group">
              <label className="form-label">Search</label>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  placeholder="Search requisitions..."
                  value={filters.search}
                  onChange={(e) => onFilterChange({ search: e.target.value })}
                  className="input pl-10"
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="form-group">
              <label className="form-label">Status</label>
              <select
                value={filters.status}
                onChange={(e) => onFilterChange({ status: e.target.value })}
                className="input"
              >
                <option value="">All Status</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            {/* Department Filter */}
            <div className="form-group">
              <label className="form-label">
                <Building size={16} className="inline mr-1" />
                Department
              </label>
              <select
                value={filters.department_id}
                onChange={(e) => onFilterChange({ department_id: e.target.value })}
                className="input"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Circle Filter */}
            <div className="form-group">
              <label className="form-label">
                <Radio size={16} className="inline mr-1" />
                Telecom Circle
              </label>
              <select
                value={filters.circle_id || ''}
                onChange={(e) => onFilterChange({ circle_id: e.target.value, cluster_id: '' })}
                className="input"
              >
                <option value="">All Circles</option>
                {circles.map((circle) => (
                  <option key={circle.id} value={circle.id}>
                    {circle.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Cluster Filter */}
            <div className="form-group">
              <label className="form-label">
                <Radio size={16} className="inline mr-1" />
                Cluster
              </label>
              <select
                value={filters.cluster_id || ''}
                onChange={(e) => onFilterChange({ cluster_id: e.target.value })}
                className="input"
                disabled={!filters.circle_id}
              >
                <option value="">All Clusters</option>
                {clusters
                  .filter(cluster => !filters.circle_id || cluster.circle_id === parseInt(filters.circle_id))
                  .map((cluster) => (
                    <option key={cluster.id} value={cluster.id}>
                      {cluster.name}
                    </option>
                  ))}
              </select>
            </div>

            {/* Items per page */}
            <div className="form-group">
              <label className="form-label">Items per page</label>
              <select
                value={filters.limit}
                onChange={(e) => onFilterChange({ limit: parseInt(e.target.value) })}
                className="input"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Clear Filters */}
          {hasActiveFilters && (
            <div className="flex justify-end mt-4">
              <button
                onClick={handleClearFilters}
                className="btn btn-secondary"
              >
                <X size={16} className="mr-2" />
                Clear All Filters
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RequisitionFilters;

