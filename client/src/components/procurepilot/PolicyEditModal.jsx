import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment, useEffect, useMemo, useState } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import clsx from 'clsx';
import {
  formatInr,
  isDraftDirty,
  validatePolicyDraft
} from '../../utils/procurePilotPolicyForm';

/**
 * @typedef {import('../../types/procurePilotPolicy').PolicyFormDraft} PolicyFormDraft
 * @typedef {import('../../types/procurePilotPolicy').PolicyCategoryOption} PolicyCategoryOption
 */

/**
 * @param {{
 *   open: boolean;
 *   roleLevel: number;
 *   roleLabel: string;
 *   roleHint?: string;
 *   initialDraft: PolicyFormDraft;
 *   categories: PolicyCategoryOption[];
 *   saving?: boolean;
 *   onAttemptClose: (draft: PolicyFormDraft) => void;
 *   onRequestSave: (draft: PolicyFormDraft) => void;
 * }} props
 */
export default function PolicyEditModal({
  open,
  roleLevel,
  roleLabel,
  roleHint,
  initialDraft,
  categories,
  saving = false,
  onAttemptClose,
  onRequestSave
}) {
  const [draft, setDraft] = useState(initialDraft);

  useEffect(() => {
    if (open) {
      setDraft(initialDraft);
    }
  }, [open, initialDraft]);

  const validation = useMemo(() => validatePolicyDraft(draft), [draft]);
  const dirty = useMemo(() => isDraftDirty(initialDraft, draft), [initialDraft, draft]);

  const setField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const toggleCategory = (listKey, catId) => {
    setDraft((prev) => {
      const set = new Set(prev[listKey]);
      if (set.has(catId)) set.delete(catId);
      else set.add(catId);
      return { ...prev, [listKey]: [...set] };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validation.valid) return;
    onRequestSave(draft);
  };

  const fieldError = (key) => validation.errors[key];

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={() => !saving && onAttemptClose(draft)}>
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

        <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
          <div className="flex min-h-full items-center justify-center">
            <TransitionChild
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 translate-y-2 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 translate-y-0"
              leaveTo="opacity-0 translate-y-2"
            >
              <DialogPanel className="w-full max-w-2xl rounded-xl bg-card border border-border shadow-2xl flex flex-col max-h-[min(90vh,880px)]">
                <div className="px-5 py-4 border-b border-border flex items-start justify-between gap-3">
                  <div>
                    <DialogTitle className="text-lg font-semibold text-fg">
                      Edit policy — L{roleLevel}
                    </DialogTitle>
                    <p className="text-sm text-muted mt-0.5">{roleLabel}</p>
                    {roleHint ? <p className="text-xs text-muted mt-1 max-w-prose">{roleHint}</p> : null}
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm p-2"
                    onClick={() => onAttemptClose(draft)}
                    disabled={saving}
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
                  <div className="px-5 py-4 space-y-6 overflow-y-auto flex-1">
                    {validation.warnings.form ? (
                      <div
                        className="rounded-lg border border-amber-200 bg-amber-50/80 text-amber-900 text-sm px-3 py-2"
                        role="status"
                      >
                        {validation.warnings.form}
                      </div>
                    ) : null}

                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
                        Spending limits
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Per-transaction cap"
                          hint={formatInr(draft.max_per_transaction)}
                          error={fieldError('max_per_transaction')}
                        >
                          <input
                            type="number"
                            min={0}
                            className="input w-full"
                            value={draft.max_per_transaction}
                            onChange={(e) => setField('max_per_transaction', e.target.value)}
                            aria-invalid={!!fieldError('max_per_transaction')}
                          />
                        </Field>
                        <Field
                          label="Monthly budget"
                          hint={formatInr(draft.max_monthly_budget)}
                          error={fieldError('max_monthly_budget')}
                        >
                          <input
                            type="number"
                            min={0}
                            className="input w-full"
                            value={draft.max_monthly_budget}
                            onChange={(e) => setField('max_monthly_budget', e.target.value)}
                          />
                        </Field>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-3">
                        Approval rules
                      </h3>
                      <div className="grid gap-4 sm:grid-cols-2">
                        <Field
                          label="Auto-approve max amount"
                          hint="Within auto-approve segments only"
                          error={fieldError('auto_approve_max_amount')}
                          warning={validation.warnings.auto_approve_max_amount}
                        >
                          <input
                            type="number"
                            min={0}
                            className="input w-full"
                            value={draft.auto_approve_max_amount}
                            onChange={(e) => setField('auto_approve_max_amount', e.target.value)}
                          />
                        </Field>
                        <Field
                          label="Approval required above"
                          hint="Leave empty for role default"
                          error={fieldError('approval_required_above')}
                        >
                          <input
                            type="number"
                            min={0}
                            placeholder="Optional"
                            className="input w-full"
                            value={draft.approval_required_above}
                            onChange={(e) => setField('approval_required_above', e.target.value)}
                          />
                        </Field>
                      </div>
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                        Allowed segments
                      </h3>
                      {fieldError('allowed_categories') ? (
                        <p className="text-xs text-destructive mb-2">{fieldError('allowed_categories')}</p>
                      ) : null}
                      <SegmentPicker
                        categories={categories}
                        selected={draft.allowed_categories}
                        onToggle={(id) => toggleCategory('allowed_categories', id)}
                        variant="primary"
                      />
                    </section>

                    <section>
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                        Auto-approve segments
                      </h3>
                      {fieldError('auto_approve_categories') ? (
                        <p className="text-xs text-destructive mb-2">{fieldError('auto_approve_categories')}</p>
                      ) : null}
                      <SegmentPicker
                        categories={categories}
                        selected={draft.auto_approve_categories}
                        onToggle={(id) => toggleCategory('auto_approve_categories', id)}
                        variant="success"
                      />
                    </section>

                    <section>
                      <Field label="Internal notes" hint="Visible to policy admins only">
                        <textarea
                          rows={3}
                          className="textarea w-full"
                          value={draft.notes}
                          onChange={(e) => setField('notes', e.target.value)}
                          placeholder="e.g. FY26 department cap alignment"
                        />
                      </Field>
                    </section>
                  </div>

                  <div className="px-5 py-4 border-t border-border flex flex-wrap items-center justify-between gap-3 bg-muted/20 rounded-b-xl">
                    <p className="text-xs text-muted">
                      {dirty ? 'Unsaved changes' : 'No changes'}
                      {!validation.valid ? ' · Fix errors to save' : ''}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => onAttemptClose(draft)}
                        disabled={saving}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="btn btn-primary btn-sm inline-flex items-center gap-2"
                        disabled={saving || !validation.valid || !dirty}
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Review & save
                      </button>
                    </div>
                  </div>
                </form>
              </DialogPanel>
            </TransitionChild>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}

function Field({ label, hint, error, warning, children }) {
  return (
    <label className="block text-sm">
      <span className="form-label">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted mt-1 block">{hint}</span> : null}
      {warning ? <span className="text-xs text-amber-700 mt-1 block">{warning}</span> : null}
      {error ? <span className="text-xs text-destructive mt-1 block" role="alert">{error}</span> : null}
    </label>
  );
}

function SegmentPicker({ categories, selected, onToggle, variant }) {
  return (
    <div className="flex flex-wrap gap-2">
      {categories.map((c) => {
        const active = selected.includes(c.id);
        return (
          <button
            key={c.id}
            type="button"
            onClick={() => onToggle(c.id)}
            className={clsx(
              'text-xs px-2.5 py-1.5 rounded-full border transition-colors',
              active && variant === 'primary' && 'bg-primary/15 border-primary text-primary',
              active && variant === 'success' && 'bg-emerald-500/15 border-emerald-600 text-emerald-800',
              !active && 'border-border text-muted hover:border-input hover:text-fg'
            )}
            aria-pressed={active}
          >
            {c.label || c.id}
          </button>
        );
      })}
    </div>
  );
}
