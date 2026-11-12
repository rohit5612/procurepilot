import React, { useEffect, useState } from 'react';
import { inventoryAPI } from '../../utils/api';
import { usePermissions } from '../../hooks/usePermissions';
import { Plus, Edit, Trash2, RefreshCw, CheckCircle, X, AlertTriangle, SortAsc } from 'lucide-react';

const TransactionCategoryManagementPage = () => {
  const { hasPermission } = usePermissions();
  const canRead = hasPermission('inventory.transaction_categories.read');
  const canCreate = hasPermission('inventory.transaction_categories.create');
  const canUpdate = hasPermission('inventory.transaction_categories.update');
  const canDelete = hasPermission('inventory.transaction_categories.delete');
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [showCreate, setShowCreate] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [selected, setSelected] = useState(null);

  const [form, setForm] = useState({
    category_code: '',
    name: '',
    description: '',
    sort_order: 0,
    is_active: true
  });

  useEffect(() => {
    if (canRead) fetchCategories();
  }, [canRead]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await inventoryAPI.getTransactionCategories(true);
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js.message || 'Failed to load categories');
      setCategories(Array.isArray(js.data) ? js.data : []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => setForm({ category_code: '', name: '', description: '', sort_order: 0, is_active: true });

  const openCreate = () => { resetForm(); setShowCreate(true); };
  const openEdit = (cat) => { setSelected(cat); setForm({ category_code: cat.category_code, name: cat.name, description: cat.description || '', sort_order: cat.sort_order || 0, is_active: !!cat.is_active }); setShowEdit(true); };

  const onCreate = async (e) => {
    e.preventDefault();
    try {
      setError(null);
      const res = await inventoryAPI.createTransactionCategory({
        category_code: form.category_code,
        name: form.name,
        description: form.description || null,
        sort_order: Number(form.sort_order || 0),
        is_active: !!form.is_active
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js.message || 'Failed to create category');
      setSuccess('Category created');
      setShowCreate(false);
      fetchCategories();
    } catch (e) { setError(e.message); }
  };

  const onUpdate = async (e) => {
    e.preventDefault();
    try {
      if (!selected) return;
      setError(null);
      const res = await inventoryAPI.updateTransactionCategory(selected.id, {
        category_code: form.category_code,
        name: form.name,
        description: form.description || null,
        sort_order: Number(form.sort_order || 0),
        is_active: !!form.is_active
      });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js.message || 'Failed to update category');
      setSuccess('Category updated');
      setShowEdit(false);
      fetchCategories();
    } catch (e) { setError(e.message); }
  };

  const toggleActive = async (cat, active) => {
    try {
      setError(null);
      const res = await inventoryAPI.updateTransactionCategory(cat.id, { is_active: !!active });
      const js = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(js.message || 'Failed to update status');
      fetchCategories();
    } catch (e) { setError(e.message); }
  };

  const onDelete = async (cat) => {
    try {
      if (!window.confirm(`Delete category "${cat.name}"? This cannot be undone.`)) return;
      const res = await inventoryAPI.deleteTransactionCategory(cat.id);
      if (res.status === 409) {
        const js = await res.json().catch(() => ({}));
        setError(js.message || 'Category is in use; deactivate instead');
        return;
      }
      if (!res.ok) {
        const js = await res.json().catch(() => ({}));
        throw new Error(js.message || 'Failed to delete');
      }
      setSuccess('Category deleted');
      fetchCategories();
    } catch (e) { setError(e.message); }
  };

  return (
    <div className="space-y-6">
      {!canRead && (
        <div className="flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-fg mb-2">Access Denied</h2>
            <p className="text-muted">You don't have permission to view Transaction Categories.</p>
          </div>
        </div>
      )}
      {canRead && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-fg">Transaction Categories</h1>
              <p className="text-muted">Manage categories used in Purchase Orders and Issues</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="btn btn-secondary" onClick={fetchCategories}><RefreshCw className="w-4 h-4 mr-1"/>Refresh</button>
              {canCreate && (
                <button className="btn btn-primary" onClick={openCreate}><Plus className="w-4 h-4 mr-1"/>Add Category</button>
              )}
            </div>
          </div>

          {error && (
            <div className="card border-destructive">
              <div className="card-body flex items-center gap-2 text-destructive">
                <AlertTriangle className="w-4 h-4"/>
                <span>{error}</span>
              </div>
            </div>
          )}
          {success && (
            <div className="card border-green-300">
              <div className="card-body flex items-center gap-2 text-green-700">
                <CheckCircle className="w-4 h-4"/>
                <span>{success}</span>
                <button className="btn btn-secondary ml-auto" onClick={()=>setSuccess(null)}>Dismiss</button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-body overflow-x-auto">
              {loading ? (
                <div className="text-muted">Loading…</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Code</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Name</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Description</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase"><div className="inline-flex items-center gap-1">Sort <SortAsc className="w-3 h-3"/></div></th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase">Status</th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-muted-foreground uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map(cat => (
                      <tr key={cat.id} className="border-b border-default hover:bg-muted/50">
                        <td className="px-4 py-3">{cat.category_code}</td>
                        <td className="px-4 py-3 font-medium text-fg">{cat.name}</td>
                        <td className="px-4 py-3 text-sm text-muted">{cat.description || '-'}</td>
                        <td className="px-4 py-3">{cat.sort_order}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${cat.is_active ? 'badge-success' : 'badge-danger'}`}>{cat.is_active ? 'Active' : 'Inactive'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            {canUpdate && (
                              <button className="btn btn-secondary" onClick={() => openEdit(cat)}><Edit className="w-4 h-4"/></button>
                            )}
                            {canUpdate && (
                              cat.is_active ? (
                                <button className="btn btn-secondary" onClick={() => toggleActive(cat, false)}>Deactivate</button>
                              ) : (
                                <button className="btn btn-secondary" onClick={() => toggleActive(cat, true)}>Activate</button>
                              )
                            )}
                            {canDelete && (
                              <button className="btn btn-danger" onClick={() => onDelete(cat)}><Trash2 className="w-4 h-4"/></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {categories.length === 0 && (
                      <tr><td className="px-4 py-6 text-center text-muted" colSpan={6}>No categories found</td></tr>
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {showCreate && canCreate && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="card w-full max-w-md">
                <div className="card-header flex items-center justify-between"><h3 className="text-lg font-semibold">Create Category</h3><button className="btn" onClick={()=>setShowCreate(false)}><X className="w-5 h-5"/></button></div>
                <form className="card-body space-y-3" onSubmit={onCreate}>
                  <div>
                    <label className="form-label">Code</label>
                    <input className="input" value={form.category_code} onChange={(e)=>setForm({...form, category_code: e.target.value})} required />
                  </div>
                  <div>
                    <label className="form-label">Name</label>
                    <input className="input" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} required />
                  </div>
                  <div>
                    <label className="form-label">Description</label>
                    <textarea className="input" rows={3} value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})}/>
                  </div>
                  <div>
                    <label className="form-label">Sort Order</label>
                    <input type="number" className="input" value={form.sort_order} onChange={(e)=>setForm({...form, sort_order: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="is_active" checked={form.is_active} onChange={(e)=>setForm({...form, is_active: e.target.checked})} />
                    <label htmlFor="is_active">Active</label>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowCreate(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Create</button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {showEdit && selected && canUpdate && (
            <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
              <div className="card w-full max-w-md">
                <div className="card-header flex items-center justify-between"><h3 className="text-lg font-semibold">Edit Category</h3><button className="btn" onClick={()=>setShowEdit(false)}><X className="w-5 h-5"/></button></div>
                <form className="card-body space-y-3" onSubmit={onUpdate}>
                  <div>
                    <label className="form-label">Code</label>
                    <input className="input" value={form.category_code} onChange={(e)=>setForm({...form, category_code: e.target.value})} required />
                  </div>
                  <div>
                    <label className="form-label">Name</label>
                    <input className="input" value={form.name} onChange={(e)=>setForm({...form, name: e.target.value})} required />
                  </div>
                  <div>
                    <label className="form-label">Description</label>
                    <textarea className="input" rows={3} value={form.description} onChange={(e)=>setForm({...form, description: e.target.value})}/>
                  </div>
                  <div>
                    <label className="form-label">Sort Order</label>
                    <input type="number" className="input" value={form.sort_order} onChange={(e)=>setForm({...form, sort_order: parseInt(e.target.value) || 0})} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="edit_active" checked={form.is_active} onChange={(e)=>setForm({...form, is_active: e.target.checked})} />
                    <label htmlFor="edit_active">Active</label>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" className="btn btn-secondary" onClick={()=>setShowEdit(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Update</button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default TransactionCategoryManagementPage;


