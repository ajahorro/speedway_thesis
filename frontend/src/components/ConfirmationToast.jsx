import React from 'react';
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
  variant = 'danger' 
}) => {
  return (
    <div style={s.container}>
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
};

export default ConfirmationToast;
