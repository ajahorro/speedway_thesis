import React from 'react';

const BookingChat = ({ bookingId }) => (
  <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
    <div style={{ flex: 1, padding: '1rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
      <div style={{ fontSize: '0.8rem', opacity: 0.5, textAlign: 'center' }}>End-to-end encrypted chat</div>
    </div>
    <div style={{ padding: '1rem', borderTop: '1px solid var(--admin-border)', display: 'flex', gap: '0.5rem' }}>
      <input type="text" placeholder="Type a message..." style={{ flex: 1, background: 'transparent', border: 'none', color: '#fff', outline: 'none' }} />
      <button style={{ background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: '4px', padding: '0.25rem 0.75rem' }}>Send</button>
    </div>
  </div>
);

export default BookingChat;
