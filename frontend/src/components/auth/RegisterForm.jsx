import React, { useState } from 'react';
import { Mail, Lock, User, Phone, Loader2, AlertCircle } from 'lucide-react';
import StyledInput from './StyledInput';

const RegisterForm = ({ onRegister, onSwitchMode, isLoading }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError('');
    onRegister(formData);
  };

  const updateField = (field, value) => {
    if (field === 'firstName' || field === 'lastName') value = value.replace(/[^a-zA-Z ]/g, '').replace(/\s+/g, ' ');
    if (field === 'phone') value = value.replace(/\D/g, '').slice(0, 15);
    setFormData(prev => ({ ...prev, [field]: value }));
    if (error) setError('');
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
    marginTop: '1rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 8px 25px rgba(169, 27, 24, 0.25)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && (
        <div role="alert" style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '1rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.12)', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '0.65rem', color: '#fca5a5', fontSize: '0.8rem', fontWeight: '700' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} /> {error}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <StyledInput icon={User} type="text" placeholder="First Name" required value={formData.firstName} onChange={e => updateField('firstName', e.target.value)} autoComplete="given-name" />
        </div>
        <div style={{ position: 'relative' }}>
          <StyledInput icon={User} type="text" placeholder="Last Name" required value={formData.lastName} onChange={e => updateField('lastName', e.target.value)} autoComplete="family-name" />
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <StyledInput icon={Mail} type="email" placeholder="Email Address" required value={formData.email} onChange={e => updateField('email', e.target.value)} autoComplete="email" />
      </div>
      
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <StyledInput icon={Phone} type="tel" placeholder="Phone Number" required value={formData.phone} onChange={e => updateField('phone', e.target.value)} autoComplete="tel" />
      </div>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <StyledInput icon={Lock} type="password" placeholder="Create Password" required value={formData.password} onChange={e => updateField('password', e.target.value)} autoComplete="new-password" />
      </div>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <StyledInput icon={Lock} type="password" placeholder="Confirm Password" required value={formData.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} autoComplete="new-password" />
      </div>

      <button type="submit" disabled={isLoading} style={buttonStyle}>
        {isLoading ? <><Loader2 size={16} style={{ verticalAlign: 'middle', marginRight: '0.4rem', animation: 'spin 1s linear infinite' }} /> Creating Account...</> : 'Register'}
      </button>
      
      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>
        Already have an account? <span onClick={() => onSwitchMode('LOGIN')} style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900' }}>Login</span>
      </p>
    </form>
  );
};

export default RegisterForm;
