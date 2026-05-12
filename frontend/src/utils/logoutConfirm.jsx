import toast from 'react-hot-toast';
import { LogOut, AlertTriangle, Trash2 } from 'lucide-react';
import ConfirmationToast from '../components/ConfirmationToast';

/**
 * Generic confirmation orchestrator
 */
export const showConfirmation = ({ 
  title, 
  message, 
  icon, 
  confirmLabel, 
  cancelLabel, 
  onConfirm, 
  variant = 'danger' 
}) => {
  toast.custom((t) => (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      pointerEvents: t.visible ? 'auto' : 'none',
      zIndex: 9999
    }}>
      <div 
        style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(0,0,0,0.4)', 
          backdropFilter: 'blur(4px)',
          opacity: t.visible ? 1 : 0,
          transition: 'opacity 0.3s ease',
          pointerEvents: 'none'
        }} 
      />
      <ConfirmationToast
        t={t}
        title={title}
        message={message}
        icon={icon}
        confirmLabel={confirmLabel}
        cancelLabel={cancelLabel}
        variant={variant}
        onConfirm={() => {
          onConfirm();
          toast.dismiss(t.id);
        }}
        onCancel={() => toast.dismiss(t.id)}
      />
    </div>
  ), {
    duration: Infinity,
    position: 'top-center',
  });
};

/**
 * Specialized logout confirmation
 */
export const confirmLogout = (onConfirm) => {
  showConfirmation({
    title: 'Terminate Session?',
    message: 'Are you sure you want to log out of the admin panel?',
    icon: LogOut,
    confirmLabel: 'Log Out',
    onConfirm,
    variant: 'danger'
  });
};

/**
 * Specialized delete confirmation (Example for future use)
 */
export const confirmDelete = (itemName, onConfirm) => {
  showConfirmation({
    title: 'Confirm Deletion',
    message: `Are you sure you want to delete ${itemName}? This action cannot be undone.`,
    icon: Trash2,
    confirmLabel: 'Delete',
    onConfirm,
    variant: 'danger'
  });
};
