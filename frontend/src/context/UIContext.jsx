import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, AlertCircle, Info, Loader } from 'lucide-react';

const UIContext = createContext();

export const UIProvider = ({ children }) => {
  const [modal, setModal] = useState(null); // { title, message, onConfirm, onCancel, confirmText, cancelText, type }
  const [toasts, setToasts] = useState([]); // Array of { id, message, type }

  // Modal actions
  const openModal = useCallback((options) => {
    setModal({
      title: options.title || 'Are you sure?',
      message: options.message || '',
      confirmText: options.confirmText || 'Confirm',
      cancelText: options.cancelText || 'Cancel',
      onConfirm: options.onConfirm || null,
      onCancel: options.onCancel || null,
      type: options.type || 'info', // 'danger' | 'warning' | 'info' | 'success'
    });
  }, []);

  const closeModal = useCallback((triggeredByX = false) => {
    if (modal) {
      if (triggeredByX && modal.onCancel) {
        modal.onCancel();
      }
      setModal(null);
    }
  }, [modal]);

  // Toast actions
  const showToast = useCallback((message, type = 'success', options = {}) => {
    const id = options.id || (Date.now() + Math.random().toString(36).substr(2, 9));
    setToasts((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      return [...filtered, { id, message, type }];
    });
    
    // Auto dismiss after 3 seconds unless it's a loading toast
    if (type !== 'loading') {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3000);
    }

    return id;
  }, []);

  // Setup convenience helper methods on showToast
  useEffect(() => {
    showToast.success = (msg, opts) => showToast(msg, 'success', opts);
    showToast.error = (msg, opts) => showToast(msg, 'error', opts);
    showToast.warning = (msg, opts) => showToast(msg, 'warning', opts);
    showToast.info = (msg, opts) => showToast(msg, 'info', opts);
    showToast.loading = (msg, opts) => showToast(msg, 'loading', opts);
    showToast.dismiss = (id) => {
      if (id) {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }
    };
  }, [showToast]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Map types to colors and icons
  const getModalStyles = (type) => {
    switch (type) {
      case 'danger':
        return {
          brandColor: '#ef4444',
          icon: <AlertCircle size={28} color="#ef4444" />,
          buttonBg: '#ef4444',
        };
      case 'warning':
        return {
          brandColor: '#f59e0b',
          icon: <AlertTriangle size={28} color="#f59e0b" />,
          buttonBg: '#f59e0b',
        };
      case 'success':
        return {
          brandColor: '#10b981',
          icon: <CheckCircle size={28} color="#10b981" />,
          buttonBg: '#10b981',
        };
      default:
        return {
          brandColor: 'var(--admin-brand, #E61E2A)',
          icon: <Info size={28} color="var(--admin-brand, #E61E2A)" />,
          buttonBg: 'var(--admin-brand, #E61E2A)',
        };
    }
  };

  const getToastStyles = (type) => {
    switch (type) {
      case 'success':
        return {
          bg: 'rgba(16, 185, 129, 0.1)',
          border: '1px solid rgba(16, 185, 129, 0.25)',
          icon: <CheckCircle size={16} color="#10b981" />,
        };
      case 'error':
        return {
          bg: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
          icon: <AlertCircle size={16} color="#ef4444" />,
        };
      case 'warning':
        return {
          bg: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          icon: <AlertTriangle size={16} color="#f59e0b" />,
        };
      case 'loading':
        return {
          bg: 'rgba(255, 255, 255, 0.05)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          icon: <Loader size={16} color="#FFF" style={{ animation: 'spin 1.5s linear infinite' }} />,
        };
      default:
        return {
          bg: 'rgba(230, 30, 42, 0.1)',
          border: '1px solid rgba(230, 30, 42, 0.25)',
          icon: <Info size={16} color="var(--admin-brand, #E61E2A)" />,
        };
    }
  };

  return (
    <UIContext.Provider value={{ openModal, closeModal, showToast, modal, toasts }}>
      {children}

      {/* Category A: Blocking Center-Screen Modals */}
      {modal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 99999,
          padding: '1rem',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            background: '#15171A',
            border: `1px solid ${getModalStyles(modal.type).brandColor}40`,
            borderRadius: '8px',
            maxWidth: '500px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.75)',
            position: 'relative',
            overflow: 'hidden',
            animation: 'modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)'
          }}>
            {/* Top right X close icon - acts as cancel/dismiss */}
            <button 
              onClick={() => closeModal(true)}
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'transparent',
                border: 'none',
                color: 'var(--admin-text-secondary, #8E9196)',
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'var(--admin-text-secondary, #8E9196)';
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X size={18} />
            </button>

            {/* Modal Content */}
            <div style={{ padding: '2rem 2rem 1.5rem 2rem' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', marginBottom: '1rem' }}>
                {getModalStyles(modal.type).icon}
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    margin: 0,
                    fontSize: '1.25rem',
                    fontWeight: '900',
                    color: '#FFF',
                    letterSpacing: '0.5px',
                    textTransform: 'uppercase'
                  }}>
                    {modal.title}
                  </h3>
                  <div style={{
                    marginTop: '0.75rem',
                    fontSize: '0.9rem',
                    color: 'var(--admin-text-secondary, #8E9196)',
                    lineHeight: '1.6',
                    fontWeight: '500'
                  }}>
                    {modal.message}
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div style={{
              background: '#0F1012',
              padding: '1rem 2rem',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '0.75rem',
              borderTop: '1px solid rgba(255, 255, 255, 0.03)'
            }}>
              <button
                onClick={() => {
                  if (modal.onCancel) modal.onCancel();
                  closeModal();
                }}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '4px',
                  background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  color: 'var(--admin-text-secondary, #8E9196)',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#fff';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--admin-text-secondary, #8E9196)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                }}
              >
                {modal.cancelText}
              </button>
              <button
                onClick={() => {
                  if (modal.onConfirm) modal.onConfirm();
                  closeModal();
                }}
                style={{
                  padding: '0.6rem 1.25rem',
                  borderRadius: '4px',
                  background: getModalStyles(modal.type).buttonBg,
                  border: 'none',
                  color: '#FFF',
                  fontWeight: '700',
                  fontSize: '0.8rem',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.filter = 'brightness(1.1)';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'brightness(1)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {modal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category B: Non-Blocking Center-Screen Toasts */}
      <div style={{
        position: 'fixed',
        top: '1.5rem',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        alignItems: 'center',
        pointerEvents: 'none', // Allow clicking through empty space
      }}>
        {toasts.map((t) => (
          <div
            key={t.id}
            style={{
              pointerEvents: 'auto', // Re-enable clicks for the toast itself
              background: '#15171A',
              color: '#FFF',
              padding: '0.75rem 1.25rem',
              borderRadius: '50px',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              maxWidth: '90vw',
              minWidth: '280px',
              fontSize: '0.85rem',
              fontWeight: '600',
              animation: 'toastSlideIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
              ...getToastStyles(t.type)
            }}
          >
            {getToastStyles(t.type).icon}
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {t.message}
            </span>
            <button
              onClick={() => removeToast(t.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255, 255, 255, 0.4)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: '0.1rem',
                borderRadius: '50%',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#FFF'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)'; }}
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Style Animations (Injected via style block) */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideIn {
          from { transform: scale(0.9) translateY(20px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes toastSlideIn {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </UIContext.Provider>
  );
};

export const useUI = () => {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within a UIProvider');
  }
  return context;
};
