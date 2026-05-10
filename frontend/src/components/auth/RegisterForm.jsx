import React, { useState } from 'react';
import { Mail, Lock, User, Phone } from 'lucide-react';

const RegisterForm = ({ onRegister, onSwitchMode, isLoading }) => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onRegister(formData);
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
    marginTop: '1rem',
    transition: 'all 0.2s ease',
    boxShadow: '0 8px 25px rgba(169, 27, 24, 0.25)',
    textTransform: 'uppercase',
    letterSpacing: '1px'
  };

  return (
    <form onSubmit={handleSubmit}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ position: 'relative' }}>
          <User size={16} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
          <input 
            type="text" 
            placeholder="First Name" 
            required 
            value={formData.firstName} 
            onChange={e => setFormData({ ...formData, firstName: e.target.value })} 
            style={{ ...inputStyle, paddingLeft: '2.75rem' }} 
            autoComplete="given-name" 
          />
        </div>
        <div style={{ position: 'relative' }}>
          <User size={16} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
          <input 
            type="text" 
            placeholder="Last Name" 
            required 
            value={formData.lastName} 
            onChange={e => setFormData({ ...formData, lastName: e.target.value })} 
            style={{ ...inputStyle, paddingLeft: '2.75rem' }} 
            autoComplete="family-name" 
          />
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Mail size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
        <input 
          type="email" 
          placeholder="Email Address" 
          required 
          value={formData.email} 
          onChange={e => setFormData({ ...formData, email: e.target.value })} 
          style={inputStyle} 
          autoComplete="email" 
        />
      </div>
      
      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <Phone size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
        <input 
          type="tel" 
          placeholder="Phone Number" 
          required 
          value={formData.phone} 
          onChange={e => setFormData({ ...formData, phone: e.target.value })} 
          style={inputStyle} 
          autoComplete="tel" 
        />
      </div>

      <div style={{ position: 'relative', marginBottom: '1.5rem' }}>
        <Lock size={18} color="var(--admin-brand)" style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.8 }} />
        <input 
          type="password" 
          placeholder="Create Password" 
          required 
          value={formData.password} 
          onChange={e => setFormData({ ...formData, password: e.target.value })} 
          style={inputStyle} 
          autoComplete="new-password" 
        />
      </div>

      <button type="submit" disabled={isLoading} style={buttonStyle}>
        {isLoading ? 'Creating Account...' : 'Register'}
      </button>
      
      <p style={{ textAlign: 'center', marginTop: '1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>
        Already have an account? <span onClick={() => onSwitchMode('LOGIN')} style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900' }}>Login</span>
      </p>
    </form>
  );
};

export default RegisterForm;
