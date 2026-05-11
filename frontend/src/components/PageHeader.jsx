import React from 'react';
import { ArrowLeft, RefreshCw } from 'lucide-react';

const PageHeader = ({ badge, title, subtitle, onRefresh, showBack, onBack, actionLabel, onAction, actionIcon, children }) => (
  <div className="stack-on-mobile" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '2.5rem' }}>
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
        {showBack && <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--admin-text-primary)' }}><ArrowLeft size={20} /></button>}
        {badge && <span style={{ fontSize: '0.65rem', fontWeight: '950', letterSpacing: '2px', color: 'var(--admin-brand)', background: 'rgba(230, 30, 42, 0.1)', padding: '0.25rem 0.75rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid rgba(230, 30, 42, 0.2)' }}>{badge}</span>}
      </div>
      <h1 className="text-fluid-h1" style={{ margin: 0, letterSpacing: '-1.5px', color: 'var(--admin-text-primary)', lineHeight: 1.1, fontWeight: '950', textTransform: 'uppercase' }}>{title}</h1>
      <p style={{ margin: '0.5rem 0 0 0', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '500', maxWidth: '600px' }}>{subtitle}</p>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
      {children}
      {actionLabel && (
        <button 
          onClick={onAction}
          style={{ 
            background: 'var(--admin-brand)', color: '#fff', border: 'none', 
            padding: '0.75rem 1.5rem', borderRadius: '4px', fontWeight: '950', 
            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
            fontSize: '0.75rem', letterSpacing: '1px'
          }}
        >
          {actionIcon}
          {actionLabel}
        </button>
      )}
      {onRefresh && <button onClick={onRefresh} style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', padding: '0.75rem', borderRadius: 'var(--admin-radius-sm)', cursor: 'pointer', color: 'var(--admin-text-primary)', transition: '0.2s' }}><RefreshCw size={18} /></button>}
    </div>
  </div>
);

export default PageHeader;
