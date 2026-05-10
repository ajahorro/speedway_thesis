import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';

const VerifyForm = ({ onVerify, onResend, onBack, email, isLoading }) => {
  const [otpCode, setOtpCode] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onVerify(otpCode);
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    padding: '1rem',
    borderRadius: '0.85rem',
    color: 'var(--admin-text-primary)',
    fontSize: '1.2rem',
    outline: 'none',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    boxSizing: 'border-box',
    textAlign: 'center',
    letterSpacing: '8px',
    fontWeight: '900'
  };

  const buttonStyle = {
    width: '100%',
    background: 'var(--admin-brand)',
    color: '#FFFFFF',
    padding: '1.1rem',
    borderRadius: '0.85rem',
    border: 'none',
    fontWeight: '900',
    fontSize: '0.95rem',
    cursor: 'pointer',
    marginTop: '1.5rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 8px 25px rgba(169, 27, 24, 0.25)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };

  return (
    <form onSubmit={handleSubmit}>
      <p style={{ textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.6', fontWeight: '500', opacity: 0.8 }}>
        Please enter the 6-digit verification code <br />sent to <strong>{email}</strong>
      </p>
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <ShieldCheck size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8, zIndex: 1 }} />
        <input 
          type="text" 
          placeholder="000000" 
          maxLength={6}
          required 
          value={otpCode} 
          onChange={e => setOtpCode(e.target.value.replace(/\D/g, ''))} 
          style={inputStyle} 
        />
      </div>
      <button type="submit" disabled={isLoading} style={buttonStyle}>
        {isLoading ? 'Verifying...' : 'Verify Code'}
      </button>
      <div style={{ textAlign: 'center', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>
          Didn't receive a code? <span onClick={onResend} style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900' }}>Resend</span>
        </p>
        <span onClick={onBack} style={{ color: 'var(--admin-text-secondary)', cursor: 'pointer', fontWeight: '700', opacity: 0.6, fontSize: '0.85rem' }}>Back</span>
      </div>
    </form>
  );
};

export default VerifyForm;
