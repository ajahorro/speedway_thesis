import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotificationPopover = ({ user, profile, onClose, onRead }) => {
  const navigate = useNavigate();

  return (
    <div style={{ position: 'absolute', top: '100%', right: 0, width: '320px', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', padding: '1.5rem', boxShadow: 'var(--admin-card-shadow)', zIndex: 100, marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h4 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--admin-brand)' }}>notifications</h4>
        <span style={{ fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '800', cursor: 'pointer' }} onClick={onRead}>mark all as read</span>
      </div>
      <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '700', textAlign: 'center', padding: '2rem 0', border: '1px dashed var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        no new notifications
      </div>
      <button 
        onClick={() => {
          navigate('/admin/notifications');
          onClose();
        }} 
        style={{ marginTop: '1.5rem', width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', fontSize: '0.7rem', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
      >
        view all notifications
      </button>
    </div>
  );
};

export default NotificationPopover;
