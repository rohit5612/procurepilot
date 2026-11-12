import { useState, useEffect } from 'react';
import { clusterAPI } from '../../utils/api';

/**
 * Reusable Cluster Selector Component
 * 
 * @param {object} props
 * @param {number|null} props.value - Selected cluster ID
 * @param {function} props.onChange - Callback when selection changes
 * @param {number|null} props.circleId - Filter by circle ID (optional)
 * @param {boolean} props.required - Whether field is required
 * @param {boolean} props.disabled - Whether field is disabled
 * @param {string} props.className - Additional CSS classes
 */
const ClusterSelector = ({ 
  value, 
  onChange, 
  circleId = null,
  required = false, 
  disabled = false,
  className = ''
}) => {
  const [clusters, setClusters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (circleId) {
      fetchClusters();
    } else {
      setClusters([]);
      setLoading(false);
    }
  }, [circleId]);

  const fetchClusters = async () => {
    try {
      setLoading(true);
      const response = circleId 
        ? await clusterAPI.getByCircle(circleId)
        : await clusterAPI.getAll();
      const data = await response.json();
      
      if (data.success) {
        setClusters(data.data || []);
      } else {
        setError('Failed to load clusters');
      }
    } catch (err) {
      console.error('Error fetching clusters:', err);
      setError('Error loading clusters');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const newValue = e.target.value ? parseInt(e.target.value) : null;
    onChange(newValue);
  };

  if (loading) {
    return (
      <select className={`border border-default rounded-md px-3 py-2 ${className}`} disabled>
        <option>Loading clusters...</option>
      </select>
    );
  }

  if (error) {
    return (
      <select className={`border border-default rounded-md px-3 py-2 ${className}`} disabled>
        <option>{error}</option>
      </select>
    );
  }

  if (!circleId) {
    return (
      <select className={`border border-default rounded-md px-3 py-2 ${className}`} disabled>
        <option>Select a circle first</option>
      </select>
    );
  }

  return (
    <select
      className={`border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
      value={value || ''}
      onChange={handleChange}
      required={required}
      disabled={disabled}
    >
      <option value="">Select Cluster</option>
      {clusters.map((cluster) => (
        <option key={cluster.id} value={cluster.id}>
          {cluster.code} - {cluster.name}
        </option>
      ))}
    </select>
  );
};

export default ClusterSelector;

