import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, User, FileText, Upload, Trash2, Pencil, Save, Eye, EyeOff, Plus } from 'lucide-react';
import { hrAPI } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';

const safeUpper = (v) => String(v || '').toUpperCase();
const asDateInput = (v) => (v ? String(v).slice(0, 10) : '');
const asDisplayDateTime = (v) => (v ? String(v).replace('T', ' ').slice(0, 19) : '-');
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // keep in sync with server MAX_FILE_SIZE (default 10MB)

const GENDER_OPTIONS = [
  { value: '', label: '—' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' }
];

const MARITAL_OPTIONS = [
  { value: '', label: '—' },
  { value: 'single', label: 'Single' },
  { value: 'married', label: 'Married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' }
];

const BLOOD_GROUP_OPTIONS = [
  { value: '', label: '—' },
  { value: 'A+', label: 'A+' },
  { value: 'A-', label: 'A-' },
  { value: 'B+', label: 'B+' },
  { value: 'B-', label: 'B-' },
  { value: 'AB+', label: 'AB+' },
  { value: 'AB-', label: 'AB-' },
  { value: 'O+', label: 'O+' },
  { value: 'O-', label: 'O-' }
];

const DOC_TYPES = [
  { value: 'photo', label: 'Photo' },
  { value: 'aadhaar', label: 'Aadhaar Card' },
  { value: 'pan', label: 'PAN Card' },
  { value: 'appointment_letter', label: 'Appointment Letter' },
  { value: 'certificate', label: 'Certificate' },
  { value: 'other', label: 'Other' }
];

const EmployeeProfileModal = ({ employeeId, mode = 'view', initialTab = 'profile', onClose, onUpdated, onCreated }) => {
  const { hasPermission, isSuperuser } = usePermissions();
  const canUpdateEmployee = isSuperuser || hasPermission('hr.employee.update');
  const canCreateEmployee = isSuperuser || hasPermission('hr.employee.create');
  const canSaveEmployee = mode === 'create' ? canCreateEmployee : canUpdateEmployee;
  const canReadDocs = isSuperuser || hasPermission('hr.employee.documents.read');
  const canManageDocs = isSuperuser || hasPermission('hr.employee.documents.create');
  const canReadOrgMasters = isSuperuser || hasPermission('hr.organization.read') || hasPermission('hr.organization.update');
  const canEditBanking = canUpdateEmployee; // bank account APIs are protected by hr.employee.update
  const canReadRelated = isSuperuser || hasPermission('hr.employee.read');
  const canEditRelated = canUpdateEmployee;
  const canReadPayroll = isSuperuser || hasPermission('hr.payroll.read') || hasPermission('hr.payroll.update');
  const canEditPayroll = isSuperuser || hasPermission('hr.payroll.update');

  const [tab, setTab] = useState(initialTab || 'profile'); // profile | organization | payroll | banking | additional | documents
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [employee, setEmployee] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({});

  const [masters, setMasters] = useState({
    departments: [],
    designations: [],
    positions: [],
    grades: [],
    locations: []
  });
  const [mastersLoading, setMastersLoading] = useState(false);

  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState(null);
  const [docs, setDocs] = useState([]);

  const [bankAccounts, setBankAccounts] = useState([]);
  const [bankLoading, setBankLoading] = useState(false);
  const [bankError, setBankError] = useState(null);
  const [bankEditId, setBankEditId] = useState(null);
  const [bankSecretsVisibleIds, setBankSecretsVisibleIds] = useState([]); // array of bank_account.id
  const [bankForm, setBankForm] = useState({
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    bank_name: '',
    branch_name: '',
    account_type: 'savings',
    is_primary: true,
    effective_from: '',
    effective_to: ''
  });

  const [docForm, setDocForm] = useState({
    doc_type: 'aadhaar',
    doc_number: '',
    issue_date: '',
    expiry_date: '',
    remarks: '',
    file: null
  });
  const [docUploading, setDocUploading] = useState(false);

  const [photoUrl, setPhotoUrl] = useState(null);
  const photoInputRef = useRef(null);

  const [relLoading, setRelLoading] = useState(false);
  const [relError, setRelError] = useState(null);
  const [dependents, setDependents] = useState([]);
  const [nominees, setNominees] = useState([]);
  const [education, setEducation] = useState([]);
  const [experience, setExperience] = useState([]);
  const [transfers, setTransfers] = useState([]);

  const [depForm, setDepForm] = useState({ name: '', relationship: 'spouse', date_of_birth: '', gender: '', is_nominee: false, is_emergency_contact: false });
  const [nomForm, setNomForm] = useState({ name: '', relationship: '', nominee_for: 'pf', share_percent: '' });
  const [eduForm, setEduForm] = useState({ qualification: '', institution: '', year_of_passing: '', grade_or_score: '' });
  const [expForm, setExpForm] = useState({ company_name: '', designation: '', from_date: '', to_date: '', notes: '' });
  const [trForm, setTrForm] = useState({ from_department_id: '', to_department_id: '', from_location_id: '', to_location_id: '', effective_from: '', reason: '' });

  // Employee salary structure override (Payroll)
  const [salLoading, setSalLoading] = useState(false);
  const [salError, setSalError] = useState(null);
  const [salHeader, setSalHeader] = useState(null);
  const [salLines, setSalLines] = useState([]);
  const [salModalOpen, setSalModalOpen] = useState(false);
  const [salSaving, setSalSaving] = useState(false);
  const [salTemplateId, setSalTemplateId] = useState('');
  const [salStructures, setSalStructures] = useState([]);
  const [salComponents, setSalComponents] = useState([]);
  const [salEditLines, setSalEditLines] = useState([]);

  const isCreate = mode === 'create' && !employeeId;
  const effectiveEmployeeId = employeeId || employee?.id || null;

  useEffect(() => {
    if (!initialTab) return;
    if (initialTab === 'documents' && !(canReadDocs || canManageDocs)) {
      setTab('profile');
      return;
    }
    setTab(initialTab);
  }, [initialTab, canReadDocs, canManageDocs]);

  const photoDoc = useMemo(() => {
    const candidates = docs.filter((d) => String(d.doc_type || '').toLowerCase() === 'photo');
    return candidates[0] || null; // docs are returned ordered by uploaded_at desc
  }, [docs]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        if (isCreate) {
          if (!mounted) return;
          setEmployee(null);
          setEditMode(true);
          setForm({
            employee_code: '',
            first_name: '',
            last_name: '',
            full_name: '',
            work_status: 'active',
            payment_mode: 'bank',
            employment_type: 'permanent',
            employment_category: 'staff',
            disability_flag: false
          });
          return;
        }
        const res = await hrAPI.getEmployee(employeeId);
        const js = res.ok ? await res.json() : null;
        if (!res.ok) throw new Error(js?.message || 'Failed to load employee');
        if (!mounted) return;
        setEmployee(js.data);
        setForm(js.data || {});
      } catch (e) {
        if (!mounted) return;
        setError(e.message);
      } finally {
        if (!mounted) return;
        setLoading(false);
      }
    };
    if (employeeId || isCreate) load();
    return () => { mounted = false; };
  }, [employeeId, isCreate]);

  const loadSalaryStructure = async () => {
    if (!effectiveEmployeeId) return;
    if (!canReadPayroll) return;
    setSalLoading(true);
    setSalError(null);
    try {
      const [ssRes, stRes, compRes] = await Promise.all([
        hrAPI.getEmployeeSalaryStructure(effectiveEmployeeId),
        hrAPI.listPayrollStructures(),
        hrAPI.listPayrollComponents()
      ]);
      const ssJs = ssRes.ok ? await ssRes.json() : await ssRes.json().catch(() => ({}));
      if (!ssRes.ok) throw new Error(ssJs?.message || ssJs?.error || 'Failed to load employee salary structure');
      const stJs = stRes.ok ? await stRes.json() : await stRes.json().catch(() => ({}));
      if (!stRes.ok) throw new Error(stJs?.message || stJs?.error || 'Failed to load salary structures');
      const compJs = compRes.ok ? await compRes.json() : await compRes.json().catch(() => ({}));
      if (!compRes.ok) throw new Error(compJs?.message || compJs?.error || 'Failed to load payroll components');

      setSalHeader(ssJs?.data?.header || null);
      setSalLines(Array.isArray(ssJs?.data?.lines) ? ssJs.data.lines : []);
      setSalStructures(Array.isArray(stJs?.data) ? stJs.data : []);
      setSalComponents(Array.isArray(compJs?.data) ? compJs.data : []);
      setSalTemplateId(ssJs?.data?.header?.base_structure_id ? String(ssJs.data.header.base_structure_id) : '');
    } catch (e) {
      setSalError(e?.message || 'Failed to load salary structure');
      setSalHeader(null);
      setSalLines([]);
    } finally {
      setSalLoading(false);
    }
  };

  useEffect(() => {
    if (tab !== 'payroll') return;
    if (!effectiveEmployeeId) return;
    loadSalaryStructure();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, effectiveEmployeeId]);

  const openSalaryModal = () => {
    setSalError(null);
    setSalModalOpen(true);
    const fromExisting = (salLines || []).map((l, idx) => ({
      component_id: l.component_id,
      amount: Number(l.amount || 0),
      sort_order: Number(l.sort_order ?? idx * 10),
      is_active: l.is_active !== false
    }));
    setSalEditLines(fromExisting.length ? fromExisting : []);
  };

  const loadTemplateLines = async () => {
    const id = Number(salTemplateId || 0);
    if (!id) return;
    try {
      setSalError(null);
      const res = await hrAPI.getPayrollStructure(id);
      const js = res.ok ? await res.json() : await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js?.message || js?.error || 'Failed to load structure');
      const lines = Array.isArray(js?.data?.lines) ? js.data.lines : [];
      setSalEditLines(
        lines
          .filter((l) => l.is_active !== false)
          .map((l, idx) => ({
            component_id: l.component_id,
            amount: Number(l.amount || 0),
            sort_order: Number(l.sort_order ?? idx * 10),
            is_active: l.is_active !== false
          }))
      );
    } catch (e) {
      setSalError(e?.message || 'Failed to load template lines');
    }
  };

  const addSalaryLine = () => {
    setSalEditLines((p) => [...p, { component_id: '', amount: 0, sort_order: (p.length + 1) * 10, is_active: true }]);
  };

  const removeSalaryLine = (idx) => {
    setSalEditLines((p) => p.filter((_, i) => i !== idx));
  };

  const saveSalaryStructure = async () => {
    if (!effectiveEmployeeId) return;
    if (!canEditPayroll) return;
    const clean = (salEditLines || [])
      .map((l, idx) => ({
        component_id: Number(l.component_id),
        amount: Number(l.amount || 0),
        sort_order: Number(l.sort_order ?? idx * 10),
        calc_type: 'fixed',
        is_active: l.is_active !== false
      }))
      .filter((l) => Number.isFinite(l.component_id) && l.component_id > 0);
    if (!clean.length) {
      setSalError('Please add at least one component line.');
      return;
    }
    const dup = new Set();
    for (const l of clean) {
      const k = String(l.component_id);
      if (dup.has(k)) {
        setSalError('Duplicate component in lines. Remove duplicates and try again.');
        return;
      }
      dup.add(k);
    }
    setSalSaving(true);
    setSalError(null);
    try {
      const res = await hrAPI.upsertEmployeeSalaryStructure(effectiveEmployeeId, {
        id: salHeader?.id || undefined,
        base_structure_id: salTemplateId ? Number(salTemplateId) : null,
        lines: clean
      });
      const js = res.ok ? await res.json() : await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js?.message || js?.error || 'Failed to save salary structure');
      setSalModalOpen(false);
      setSalHeader(js?.data?.header || null);
      setSalLines(Array.isArray(js?.data?.lines) ? js.data.lines : []);
    } catch (e) {
      setSalError(e?.message || 'Failed to save salary structure');
    } finally {
      setSalSaving(false);
    }
  };

  const clearSalaryOverride = async () => {
    if (!effectiveEmployeeId) return;
    if (!canEditPayroll) return;
    if (!window.confirm('Clear employee salary override? Payroll will fall back to assigned structure.')) return;
    try {
      setSalError(null);
      const res = await hrAPI.deleteEmployeeSalaryStructure(effectiveEmployeeId);
      const js = res.ok ? await res.json() : await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js?.message || js?.error || 'Failed to clear salary override');
      await loadSalaryStructure();
    } catch (e) {
      setSalError(e?.message || 'Failed to clear salary override');
    }
  };

  const loadDocs = async () => {
    if (!canReadDocs && !canManageDocs) return [];
    setDocsLoading(true);
    setDocsError(null);
    try {
      const res = await hrAPI.listEmployeeDocuments(effectiveEmployeeId);
      const js = res.ok ? await res.json() : null;
      if (!res.ok) throw new Error(js?.message || 'Failed to load documents');
      setDocs(Array.isArray(js.data) ? js.data : []);
      return js.data || [];
    } catch (e) {
      setDocsError(e.message);
      setDocs([]);
      return [];
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveEmployeeId) return;
    if (!canReadDocs && !canManageDocs) return;
    loadDocs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEmployeeId, canReadDocs, canManageDocs]);

  const loadRelated = async () => {
    if (!effectiveEmployeeId) return;
    if (!canReadRelated) return;
    setRelLoading(true);
    setRelError(null);
    try {
      const [
        depRes,
        nomRes,
        eduRes,
        expRes,
        trRes
      ] = await Promise.all([
        hrAPI.listEmployeeDependents(effectiveEmployeeId),
        hrAPI.listEmployeeNominees(effectiveEmployeeId),
        hrAPI.listEmployeeEducation(effectiveEmployeeId),
        hrAPI.listEmployeeExperience(effectiveEmployeeId),
        hrAPI.listEmployeeTransfers(effectiveEmployeeId)
      ]);
      const j = async (r) => (r?.ok ? (await r.json()) : null);
      const depJ = await j(depRes);
      const nomJ = await j(nomRes);
      const eduJ = await j(eduRes);
      const expJ = await j(expRes);
      const trJ = await j(trRes);
      if (!depRes.ok) throw new Error(depJ?.message || 'Failed to load dependents');
      if (!nomRes.ok) throw new Error(nomJ?.message || 'Failed to load nominees');
      if (!eduRes.ok) throw new Error(eduJ?.message || 'Failed to load education');
      if (!expRes.ok) throw new Error(expJ?.message || 'Failed to load experience');
      if (!trRes.ok) throw new Error(trJ?.message || 'Failed to load transfers');

      setDependents(Array.isArray(depJ?.data) ? depJ.data : []);
      setNominees(Array.isArray(nomJ?.data) ? nomJ.data : []);
      setEducation(Array.isArray(eduJ?.data) ? eduJ.data : []);
      setExperience(Array.isArray(expJ?.data) ? expJ.data : []);
      setTransfers(Array.isArray(trJ?.data) ? trJ.data : []);
    } catch (e) {
      setRelError(e.message);
      setDependents([]);
      setNominees([]);
      setEducation([]);
      setExperience([]);
      setTransfers([]);
    } finally {
      setRelLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveEmployeeId) return;
    if (!canReadRelated) return;
    loadRelated();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEmployeeId, canReadRelated]);

  const loadBankAccounts = async () => {
    setBankLoading(true);
    setBankError(null);
    try {
      const res = await hrAPI.listEmployeeBankAccounts(effectiveEmployeeId);
      const js = res.ok ? await res.json() : null;
      if (!res.ok) throw new Error(js?.message || 'Failed to load bank accounts');
      setBankAccounts(Array.isArray(js.data) ? js.data : []);
      return js.data || [];
    } catch (e) {
      setBankError(e.message);
      setBankAccounts([]);
      return [];
    } finally {
      setBankLoading(false);
    }
  };

  useEffect(() => {
    if (!effectiveEmployeeId) return;
    loadBankAccounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveEmployeeId]);

  const maskAccountNumber = (v) => {
    const s = String(v || '').replace(/\s+/g, '');
    if (!s) return '-';
    if (s.length <= 4) return s;
    return `${'•'.repeat(Math.max(0, s.length - 4))}${s.slice(-4)}`;
  };

  const maskIfsc = (v) => {
    const s = String(v || '').replace(/\s+/g, '').toUpperCase();
    if (!s) return '-';
    if (s.length <= 3) return s;
    return `${'•'.repeat(Math.max(0, s.length - 3))}${s.slice(-3)}`;
  };

  const isBankSecretsVisible = (bankAccountId) =>
    bankSecretsVisibleIds.includes(Number(bankAccountId));

  const toggleBankSecretsVisible = (bankAccountId) => {
    const id = Number(bankAccountId);
    setBankSecretsVisibleIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  // Fetch photo blob whenever photoDoc changes
  useEffect(() => {
    let revoke = null;
    const fetchPhoto = async () => {
      setPhotoUrl(null);
      if (!photoDoc) return;
      try {
        const res = await hrAPI.downloadEmployeeDocument(effectiveEmployeeId, photoDoc.id, true);
        if (!res.ok) return;
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        revoke = url;
        setPhotoUrl(url);
      } catch (_) {
        setPhotoUrl(null);
      }
    };
    fetchPhoto();
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [effectiveEmployeeId, photoDoc]);

  const updateField = (k, v) => setForm((prev) => ({ ...prev, [k]: v }));

  const loadMasters = async () => {
    if (!canReadOrgMasters) return;
    setMastersLoading(true);
    try {
      const [d, des, p, g, l] = await Promise.all([
        hrAPI.list('departments'),
        hrAPI.list('designations'),
        hrAPI.list('positions'),
        hrAPI.list('grades'),
        hrAPI.list('locations')
      ]);
      const j = async (r) => (r?.ok ? (await r.json()).data : []);
      setMasters({
        departments: await j(d),
        designations: await j(des),
        positions: await j(p),
        grades: await j(g),
        locations: await j(l)
      });
    } finally {
      setMastersLoading(false);
    }
  };

  useEffect(() => {
    if (!editMode) return;
    if (mastersLoading) return;
    if (masters.departments.length) return;
    if (!canReadOrgMasters) return;
    loadMasters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editMode, canReadOrgMasters]);

  const filteredDesignations = useMemo(() => {
    if (!form?.department_id) return masters.designations;
    return masters.designations.filter((d) => Number(d.department_id) === Number(form.department_id));
  }, [masters.designations, form?.department_id]);

  const filteredPositions = useMemo(() => {
    return masters.positions.filter((p) => {
      const deptOk = !form?.department_id || Number(p.department_id) === Number(form.department_id);
      const desOk = !form?.designation_id || Number(p.designation_id) === Number(form.designation_id);
      return deptOk && desOk;
    });
  }, [masters.positions, form?.department_id, form?.designation_id]);

  const onOrgChange = (name, value) => {
    const v = value === '' ? null : Number(value);
    setForm((prev) => {
      const next = { ...prev, [name]: v };

      if (name === 'department_id') {
        if (prev?.designation_id) {
          const des = masters.designations.find((d) => Number(d.id) === Number(prev.designation_id));
          if (des?.department_id && Number(des.department_id) !== Number(v)) next.designation_id = null;
        }
        if (prev?.position_id) {
          const pos = masters.positions.find((p) => Number(p.id) === Number(prev.position_id));
          if (pos?.department_id && Number(pos.department_id) !== Number(v)) next.position_id = null;
        }
      }

      if (name === 'designation_id') {
        const des = masters.designations.find((d) => Number(d.id) === Number(v));
        if (des?.department_id && !next.department_id) next.department_id = des.department_id;
        if (prev?.position_id) {
          const pos = masters.positions.find((p) => Number(p.id) === Number(prev.position_id));
          if (pos?.designation_id && Number(pos.designation_id) !== Number(v)) next.position_id = null;
        }
      }

      if (name === 'position_id') {
        const pos = masters.positions.find((p) => Number(p.id) === Number(v));
        if (pos) {
          next.designation_id = next.designation_id || pos.designation_id || null;
          next.department_id = next.department_id || pos.department_id || null;
          if (!next.grade_id && pos.grade_id) next.grade_id = pos.grade_id;
          if (!next.location_id && pos.location_id) next.location_id = pos.location_id;
        }
      }

      return next;
    });
  };

  const saveProfile = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        employee_code: form.employee_code,
        first_name: form.first_name,
        last_name: form.last_name,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        branch: form.branch,
        notes: form.notes,
        work_status: form.work_status,
        date_of_birth: form.date_of_birth,
        join_date: form.join_date,
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        address_line1: form.address_line1,
        address_line2: form.address_line2,
        city: form.city,
        state: form.state,
        postal_code: form.postal_code,
        country: form.country,
        secondary_email: form.secondary_email,
        secondary_phone: form.secondary_phone,
        gender: form.gender,
        marital_status: form.marital_status,
        nationality: form.nationality,
        blood_group: form.blood_group,
        disability_flag: form.disability_flag,
        disability_details: form.disability_details,
        father_name: form.father_name,
        mother_name: form.mother_name,
        spouse_name: form.spouse_name,
        permanent_address_line1: form.permanent_address_line1,
        permanent_address_line2: form.permanent_address_line2,
        permanent_city: form.permanent_city,
        permanent_state: form.permanent_state,
        permanent_postal_code: form.permanent_postal_code,
        permanent_country: form.permanent_country,
        employment_type: form.employment_type,
        employment_category: form.employment_category,
        probation_end_date: form.probation_end_date,
        confirmation_date: form.confirmation_date,
        resign_date: form.resign_date,
        last_working_day: form.last_working_day,
        exit_reason: form.exit_reason,
        pan_number: form.pan_number,
        aadhaar_number: form.aadhaar_number,
        uan_number: form.uan_number,
        pf_number: form.pf_number,
        esic_number: form.esic_number,
        payment_mode: form.payment_mode,
        biometric_device_id: form.biometric_device_id,
        access_card_id: form.access_card_id,
        insurance_provider: form.insurance_provider,
        insurance_policy_number: form.insurance_policy_number,
        insurance_valid_to: form.insurance_valid_to,
        supervisor_employee_id: form.supervisor_employee_id || null,
        department_id: form.department_id || null,
        designation_id: form.designation_id || null,
        position_id: form.position_id || null,
        grade_id: form.grade_id || null,
        location_id: form.location_id || null
      };
      if (!effectiveEmployeeId) {
        if (!payload.employee_code) throw new Error('Employee code is required');
        if (!payload.first_name && !payload.full_name) throw new Error('First name or full name is required');
        const res = await hrAPI.createEmployee(payload);
        const js = res.ok ? await res.json() : null;
        if (!res.ok) throw new Error(js?.message || 'Failed to create employee');
        setEmployee(js.data);
        setForm(js.data || payload);
        setEditMode(false);
        onCreated?.(js.data?.id);
        onUpdated?.();
      } else {
        const res = await hrAPI.updateEmployee(effectiveEmployeeId, payload);
        const js = res.ok ? await res.json() : null;
        if (!res.ok) throw new Error(js?.message || 'Failed to update employee');
        setEmployee(js.data);
        setForm(js.data || payload);
        setEditMode(false);
        onUpdated?.();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const uploadDoc = async (file, docType) => {
    setDocsError(null);
    try {
      const res = await hrAPI.uploadEmployeeDocument(employeeId, file, docType);
      const js = res.ok ? await res.json() : null;
      if (!res.ok) throw new Error(js?.message || 'Failed to upload document');
      await loadDocs();
      return true;
    } catch (e) {
      setDocsError(e.message);
      return false;
    }
  };

  const uploadStructuredDoc = async () => {
    setDocsError(null);
    if (!canManageDocs) {
      setDocsError("You don't have permission to upload documents.");
      return false;
    }
    const { file, doc_type, doc_number, issue_date, expiry_date, remarks } = docForm;
    if (!effectiveEmployeeId) {
      setDocsError('Please save the employee first, then upload documents.');
      return false;
    }
    if (!file) {
      setDocsError('Please select a file to upload.');
      return false;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setDocsError(`File too large. Max allowed is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`);
      return false;
    }
    if (!doc_type) {
      setDocsError('Please select document type.');
      return false;
    }
    if (doc_type === 'aadhaar') {
      const num = String(doc_number || '').replace(/\s+/g, '');
      if (!/^\d{12}$/.test(num)) {
        setDocsError('Aadhaar number must be 12 digits.');
        return false;
      }
    }
    if (doc_type === 'pan') {
      const num = String(doc_number || '').replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z]{5}\d{4}[A-Z]$/.test(num)) {
        setDocsError('PAN number must match format AAAAA9999A.');
        return false;
      }
    }

    setDocUploading(true);
    try {
      const meta = {
        issue_date: issue_date || null,
        expiry_date: expiry_date || null,
        remarks: remarks || null
      };
      const res = await hrAPI.uploadEmployeeDocument(employeeId, file, doc_type, {
        doc_number: doc_number || null,
        doc_meta: meta
      });
      const js = res.ok ? await res.json() : null;
      if (!res.ok) throw new Error(js?.message || 'Failed to upload document');
      await loadDocs();
      setDocForm({ doc_type: 'aadhaar', doc_number: '', issue_date: '', expiry_date: '', remarks: '', file: null });
      return true;
    } catch (e) {
      setDocsError(e.message);
      return false;
    } finally {
      setDocUploading(false);
    }
  };

  const handlePhotoSelected = async (file) => {
    if (!file) return;
    if (!canManageDocs) {
      setDocsError("You don't have permission to upload documents/photos.");
      return;
    }
    if (!effectiveEmployeeId) {
      setDocsError('Please save the employee first, then upload a photo.');
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setDocsError(`Photo too large. Max allowed is ${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB.`);
      return;
    }
    try {
      await hrAPI.uploadEmployeeDocument(effectiveEmployeeId, file, 'photo', { doc_meta: { kind: 'profile_photo' } });
      await loadDocs();
    } catch (e) {
      setDocsError(e?.message || 'Failed to upload photo');
    }
  };

  const deleteDoc = async (docId) => {
    setDocsError(null);
    try {
      if (!canManageDocs) throw new Error("You don't have permission to delete documents.");
      const res = await hrAPI.deleteEmployeeDocument(effectiveEmployeeId, docId);
      const js = res.ok ? await res.json() : null;
      if (!res.ok) throw new Error(js?.message || 'Failed to delete document');
      await loadDocs();
      return true;
    } catch (e) {
      setDocsError(e.message);
      return false;
    }
  };

  const viewDoc = async (docId) => {
    setDocsError(null);
    try {
      if (!canReadDocs) throw new Error("You don't have permission to view documents.");
      const res = await hrAPI.downloadEmployeeDocument(effectiveEmployeeId, docId, true);
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js?.message || 'Failed to download document');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      // best-effort revoke later
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setDocsError(e.message);
    }
  };

  if (!employeeId && !isCreate) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
          <div className="flex items-center justify-between p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-primary/20 rounded-xl">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">
                  {employee?.full_name || `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || 'Employee'}
                </h2>
                <p className="text-muted-foreground mt-1">
                  {employee?.employee_code ? `Code: ${employee.employee_code}` : 'Employee Profile'}
                </p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-muted/50 rounded-lg transition-colors">
              <X className="h-5 w-5 text-muted-foreground" />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-6 pb-4 flex items-center gap-2">
            <button
              className={`btn ${tab === 'profile' ? 'btn-primary' : ''}`}
              onClick={() => setTab('profile')}
              type="button"
            >
              <User className="h-4 w-4 mr-2" /> Profile
            </button>
            <button
              className={`btn ${tab === 'organization' ? 'btn-primary' : ''}`}
              onClick={() => setTab('organization')}
              type="button"
            >
              Organization
            </button>
            <button
              className={`btn ${tab === 'payroll' ? 'btn-primary' : ''}`}
              onClick={() => setTab('payroll')}
              type="button"
            >
              Payroll & Statutory
            </button>
            <button
              className={`btn ${tab === 'banking' ? 'btn-primary' : ''}`}
              onClick={() => setTab('banking')}
              type="button"
            >
              Banking
            </button>
            <button
              className={`btn ${tab === 'additional' ? 'btn-primary' : ''}`}
              onClick={() => setTab('additional')}
              type="button"
              disabled={!canReadRelated}
              title={!canReadRelated ? "You don't have permission to view additional employee info." : 'Additional info'}
            >
              Additional Info
            </button>
            {(canReadDocs || canManageDocs) && (
              <button
                className={`btn ${tab === 'documents' ? 'btn-primary' : ''}`}
                onClick={() => setTab('documents')}
                type="button"
              >
                <FileText className="h-4 w-4 mr-2" /> Documents
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(95vh-170px)] p-6">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
            </div>
          ) : error ? (
            <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded">
              {error}
            </div>
          ) : tab === 'profile' ? (
            <div className="space-y-6">
              {/* Top section: photo + quick info */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Photograph</h3>
                    <div className="text-xs text-muted-foreground">
                      Click photo to upload • Max {Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB
                    </div>
                  </div>
                  <div
                    className="relative w-full aspect-square rounded-lg bg-background border border-border overflow-hidden flex items-center justify-center cursor-pointer"
                    onClick={() => {
                      if (!canManageDocs) {
                        setDocsError("You don't have permission to upload documents/photos.");
                        return;
                      }
                      photoInputRef.current?.click();
                    }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (!canManageDocs) {
                          setDocsError("You don't have permission to upload documents/photos.");
                          return;
                        }
                        photoInputRef.current?.click();
                      }
                    }}
                  >
                    {photoUrl ? (
                      <img src={photoUrl} alt="Employee" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center text-muted text-sm">
                        No photo uploaded
                        <div className="text-xs mt-1">Click to upload a profile photo.</div>
                      </div>
                    )}

                    <div className="absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors pointer-events-none" />

                    <div className="absolute bottom-3 left-3 right-3 pointer-events-none">
                      <div className="btn btn-sm w-full flex items-center justify-center pointer-events-none opacity-90">
                        <Upload className="h-4 w-4 mr-2" />
                        Upload / Replace Photo
                      </div>
                    </div>

                    {photoDoc && canManageDocs && (
                      <button
                        type="button"
                        className="absolute top-3 right-3 btn btn-sm"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (!window.confirm('Delete profile photo?')) return;
                          await deleteDoc(photoDoc.id);
                          setPhotoUrl(null);
                        }}
                        title="Delete photo"
                      >
                        <Trash2 className="h-4 w-4 mr-1" />
                        Delete
                      </button>
                    )}

                    <input
                      ref={photoInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        await handlePhotoSelected(file);
                        e.target.value = '';
                      }}
                    />
                  </div>
                </div>

                <div className="lg:col-span-2 bg-muted/30 rounded-xl p-6 border border-border/50">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-foreground">Profile</h3>
                    <div className="flex items-center gap-2">
                      {!editMode ? (
                        <button
                          className="btn btn-sm"
                          onClick={() => canSaveEmployee && setEditMode(true)}
                          type="button"
                          disabled={!canSaveEmployee}
                          title={!canSaveEmployee ? "You don't have permission to edit this employee." : 'Edit'}
                        >
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-sm" onClick={() => { setEditMode(false); setForm(employee || {}); }} type="button">
                            Cancel
                          </button>
                          <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving || !canSaveEmployee} type="button">
                            <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-muted-foreground">Employee Code</label>
                      {editMode ? (
                        <input
                          className="input mt-1 w-full font-mono"
                          value={form.employee_code || ''}
                          onChange={(e) => updateField('employee_code', e.target.value)}
                          placeholder="e.g. EMP001"
                        />
                      ) : (
                        <div className="mt-1 text-sm font-mono">{employee?.employee_code || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Status</label>
                      {editMode ? (
                        <select
                          className="select mt-1 w-full"
                          value={form.work_status || 'active'}
                          onChange={(e) => updateField('work_status', e.target.value)}
                        >
                          <option value="active">ACTIVE</option>
                          <option value="notice">NOTICE</option>
                          <option value="resigned">RESIGNED</option>
                        </select>
                      ) : (
                        <div className="mt-1 text-sm">{safeUpper(employee?.work_status)}</div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">First Name</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" value={form.first_name || ''} onChange={(e) => updateField('first_name', e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.first_name || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Last Name</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" value={form.last_name || ''} onChange={(e) => updateField('last_name', e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.last_name || '-'}</div>
                      )}
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-xs text-muted-foreground">Full Name (Inventory-compat)</label>
                      {editMode ? (
                        <input
                          className="input mt-1 w-full"
                          value={form.full_name || ''}
                          onChange={(e) => updateField('full_name', e.target.value)}
                        />
                      ) : (
                        <div className="mt-1 text-sm">
                          {employee?.full_name || `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() || '-'}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        Tip: if you update only Full Name, the system will auto-split first/last.
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Email</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" value={form.email || ''} onChange={(e) => updateField('email', e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.email || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Phone</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" value={form.phone || ''} onChange={(e) => updateField('phone', e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.phone || '-'}</div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Branch</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" value={form.branch || ''} onChange={(e) => updateField('branch', e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.branch || '-'}</div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Join Date</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" type="date" value={asDateInput(form.join_date)} onChange={(e) => updateField('join_date', e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.join_date ? String(employee.join_date).slice(0, 10) : '-'}</div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Date of Birth</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" type="date" value={asDateInput(form.date_of_birth)} onChange={(e) => updateField('date_of_birth', e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.date_of_birth ? String(employee.date_of_birth).slice(0, 10) : '-'}</div>
                      )}
                    </div>

                    <div>
                      <label className="text-xs text-muted-foreground">Supervisor Employee ID</label>
                      {editMode ? (
                        <input
                          className="input mt-1 w-full"
                          inputMode="numeric"
                          value={form.supervisor_employee_id ?? ''}
                          onChange={(e) => updateField('supervisor_employee_id', e.target.value === '' ? null : Number(e.target.value))}
                          placeholder="e.g. 12"
                        />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.supervisor_employee_id ?? '-'}</div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="text-xs text-muted-foreground">Notes</label>
                    {editMode ? (
                      <textarea className="input mt-1 w-full" rows={3} value={form.notes || ''} onChange={(e) => updateField('notes', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm whitespace-pre-wrap">{employee?.notes || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Organization (IDs + names) */}
              {/* Emergency contact */}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Emergency Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.emergency_contact_name || ''} onChange={(e) => updateField('emergency_contact_name', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.emergency_contact_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Phone</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.emergency_contact_phone || ''} onChange={(e) => updateField('emergency_contact_phone', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.emergency_contact_phone || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal & Family */}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Personal & Family</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Gender</label>
                    {editMode ? (
                      <select
                        className="input mt-1 w-full"
                        value={form.gender || ''}
                        onChange={(e) => updateField('gender', e.target.value)}
                      >
                        {GENDER_OPTIONS.map((o) => (
                          <option key={o.value || 'blank'} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.gender || '-'}</div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Marital Status</label>
                    {editMode ? (
                      <select
                        className="input mt-1 w-full"
                        value={form.marital_status || ''}
                        onChange={(e) => updateField('marital_status', e.target.value)}
                      >
                        {MARITAL_OPTIONS.map((o) => (
                          <option key={o.value || 'blank'} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.marital_status || '-'}</div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Nationality</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.nationality || ''} onChange={(e) => updateField('nationality', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.nationality || '-'}</div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Blood Group</label>
                    {editMode ? (
                      <select
                        className="input mt-1 w-full"
                        value={form.blood_group || ''}
                        onChange={(e) => updateField('blood_group', e.target.value)}
                      >
                        {BLOOD_GROUP_OPTIONS.map((o) => (
                          <option key={o.value || 'blank'} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.blood_group || '-'}</div>
                    )}
                  </div>

                  <div className="md:col-span-2 flex items-center gap-3">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Disability</label>
                      {editMode ? (
                        <label className="mt-2 inline-flex items-center gap-2 text-sm text-muted">
                          <input
                            type="checkbox"
                            checked={Boolean(form.disability_flag)}
                            onChange={(e) => updateField('disability_flag', e.target.checked)}
                          />
                          Has disability
                        </label>
                      ) : (
                        <div className="mt-1 text-sm">{employee?.disability_flag ? 'Yes' : 'No'}</div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground">Disability Details</label>
                      {editMode ? (
                        <input
                          className="input mt-1 w-full"
                          value={form.disability_details || ''}
                          onChange={(e) => updateField('disability_details', e.target.value)}
                          disabled={!Boolean(form.disability_flag)}
                          placeholder={form.disability_flag ? 'Optional' : 'Enable disability to add details'}
                        />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.disability_details || '-'}</div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Father Name</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.father_name || ''} onChange={(e) => updateField('father_name', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.father_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Mother Name</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.mother_name || ''} onChange={(e) => updateField('mother_name', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.mother_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Spouse Name</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.spouse_name || ''} onChange={(e) => updateField('spouse_name', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.spouse_name || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Secondary Contact */}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Secondary Contact</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Secondary Email</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.secondary_email || ''} onChange={(e) => updateField('secondary_email', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.secondary_email || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Secondary Phone</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.secondary_phone || ''} onChange={(e) => updateField('secondary_phone', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.secondary_phone || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Address Line 1</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.address_line1 || ''} onChange={(e) => updateField('address_line1', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.address_line1 || '-'}</div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Address Line 2</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.address_line2 || ''} onChange={(e) => updateField('address_line2', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.address_line2 || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">City</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.city || ''} onChange={(e) => updateField('city', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.city || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">State</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.state || ''} onChange={(e) => updateField('state', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.state || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Postal Code</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.postal_code || ''} onChange={(e) => updateField('postal_code', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.postal_code || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Country</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.country || ''} onChange={(e) => updateField('country', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.country || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* Permanent Address */}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Permanent Address</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Address Line 1</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.permanent_address_line1 || ''} onChange={(e) => updateField('permanent_address_line1', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.permanent_address_line1 || '-'}</div>
                    )}
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Address Line 2</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.permanent_address_line2 || ''} onChange={(e) => updateField('permanent_address_line2', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.permanent_address_line2 || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">City</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.permanent_city || ''} onChange={(e) => updateField('permanent_city', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.permanent_city || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">State</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.permanent_state || ''} onChange={(e) => updateField('permanent_state', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.permanent_state || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Postal Code</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.permanent_postal_code || ''} onChange={(e) => updateField('permanent_postal_code', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.permanent_postal_code || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Country</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.permanent_country || ''} onChange={(e) => updateField('permanent_country', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.permanent_country || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              {/* System fields */}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">System</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Employee ID</label>
                    <div className="mt-1 text-sm font-mono">{employee?.id ?? '-'}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Created At</label>
                    <div className="mt-1 text-sm">{asDisplayDateTime(employee?.created_at)}</div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Updated At</label>
                    <div className="mt-1 text-sm">{asDisplayDateTime(employee?.updated_at)}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : tab === 'organization' ? (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Organization</h3>
                  {!editMode ? (
                    <button
                      className="btn btn-sm"
                      onClick={() => canSaveEmployee && setEditMode(true)}
                      type="button"
                      disabled={!canSaveEmployee}
                      title={!canSaveEmployee ? "You don't have permission to edit this employee." : 'Edit'}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-sm" onClick={() => { setEditMode(false); setForm(employee || {}); }} type="button">
                        Cancel
                      </button>
                      <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving || !canSaveEmployee} type="button">
                        <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
                {editMode && (
                  <div className="text-xs text-muted-foreground mb-3">
                    Pick values from HR masters (HR → Organization). The lists may be empty until you create masters.
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Department</label>
                    {editMode ? (
                      <select className="input mt-1 w-full" value={form.department_id || ''} onChange={(e) => onOrgChange('department_id', e.target.value)} disabled={mastersLoading}>
                        <option value="">Select Department</option>
                        {masters.departments.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.department_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Designation</label>
                    {editMode ? (
                      <select className="input mt-1 w-full" value={form.designation_id || ''} onChange={(e) => onOrgChange('designation_id', e.target.value)} disabled={mastersLoading}>
                        <option value="">Select Designation</option>
                        {filteredDesignations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.designation_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Position</label>
                    {editMode ? (
                      <select className="input mt-1 w-full" value={form.position_id || ''} onChange={(e) => onOrgChange('position_id', e.target.value)} disabled={mastersLoading}>
                        <option value="">Select Position</option>
                        {filteredPositions.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.position_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Grade</label>
                    {editMode ? (
                      <select className="input mt-1 w-full" value={form.grade_id || ''} onChange={(e) => onOrgChange('grade_id', e.target.value)} disabled={mastersLoading}>
                        <option value="">Select Grade</option>
                        {masters.grades.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.grade_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Location</label>
                    {editMode ? (
                      <select className="input mt-1 w-full" value={form.location_id || ''} onChange={(e) => onOrgChange('location_id', e.target.value)} disabled={mastersLoading}>
                        <option value="">Select Location</option>
                        {masters.locations.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                    ) : (
                      <div className="mt-1 text-sm">{employee?.location_name || '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Supervisor Employee ID</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" inputMode="numeric" value={form.supervisor_employee_id ?? ''} onChange={(e) => updateField('supervisor_employee_id', e.target.value === '' ? null : Number(e.target.value))} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.supervisor_employee_id ?? '-'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : tab === 'payroll' ? (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Payroll & Statutory</h3>
                  {!editMode ? (
                    <button
                      className="btn btn-sm"
                      onClick={() => canSaveEmployee && setEditMode(true)}
                      type="button"
                      disabled={!canSaveEmployee}
                      title={!canSaveEmployee ? "You don't have permission to edit this employee." : 'Edit'}
                    >
                      <Pencil className="h-4 w-4 mr-2" /> Edit
                    </button>
                  ) : (
                    <>
                      <button className="btn btn-sm" onClick={() => { setEditMode(false); setForm(employee || {}); }} type="button">Cancel</button>
                      <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={saving || !canSaveEmployee} type="button">
                        <Save className="h-4 w-4 mr-2" /> {saving ? 'Saving…' : 'Save'}
                      </button>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    ['employment_type', 'Employment Type'],
                    ['employment_category', 'Employment Category'],
                    ['payment_mode', 'Payment Mode'],
                    ['pan_number', 'PAN'],
                    ['aadhaar_number', 'Aadhaar'],
                    ['uan_number', 'UAN'],
                    ['pf_number', 'PF Number'],
                    ['esic_number', 'ESIC Number'],
                    ['biometric_device_id', 'Biometric Device ID'],
                    ['access_card_id', 'Access Card ID'],
                    ['insurance_provider', 'Insurance Provider'],
                    ['insurance_policy_number', 'Insurance Policy #']
                  ].map(([k, label]) => (
                    <div key={k}>
                      <label className="text-xs text-muted-foreground">{label}</label>
                      {editMode ? (
                        <input className="input mt-1 w-full" value={form[k] || ''} onChange={(e) => updateField(k, e.target.value)} />
                      ) : (
                        <div className="mt-1 text-sm">{employee?.[k] || '-'}</div>
                      )}
                    </div>
                  ))}
                  <div>
                    <label className="text-xs text-muted-foreground">Probation End</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" type="date" value={asDateInput(form.probation_end_date)} onChange={(e) => updateField('probation_end_date', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.probation_end_date ? String(employee.probation_end_date).slice(0,10) : '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Confirmation Date</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" type="date" value={asDateInput(form.confirmation_date)} onChange={(e) => updateField('confirmation_date', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.confirmation_date ? String(employee.confirmation_date).slice(0,10) : '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Insurance Valid To</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" type="date" value={asDateInput(form.insurance_valid_to)} onChange={(e) => updateField('insurance_valid_to', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.insurance_valid_to ? String(employee.insurance_valid_to).slice(0, 10) : '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Resign Date</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" type="date" value={asDateInput(form.resign_date)} onChange={(e) => updateField('resign_date', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.resign_date ? String(employee.resign_date).slice(0, 10) : '-'}</div>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Last Working Day</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" type="date" value={asDateInput(form.last_working_day)} onChange={(e) => updateField('last_working_day', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.last_working_day ? String(employee.last_working_day).slice(0, 10) : '-'}</div>
                    )}
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-muted-foreground">Exit Reason</label>
                    {editMode ? (
                      <input className="input mt-1 w-full" value={form.exit_reason || ''} onChange={(e) => updateField('exit_reason', e.target.value)} />
                    ) : (
                      <div className="mt-1 text-sm">{employee?.exit_reason || '-'}</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-xl p-6 border border-border/50">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-lg font-semibold text-foreground">Salary Structure</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Optional employee override. If set, Pay Run uses this instead of the assigned structure.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {salHeader ? (
                      <button className="btn btn-sm" type="button" onClick={clearSalaryOverride} disabled={!canEditPayroll}>
                        Clear override
                      </button>
                    ) : null}
                    <button className="btn btn-primary btn-sm" type="button" onClick={openSalaryModal} disabled={!canEditPayroll || !effectiveEmployeeId}>
                      <Pencil className="h-4 w-4 mr-2" /> Edit Salary Structure
                    </button>
                  </div>
                </div>

                {salError ? (
                  <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded mb-3">{salError}</div>
                ) : null}

                {salLoading ? (
                  <div className="text-sm text-muted-foreground">Loading salary structure…</div>
                ) : !canReadPayroll ? (
                  <div className="text-sm text-muted-foreground">
                    View-only. Ask for <span className="font-mono">hr.payroll.read</span> to see salary structures.
                  </div>
                ) : salLines.length === 0 ? (
                  <div className="text-sm text-muted-foreground">
                    No employee override saved. (Payroll will use the employee’s assignment from Payroll → Employee Assignment.)
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left">Component</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {salLines.map((l) => (
                          <tr key={l.id}>
                            <td className="px-3 py-2">
                              <div className="font-mono text-xs">{l.component_code}</div>
                              <div className="text-xs text-muted-foreground">{l.component_name}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-mono">{Number(l.amount || 0).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {salModalOpen ? (
                <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto">
                  <div className="relative top-16 mx-auto p-5 border w-11/12 md:w-4/5 lg:w-2/3 shadow-lg rounded-md bg-card border-default">
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div>
                        <div className="text-lg font-semibold text-fg">Edit Salary Structure</div>
                        <div className="text-xs text-muted">Load a template, tweak/add lines, then save.</div>
                      </div>
                      <button className="btn btn-sm" type="button" onClick={() => setSalModalOpen(false)} disabled={salSaving}>
                        <X className="h-4 w-4 mr-2" /> Close
                      </button>
                    </div>

                    {salError ? (
                      <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded mb-3">{salError}</div>
                    ) : null}

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end mb-4">
                      <div className="md:col-span-2">
                        <label className="text-xs text-muted-foreground">Load template structure (optional)</label>
                        <select className="input mt-1 w-full" value={salTemplateId} onChange={(e) => setSalTemplateId(e.target.value)}>
                          <option value="">— None —</option>
                          {salStructures.map((s) => (
                            <option key={s.id} value={String(s.id)}>
                              {s.code} — {s.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <button className="btn btn-sm" type="button" onClick={loadTemplateLines} disabled={!salTemplateId}>
                        Load lines
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left">Component</th>
                            <th className="px-3 py-2 text-right">Amount</th>
                            <th className="px-3 py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {salEditLines.length === 0 ? (
                            <tr>
                              <td className="px-3 py-3 text-sm text-muted-foreground" colSpan={3}>
                                No lines yet. Click “Add line” or load a template.
                              </td>
                            </tr>
                          ) : (
                            salEditLines.map((l, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2">
                                  <select
                                    className="input w-full"
                                    value={l.component_id || ''}
                                    onChange={(e) =>
                                      setSalEditLines((p) =>
                                        p.map((x, i) => (i === idx ? { ...x, component_id: e.target.value } : x))
                                      )
                                    }
                                  >
                                    <option value="">Select…</option>
                                    {salComponents
                                      .filter((c) => c.is_active !== false)
                                      .map((c) => (
                                        <option key={c.id} value={String(c.id)}>
                                          {c.code} — {c.name} ({c.type})
                                        </option>
                                      ))}
                                  </select>
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <input
                                    className="input w-40 text-right font-mono"
                                    type="number"
                                    step="0.01"
                                    value={l.amount}
                                    onChange={(e) =>
                                      setSalEditLines((p) => p.map((x, i) => (i === idx ? { ...x, amount: e.target.value } : x)))
                                    }
                                  />
                                </td>
                                <td className="px-3 py-2 text-right">
                                  <button className="btn btn-sm btn-ghost" type="button" onClick={() => removeSalaryLine(idx)}>
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <button className="btn btn-sm" type="button" onClick={addSalaryLine}>
                        <Plus className="h-4 w-4 mr-2" /> Add line
                      </button>
                      <div className="flex items-center gap-2">
                        <button className="btn" type="button" onClick={() => setSalModalOpen(false)} disabled={salSaving}>
                          Cancel
                        </button>
                        <button className="btn btn-primary" type="button" onClick={saveSalaryStructure} disabled={salSaving}>
                          <Save className="h-4 w-4 mr-2" /> {salSaving ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : tab === 'banking' ? (
            <div className="space-y-4">
              {bankError && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded">
                  {bankError}
                </div>
              )}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Bank Accounts</h3>
                    {!canEditBanking && (
                      <div className="text-xs text-muted-foreground mt-1">
                        View-only. Ask for <span className="font-mono">hr.employee.update</span> to edit banking.
                      </div>
                    )}
                  </div>
                  {bankEditId && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        setBankEditId(null);
                        setBankForm({
                          account_holder_name: '',
                          account_number: '',
                          ifsc_code: '',
                          bank_name: '',
                          branch_name: '',
                          account_type: 'savings',
                          is_primary: false,
                          effective_from: '',
                          effective_to: ''
                        });
                      }}
                    >
                      Cancel Edit
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Account Holder Name</label>
                    <input className="input mt-1 w-full" disabled={!canEditBanking} value={bankForm.account_holder_name} onChange={(e) => setBankForm((p) => ({ ...p, account_holder_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Account Number</label>
                    <input className="input mt-1 w-full" disabled={!canEditBanking} value={bankForm.account_number} onChange={(e) => setBankForm((p) => ({ ...p, account_number: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">IFSC</label>
                    <input className="input mt-1 w-full" disabled={!canEditBanking} value={bankForm.ifsc_code} onChange={(e) => setBankForm((p) => ({ ...p, ifsc_code: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Bank Name</label>
                    <input className="input mt-1 w-full" disabled={!canEditBanking} value={bankForm.bank_name} onChange={(e) => setBankForm((p) => ({ ...p, bank_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Branch</label>
                    <input className="input mt-1 w-full" disabled={!canEditBanking} value={bankForm.branch_name} onChange={(e) => setBankForm((p) => ({ ...p, branch_name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Account Type</label>
                    <select className="input mt-1 w-full" disabled={!canEditBanking} value={bankForm.account_type} onChange={(e) => setBankForm((p) => ({ ...p, account_type: e.target.value }))}>
                      <option value="savings">Savings</option>
                      <option value="current">Current</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Effective From</label>
                    <input
                      className="input mt-1 w-full"
                      type="date"
                      disabled={!canEditBanking}
                      value={bankForm.effective_from || ''}
                      onChange={(e) => setBankForm((p) => ({ ...p, effective_from: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Effective To</label>
                    <input
                      className="input mt-1 w-full"
                      type="date"
                      disabled={!canEditBanking}
                      value={bankForm.effective_to || ''}
                      onChange={(e) => setBankForm((p) => ({ ...p, effective_to: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2 flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-sm text-muted">
                      <input type="checkbox" disabled={!canEditBanking} checked={bankForm.is_primary} onChange={(e) => setBankForm((p) => ({ ...p, is_primary: e.target.checked }))} />
                      Set as primary
                    </label>
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={!canEditBanking || bankLoading || !bankForm.account_holder_name || !bankForm.account_number}
                      onClick={async () => {
                        setBankError(null);
                        try {
                          if (!effectiveEmployeeId) throw new Error('Please save employee first');
                          const res = bankEditId
                            ? await hrAPI.updateEmployeeBankAccount(effectiveEmployeeId, bankEditId, bankForm)
                            : await hrAPI.createEmployeeBankAccount(effectiveEmployeeId, bankForm);
                          const js = res.ok ? await res.json() : null;
                          if (!res.ok) throw new Error(js?.message || (bankEditId ? 'Failed to update bank account' : 'Failed to add bank account'));
                          setBankForm({
                            account_holder_name: '',
                            account_number: '',
                            ifsc_code: '',
                            bank_name: '',
                            branch_name: '',
                            account_type: 'savings',
                            is_primary: false,
                            effective_from: '',
                            effective_to: ''
                          });
                          setBankEditId(null);
                          await loadBankAccounts();
                        } catch (e) {
                          setBankError(e.message);
                        }
                      }}
                    >
                      {bankEditId ? 'Update' : 'Add'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border overflow-hidden">
                {bankLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                  </div>
                ) : bankAccounts.length === 0 ? (
                  <div className="p-6 text-sm text-muted">No bank accounts added yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Primary</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Holder</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Account</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">IFSC</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Bank</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Branch</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Type</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {bankAccounts.map((b) => (
                          <tr key={b.id} className="hover:bg-muted/40">
                            {/*
                              Security: mask sensitive values by default (account/IFSC).
                              Use the per-row Eye toggle to reveal/hide.
                            */}
                            <td className="px-3 py-2">{b.is_primary ? 'Yes' : 'No'}</td>
                            <td className="px-3 py-2">{b.account_holder_name}</td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {isBankSecretsVisible(b.id) ? (b.account_number || '-') : maskAccountNumber(b.account_number)}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs">
                              {isBankSecretsVisible(b.id) ? (b.ifsc_code || '-') : maskIfsc(b.ifsc_code)}
                            </td>
                            <td className="px-3 py-2">{b.bank_name || '-'}</td>
                            <td className="px-3 py-2">{b.branch_name || '-'}</td>
                            <td className="px-3 py-2">{b.account_type || '-'}</td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  onClick={() => toggleBankSecretsVisible(b.id)}
                                  title={isBankSecretsVisible(b.id) ? 'Hide account/IFSC' : 'View account/IFSC'}
                                >
                                  {isBankSecretsVisible(b.id) ? <EyeOff className="h-4 w-4 mr-1" /> : <Eye className="h-4 w-4 mr-1" />}
                                  {isBankSecretsVisible(b.id) ? 'Hide' : 'View'}
                                </button>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={!canEditBanking}
                                  onClick={() => {
                                    setBankError(null);
                                    setBankEditId(b.id);
                                    setBankForm({
                                      account_holder_name: b.account_holder_name || '',
                                      account_number: b.account_number || '',
                                      ifsc_code: b.ifsc_code || '',
                                      bank_name: b.bank_name || '',
                                      branch_name: b.branch_name || '',
                                      account_type: b.account_type || 'savings',
                                      is_primary: Boolean(b.is_primary),
                                      effective_from: asDateInput(b.effective_from),
                                      effective_to: asDateInput(b.effective_to)
                                    });
                                  }}
                                >
                                  <Pencil className="h-4 w-4 mr-1" /> Edit
                                </button>
                                {!b.is_primary && (
                                  <button
                                    className="btn btn-sm"
                                    type="button"
                                    disabled={!canEditBanking}
                                    onClick={async () => {
                                      await hrAPI.updateEmployeeBankAccount(effectiveEmployeeId, b.id, { is_primary: true });
                                      await loadBankAccounts();
                                    }}
                                  >
                                    Set Primary
                                  </button>
                                )}
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={!canEditBanking}
                                  onClick={async () => {
                                    if (!window.confirm('Delete this bank account?')) return;
                                    await hrAPI.deleteEmployeeBankAccount(effectiveEmployeeId, b.id);
                                    await loadBankAccounts();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : tab === 'additional' ? (
            <div className="space-y-4">
              {relError && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded">
                  {relError}
                </div>
              )}

              {editMode && (
                <div className="bg-card border border-border rounded-lg p-3 text-xs text-muted-foreground">
                  Tip: “Additional Info” is saved via its own buttons and does not require the main Profile “Save”.
                </div>
              )}

              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-foreground">Dependents</h3>
                  <button className="btn btn-sm" type="button" onClick={() => loadRelated()} disabled={relLoading}>
                    Refresh
                  </button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={depForm.name} onChange={(e) => setDepForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Relationship</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={depForm.relationship} onChange={(e) => setDepForm((p) => ({ ...p, relationship: e.target.value }))} placeholder="father/mother/spouse/child/other" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">DOB</label>
                    <input className="input mt-1 w-full" type="date" disabled={!canEditRelated} value={depForm.date_of_birth} onChange={(e) => setDepForm((p) => ({ ...p, date_of_birth: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Gender</label>
                    <select className="input mt-1 w-full" disabled={!canEditRelated} value={depForm.gender} onChange={(e) => setDepForm((p) => ({ ...p, gender: e.target.value }))}>
                      {GENDER_OPTIONS.map((o) => (
                        <option key={o.value || 'blank'} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="inline-flex items-center gap-2 text-sm text-muted mt-6">
                      <input type="checkbox" disabled={!canEditRelated} checked={depForm.is_nominee} onChange={(e) => setDepForm((p) => ({ ...p, is_nominee: e.target.checked }))} />
                      Is nominee
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-muted mt-6">
                      <input type="checkbox" disabled={!canEditRelated} checked={depForm.is_emergency_contact} onChange={(e) => setDepForm((p) => ({ ...p, is_emergency_contact: e.target.checked }))} />
                      Emergency contact
                    </label>
                  </div>
                  <div className="flex items-end justify-end">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={!canEditRelated || !depForm.name || !depForm.relationship}
                      onClick={async () => {
                        setRelError(null);
                        try {
                          const res = await hrAPI.createEmployeeDependent(effectiveEmployeeId, {
                            ...depForm,
                            date_of_birth: depForm.date_of_birth || null
                          });
                          const js = res.ok ? await res.json() : null;
                          if (!res.ok) throw new Error(js?.message || 'Failed to add dependent');
                          setDepForm({ name: '', relationship: 'spouse', date_of_birth: '', gender: '', is_nominee: false, is_emergency_contact: false });
                          await loadRelated();
                        } catch (e) {
                          setRelError(e.message);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </button>
                  </div>
                </div>

                <div className="mt-4 bg-card rounded-lg border border-border overflow-hidden">
                  {relLoading ? (
                    <div className="p-6 text-sm text-muted">Loading…</div>
                  ) : dependents.length === 0 ? (
                    <div className="p-6 text-sm text-muted">No dependents added yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Name</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Relationship</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">DOB</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Nominee</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Emergency</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {dependents.map((d) => (
                            <tr key={d.id} className="hover:bg-muted/40">
                              <td className="px-3 py-2">{d.name}</td>
                              <td className="px-3 py-2">{d.relationship}</td>
                              <td className="px-3 py-2">{d.date_of_birth ? String(d.date_of_birth).slice(0, 10) : '-'}</td>
                              <td className="px-3 py-2">{d.is_nominee ? 'Yes' : 'No'}</td>
                              <td className="px-3 py-2">{d.is_emergency_contact ? 'Yes' : 'No'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={!canEditRelated}
                                  onClick={async () => {
                                    if (!window.confirm('Delete this dependent?')) return;
                                    await hrAPI.deleteEmployeeDependent(effectiveEmployeeId, d.id);
                                    await loadRelated();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Nominees</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Name</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={nomForm.name} onChange={(e) => setNomForm((p) => ({ ...p, name: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Relationship</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={nomForm.relationship} onChange={(e) => setNomForm((p) => ({ ...p, relationship: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Nominee For</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={nomForm.nominee_for} onChange={(e) => setNomForm((p) => ({ ...p, nominee_for: e.target.value }))} placeholder="pf/esi/gratuity/insurance/other" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Share %</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={nomForm.share_percent} onChange={(e) => setNomForm((p) => ({ ...p, share_percent: e.target.value }))} placeholder="e.g. 50" />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={!canEditRelated || !nomForm.name}
                      onClick={async () => {
                        setRelError(null);
                        try {
                          const res = await hrAPI.createEmployeeNominee(effectiveEmployeeId, {
                            ...nomForm,
                            relationship: nomForm.relationship || null,
                            nominee_for: nomForm.nominee_for || null,
                            share_percent: nomForm.share_percent === '' ? null : nomForm.share_percent
                          });
                          const js = res.ok ? await res.json() : null;
                          if (!res.ok) throw new Error(js?.message || 'Failed to add nominee');
                          setNomForm({ name: '', relationship: '', nominee_for: 'pf', share_percent: '' });
                          await loadRelated();
                        } catch (e) {
                          setRelError(e.message);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </button>
                  </div>
                </div>

                <div className="mt-4 bg-card rounded-lg border border-border overflow-hidden">
                  {relLoading ? (
                    <div className="p-6 text-sm text-muted">Loading…</div>
                  ) : nominees.length === 0 ? (
                    <div className="p-6 text-sm text-muted">No nominees added yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Name</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">For</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Share</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {nominees.map((n) => (
                            <tr key={n.id} className="hover:bg-muted/40">
                              <td className="px-3 py-2">{n.name}</td>
                              <td className="px-3 py-2">{n.nominee_for || '-'}</td>
                              <td className="px-3 py-2">{n.share_percent ?? '-'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={!canEditRelated}
                                  onClick={async () => {
                                    if (!window.confirm('Delete this nominee?')) return;
                                    await hrAPI.deleteEmployeeNominee(effectiveEmployeeId, n.id);
                                    await loadRelated();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Education</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Qualification</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={eduForm.qualification} onChange={(e) => setEduForm((p) => ({ ...p, qualification: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Institution</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={eduForm.institution} onChange={(e) => setEduForm((p) => ({ ...p, institution: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Year of Passing</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={eduForm.year_of_passing} onChange={(e) => setEduForm((p) => ({ ...p, year_of_passing: e.target.value }))} placeholder="e.g. 2020" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Grade/Score</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={eduForm.grade_or_score} onChange={(e) => setEduForm((p) => ({ ...p, grade_or_score: e.target.value }))} />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={!canEditRelated || !eduForm.qualification}
                      onClick={async () => {
                        setRelError(null);
                        try {
                          const res = await hrAPI.createEmployeeEducation(effectiveEmployeeId, {
                            ...eduForm,
                            institution: eduForm.institution || null,
                            year_of_passing: eduForm.year_of_passing === '' ? null : eduForm.year_of_passing,
                            grade_or_score: eduForm.grade_or_score || null
                          });
                          const js = res.ok ? await res.json() : null;
                          if (!res.ok) throw new Error(js?.message || 'Failed to add education');
                          setEduForm({ qualification: '', institution: '', year_of_passing: '', grade_or_score: '' });
                          await loadRelated();
                        } catch (e) {
                          setRelError(e.message);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </button>
                  </div>
                </div>

                <div className="mt-4 bg-card rounded-lg border border-border overflow-hidden">
                  {relLoading ? (
                    <div className="p-6 text-sm text-muted">Loading…</div>
                  ) : education.length === 0 ? (
                    <div className="p-6 text-sm text-muted">No education records yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Qualification</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Institution</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Year</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Score</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {education.map((e) => (
                            <tr key={e.id} className="hover:bg-muted/40">
                              <td className="px-3 py-2">{e.qualification}</td>
                              <td className="px-3 py-2">{e.institution || '-'}</td>
                              <td className="px-3 py-2">{e.year_of_passing ?? '-'}</td>
                              <td className="px-3 py-2">{e.grade_or_score || '-'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={!canEditRelated}
                                  onClick={async () => {
                                    if (!window.confirm('Delete this education record?')) return;
                                    await hrAPI.deleteEmployeeEducation(effectiveEmployeeId, e.id);
                                    await loadRelated();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Experience</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Company</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={expForm.company_name} onChange={(e) => setExpForm((p) => ({ ...p, company_name: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Designation</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={expForm.designation} onChange={(e) => setExpForm((p) => ({ ...p, designation: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">From</label>
                    <input className="input mt-1 w-full" type="date" disabled={!canEditRelated} value={expForm.from_date} onChange={(e) => setExpForm((p) => ({ ...p, from_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">To</label>
                    <input className="input mt-1 w-full" type="date" disabled={!canEditRelated} value={expForm.to_date} onChange={(e) => setExpForm((p) => ({ ...p, to_date: e.target.value }))} />
                  </div>
                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">Notes</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={expForm.notes} onChange={(e) => setExpForm((p) => ({ ...p, notes: e.target.value }))} />
                  </div>
                  <div className="md:col-span-4 flex justify-end">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={!canEditRelated || !expForm.company_name}
                      onClick={async () => {
                        setRelError(null);
                        try {
                          const res = await hrAPI.createEmployeeExperience(effectiveEmployeeId, {
                            ...expForm,
                            designation: expForm.designation || null,
                            from_date: expForm.from_date || null,
                            to_date: expForm.to_date || null,
                            notes: expForm.notes || null
                          });
                          const js = res.ok ? await res.json() : null;
                          if (!res.ok) throw new Error(js?.message || 'Failed to add experience');
                          setExpForm({ company_name: '', designation: '', from_date: '', to_date: '', notes: '' });
                          await loadRelated();
                        } catch (e) {
                          setRelError(e.message);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add
                    </button>
                  </div>
                </div>

                <div className="mt-4 bg-card rounded-lg border border-border overflow-hidden">
                  {relLoading ? (
                    <div className="p-6 text-sm text-muted">Loading…</div>
                  ) : experience.length === 0 ? (
                    <div className="p-6 text-sm text-muted">No experience records yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Company</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Designation</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">From</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">To</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {experience.map((e) => (
                            <tr key={e.id} className="hover:bg-muted/40">
                              <td className="px-3 py-2">{e.company_name}</td>
                              <td className="px-3 py-2">{e.designation || '-'}</td>
                              <td className="px-3 py-2">{e.from_date ? String(e.from_date).slice(0, 10) : '-'}</td>
                              <td className="px-3 py-2">{e.to_date ? String(e.to_date).slice(0, 10) : '-'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={!canEditRelated}
                                  onClick={async () => {
                                    if (!window.confirm('Delete this experience record?')) return;
                                    await hrAPI.deleteEmployeeExperience(effectiveEmployeeId, e.id);
                                    await loadRelated();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Transfers</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">From Department</label>
                    <select className="input mt-1 w-full" disabled={!canEditRelated || mastersLoading} value={trForm.from_department_id} onChange={(e) => setTrForm((p) => ({ ...p, from_department_id: e.target.value }))}>
                      <option value="">—</option>
                      {masters.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">To Department</label>
                    <select className="input mt-1 w-full" disabled={!canEditRelated || mastersLoading} value={trForm.to_department_id} onChange={(e) => setTrForm((p) => ({ ...p, to_department_id: e.target.value }))}>
                      <option value="">—</option>
                      {masters.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Effective From</label>
                    <input className="input mt-1 w-full" type="date" disabled={!canEditRelated} value={trForm.effective_from} onChange={(e) => setTrForm((p) => ({ ...p, effective_from: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">From Location</label>
                    <select className="input mt-1 w-full" disabled={!canEditRelated || mastersLoading} value={trForm.from_location_id} onChange={(e) => setTrForm((p) => ({ ...p, from_location_id: e.target.value }))}>
                      <option value="">—</option>
                      {masters.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">To Location</label>
                    <select className="input mt-1 w-full" disabled={!canEditRelated || mastersLoading} value={trForm.to_location_id} onChange={(e) => setTrForm((p) => ({ ...p, to_location_id: e.target.value }))}>
                      <option value="">—</option>
                      {masters.locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-muted-foreground">Reason</label>
                    <input className="input mt-1 w-full" disabled={!canEditRelated} value={trForm.reason} onChange={(e) => setTrForm((p) => ({ ...p, reason: e.target.value }))} />
                  </div>
                  <div className="md:col-span-3 flex justify-end">
                    <button
                      className="btn btn-primary"
                      type="button"
                      disabled={!canEditRelated}
                      onClick={async () => {
                        setRelError(null);
                        try {
                          if (!masters.departments.length && canReadOrgMasters) await loadMasters();
                          const res = await hrAPI.createEmployeeTransfer(effectiveEmployeeId, {
                            from_department_id: trForm.from_department_id ? Number(trForm.from_department_id) : null,
                            to_department_id: trForm.to_department_id ? Number(trForm.to_department_id) : null,
                            from_location_id: trForm.from_location_id ? Number(trForm.from_location_id) : null,
                            to_location_id: trForm.to_location_id ? Number(trForm.to_location_id) : null,
                            effective_from: trForm.effective_from || null,
                            reason: trForm.reason || null
                          });
                          const js = res.ok ? await res.json() : null;
                          if (!res.ok) throw new Error(js?.message || 'Failed to add transfer');
                          setTrForm({ from_department_id: '', to_department_id: '', from_location_id: '', to_location_id: '', effective_from: '', reason: '' });
                          await loadRelated();
                        } catch (e) {
                          setRelError(e.message);
                        }
                      }}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Add Transfer
                    </button>
                  </div>
                </div>

                <div className="mt-4 bg-card rounded-lg border border-border overflow-hidden">
                  {relLoading ? (
                    <div className="p-6 text-sm text-muted">Loading…</div>
                  ) : transfers.length === 0 ? (
                    <div className="p-6 text-sm text-muted">No transfers recorded yet.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Effective</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">From</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">To</th>
                            <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Reason</th>
                            <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {transfers.map((t) => (
                            <tr key={t.id} className="hover:bg-muted/40">
                              <td className="px-3 py-2">{t.effective_from ? String(t.effective_from).slice(0, 10) : '-'}</td>
                              <td className="px-3 py-2">
                                {(t.from_department_name || t.from_department_id || '-')}{' '}
                                {(t.from_location_name || t.from_location_id) ? `@ ${t.from_location_name || t.from_location_id}` : ''}
                              </td>
                              <td className="px-3 py-2">
                                {(t.to_department_name || t.to_department_id || '-')}{' '}
                                {(t.to_location_name || t.to_location_id) ? `@ ${t.to_location_name || t.to_location_id}` : ''}
                              </td>
                              <td className="px-3 py-2">{t.reason || '-'}</td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  disabled={!canEditRelated}
                                  onClick={async () => {
                                    if (!window.confirm('Delete this transfer record?')) return;
                                    await hrAPI.deleteEmployeeTransfer(effectiveEmployeeId, t.id);
                                    await loadRelated();
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {docsError && (
                <div className="bg-destructive/10 border border-destructive text-destructive px-4 py-2 rounded">
                  {docsError}
                </div>
              )}

              <div className="bg-card rounded-lg border border-border p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Upload, view, or delete employee documents. (Use doc type <span className="font-mono">photo</span> for profile photo.)
                </div>
                <div className="text-xs text-muted-foreground">
                  Max {Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB
                </div>
              </div>

              {/* Structured upload */}
              <div className="bg-muted/30 rounded-xl p-6 border border-border/50">
                <h3 className="text-lg font-semibold text-foreground mb-4">Upload Document</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground">Document Type</label>
                    <select
                      className="input mt-1 w-full"
                      value={docForm.doc_type}
                      onChange={(e) => setDocForm((p) => ({ ...p, doc_type: e.target.value }))}
                    >
                      {DOC_TYPES.filter((d) => d.value !== 'photo').map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs text-muted-foreground">
                      {docForm.doc_type === 'aadhaar'
                        ? 'Aadhaar Number'
                        : docForm.doc_type === 'pan'
                        ? 'PAN Number'
                        : 'Document Number (optional)'}
                    </label>
                    <input
                      className="input mt-1 w-full"
                      value={docForm.doc_number}
                      onChange={(e) => setDocForm((p) => ({ ...p, doc_number: e.target.value }))}
                      placeholder={
                        docForm.doc_type === 'aadhaar'
                          ? '12-digit Aadhaar'
                          : docForm.doc_type === 'pan'
                          ? 'AAAAA9999A'
                          : 'Optional'
                      }
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground">Issue Date (optional)</label>
                    <input
                      className="input mt-1 w-full"
                      type="date"
                      value={docForm.issue_date}
                      onChange={(e) => setDocForm((p) => ({ ...p, issue_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Expiry Date (optional)</label>
                    <input
                      className="input mt-1 w-full"
                      type="date"
                      value={docForm.expiry_date}
                      onChange={(e) => setDocForm((p) => ({ ...p, expiry_date: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="text-xs text-muted-foreground">Remarks (optional)</label>
                    <input
                      className="input mt-1 w-full"
                      value={docForm.remarks}
                      onChange={(e) => setDocForm((p) => ({ ...p, remarks: e.target.value }))}
                      placeholder="Any notes about the document"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="text-xs text-muted-foreground">File</label>
                    <div className="mt-1 flex flex-col md:flex-row gap-3 md:items-center">
                      <label className="btn btn-secondary btn-sm cursor-pointer w-full md:w-auto">
                        Choose file
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e) => setDocForm((p) => ({ ...p, file: e.target.files?.[0] || null }))}
                        />
                      </label>
                      <div className="text-xs text-muted-foreground break-all">
                        {docForm.file ? docForm.file.name : 'No file selected'}
                      </div>
                    </div>
                    {docForm.file && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Selected: {docForm.file.name} ({Math.round(docForm.file.size / 1024)} KB)
                      </div>
                    )}
                  </div>

                  <div className="md:col-span-3 flex justify-end">
                    <button className="btn btn-primary" type="button" onClick={uploadStructuredDoc} disabled={docUploading}>
                      <Upload className="h-4 w-4 mr-2" />
                      {docUploading ? 'Uploading…' : 'Upload'}
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-card rounded-lg border border-border overflow-hidden">
                {docsLoading ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                  </div>
                ) : docs.length === 0 ? (
                  <div className="p-6 text-sm text-muted">No documents uploaded yet.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Type</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">File</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Number</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground uppercase text-xs">Uploaded</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground uppercase text-xs">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {docs.map((d) => (
                          <tr key={d.id} className="hover:bg-muted/40">
                            <td className="px-3 py-2">{d.doc_type}</td>
                            <td className="px-3 py-2">
                              <div className="text-sm">{d.file_name}</div>
                              {d.file_size ? (
                                <div className="text-xs text-muted-foreground">{Math.round(Number(d.file_size) / 1024)} KB</div>
                              ) : null}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {d.doc_number || '-'}
                            </td>
                            <td className="px-3 py-2 text-xs text-muted-foreground">
                              {d.uploaded_at ? String(d.uploaded_at).replace('T', ' ').slice(0, 19) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right whitespace-nowrap">
                              <div className="inline-flex items-center gap-2 justify-end">
                                <button className="btn btn-sm" type="button" onClick={() => viewDoc(d.id)}>
                                  <Eye className="h-4 w-4 mr-1" /> View
                                </button>
                                <button
                                  className="btn btn-sm"
                                  type="button"
                                  onClick={async () => {
                                    if (!window.confirm('Delete this document?')) return;
                                    await deleteDoc(d.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EmployeeProfileModal;

