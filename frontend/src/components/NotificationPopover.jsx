import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useUnifiedData } from '../context/UnifiedContext';
import { Bell, CheckCheck, ChevronRight, Info, Calendar, Star, Megaphone } from 'lucide-react';
import NotificationDetailsModal from './NotificationDetailsModal';

const TYPE_ICONS = {
  ANNOUNCEMENT: Megaphone,
  BOOKING_CREATED: Calendar,
  BOOKING_UPDATED: Calendar,
  BOOKING_CONFIRMED: Calendar,
  BOOKING_CANCELLED: Calendar,
  PAYMENT_SUBMITTED: Star,
  PAYMENT_VERIFIED: Star,
  default: Info,
};

const getIcon = (type) => TYPE_ICONS[type] || TYPE_ICONS.default;

function timeAgo(dateStr) {
  const diff = (Date.now() - new Date(dateStr)) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// 1. Destructured `onRead` from props
const NotificationPopover = ({ profile, onClose, onRead }) => {
  const navigate = useNavigate();
  // 2. Extracted `refreshData` from global context
  const { notifications, isLoading: loading, refreshData } = useUnifiedData();
  const [selectedNotification, setSelectedNotification] = useState(null);

  const recentNotifications = (notifications || []).slice(0, 5);

  const handleMarkAllRead = async () => {
    const unreadIds = (notifications || []).filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .in('id', unreadIds);

    if (!error) {
      // 3. Sync global context and refresh header count in CustomerLayout
      if (typeof refreshData === 'function') await refreshData();
      if (typeof onRead === 'function') await onRead();
      window.dispatchEvent(new Event('notificationsRead'));
    }
  };

  const handleNotificationClick = async (n) => {
    if (!n.is_read) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', n.id);
      // 4. Update state when clicking an individual unread item
      if (typeof refreshData === 'function') await refreshData();
      if (typeof onRead === 'function') await onRead();
    }

    setSelectedNotification(n);
  };

  const isAdmin = profile?.role?.toUpperCase() === 'ADMIN';
  const isStaff = profile?.role?.toUpperCase() === 'STAFF';
  const notifPath = isAdmin ? '/admin/notifications' : isStaff ? '/staff/notifications' : '/customer/notifications';

  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      right: 0,
      width: '340px',
      maxWidth: '90vw',
      background: 'var(--admin-card)',
      border: '1px solid var(--admin-border)',
      borderRadius: 'var(--admin-radius)',
      boxShadow: 'var(--admin-card-shadow)',
      zIndex: 100,
      marginTop: '0.5rem',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Bell size={14} color="var(--admin-brand)" />
          <span style={{ fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--admin-brand)' }}>
            Notifications
          </span>
        </div>
        <button
          onClick={handleMarkAllRead}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '800', padding: '0.2rem 0.4rem', borderRadius: '4px' }}
        >
          <CheckCheck size={12} />
          Mark all read
        </button>
      </div>

      {/* Notification List */}
      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>
            Loading...
          </div>
        ) : recentNotifications.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            No notifications yet
          </div>
        ) : (
          recentNotifications.map(n => {
            const Icon = getIcon(n.notification_type);
            return (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                style={{
                  padding: '0.9rem 1.25rem',
                  borderBottom: '1px solid var(--admin-border)',
                  display: 'flex', gap: '0.75rem', alignItems: 'flex-start',
                  background: n.is_read ? 'transparent' : 'rgba(var(--admin-brand-rgb), 0.04)',
                  transition: 'background 0.2s',
                  cursor: 'pointer'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => e.currentTarget.style.background = n.is_read ? 'transparent' : 'rgba(var(--admin-brand-rgb), 0.04)'}
              >
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  background: n.is_read ? 'rgba(255,255,255,0.04)' : 'rgba(var(--admin-brand-rgb), 0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Icon size={13} color={n.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.72rem', fontWeight: n.is_read ? '700' : '900',
                    color: n.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-text-primary)',
                    lineHeight: 1.4, marginBottom: '0.2rem',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical'
                  }}>
                    {n.message}
                  </div>
                  <div style={{ fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>
                    {timeAgo(n.created_at)}
                  </div>
                </div>
                {!n.is_read && (
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--admin-brand)', flexShrink: '0', marginTop: '4px' }} />
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <button
        onClick={() => { navigate(notifPath); onClose(); }}
        style={{
          width: '100%', padding: '0.85rem', background: 'var(--admin-bg)',
          border: 'none', borderTop: '1px solid var(--admin-border)',
          color: 'var(--admin-text-secondary)', fontWeight: '950', fontSize: '0.65rem',
          cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
          transition: 'color 0.2s'
        }}
        onMouseEnter={e => e.currentTarget.style.color = 'var(--admin-brand)'}
        onMouseLeave={e => e.currentTarget.style.color = 'var(--admin-text-secondary)'}
      >
        View All Notifications <ChevronRight size={12} />
      </button>

      {/* Render Modal if a notification is selected */}
      <NotificationDetailsModal
        notification={selectedNotification}
        onClose={() => {
          setSelectedNotification(null);
          onClose(); // Optional: Close the popover after viewing the modal
        }}
        onMarkRead={null} // Already marked read on click
        profile={profile}
      />
    </div>
  );
};

export default NotificationPopover;