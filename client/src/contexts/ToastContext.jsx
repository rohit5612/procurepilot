import React, { createContext, useContext, useMemo, useRef, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback((message, type = 'info', ttl = 3000) => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, type }]);
    if (ttl > 0) {
      setTimeout(() => remove(id), ttl);
    }
    return id;
  }, [remove]);

  const value = useMemo(() => ({ toasts, add, remove }), [toasts, add, remove]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Viewport */}
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2 rounded shadow text-sm border ${
              t.type === 'error' ? 'bg-danger text-white border-transparent' :
              t.type === 'success' ? 'bg-primary text-white border-transparent' :
              'bg-card text-fg border-default'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <span>{t.message}</span>
              <button className="opacity-70 hover:opacity-100" onClick={() => remove(t.id)}>×</button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToastContext = () => useContext(ToastContext);


