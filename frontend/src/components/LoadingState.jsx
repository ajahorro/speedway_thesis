import React from 'react';

const LoadingState = ({ message = 'Loading...' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '4rem', color: 'var(--admin-text-secondary)' }}>
    <div style={{ width: '40px', height: '40px', border: '3px solid var(--admin-border)', borderTopColor: 'var(--admin-brand)', borderRadius: '50%', animation: 'spin 1s linear infinite', marginBottom: '1rem' }} />
    <p style={{ fontWeight: '600' }}>{message}</p>
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

export default LoadingState;
