import React, { useState, useEffect } from 'react';
import { Bell, CreditCard, Clock, CheckCircle2, MessageCircle, CheckCircle, AlertCircle, Trash2, CheckCircle as CheckIcon } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { fetchNotifications, markNotificationAsRead, markAllAsRead, deleteNotification } from '../../services/notificationService';
import toast from 'react-hot-toast';

const CustomerNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const data = await fetchNotifications(user.id);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const channel = supabase.channel(`notifs-${user?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user?.id}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const filtered = notifications.filter(n => {
    if (filter === 'UNREAD') return !n.is_read;
    return true;
  });

  const handleMarkRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      toast.error('Failed to update notification');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead(user.id);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (err) {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'PAYMENT_VERIFIED': return <CreditCard size={20} color="#10b981" />;
      case 'VEHICLE_COMPLETED': return <CheckCircle2 size={20} color="#10b981" />;
      case 'READY_FOR_PICKUP': return <CheckIcon size={20} color="var(--admin-brand)" />;
      case 'BOOKING_CONFIRMED': return <CheckCircle size={20} color="var(--admin-info)" />;
      case 'PAYMENT_REJECTED': return <AlertCircle size={20} color="#ef4444" />;
      case 'CHAT_MESSAGE': return <MessageCircle size={20} color="#3b82f6" />;
      default: return <Bell size={20} color="var(--admin-text-secondary)" />;
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'white' }}>Notification Ledger</h1>
          <p style={{ color: 'var(--admin-text-secondary)', fontWeight: '600', fontSize: '0.9rem', margin: 0 }}>
            Official record of system alerts, payment verifications, and service milestones.
          </p>
        </div>
        <button 
          onClick={handleMarkAllRead}
          disabled={!notifications.some(n => !n.is_read)}
          style={{ padding: '0.75rem 1.25rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'white', borderRadius: '8px', fontSize: '0.75rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', opacity: notifications.some(n => !n.is_read) ? 1 : 0.5 }}
        >
          Mark all as read
        </button>
      </div>

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', background: 'var(--admin-card)', padding: '0.5rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', width: 'fit-content' }}>
        {['ALL', 'UNREAD'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{ padding: '0.5rem 1.5rem', background: filter === f ? 'var(--admin-brand)' : 'transparent', color: filter === f ? 'white' : 'var(--admin-text-secondary)', border: 'none', borderRadius: '6px', fontWeight: '900', fontSize: '0.8rem', cursor: 'pointer', textTransform: 'uppercase' }}
          >
            {f} ({f === 'ALL' ? notifications.length : notifications.filter(n => !n.is_read).length})
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--admin-brand)', fontWeight: '900' }}>SYNCHRONIZING LEDGER...</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: '5rem 2rem', textAlign: 'center', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px dashed var(--admin-border)' }}>
            <Bell size={48} color="var(--admin-text-secondary)" style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
            <h3 style={{ color: 'white', fontWeight: '950', margin: '0 0 0.5rem 0' }}>LEDGER IS EMPTY</h3>
            <p style={{ color: 'var(--admin-text-secondary)', fontWeight: '600', fontSize: '0.9rem' }}>No operational alerts match your current filter.</p>
          </div>
        ) : (
          filtered.map(n => (
            <div
              key={n.id}
              style={{
                background: 'var(--admin-card)',
                border: '1px solid var(--admin-border)',
                borderRadius: 'var(--admin-radius)',
                padding: '1.5rem',
                display: 'flex',
                gap: '1.5rem',
                position: 'relative',
                transition: 'all 0.2s ease',
                opacity: n.is_read ? 0.7 : 1,
                borderLeft: n.is_read ? '1px solid var(--admin-border)' : '4px solid var(--admin-brand)'
              }}
            >
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {getIcon(n.notification_type)}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '1rem', fontWeight: '950', color: 'white' }}>{n.title}</span>
                  <span style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>
                <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600', margin: '0 0 1rem 0', lineHeight: 1.5 }}>
                  {n.message}
                </p>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  {!n.is_read && (
                    <button onClick={() => handleMarkRead(n.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', padding: 0 }}>
                      Mark as Read
                    </button>
                  )}
                  <button onClick={() => handleDelete(n.id)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', padding: 0, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

    </div>
  );
};

export default CustomerNotifications;
