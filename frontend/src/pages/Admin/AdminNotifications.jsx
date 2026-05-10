import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import { Bell, CheckCircle, Clock, Trash2, Filter, Search } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

const AdminNotifications = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      logger.admin('Scanning for system signals...');
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      logger.admin('Signal spectrum synchronized.');
    } catch (err) {
      logger.error('Notification Fetch Error', err);
      toast.error('Failed to load signals.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
      toast.success('Signal acknowledged');
    } catch (err) {
      logger.error('Mark Read Error', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('is_read', false);

      if (error) throw error;
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      toast.success('All signals acknowledged');
    } catch (err) {
      logger.error('Mark All Read Error', err);
    }
  };

  const handleDelete = async (id) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Signal purged');
    } catch (err) {
      logger.error('Delete Notification Error', err);
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
      <PageHeader badge="SYSTEM SIGNALS" title="NOTIFICATIONS" subtitle="Operational alerts and system activity logs." onRefresh={fetchNotifications}>
        <button onClick={handleMarkAllAsRead} style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}>mark all as read</button>
      </PageHeader>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '1rem', background: 'var(--admin-card)', padding: '0.75rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)' }}>
        <div style={{ position: 'relative', flex: 1, width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
          <input type="text" placeholder="Search signals..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontWeight: '600', outline: 'none' }} />
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
                      <span style={{ fontSize: '0.65rem', fontWeight: '950', color: notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)' }}>{notif.type}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)' }}>{new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700' }}>{notif.message}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!notif.is_read && <button onClick={() => handleMarkAsRead(notif.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><CheckCircle size={18} /></button>}
                  <button onClick={() => handleDelete(notif.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><Trash2 size={18} /></button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '5rem', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px dashed var(--admin-border)' }}>
            <Bell size={48} style={{ opacity: 0.2, marginBottom: '1.5rem' }} />
            <h3 style={{ margin: 0, fontWeight: '950' }}>ALL CLEAR</h3>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
