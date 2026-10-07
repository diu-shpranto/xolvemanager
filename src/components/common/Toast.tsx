import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, number>());

  const showToast = (message: string, type: ToastType = 'success') => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev.slice(-4), { id, message, type }]);

    const timer = window.setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
      timers.current.delete(id);
    }, type === 'error' ? 6500 : type === 'warning' ? 5500 : 4000);
    timers.current.set(id, timer);
  };

  useEffect(() => {
    return () => timers.current.forEach(window.clearTimeout);
  }, []);

  const removeToast = (id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] z-[80] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 flex-col gap-2 sm:left-auto sm:right-5 sm:top-auto sm:bottom-5 sm:bottom-[calc(env(safe-area-inset-bottom,0px)+1.25rem)] sm:translate-x-0">
        {toasts.map(toast => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
            className={`pointer-events-auto flex items-start justify-between gap-3 rounded-xl border p-3.5 text-sm shadow-lg transition-all duration-200 animate-in slide-in-from-bottom-2 ${
              toast.type === 'success'
                ? 'bg-white text-slate-900 border-emerald-200 dark:bg-slate-900 dark:text-white dark:border-emerald-900'
                : toast.type === 'error'
                  ? 'bg-white text-slate-900 border-rose-200 dark:bg-slate-900 dark:text-white dark:border-rose-900'
                  : toast.type === 'warning'
                    ? 'bg-white text-slate-900 border-amber-200 dark:bg-slate-900 dark:text-white dark:border-amber-900'
                    : 'bg-white text-slate-900 border-blue-200 dark:bg-slate-900 dark:text-white dark:border-blue-900'
            }`}
          >
            <div className="flex min-w-0 items-start gap-2.5">
              {toast.type === 'success' && <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
              {toast.type === 'error' && <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />}
              {toast.type === 'warning' && <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />}
              {toast.type === 'info' && <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />}
              <span className="break-words font-medium leading-5">{toast.message}</span>
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
