import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment, useState } from 'react';
import { FlaskConical, Loader2, X } from 'lucide-react';
import { evaluatePolicy, PolicyApiError } from '../../services/procurePilotPolicyService';
import { formatInr } from '../../utils/procurePilotPolicyForm';

/**
 * @typedef {import('../../types/procurePilotPolicy').PolicyCategoryOption} PolicyCategoryOption
 */

/**
 * @param {{
 *   open: boolean;
 *   categories: PolicyCategoryOption[];
 *   onClose: () => void;
 * }} props
 */
export default function PolicySimulatorModal({ open, categories, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [maxBudget, setMaxBudget] = useState('80000');
  const [deadline, setDeadline] = useState('2026-10-24');
  const [category, setCategory] = useState('office');

  const run = async () => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await evaluatePolicy({
        request: {
          maximum_budget: Number(maxBudget),
          delivery_deadline: deadline,
          procurement_category: category
        },
        offers: [
          { id: 'A', supplier_name: 'Supplier A', price: 76000, delivery_date: deadline },
          { id: 'B', supplier_name: 'Supplier B', price: 84000, delivery_date: '2026-10-23' },
          { id: 'C', supplier_name: 'Supplier C', price: 72000, delivery_date: '2026-10-28' }
        ]
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof PolicyApiError ? e.message : e.message || 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" />
        </TransitionChild>

        <div className="fixed inset-0 overflow-y-auto p-4">
          <div className="flex min-h-full items-center justify-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100"
              leaveTo="opacity-0 scale-95"
            >
              <DialogPanel className="w-full max-w-3xl rounded-xl bg-card border border-border shadow-2xl">
                <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-primary" />
                    <DialogTitle className="text-lg font-semibold">Policy simulator</DialogTitle>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm p-2" onClick={onClose} aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-sm text-muted">
                    Runs the same deterministic engine as AI Buy (demo chair scenario). Uses your signed-in user&apos;s
                    effective policy.
                  </p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <label className="text-sm">
                      <span className="form-label">Max budget (INR)</span>
                      <input className="input w-full" value={maxBudget} onChange={(e) => setMaxBudget(e.target.value)} />
                    </label>
                    <label className="text-sm">
                      <span className="form-label">Delivery deadline</span>
                      <input
                        type="date"
                        className="input w-full"
                        value={deadline}
                        onChange={(e) => setDeadline(e.target.value)}
                      />
                    </label>
                    <label className="text-sm">
                      <span className="form-label">Segment</span>
                      <select className="input w-full" value={category} onChange={(e) => setCategory(e.target.value)}>
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.label || c.id}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {error ? (
                    <div className="text-sm text-destructive border border-destructive/30 rounded-lg px-3 py-2" role="alert">
                      {error}
                    </div>
                  ) : null}

                  {result ? (
                    <div className="rounded-lg border border-border overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 text-xs text-muted flex justify-between">
                        <span>Recommended: {result.recommended_offer_id || 'None'}</span>
                        <span>Approval: {result.approval?.required ? 'Required' : 'Not required'}</span>
                      </div>
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs text-muted border-b border-border">
                            <th className="px-3 py-2">Offer</th>
                            <th className="px-3 py-2">Price</th>
                            <th className="px-3 py-2">Status</th>
                            <th className="px-3 py-2">Reason</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(result.offers || []).map((o) => (
                            <tr key={o.offer_id} className="border-b border-border last:border-0">
                              <td className="px-3 py-2">{o.supplier_name || o.offer_id}</td>
                              <td className="px-3 py-2 tabular-nums">{formatInr(o.price)}</td>
                              <td className="px-3 py-2">
                                <span
                                  className={
                                    o.eligible
                                      ? 'text-emerald-700 font-medium'
                                      : 'text-destructive font-medium'
                                  }
                                >
                                  {o.eligible ? 'Eligible' : 'Rejected'}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-xs text-muted">
                                {o.violations?.[0]?.message || '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>

                <div className="px-5 py-4 border-t border-border flex justify-end gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
                    Close
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm inline-flex items-center gap-2"
                    onClick={run}
                    disabled={loading}
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Run simulation
                  </button>
                </div>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
