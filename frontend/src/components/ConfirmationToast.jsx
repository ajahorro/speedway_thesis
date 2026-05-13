import React from 'react';
import ReactDOM from 'react-dom';
import { confirmationStyles as s } from '../styles/confirmationStyles';

const ConfirmationToast = ({ 
  t, 
  title, 
  message, 
  icon: Icon, 
  confirmLabel = 'Confirm', 
  cancelLabel = 'Cancel', 
  onConfirm, 
  onCancel,
  variant = 'danger',
  centered = false
}) => {
  const content = (
    <div style={{
      ...s.container,
      animation: t.visible ? 'toastEnter 0.35s cubic-bezier(0.21, 1.02, 0.73, 1) forwards' : 'toastExit 0.4s cubic-bezier(0.06, 0.71, 0.55, 1) forwards',
    }}>
      <style>{`
        @keyframes toastEnter {
          0% { transform: translateY(-20px) scale(0.95); opacity: 0; }
          100% { transform: translateY(0) scale(1); opacity: 1; }
        }
        @keyframes toastExit {
          0% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.9); opacity: 0; }
        }
      `}</style>
      <div style={s.header}>
        {Icon && (
          <div style={{
            ...s.iconWrapper,
            background: variant === 'danger' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(var(--admin-brand-rgb), 0.1)',
            borderColor: variant === 'danger' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(var(--admin-brand-rgb), 0.2)',
          }}>
            <Icon size={20} color={variant === 'danger' ? '#ef4444' : 'var(--admin-brand)'} />
          </div>
        )}
        <div>
          <p style={s.title}>{title}</p>
          <p style={s.message}>{message}</p>
        </div>
      </div>

      <div style={s.buttonContainer}>
        <button 
          onClick={onCancel}
          style={s.cancelButton ? { ...s.buttonBase, ...s.cancelButton } : s.buttonBase}
        >
          {cancelLabel}
        </button>
        <button 
          onClick={onConfirm}
          style={{
            ...s.buttonBase,
            ...s.confirmButton,
            background: variant === 'danger' ? '#ef4444' : 'var(--admin-brand)'
          }}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );

  if (centered) {
    return ReactDOM.createPortal(
      <div style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(10px)',
        zIndex: 999999,
        pointerEvents: 'auto'
      }}>
        {content}
      </div>,
      document.body
    );
  }

  return content;
};

export default ConfirmationToast;
