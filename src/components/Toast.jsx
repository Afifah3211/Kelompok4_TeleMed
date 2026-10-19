import React from 'react';
import { useApp } from '../context/AppContext';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toasts } = useApp();

  if (!toasts || toasts.length === 0) return null;

  return (
    <div className="toast-container">
      {toasts.map((toast) => {
        let Icon = Info;
        let className = 'toast-item toast-info';

        if (toast.type === 'success') {
          Icon = CheckCircle2;
          className = 'toast-item toast-success';
        } else if (toast.type === 'danger') {
          Icon = AlertCircle;
          className = 'toast-item toast-danger';
        }

        return (
          <div key={toast.id} className={className}>
            <Icon size={20} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, lineHeight: 1.35 }}>{toast.message}</div>
          </div>
        );
      })}
    </div>
  );
}
