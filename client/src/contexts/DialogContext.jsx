import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const DialogContext = createContext(null);

export const DialogProvider = ({ children }) => {
  const [dialog, setDialog] = useState({ open: false, title: '', message: '', onClose: null });

  const close = useCallback(() => {
    const cb = dialog.onClose;
    setDialog({ open: false, title: '', message: '', onClose: null });
    try { cb && cb(); } catch {}
  }, [dialog]);

  const open = useCallback((title, message, onClose = null) => {
    setDialog({ open: true, title: title || 'Notice', message: message || '', onClose });
  }, []);

  const value = useMemo(() => ({ open, close }), [open, close]);

  return (
    <DialogContext.Provider value={value}>
      {children}
      {dialog.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card rounded-xl shadow-2xl w-full max-w-md border border-default">
            <div className="p-4 border-b border-default font-semibold text-fg">{dialog.title || 'Notice'}</div>
            <div className="p-4 text-sm text-fg whitespace-pre-wrap">{dialog.message}</div>
            <div className="p-4 border-t border-default flex justify-end">
              <button className="btn btn-primary" onClick={close}>OK</button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => useContext(DialogContext);


