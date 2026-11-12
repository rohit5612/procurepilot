import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import { Fragment } from 'react';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import clsx from 'clsx';

/**
 * @param {{
 *   open: boolean;
 *   title: string;
 *   description?: string;
 *   children?: import('react').ReactNode;
 *   confirmLabel?: string;
 *   cancelLabel?: string;
 *   variant?: 'danger' | 'primary' | 'neutral';
 *   loading?: boolean;
 *   onConfirm: () => void;
 *   onCancel: () => void;
 * }} props
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  loading = false,
  onConfirm,
  onCancel
}) {
  const Icon = variant === 'danger' ? AlertTriangle : Info;
  const confirmClass = clsx(
    'btn btn-sm inline-flex items-center justify-center gap-2 min-w-[5.5rem]',
    variant === 'danger' && 'btn-danger',
    variant === 'primary' && 'btn-primary',
    variant === 'neutral' && 'btn-secondary'
  );

  return (
    <Transition show={open} as={Fragment}>
      <Dialog as="div" className="relative z-[60]" onClose={() => !loading && onCancel()}>
        <TransitionChild
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/45 backdrop-blur-[2px]" aria-hidden="true" />
        </TransitionChild>

        <div className="fixed inset-0 flex items-center justify-center p-4">
          <TransitionChild
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0 scale-95"
            enterTo="opacity-100 scale-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100 scale-100"
            leaveTo="opacity-0 scale-95"
          >
            <DialogPanel className="w-full max-w-md rounded-xl bg-card border border-border shadow-xl">
              <div className="p-5 flex gap-4">
                <div
                  className={clsx(
                    'h-10 w-10 rounded-full flex items-center justify-center shrink-0',
                    variant === 'danger' ? 'bg-red-100 text-red-700' : 'bg-secondary text-secondary-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <DialogTitle className="text-base font-semibold text-fg">{title}</DialogTitle>
                  {description ? (
                    <p className="mt-1.5 text-sm text-muted leading-relaxed">{description}</p>
                  ) : null}
                  {children ? <div className="mt-3 text-sm text-fg">{children}</div> : null}
                </div>
              </div>
              <div className="px-5 py-4 border-t border-border flex justify-end gap-2 bg-muted/30 rounded-b-xl">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={onCancel}
                  disabled={loading}
                >
                  {cancelLabel}
                </button>
                <button type="button" className={confirmClass} onClick={onConfirm} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {confirmLabel}
                </button>
              </div>
            </DialogPanel>
          </TransitionChild>
        </div>
      </Dialog>
    </Transition>
  );
}
