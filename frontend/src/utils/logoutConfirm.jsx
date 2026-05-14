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
    <ConfirmationToast
      t={t}
      title={title}
      message={message}
      icon={icon}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      variant={variant}
      centered={true}
      onConfirm={() => {
        onConfirm();
        toast.dismiss(t.id);
      }}
      onCancel={() => toast.dismiss(t.id)}
    />
  ), {
    duration: Infinity,
  });
};

/**
 * Specialized logout confirmation
 */
export const confirmLogout = (onConfirm) => {
  showConfirmation({
    title: 'End Session?',
    message: 'Are you sure you want to log out of your account? Any unsaved progress may be lost.',
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
