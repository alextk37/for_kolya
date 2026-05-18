import type { ToastMessage } from '../types';
import { ICONS } from '../hooks/useToast';

export function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast toast--${toast.type}`}
          onClick={() => onRemove(toast.id)}
          role="alert"
        >
          <span className="toast__icon">{ICONS[toast.type]}</span>
          <span className="toast__text">{toast.text}</span>
          <button className="toast__close" onClick={() => onRemove(toast.id)}>
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
