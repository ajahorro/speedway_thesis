import React, { useState } from 'react';
import { Mail, Lock } from 'lucide-react';

const LoginForm = ({ onLogin, onSwitchMode, isLoading }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin(email.trim(), password);
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
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
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
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Lock size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
        <input 
          type="password" 
          placeholder="Password" 
          required 
          value={password} 
          onChange={e => setPassword(e.target.value)} 
          style={inputStyle} 
          autoComplete="current-password" 
        />
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
