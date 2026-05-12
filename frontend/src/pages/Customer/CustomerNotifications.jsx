import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bell, Check, Trash2, Loader2, Calendar, 
  MessageCircle, CreditCard, CheckCircle2, 
  AlertCircle, ChevronRight, Inbox, Filter, MoreVertical, CheckCircle
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllAsRead, 
  deleteNotification, 
  clearAllNotifications 
} from '../../services/notificationService';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

const CustomerNotifications = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL'); // ALL, UNREAD

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(user.id);
      setNotifications(data);
    } catch (error) {
      console.error('Notif Load Error:', error);
      toast.error('Failed to sync notification ledger.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (error) {
      toast.error('Failed to update notification.');
    }
  };

  const handleMarkAllRead = async () => {
    if (notifications.filter(n => !n.is_read).length === 0) return;
    const toastId = toast.loading('Marking all as read...');
    try {
      await markAllAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read', { id: toastId });
    } catch (error) {
      toast.error('Failed to update notifications', { id: toastId });
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification removed');
    } catch (error) {
      toast.error('Failed to delete notification.');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to clear your entire notification history?')) return;
    const toastId = toast.loading('Clearing history...');
    try {
      await clearAllNotifications(user.id);
      setNotifications([]);
      toast.success('History cleared', { id: toastId });
    } catch (error) {
      toast.error('Failed to clear notifications', { id: toastId });
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'PAYMENT_APPROVED':
      case 'PAYMENT_RECEIVED':
        return <CreditCard size={18} color="#10b981" />;
      case 'PAYMENT_REJECTED':
        return <AlertCircle size={18} color="#ef4444" />;
      case 'TASK_ASSIGNED':
      case 'STATUS_UPDATE':
        return <Calendar size={18} color="var(--admin-brand)" />;
      case 'VEHICLE_COMPLETED':
        return <CheckCircle2 size={18} color="#10b981" />;
      case 'CHAT_MESSAGE':
        return <MessageCircle size={18} color="#3b82f6" />;
      default:
        return <Bell size={18} color="var(--admin-text-secondary)" />;
    }
  };

  const filteredNotifications = filter === 'UNREAD' 
    ? notifications.filter(n => !n.is_read) 
    : notifications;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
        <Loader2 size={40} className="animate-spin" color="var(--admin-brand)" />
        <p style={{ fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Synchronizing Ledger...</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '900px', margin: '0 auto', width: '100%', paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'white', letterSpacing: '-1.5px' }}>Notifications</h1>
          <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', opacity: 0.8 }}>
            Real-time updates from the Speedway Fleet Engine.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button 
            onClick={handleMarkAllRead}
            style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <CheckCircle size={14} /> Mark All Read
          </button>
          <button 
            onClick={handleClearAll}
            style={{ padding: '0.75rem 1.25rem', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Trash2 size={14} /> Clear All
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--admin-card)', padding: '0.4rem', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)', width: 'fit-content' }}>
        {['ALL', 'UNREAD'].map(f => (
          <button 
            key={f}
            onClick={() => setFilter(f)}
            style={{ padding: '0.5rem 1.25rem', background: filter === f ? 'var(--admin-brand)' : 'transparent', color: filter === f ? 'white' : 'var(--admin-text-secondary)', border: 'none', borderRadius: '4px', fontWeight: '950', cursor: 'pointer', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '1px', transition: 'all 0.2s ease' }}
          >
            {f} {f === 'UNREAD' && notifications.filter(n => !n.is_read).length > 0 && `(${notifications.filter(n => !n.is_read).length})`}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {filteredNotifications.length === 0 ? (
          <div style={{ background: 'var(--admin-card)', border: '2px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', padding: '5rem 2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' }}>
            <Inbox size={60} strokeWidth={1} style={{ opacity: 0.1, color: 'white' }} />
            <div>
              <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '900', color: 'white', textTransform: 'uppercase' }}>No Notifications Found</h3>
              <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>You're all caught up with the fleet operations.</p>
            </div>
          </div>
        ) : (
          filteredNotifications.map(notif => (
            <div 
              key={notif.id}
              onClick={() => {
                if (!notif.is_read) handleMarkRead(notif.id);
                if (notif.action_url) navigate(notif.action_url);
              }}
              style={{
                background: notif.is_read ? 'var(--admin-card)' : 'rgba(var(--admin-brand-rgb), 0.03)',
                border: `1px solid ${notif.is_read ? 'var(--admin-border)' : 'rgba(var(--admin-brand-rgb), 0.2)'}`,
                borderRadius: 'var(--admin-radius-lg)',
                padding: '1.5rem',
                display: 'flex',
                gap: '1.5rem',
                alignItems: 'flex-start',
                cursor: 'pointer',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                position: 'relative',
                overflow: 'hidden'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.02)';
                e.currentTarget.style.transform = 'translateX(5px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = notif.is_read ? 'var(--admin-card)' : 'rgba(var(--admin-brand-rgb), 0.03)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              {!notif.is_read && (
                <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: 'var(--admin-brand)' }} />
              )}

              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getIcon(notif.notification_type)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem' }}>
                  <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: notif.is_read ? 'var(--admin-text-primary)' : 'white' }}>{notif.title}</h3>
                  <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--admin-text-secondary)', opacity: 0.6 }}>
                    {new Date(notif.created_at).toLocaleDateString()} • {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ margin: '0 0 1rem 0', color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600', lineHeight: 1.5 }}>{notif.message}</p>
                
                {notif.action_url && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--admin-brand)', fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    View Details <ChevronRight size={14} />
                  </div>
                )}
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(notif.id);
                }}
                style={{ padding: '0.5rem', background: 'transparent', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', opacity: 0, transition: 'opacity 0.2s' }}
                className="notif-delete-btn"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))
        )}
      </div>

      <style>{`
        div:hover > .notif-delete-btn {
          opacity: 0.6 !important;
        }
        .notif-delete-btn:hover {
          opacity: 1 !important;
          color: #ef4444 !important;
        }
      `}</style>
    </div>
  );
};

export default CustomerNotifications;
