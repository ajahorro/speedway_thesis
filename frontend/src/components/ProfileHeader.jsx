import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { useMediaQuery } from '../hooks/useMediaQuery';

const ProfileHeader = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const { profile } = useAuth();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <div style={{ textAlign: 'right', display: isMobile ? 'none' : 'block' }}>
        <div style={{ fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{profile?.full_name || 'MASTER ADMIN'}</div>
        <div style={{ fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '900', textTransform: 'uppercase', opacity: 0.6 }}>SYSTEM OPERATOR</div>
      </div>
      <div style={{ 
        width: '32px', 
        height: '32px', 
        borderRadius: 'var(--admin-radius-sm)', 
        background: 'var(--admin-bg)', 
        border: '1px solid var(--admin-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.8rem',
        fontWeight: '950',
        color: 'var(--admin-brand)'
      }}>
        {profile?.full_name?.charAt(0).toUpperCase() || 'A'}
      </div>
    </div>
  );
};

export default ProfileHeader;
