import React, { useEffect, useState } from 'react';
import { Search, X } from 'lucide-react';

export const QRMagnifier = ({ qrUrl, accountName, accountNumber, standalone = false }) => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!qrUrl) return null;

  return (
    <>
      <button type="button" onClick={() => setIsOpen(true)} title="Enlarge payment QR code" style={standalone
        ? { position: 'relative', display: 'block', width: 'min(100%, 220px)', aspectRatio: '1', padding: 0, border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', background: '#fff', cursor: 'zoom-in', margin: '1rem 0 0', overflow: 'hidden' }
        : { position: 'relative', display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', maxWidth: '400px', padding: '0.75rem', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', background: 'var(--admin-card)', color: 'var(--admin-text-primary)', cursor: 'zoom-in', margin: '1.5rem 0', textAlign: 'left', boxShadow: 'var(--admin-card-shadow)' }}>
        {standalone ? (
          <img src={qrUrl} alt="Payment QR code" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.5rem' }} />
        ) : (
          <>
            <span style={{ position: 'relative', width: 'clamp(3.5rem, 18vw, 4.5rem)', height: 'clamp(3.5rem, 18vw, 4.5rem)', flexShrink: 0, display: 'grid', placeItems: 'center', overflow: 'hidden', borderRadius: 'var(--admin-radius)', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)' }}>
              <img src={qrUrl} alt="Payment QR thumbnail" style={{ width: '100%', height: '100%', objectFit: 'contain', padding: '0.25rem' }} />
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff', background: 'rgba(0,0,0,0.4)' }}><Search size={18} /></span>
            </span>
            <span style={{ minWidth: 0, overflow: 'hidden' }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.85rem' }}>{accountName}</strong>
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--admin-text-secondary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>{accountNumber}</span>
              <span style={{ display: 'block', marginTop: '0.2rem', color: 'var(--admin-brand)', fontSize: '0.7rem', fontWeight: '800' }}>Click to enlarge QR</span>
            </span>
          </>
        )}
      </button>
      {isOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="payment-qr-title" onClick={() => setIsOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(0.75rem, 4vw, 1.5rem)' }}>
          <div onClick={event => event.stopPropagation()} style={{ position: 'relative', width: '100%', maxWidth: '26rem', maxHeight: '90vh', overflowY: 'auto', padding: 'clamp(1rem, 5vw, 1.5rem)', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)', textAlign: 'center', boxShadow: 'var(--admin-card-shadow)' }}>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close payment QR" style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '50%', width: '40px', height: '40px', display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={20} /></button>
            <h3 id="payment-qr-title" style={{ margin: '0 2.5rem 1rem 0', color: 'var(--admin-text-primary)', fontSize: '1rem' }}>Payment QR Code</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'clamp(0.75rem, 4vw, 1rem)', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius)' }}>
              <img src={qrUrl} alt="Enlarged payment QR" style={{ width: 'min(64vw, 16rem)', height: 'min(64vw, 16rem)', objectFit: 'contain', background: '#fff', padding: '0.75rem', borderRadius: 'var(--admin-radius)' }} />
            </div>
            <div style={{ marginTop: '0.75rem', color: 'var(--admin-text-primary)', fontWeight: '900' }}>{accountName}</div>
            <div style={{ color: 'var(--admin-text-secondary)', fontFamily: 'monospace' }}>{accountNumber}</div>
          </div>
        </div>
      )}
    </>
  );
};

export default QRMagnifier;
