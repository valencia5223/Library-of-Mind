import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Info, XCircle, X } from 'lucide-react';
import { subscribeNotify, dismissToast } from '../utils/notify';

const ICONS = { success: CheckCircle2, warning: AlertTriangle, error: XCircle, info: Info };

// 앱 전체 알림(토스트)과 확인 창. main.jsx 에서 App 옆에 한 번만 붙인다.
export default function NotifyHost() {
  const [state, setState] = useState({ toasts: [], dialog: null });
  const okRef = useRef(null);

  useEffect(() => subscribeNotify(setState), []);

  const dialog = state.dialog;

  useEffect(() => {
    if (!dialog) return;
    okRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dialog.close(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dialog]);

  return (
    <>
      <div className="toast-stack" role="status" aria-live="polite">
        {state.toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={18} className="toast-icon" />
              <span className="toast-text">{t.text}</span>
              <button type="button" className="toast-close" onClick={() => dismissToast(t.id)} aria-label="알림 닫기">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      {dialog && (
        <div className="notify-overlay" onMouseDown={(e) => e.target === e.currentTarget && dialog.close(false)}>
          <div className="notify-dialog" role="alertdialog" aria-modal="true" aria-label={dialog.title || '확인'}>
            <div className={`notify-dialog-icon ${dialog.danger ? 'is-danger' : ''}`}>
              {dialog.danger ? <AlertTriangle size={20} /> : <Info size={20} />}
            </div>
            <div className="notify-dialog-body">
              {dialog.title && <h3 className="notify-dialog-title">{dialog.title}</h3>}
              <p className="notify-dialog-message">{dialog.message}</p>
            </div>
            <div className="notify-dialog-actions">
              {dialog.kind === 'confirm' && (
                <button type="button" className="btn btn-secondary" onClick={() => dialog.close(false)}>
                  {dialog.cancelText}
                </button>
              )}
              <button
                ref={okRef}
                type="button"
                className={`btn ${dialog.danger ? 'btn-danger-solid' : 'btn-primary'}`}
                onClick={() => dialog.close(true)}
              >
                {dialog.okText}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
