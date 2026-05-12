import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import { Bell, CheckCircle, Clock, Trash2, Filter, Search, AlertTriangle, X } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRMATION MODAL (REQ #5)
// NOTE: This modal is ONLY used for notification deletion.
// Notification deletions are intentionally NOT written to audit_logs.
// Audit logs must only track creation events and system-level booking actions.
// ─────────────────────────────────────────────────────────────────────────────
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
      {/* Header */}
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
        <button
          onClick={onCancel}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'var(--admin-bg)',
            border: '1px solid var(--admin-border)',
            borderRadius: 'var(--admin-radius-sm)',
            color: 'var(--admin-text-primary)',
            fontWeight: '950',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            padding: '0.75rem 1.5rem',
            background: '#ef4444',
            border: 'none',
            borderRadius: 'var(--admin-radius-sm)',
            color: 'white',
            fontWeight: '950',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            cursor: 'pointer'
          }}
        >
          Confirm Delete
        </button>
      </div>
    </div>
  </div>
);

const AdminNotifications = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [broadcastForm, setBroadcastForm] = useState({ message: '' });
  const [broadcasting, setBroadcasting] = useState(false);

  // ── Deletion Confirmation State ──────────────────────────────────────────
  const [confirmDeleteId, setConfirmDeleteId] = useState(null); // null = modal hidden

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

  // ── BROADCAST HANDLER (REQ-ADM-13) ──────────────────────────────────────
  // Writes one notification per profile (all roles: ADMIN, STAFF, CUSTOMER).
  // Also inserts a corresponding AUDIT LOG entry so the Admin action is traceable.
  const handleBroadcast = async (e) => {
    e.preventDefault();
    if (!broadcastForm.message.trim()) return;
    
    setBroadcasting(true);
    try {
      logger.admin('Preparing global signal broadcast...');
      
      // Step 1: Get current admin user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user found');

      // Step 2: Fetch ALL profiles (Admin + Staff + Customer)
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id');
        
      if (profileError) throw profileError;
      
      // Step 3: Insert one notification row per profile
      const broadcastNotifications = profiles.map(p => ({
        user_id: p.id,
        title: 'System Announcement 📣',
        notification_type: 'ANNOUNCEMENT',
        message: broadcastForm.message,
        is_read: false
      }));
      
      const { error: broadcastError } = await supabase
        .from('notifications')
        .insert(broadcastNotifications);
        
      if (broadcastError) throw broadcastError;

      // Step 4: Create Audit Log entry for the broadcast action (REQ #4)
      // This records WHO sent the broadcast and WHEN — audit trail for admin accountability.
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          action_type: 'BROADCAST_SENT',
          actor_name: user.email,
          actor_role: 'ADMIN',
          details: `Global broadcast transmitted to ${profiles.length} users. Message: "${broadcastForm.message.substring(0, 100)}${broadcastForm.message.length > 100 ? '...' : ''}"`,
          created_at: new Date().toISOString()
        });

      if (auditError) {
        // Non-blocking: log warning but don't fail the broadcast
        logger.error('Audit Log Warning (broadcast)', auditError);
      } else {
        logger.admin('Audit log entry created for broadcast action.');
      }
      
      toast.success(`Broadcast signal transmitted to ${profiles.length} receivers`);
      setBroadcastForm({ message: '' });
      fetchNotifications();
      logger.admin('Global broadcast complete.');
    } catch (err) {
      logger.error('Broadcast Error', err);
      toast.error('Failed to transmit global signal');
    } finally {
      setBroadcasting(false);
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

  // ── DELETE HANDLER (REQ #5) ──────────────────────────────────────────────
  // Triggered only after the user confirms via the modal.
  // CRITICAL: No audit_log entry is created here. Notification cleanup is
  // considered a routine housekeeping action, not a system-level event.
  const handleConfirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null); // Close modal immediately
    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Signal purged');
      // ⚠️ Intentionally NO audit_log insert here — per system design (REQ #5 CRITICAL)
    } catch (err) {
      logger.error('Delete Notification Error', err);
      toast.error('Failed to purge signal');
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

      {/* DELETE CONFIRMATION MODAL */}
      {confirmDeleteId !== null && (
        <DeleteConfirmModal
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
        />
      )}

      <PageHeader badge="SYSTEM SIGNALS" title="NOTIFICATIONS" subtitle="Operational alerts and system activity logs." onRefresh={fetchNotifications}>
        <button onClick={handleMarkAllAsRead} style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}>mark all as read</button>
      </PageHeader>

      {/* GLOBAL BROADCAST COMPOSER (REQ-ADM-13) */}
      <div style={{ ...cardStyle, border: '1px dashed var(--admin-brand)', background: 'rgba(var(--admin-brand-rgb), 0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
          <Bell size={20} color="var(--admin-brand)" />
          <div>
            <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', textTransform: 'uppercase' }}>Global Broadcast Hub</h3>
            <p style={{ margin: 0, fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>Transmit a priority announcement to all staff and customers. Action is logged in Audit Logs.</p>
          </div>
        </div>
        <form onSubmit={handleBroadcast} style={{ display: 'flex', gap: '1rem', flexDirection: isMobile ? 'column' : 'row' }}>
          <input 
            type="text" 
            placeholder="Type your global announcement here..."
            value={broadcastForm.message}
            onChange={(e) => setBroadcastForm({ message: e.target.value })}
            style={{ 
              flex: 1, padding: '0.85rem 1.25rem', background: 'var(--admin-bg)', 
              border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', 
              color: 'var(--admin-text-primary)', fontWeight: '700', outline: 'none'
            }}
          />
          <button 
            type="submit"
            disabled={broadcasting}
            style={{ 
              padding: '0.85rem 2rem', background: 'var(--admin-brand)', color: 'white', 
              border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', 
              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', 
              gap: '0.75rem', textTransform: 'uppercase' 
            }}
          >
            {broadcasting ? <CheckCircle size={18} className="animate-spin" /> : 'Transmit Broadcast'}
          </button>
        </form>
      </div>

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
                      <span style={{ fontSize: '0.65rem', fontWeight: '950', color: notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)' }}>{notif.notification_type || notif.type}</span>
                      <span style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)' }}>{new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'white' }}>{notif.title || 'Signal Received'}</p>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>{notif.message}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!notif.is_read && <button onClick={() => handleMarkAsRead(notif.id)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><CheckCircle size={18} /></button>}
                  {/* Clicking trash opens confirmation modal — no direct delete */}
                  <button
                    onClick={() => setConfirmDeleteId(notif.id)}
                    title="Delete notification"
                    style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', transition: 'color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#ef4444'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--admin-text-secondary)'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          // ── COMPACT EMPTY STATE (REQ #1 equivalent for Notifications) ──────
          // Inline/horizontal layout instead of large billboard
          <div style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            padding: '1rem 1.5rem',
            background: 'var(--admin-card)',
            borderRadius: 'var(--admin-radius)',
            border: '1px dashed var(--admin-border)'
          }}>
            <Bell size={20} style={{ opacity: 0.3, flexShrink: 0 }} />
            <div>
              <p style={{ margin: 0, fontWeight: '950', fontSize: '0.85rem', textTransform: 'uppercase' }}>All Clear</p>
              <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>No signals match your current filter.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
