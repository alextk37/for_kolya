import { useEffect, useRef } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function Modal({
  open,
  title,
  placeholder = '',
  initialValue = '',
  confirmLabel = 'Сохранить',
  cancelLabel = 'Отмена',
  onConfirm,
  onCancel,
}: ModalProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.value = initialValue;
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [open, initialValue]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = inputRef.current?.value.trim() || '';
    if (val) onConfirm(val);
  };

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal__title">{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            className="modal__input"
            type="text"
            placeholder={placeholder}
            defaultValue={initialValue}
            autoFocus
          />
          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
            <button type="submit" className="btn btn--primary">
              {confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
