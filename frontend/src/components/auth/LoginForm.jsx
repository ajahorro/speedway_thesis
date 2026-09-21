import React, { useState } from 'react';
import { Mail, Lock, AlertCircle } from 'lucide-react';
import StyledInput from './StyledInput';

const LoginForm = ({ onLogin, onSwitchMode, isLoading, error, onClearError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email.trim(), password);
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
      <div style={{ marginBottom: '1.25rem' }}>
        {error && (
          <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '0.65rem', color: '#fca5a5', fontSize: '0.8rem', fontWeight: '700', lineHeight: 1.4 }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}
        <StyledInput icon={Mail} type="email" placeholder="Email Address" required value={email} onChange={e => { setEmail(e.target.value); onClearError?.(); }} autoComplete="email" />
      </div>
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <StyledInput icon={Lock} type="password" placeholder="Password" required value={password} onChange={e => { setPassword(e.target.value); onClearError?.(); }} autoComplete="current-password" />
      </div>
      <button type="submit" disabled={isLoading} style={buttonStyle}>
        {isLoading ? 'Processing...' : 'Login'}
      </button>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', marginTop: '1.5rem', fontSize: '0.85rem' }}>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontWeight: '600' }}>
          Don't have an account? <span onClick={() => onSwitchMode('REGISTER')} style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900' }}>Register</span>
        </p>
        <span onClick={() => onSwitchMode('RECOVER')} style={{ color: 'var(--admin-text-secondary)', cursor: 'pointer', fontWeight: '700', opacity: 0.6 }}>Forgot Password?</span>
      </div>
    </form>
  );
};

export default LoginForm;
