import React, { useState, useEffect } from 'react';
import { mockNotifications } from './AdminMockData';
import PageHeader from '../../components/PageHeader';
import { Bell, CheckCircle, Clock, Trash2, Filter, Search } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';

const AdminNotifications = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    setLoading(true);
    setTimeout(() => {
      setNotifications(mockNotifications);
      setLoading(false);
    }, 500);
  };

  const handleMarkAsRead = (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    toast.success('Notification marked as read');
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    toast.success('All notifications marked as read');
  };

  const handleDelete = (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success('Notification removed');
  };

  const filteredNotifications = notifications.filter(n => {
    const matchesSearch = n.message.toLowerCase().includes(searchQuery.toLowerCase());
    if (filter === 'UNREAD') return matchesSearch && !n.is_read;
    if (filter === 'READ') return matchesSearch && n.is_read;
    return matchesSearch;
  });

  const cardStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-border)',
    padding: '1.25rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    transition: 'all 0.2s',
    position: 'relative',
    overflow: 'hidden'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      <PageHeader 
        badge="SYSTEM SIGNALS"
        title="NOTIFICATIONS"
        subtitle="Operational alerts and system activity logs."
        onRefresh={fetchNotifications}
      >
        <button 
          onClick={handleMarkAllAsRead}
          style={{ 
            padding: '0.75rem 1.25rem', 
            background: 'var(--admin-bg)', 
            border: '1px solid var(--admin-border)', 
            borderRadius: 'var(--admin-radius-sm)', 
            color: 'var(--admin-text-primary)',
            fontSize: '0.7rem',
            fontWeight: '950',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          mark all as read
        </button>
      </PageHeader>

      <div style={{ 
        display: 'flex', 
        flexDirection: isMobile ? 'column' : 'row', 
        gap: '1rem', 
        background: 'var(--admin-card)', 
        padding: '0.75rem', 
        borderRadius: 'var(--admin-radius)', 
        border: '1px solid var(--admin-border)',
        alignItems: 'center'
      }}>
        <div style={{ position: 'relative', flex: 1, width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Search signals..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 1rem 0.75rem 2.75rem', 
              background: 'var(--admin-bg)', 
              border: '1px solid var(--admin-border)', 
              borderRadius: 'var(--admin-radius-sm)', 
              color: 'var(--admin-text-primary)',
              fontWeight: '600',
              outline: 'none'
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--admin-bg)', padding: '0.25rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
          {['ALL', 'UNREAD', 'READ'].map(f => (
            <button 
              key={f} 
              onClick={() => setFilter(f)}
              style={{ 
                padding: '0.5rem 1rem', 
                borderRadius: 'var(--admin-radius-sm)', 
                border: 'none', 
                background: filter === f ? 'var(--admin-brand)' : 'transparent', 
                color: filter === f ? 'white' : 'var(--admin-text-secondary)',
                fontSize: '0.7rem',
                fontWeight: '950',
                cursor: 'pointer',
                textTransform: 'uppercase'
              }}
            >
              {f}
            </button>
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
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: 'var(--admin-radius-sm)', 
                    background: notif.is_read ? 'var(--admin-bg)' : 'rgba(var(--admin-brand-rgb), 0.1)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)',
                    border: '1px solid var(--admin-border)'
                  }}>
                    <Bell size={18} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px', color: notif.is_read ? 'var(--admin-text-secondary)' : 'var(--admin-brand)' }}>{notif.type}</span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'var(--admin-border)' }} />
                      <span style={{ fontSize: '0.65rem', fontWeight: '800', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}><Clock size={10} /> {new Date(notif.created_at).toLocaleString()}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: '700', color: 'var(--admin-text-primary)' }}>{notif.message}</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {!notif.is_read && (
                    <button 
                      onClick={() => handleMarkAsRead(notif.id)}
                      title="Mark as read"
                      style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', padding: '0.5rem' }}
                      onMouseEnter={(e) => e.currentTarget.style.color = '#10b981'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--admin-text-secondary)'}
                    >
                      <CheckCircle size={18} />
                    </button>
                  )}
                  <button 
                    onClick={() => handleDelete(notif.id)}
                    title="Delete notification"
                    style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer', padding: '0.5rem' }}
                    onMouseEnter={(e) => e.currentTarget.style.color = 'var(--admin-brand)'}
                    onMouseLeave={(e) => e.currentTarget.style.color = 'var(--admin-text-secondary)'}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: 'center', padding: '5rem 2rem', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px dashed var(--admin-border)' }}>
            <Bell size={48} style={{ color: 'var(--admin-text-secondary)', opacity: 0.2, marginBottom: '1.5rem' }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>ALL CLEAR</h3>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>No signals detected in the selected spectrum.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminNotifications;
