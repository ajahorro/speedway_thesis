import React, { useState, useEffect } from 'react';
import { Bell, ShieldCheck, CheckCircle, Clock } from 'lucide-react';
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
      case 'PAYMENT_VERIFIED': return <ShieldCheck size={16} color="var(--admin-success)" />;
      case 'STATUS_UPDATE': return <Clock size={16} color="var(--admin-brand)" />;
      case 'BOOKING_CONFIRMED': return <CheckCircle size={16} color="var(--admin-info)" />;
      case 'TASK_ASSIGNED': return <Clock size={16} color="#a855f7" />;
      default: return <Bell size={16} color="var(--admin-text-secondary)" />;
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
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--admin-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>Alerts</h3>
        <button
          onClick={() => navigate('/customer/notifications')}
          style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.75rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          View All
        </button>
      </div>

      <div style={{ padding: '0.5rem 0', display: 'flex', flexDirection: 'column' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-brand)', fontWeight: '900', fontSize: '0.85rem' }}>Loading...</div>
        ) : notifications.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>No notifications yet</div>
        ) : (
          notifications.map((notif) => (
            <div
              key={notif.id}
              className="admin-card-hover"
              style={{
                padding: '1rem 1.5rem',
                borderBottom: '1px solid var(--admin-border)',
                cursor: 'pointer',
                display: 'flex',
                gap: '1rem',
                background: notif.is_read ? 'transparent' : 'rgba(var(--admin-brand-rgb), 0.03)'
              }}
            >
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: 'var(--admin-bg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--admin-border)',
                flexShrink: 0
              }}>
                {getIcon(notif.type)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: notif.is_read ? '800' : '950', color: 'var(--admin-text-primary)' }}>
                  {notif.title}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', lineHeight: 1.4 }}>
                  {notif.message}
                </div>
                <div style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--admin-text-secondary)', marginTop: '0.25rem', textTransform: 'uppercase' }}>
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
