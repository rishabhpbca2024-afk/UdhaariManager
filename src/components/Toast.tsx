import React from 'react';
import { CheckCircle2, AlertCircle } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface ToastProps {
  toast: ToastData | null;
}

export const Toast: React.FC<ToastProps> = ({ toast }) => {
  if (!toast) return null;

  return (
    <div className="toast-container">
      <div className={`toast toast-${toast.type}`}>
        {toast.type === 'success' ? (
          <CheckCircle2 size={18} color="var(--primary)" style={{ flexShrink: 0 }} />
        ) : (
          <AlertCircle size={18} color="var(--status-overdue-text)" style={{ flexShrink: 0 }} />
        )}
        <span>{toast.message}</span>
      </div>
    </div>
  );
};

export default Toast;
