import { createContext, useCallback, useContext, useRef, useState } from 'react';
import Modal from '../components/Modal.jsx';

const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation dialog:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: 'Delete player?', message: '...', tone: 'danger' })) {...}
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((opts) => {
    setState({ title: 'Are you sure?', confirmText: 'Confirm', cancelText: 'Cancel', tone: 'primary', ...opts });
    return new Promise((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = (result) => {
    setState(null);
    if (resolver.current) resolver.current(result);
    resolver.current = null;
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal open={!!state} onClose={() => close(false)} title={state?.title} size="sm">
        {state && (
          <>
            <p className="muted" style={{ marginTop: 0 }}>{state.message}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => close(false)}>{state.cancelText}</button>
              <button className={`btn btn-${state.tone}`} onClick={() => close(true)} autoFocus>
                {state.confirmText}
              </button>
            </div>
          </>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
