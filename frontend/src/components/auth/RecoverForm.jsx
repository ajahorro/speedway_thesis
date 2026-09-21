import React, { useState } from 'react';
import { Mail } from 'lucide-react';
import StyledInput from './StyledInput';

const RecoverForm = ({ onRecover, onSwitchMode, isLoading }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRecover(email);
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
        Enter your email address to receive a <br />password reset link.
      </p>
      <div style={{ marginBottom: '1.5rem' }}>
        <StyledInput icon={Mail} type="email" placeholder="Email Address" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
      </div>
      <button type="submit" disabled={isLoading} style={buttonStyle}>
        {isLoading ? 'Sending...' : 'Send Recovery Link'}
      </button>
      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>
        Remember your password? <span onClick={() => onSwitchMode('LOGIN')} style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900' }}>Login</span>
      </p>
    </form>
  );
};

export default RecoverForm;
