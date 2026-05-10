import React, { useState } from 'react';
import { Mail } from 'lucide-react';

const RecoverForm = ({ onRecover, onSwitchMode, isLoading }) => {
  const [email, setEmail] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onRecover(email);
  };

  const inputStyle = {
    width: '100%',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    padding: '1rem 1rem 1rem 3rem',
    borderRadius: '0.85rem',
    color: 'var(--admin-text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
    boxSizing: 'border-box'
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
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Mail size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
        <input 
          type="email" 
          placeholder="Email Address" 
          required 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          style={inputStyle} 
          autoComplete="email" 
        />
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
