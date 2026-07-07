import { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Props {
  toast: ToastState | null;
  onDismiss: () => void;
  duration?: number;
}

export default function Toast({ toast, onDismiss, duration = 6000 }: Props) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [toast, duration, onDismiss]);

  if (!toast) return null;
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.actionLabel && (
        <button
          className="toast-action"
          onClick={() => {
            toast.onAction?.();
            onDismiss();
          }}
        >
          {toast.actionLabel}
        </button>
      )}
      <button className="toast-close" aria-label="Dismiss" onClick={onDismiss}>
        <X size={15} />
      </button>
    </div>
  );
}
