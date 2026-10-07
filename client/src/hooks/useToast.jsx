import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const push = useCallback(
    (message, tone = 'info', ttl = 3500) => {
      const id = ++idRef.current;
      setToasts((t) => [...t.slice(-4), { id, message, tone }]);
      if (ttl) setTimeout(() => remove(id), ttl);
      return id;
    },
    [remove]
  );

  const value = useMemo(
    () => ({
      toast: push,
      success: (m, ttl) => push(m, 'success', ttl),
      error: (m, ttl) => push(m, 'danger', ttl ?? 5000),
      info: (m, ttl) => push(m, 'info', ttl),
      warning: (m, ttl) => push(m, 'warning', ttl),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`} onClick={() => remove(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
