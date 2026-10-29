import { Info, TriangleAlert, X } from 'lucide-react';
import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { cx } from '../lib/cx';
import styles from './Toast.module.css';

type ToastKind = 'info' | 'error';
type ShowToast = (message: string, kind?: ToastKind) => void;

interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}

const ToastContext = createContext<ShowToast>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback<ShowToast>(
    (message, kind = 'info') => {
      const id = nextId.current++;
      setToasts((list) => [...list.filter((t) => t.message !== message), { id, message, kind }].slice(-3));
      setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4000);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className={styles.viewport} role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div key={toast.id} className={cx(styles.toast, toast.kind === 'error' && styles.error)}>
            {toast.kind === 'error' ? <TriangleAlert size={18} aria-hidden /> : <Info size={18} aria-hidden />}
            <span className={styles.message}>{toast.message}</span>
            <button type="button" className={styles.close} aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ShowToast {
  return useContext(ToastContext);
}
