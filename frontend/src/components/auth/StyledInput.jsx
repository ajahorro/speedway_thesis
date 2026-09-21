import React from 'react';

const StyledInput = ({ icon: Icon, type, placeholder, value, onChange, required = false, autoComplete, name }) => (
  <div style={{ position: 'relative', width: '100%' }}>
    <div aria-hidden="true" style={{ position: 'absolute', inset: '0 auto 0 0', display: 'flex', alignItems: 'center', paddingLeft: '1rem', pointerEvents: 'none', color: 'var(--admin-text-secondary)', zIndex: 1 }}>
      <Icon size={18} />
    </div>
    <input
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      required={required}
      autoComplete={autoComplete}
      style={{ width: '100%', boxSizing: 'border-box', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', padding: '1rem 1rem 1rem 2.75rem', borderRadius: '0.85rem', color: 'var(--admin-text-primary)', fontSize: '0.95rem', outline: 'none', transition: 'all 0.2s ease' }}
    />
  </div>
);

export default StyledInput;
