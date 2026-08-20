import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import PageHeader from "../components/PageHeader";
import { Bell, CheckCircle, Trash2, Search, AlertTriangle, X, Info, Calendar, Star, Megaphone, ExternalLink } from 'lucide-react';
import { useMediaQuery } from "../hooks/useMediaQuery";
import toast from 'react-hot-toast';
import { logger } from "../utils/logger";
import { useAuth } from "../hooks/useAuth";
import { useUnifiedData } from "../context/UnifiedContext";

import NotificationDetailsModal from '../components/NotificationDetailsModal';

const DeleteConfirmModal = ({ onConfirm, onCancel }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 9999,
    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '1rem'
  }}>
    <div style={{
      background: 'var(--admin-card)',
      border: '1px solid var(--admin-border)',
      borderRadius: 'var(--admin-radius)',
      padding: '2rem',
      maxWidth: '420px',
      width: '100%',
      boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'rgba(239,68,68,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0
        }}>
          <AlertTriangle size={20} color="#ef4444" />
        </div>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-primary)' }}>
          Confirm Deletion
        </h3>
      </div>
      <p style={{ margin: '0 0 1.5rem 0', fontSize: '0.875rem', color: 'var(--admin-text-secondary)', fontWeight: '600', lineHeight: 1.6 }}>
        Are you sure you want to delete this notification? This action cannot be undone.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{ padding: '0.75rem 1.5rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '950', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer' }}>Cancel</button>
        <button onClick={onConfirm} style={{ padding: '0.75rem 1.5rem', background: '#ef4444', border: 'none', borderRadius: 'var(--admin-radius-sm)', color: 'white', fontWeight: '950', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer' }}>Confirm Delete</button>
      </div>
    </div>
  </div>
);

const GlobalNotifications = () => {
  const { user, profile } = useAuth();
  const { notifications: globalNotifications, refreshData } = useUnifiedData();
  const isMobile = useMediaQuery('(max-width: 1024px)');

  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectedNotification, setSelectedNotification] = useState(null);

  const handleMarkAsRead = async (id, silent = false) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
      await refreshData();
      if (!silent) toast.success('Notification acknowledged');
    } catch (err) {
      logger.error('Mark Read Error', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
      if (error) throw error;
      await refreshData();
      toast.success('All notifications acknowledged');
    } catch (err) {
      logger.error('Mark All Read Error', err);
    }
  };

  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    try {
      const { error } = await supabase.from('notifications').delete().eq('id', id);
      if (error) throw error;
      await refreshData();
      toast.success('Notification removed');
    } catch (err) {
      logger.error('Delete Notification Error', err);
      toast.error('Failed to remove notification');
    }
  };

  const filteredNotifications = (globalNotifications || []).filter(n => {
    const matchesSearch = n.message?.toLowerCase().includes(searchQuery.toLowerCase()) || n.title?.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'UNREAD') return matchesSearch && !n.is_read;
    if (filter === 'READ') return matchesSearch && n.is_read;
    return matchesSearch;
  });

  const cardStyle = { background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', padding: '1.25rem', cursor: 'pointer', transition: '0.2s' };

  return (
    <div style={{ width: '100%', maxWidth: '1400px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>
      {confirmDeleteId !== null && <DeleteConfirmModal onConfirm={handleConfirmDelete} onCancel={() => setConfirmDeleteId(null)} />}
      <NotificationDetailsModal notification={selectedNotification} onClose={() => setSelectedNotification(null)} onMarkRead={handleMarkAsRead} profile={profile} />

      <PageHeader badge="SYSTEM ALERTS" title="NOTIFICATIONS" subtitle="Stay informed about operational updates, bookings, and account activity." onRefresh={refreshData}>
        <button onClick={handleMarkAllAsRead} style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}>mark all as read</button>
      </PageHeader>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', background: 'var(--admin-card)', padding: '0.75rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)' }}>
        <div style={{ position: 'relative', flex: 1, width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
          <input type="text" placeholder="Search notifications..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '600', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--admin-bg)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
          {['ALL', 'UNREAD', 'READ'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{ padding: '0.5rem 1rem', borderRadius: 'var(--admin-radius-sm)', border: 'none', background: filter === f ? 'var(--admin-brand)' : 'transparent', color: filter === f ? 'white' : 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer' }}>{f}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
        {filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                setSelectedNotification(notif);
                if (!notif.is_read) handleMarkAsRead(notif.id, true);
              }}
              style={{ ...cardStyle, opacity: notif.is_read ? 0.6 : 1, borderLeft: notif.is_read ? '1px solid var(--admin-border)' : '4px solid var(--admin-brand)' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--admin-brand)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--admin-border)'}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', minWidth: 0 }}>
                  <Bell size={20} color={notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)'} style={{ flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.15rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '950', color: notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)' }}>{notif.notification_type || 'SYSTEM'}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)' }}>{new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{notif.title || 'Notification Received'}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => setConfirmDeleteId(notif.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem 1.5rem', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px dashed var(--admin-border)' }}>
            <Bell size={20} style={{ opacity: 0.3, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: '950', fontSize: '0.85rem', textTransform: 'uppercase' }}>All Clear</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>No notifications match your current filter.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default GlobalNotifications;