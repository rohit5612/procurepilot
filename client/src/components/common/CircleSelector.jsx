import { useState, useEffect } from 'react';
import { circleAPI } from '../../utils/api';

/**
 * Reusable Circle Selector Component
 * 
 * @param {object} props
 * @param {number|null} props.value - Selected circle ID
 * @param {function} props.onChange - Callback when selection changes
 * @param {boolean} props.required - Whether field is required
 * @param {boolean} props.disabled - Whether field is disabled
 * @param {string} props.className - Additional CSS classes
 * @param {string} props.region - Filter by region (optional)
 */
const CircleSelector = ({ 
  value, 
  onChange, 
  required = false, 
  disabled = false,
  className = '',
  region = null
}) => {
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCircles();
  }, [region]);

  const fetchCircles = async () => {
    try {
      setLoading(true);
      const response = await circleAPI.getAll(region ? { region } : {});
      const data = await response.json();
      
      if (data.success) {
        setCircles(data.data || []);
      } else {
        setError('Failed to load circles');
      }
    } catch (err) {
      console.error('Error fetching circles:', err);
      setError('Error loading circles');
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
        <option>Loading circles...</option>
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

  return (
    <select
      className={`border border-default rounded-md px-3 py-2 focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
      value={value || ''}
      onChange={handleChange}
      required={required}
      disabled={disabled}
    >
      <option value="">Select Circle</option>
      {circles.map((circle) => (
        <option key={circle.id} value={circle.id}>
          {circle.code} - {circle.name} ({circle.region})
        </option>
      ))}
    </select>
  );
};

export default CircleSelector;

