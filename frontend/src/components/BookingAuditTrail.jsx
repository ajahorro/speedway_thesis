import React from 'react';

const BookingAuditTrail = ({ logs = [] }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
    {logs.map((log, i) => (
      <div key={i} style={{ padding: '1rem', borderLeft: '2px solid var(--admin-brand)', background: 'var(--admin-bg)', borderRadius: '0 0.75rem 0.75rem 0' }}>
        <div style={{ fontSize: '0.8rem', fontWeight: '800' }}>{log.event_type}</div>
        <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)' }}>{log.metadata?.details}</div>
        <div style={{ fontSize: '0.65rem', marginTop: '0.25rem', opacity: 0.6 }}>{new Date(log.created_at).toLocaleString()}</div>
      </div>
    ))}
    {logs.length === 0 && <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.8rem' }}>No activity logs found.</div>}
  </div>
);

export default BookingAuditTrail;
