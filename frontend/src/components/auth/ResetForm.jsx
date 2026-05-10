import React, { useState } from 'react';
import { Lock } from 'lucide-react';
import toast from 'react-hot-toast';

const ResetForm = ({ onReset, onSwitchMode, isLoading }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    onReset(newPassword);
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
        Create a new secure password for <br />your account.
      </p>
      <div style={{ position: 'relative', marginBottom: '1.25rem' }}>
        <Lock size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
        <input 
          type="password" 
          placeholder="New Password" 
          required 
          value={newPassword} 
          onChange={e => setNewPassword(e.target.value)} 
          style={inputStyle} 
          autoComplete="new-password"
        />
      </div>
      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Lock size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
        <input 
          type="password" 
          placeholder="Confirm New Password" 
          required 
          value={confirmPassword} 
          onChange={e => setConfirmPassword(e.target.value)} 
          style={inputStyle} 
          autoComplete="new-password"
        />
      </div>
      <button type="submit" disabled={isLoading} style={buttonStyle}>
        {isLoading ? 'Updating...' : 'Update Password'}
      </button>
      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>
        Back to <span onClick={() => onSwitchMode('LOGIN')} style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900' }}>Login</span>
      </p>
    </form>
  );
};

export default ResetForm;
