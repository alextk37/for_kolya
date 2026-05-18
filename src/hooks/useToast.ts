import { useState, useCallback, useRef, useEffect } from 'react';
import type { ToastMessage } from '../types';

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Очистка таймеров при размонтировании
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const addToast = useCallback(
    (type: ToastMessage['type'], text: string, duration: number = 3000) => {
      const id = `toast-${++toastIdCounter}`;
      const toast: ToastMessage = { id, type, text, duration };
      setToasts((prev) => [...prev, toast]);

      if (duration > 0) {
        const timer = setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== id));
          timersRef.current.delete(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const success = useCallback((text: string) => addToast('success', text), [addToast]);
  const error = useCallback((text: string) => addToast('error', text, 5000), [addToast]);
  const info = useCallback((text: string) => addToast('info', text), [addToast]);
  const warning = useCallback((text: string) => addToast('warning', text, 4000), [addToast]);

  return { toasts, addToast, removeToast, success, error, info, warning };
}

const ICONS: Record<ToastMessage['type'], string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠',
};

export { ICONS };
