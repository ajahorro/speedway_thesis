import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, CheckCircle, Clock, CreditCard, AlertCircle, CheckCircle2, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { fetchNotifications, subscribeToNotifications } from '../../services/notificationService';
import { supabase } from '../../lib/supabase';

const RecentNotifications = ({ userId }) => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;

    const load = async () => {
      try {
        const data = await fetchNotifications(userId);
        setNotifications(data.slice(0, 5)); // Show latest 5
      } catch (err) {
        console.error('Notification fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    load();

    // Real-time: auto-refresh on new notification
    const channel = subscribeToNotifications(userId, () => load());
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const getIcon = (type) => {
    switch (type) {
      case 'PAYMENT_APPROVED':
      case 'PAYMENT_RECEIVED':
      case 'PAYMENT_VERIFIED':
        return <CreditCard size={16} color="#10b981" />;
      case 'PAYMENT_REJECTED':
        return <AlertCircle size={16} color="#ef4444" />;
      case 'TASK_ASSIGNED':
      case 'STATUS_UPDATE':
        return <Clock size={16} color="var(--admin-brand)" />;
      case 'VEHICLE_COMPLETED':
        return <CheckCircle2 size={16} color="#10b981" />;
      case 'CHAT_MESSAGE':
        return <MessageCircle size={16} color="#3b82f6" />;
      case 'BOOKING_CONFIRMED':
        return <CheckCircle size={16} color="var(--admin-info)" />;
      default:
        return <Bell size={16} color="var(--admin-text-secondary)" />;
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <div style={{
      background: 'var(--admin-card)',
      borderRadius: 'var(--admin-radius-lg)',
      border: '1px solid var(--admin-border)',
      boxShadow: 'var(--admin-card-shadow)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }}>
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--admin-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Operational Alerts</h3>
        <button
          onClick={() => navigate('/customer/notifications')}
          style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          View All
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-brand)', fontWeight: '900', fontSize: '0.8rem' }}>SYNCING...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '3rem 1.5rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '600', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <Bell size={24} style={{ opacity: 0.2 }} />
            NO RECENT ACTIVITY
          </div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                if (notif.action_url) navigate(notif.action_url);
                else navigate('/customer/notifications');
              }}
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--admin-border)',
                cursor: 'pointer',
                display: 'flex',
                gap: '1rem',
                background: notif.is_read ? 'transparent' : 'rgba(var(--admin-brand-rgb), 0.03)',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={(e) => e.currentTarget.style.background = notif.is_read ? 'transparent' : 'rgba(var(--admin-brand-rgb), 0.03)'}
            >
              <div style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: 'rgba(255,255,255,0.03)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--admin-border)',
                flexShrink: 0
              }}>
                {getIcon(notif.notification_type)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', minWidth: 0 }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '950', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {notif.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {notif.message}
                </div>
                <div style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--admin-text-secondary)', marginTop: '0.25rem', textTransform: 'uppercase', opacity: 0.6 }}>
                  {timeAgo(notif.created_at)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default RecentNotifications;
