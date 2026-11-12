import React, { useState, useEffect } from 'react';
import { X, MapPin, Building2, Globe, Phone, Mail, User, Map } from 'lucide-react';
import { circleAPI, clusterAPI } from '../../utils/api';

const SiteForm = ({ site, onSubmit, onClose }) => {
  const [formData, setFormData] = useState({
    site_code: '',
    name: '',
    description: '',
    site_type: 'OFFICE',
    status: 'ACTIVE',
    circle_id: '',
    cluster_id: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: '',
    contact_person: '',
    email: '',
    phone: '',
    hub_site_status: '',
    aom: '',
    technician_employee_code: '',
    technician_employee_name: '',
    fse_employee_code: '',
    fse_employee_name: '',
    power_type: '',
    dg_make: '',
    dg_rating: '',
    solar_type: '',
    is_default: false
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const [circles, setCircles] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [employees, setEmployees] = useState([]);

  // Initialize form data when editing
  useEffect(() => {
    if (site) {
      setFormData({
        site_code: site.site_code || '',
        name: site.name || '',
        description: site.description || '',
        site_type: site.site_type || 'OFFICE',
        status: site.status || 'ACTIVE',
        circle_id: site.circle_id || '',
        cluster_id: site.cluster_id || '',
        address_line1: site.address_line1 || '',
        address_line2: site.address_line2 || '',
        city: site.city || '',
        state: site.state || '',
        postal_code: site.postal_code || '',
        country: site.country || '',
        contact_person: site.contact_person || '',
        email: site.email || '',
        phone: site.phone || '',
      hub_site_status: site.hub_site_status || '',
      aom: site.aom || '',
        technician_employee_code: site.technician_employee_code || '',
        technician_employee_name: site.technician_employee_name || '',
        fse_employee_code: site.fse_employee_code || '',
        fse_employee_name: site.fse_employee_name || '',
        power_type: site.power_type || '',
        dg_make: site.dg_make || '',
        dg_rating: site.dg_rating || '',
        solar_type: site.solar_type || '',
        is_default: site.is_default || false
      });
    }
  }, [site]);

  // Load circles on mount
  useEffect(() => {
    const loadCircles = async () => {
      try {
        const res = await circleAPI.getAll();
        const data = await res.json();
        setCircles(Array.isArray(data?.data) ? data.data : []);
      } catch (_) { setCircles([]); }
    };
    loadCircles();
  }, []);

  // Load clusters when circle changes
  useEffect(() => {
    const loadClusters = async () => {
      if (!formData.circle_id) { setClusters([]); return; }
      try {
        const res = await clusterAPI.getByCircle(formData.circle_id);
        const data = await res.json();
        setClusters(Array.isArray(data?.data) ? data.data : []);
      } catch (_) { setClusters([]); }
    };
    loadClusters();
  }, [formData.circle_id]);

  // Load employees (for technician / FSE selection)
  useEffect(() => {
    const loadEmployees = async () => {
      try {
        const res = await import('../../utils/api').then(m =>
          m.inventoryAPI.getEmployees('only_technicians=true')
        );
        if (!res.ok) return;
        const js = await res.json();
        setEmployees(Array.isArray(js.data) ? js.data : []);
      } catch (_) {
        setEmployees([]);
      }
    };
    loadEmployees();
  }, []);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Reset dependent field when circle changes
    if (field === 'circle_id') {
      setFormData(prev => ({ ...prev, cluster_id: '' }));
    }

    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: null
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.site_code.trim()) {
      newErrors.site_code = 'Site code is required';
    } else if (formData.site_code.length < 2) {
      newErrors.site_code = 'Site code must be at least 2 characters';
    }

    if (!formData.name.trim()) {
      newErrors.name = 'Site name is required';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      if (site) {
        // Update existing site
        await onSubmit(site.id, formData);
      } else {
        // Create new site
        await onSubmit(formData);
      }
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  const siteTypes = [
    { value: 'OFFICE', label: 'Office' },
    { value: 'INDUS', label: 'Indus' },
    { value: 'OTHER', label: 'Other' }
  ];

  const statusOptions = [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' }
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/20 rounded-xl">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {site ? 'Edit Site' : 'Add New Site'}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {site ? 'Update site information and settings' : 'Create a new company site with complete details'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-muted/50 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Form */}
        <div className="overflow-y-auto max-h-[calc(95vh-120px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-8">
            {/* Basic Information */}
            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Basic Information</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center">
                    Site Code <span className="text-destructive ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.site_code}
                    onChange={(e) => handleInputChange('site_code', e.target.value.toUpperCase())}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                      errors.site_code ? 'border-destructive bg-destructive/5' : 'border-border bg-background'
                    }`}
                    placeholder="e.g., HQ, WH01, FACT01"
                  />
                  {errors.site_code && (
                    <p className="text-sm text-destructive flex items-center mt-1">
                      <span className="w-1 h-1 bg-destructive rounded-full mr-2"></span>
                      {errors.site_code}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center">
                    Site Name <span className="text-destructive ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                      errors.name ? 'border-destructive bg-destructive/5' : 'border-border bg-background'
                    }`}
                    placeholder="e.g., Headquarters, Main Warehouse"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive flex items-center mt-1">
                      <span className="w-1 h-1 bg-destructive rounded-full mr-2"></span>
                      {errors.name}
                    </p>
                  )}
                </div>

                <div className="lg:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-foreground">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                    rows="3"
                    placeholder="Brief description of the site and its purpose"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Site Type</label>
                  <select
                    value={formData.site_type}
                    onChange={(e) => handleInputChange('site_type', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {siteTypes.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    {statusOptions.map(status => (
                      <option key={status.value} value={status.value}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="lg:col-span-2">
                  <div className="flex items-center space-x-3 p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <input
                      type="checkbox"
                      id="is_default"
                      checked={formData.is_default}
                      onChange={(e) => handleInputChange('is_default', e.target.checked)}
                      className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary/20"
                    />
                    <label htmlFor="is_default" className="text-sm font-medium text-foreground cursor-pointer">
                      Set as default site
                    </label>
                    <span className="text-xs text-muted-foreground ml-auto">
                      This site will be selected by default in forms
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Power / DG configuration */}
            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Map className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Power Configuration</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">DG / Non-DG</label>
                  <select
                    value={formData.power_type}
                    onChange={(e) => handleInputChange('power_type', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Not set</option>
                    <option value="DG">DG</option>
                    <option value="Non DG">Non DG</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">DG Make</label>
                  <input
                    type="text"
                    value={formData.dg_make}
                    onChange={(e) => handleInputChange('dg_make', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g. Kirloskar, M&M, Eicher"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">DG Rating</label>
                  <input
                    type="text"
                    value={formData.dg_rating}
                    onChange={(e) => handleInputChange('dg_rating', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g. 15, 25, 62.5*2"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Solar / HPSC</label>
                  <select
                    value={formData.solar_type}
                    onChange={(e) => handleInputChange('solar_type', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Not set</option>
                    <option value="Solar">Solar</option>
                    <option value="Non-Solar">Non-Solar</option>
                    <option value="HPSC">HPSC</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Address Information */}
            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Map className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Address Information</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-foreground">Street Address</label>
                  <input
                    type="text"
                    value={formData.address_line1}
                    onChange={(e) => handleInputChange('address_line1', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Street address, building number"
                  />
                </div>

                <div className="lg:col-span-2 space-y-2">
                  <label className="text-sm font-medium text-foreground">Address Line 2</label>
                  <input
                    type="text"
                    value={formData.address_line2}
                    onChange={(e) => handleInputChange('address_line2', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Apartment, suite, unit, floor, etc."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => handleInputChange('city', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="City"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">State/Province</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => handleInputChange('state', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="State or province"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Postal Code</label>
                  <input
                    type="text"
                    value={formData.postal_code}
                    onChange={(e) => handleInputChange('postal_code', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="ZIP or postal code"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Country</label>
                  <input
                    type="text"
                    value={formData.country}
                    onChange={(e) => handleInputChange('country', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            {/* Region (Circle/Cluster) */}
            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Globe className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Region</h3>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Circle</label>
                  <select
                    value={formData.circle_id}
                    onChange={(e) => handleInputChange('circle_id', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select Circle</option>
                    {circles.map(c => (
                      <option key={c.id} value={c.id}>{c.name || c.circle_name || `Circle #${c.id}`}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Cluster</label>
                  <select
                    value={formData.cluster_id}
                    onChange={(e) => handleInputChange('cluster_id', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    disabled={!formData.circle_id}
                  >
                    <option value="">{formData.circle_id ? 'Select Cluster' : 'Select Circle first'}</option>
                    {clusters.map(cl => (
                      <option key={cl.id} value={cl.id}>{cl.name || cl.cluster_name || `Cluster #${cl.id}`}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Technician & FSE (Contact Information) */}
            <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">Technician & FSE</h3>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hub site status */}
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-sm font-medium text-foreground">Hub Site Status</label>
                  <input
                    type="text"
                    value={formData.hub_site_status}
                    onChange={(e) => handleInputChange('hub_site_status', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g. VIL More than 5 Sites..."
                  />
                </div>

                {/* Technician selector (from Employee Master) */}
                <div className="space-y-2 lg:col-span-2">
                  <label className="text-sm font-medium text-foreground">Technician (Employee Master)</label>
                  <select
                    value={formData.technician_employee_code}
                    onChange={(e) => {
                      const code = e.target.value;
                      const emp = employees.find((x) => x.employee_code === code);
                      const techName = emp ? (emp.full_name || `${emp.first_name || ''} ${emp.last_name || ''}`) : '';
                      const techPhone = emp ? (emp.phone || '') : '';
                      handleInputChange('technician_employee_code', code);
                      handleInputChange('technician_employee_name', techName);
                      // Also reflect technician into contact person + phone
                      handleInputChange('contact_person', techName);
                      handleInputChange('phone', techPhone);
                    }}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="">Select technician</option>
                    {employees.map((e) => (
                      <option key={e.id} value={e.employee_code}>
                        {e.employee_code} - {e.full_name || `${e.first_name || ''} ${e.last_name || ''}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Technician Name</label>
                  <input
                    type="text"
                    value={formData.contact_person}
                    onChange={(e) => handleInputChange('contact_person', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Technician name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                      errors.email ? 'border-destructive bg-destructive/5' : 'border-border bg-background'
                    }`}
                    placeholder="contact@company.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive flex items-center mt-1">
                      <span className="w-1 h-1 bg-destructive rounded-full mr-2"></span>
                      {errors.email}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">Technician Phone</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full px-4 py-3 rounded-lg border transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary ${
                      errors.phone ? 'border-destructive bg-destructive/5' : 'border-border bg-background'
                    }`}
                    placeholder="+1 (555) 123-4567"
                  />
                  {errors.phone && (
                    <p className="text-sm text-destructive flex items-center mt-1">
                      <span className="w-1 h-1 bg-destructive rounded-full mr-2"></span>
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* FSE manual fields */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">FSE Name</label>
                  <input
                    type="text"
                    value={formData.fse_employee_name}
                    onChange={(e) => handleInputChange('fse_employee_name', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="FSE name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">FSE Number</label>
                  <input
                    type="tel"
                    value={formData.fse_employee_code}
                    onChange={(e) => handleInputChange('fse_employee_code', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="FSE contact number"
                  />
                </div>

                {/* AOM */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">AOM</label>
                  <input
                    type="text"
                    value={formData.aom}
                    onChange={(e) => handleInputChange('aom', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-border bg-background transition-colors focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="e.g. 102597-Rohit Shreshty"
                  />
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-between pt-6 border-t border-border">
              <div className="text-sm text-muted-foreground">
                <span className="text-destructive">*</span> Required fields
              </div>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 rounded-lg border border-border bg-background text-foreground hover:bg-muted/50 transition-colors font-medium"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4" />
                      <span>{site ? 'Update Site' : 'Create Site'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SiteForm;

