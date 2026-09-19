import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

const QRMagnifier = ({ qrUrl, accountName, accountNumber }) => {
  const [isOpen, setIsOpen] = useState(false);
  if (!qrUrl) return null;

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} title="Enlarge payment QR code" style={{ position: 'relative', display: 'block', width: '100%', maxWidth: '400px', padding: 0, border: 0, background: '#fff', cursor: 'zoom-in', margin: '1.5rem 0' }}>
        <img src={qrUrl} alt="Payment QR" style={{ width: '100%', height: '550px', objectFit: 'contain', borderRadius: 'var(--admin-radius-lg)', border: '1px solid var(--admin-border)', padding: '1.5rem', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }} />
        <Search size={22} style={{ position: 'absolute', right: '1rem', bottom: '1rem', padding: '0.5rem', boxSizing: 'content-box', color: '#fff', background: 'rgba(0,0,0,0.7)', borderRadius: '50%' }} />
      </button>
      {isOpen && (
        <div role="dialog" aria-modal="true" onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div onClick={event => event.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '720px', maxHeight: '90vh', padding: '1rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '8px', textAlign: 'center' }}>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close payment QR" style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '50%', width: '40px', height: '40px', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={20} /></button>
            <img src={qrUrl} alt="Enlarged payment QR" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', background: '#fff', padding: '1rem', borderRadius: '8px' }} />
            <div style={{ marginTop: '0.75rem', color: 'var(--admin-text-primary)', fontWeight: '900' }}>{accountName}</div>
            <div style={{ color: 'var(--admin-text-secondary)', fontFamily: 'monospace' }}>{accountNumber}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default QRMagnifier;
