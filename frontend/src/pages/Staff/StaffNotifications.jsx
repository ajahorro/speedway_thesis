import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import { Bell, CheckCircle, Trash2, Search, AlertTriangle } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';
import { useAuth } from '../../hooks/useAuth';

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

const StaffNotifications = () => {
  const { profile } = useAuth();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const fetchNotifications = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      logger.error('Staff Notification Fetch Error', err);
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const channel = supabase.channel(`staff-notifs-${profile?.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile?.id}` }, () => fetchNotifications())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const handleMarkAsRead = async (id) => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('id', id);
      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      toast.success('Notification acknowledged');
    } catch (err) {
      logger.error('Mark Read Error', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase.from('notifications').update({ is_read: true }).eq('user_id', profile.id).eq('is_read', false);
      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
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
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification removed');
    } catch (err) {
      logger.error('Delete Notification Error', err);
      toast.error('Failed to remove notification');
    }
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = n.message?.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'UNREAD') return matchesSearch && !n.is_read;
    if (filter === 'READ') return matchesSearch && n.is_read;
    return matchesSearch;
  });

  const cardStyle = { background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', padding: '1.25rem' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      {confirmDeleteId !== null && <DeleteConfirmModal onConfirm={handleConfirmDelete} onCancel={() => setConfirmDeleteId(null)} />}

      <PageHeader badge="STAFF SIGNALS" title="NOTIFICATIONS" subtitle="Updates on your assigned tasks and system alerts." onRefresh={fetchNotifications}>
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
        {loading ? (
          [1,2,3].map(i => <div key={i} style={{ height: '100px', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)' }} className="animate-pulse" />)
        ) : filteredNotifications.length > 0 ? (
          filteredNotifications.map((notif) => (
            <div key={notif.id} style={{ ...cardStyle, opacity: notif.is_read ? 0.6 : 1, borderLeft: notif.is_read ? '1px solid var(--admin-border)' : '4px solid var(--admin-brand)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <Bell size={20} color={notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)'} />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '950', color: notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)' }}>{notif.notification_type || 'SYSTEM'}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)' }}>{new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'white' }}>{notif.title || 'Notification Received'}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>{notif.message}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!notif.is_read && <button onClick={() => handleMarkAsRead(notif.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><CheckCircle size={18} /></button>}
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

export default StaffNotifications;
