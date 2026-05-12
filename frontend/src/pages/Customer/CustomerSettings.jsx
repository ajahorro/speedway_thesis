import React, { useState } from 'react';
import { 
  User, Mail, Phone, Lock, Moon, Sun, 
  Shield, Trash2, Save, Loader2, Key, BellRing,
  AlertTriangle, ChevronRight, CheckCircle, Settings
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const CustomerSettings = () => {
  const { theme, toggleTheme } = useTheme();
  
  const sectionStyle = {
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius-lg)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    boxShadow: 'var(--admin-card-shadow)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', maxWidth: '800px', margin: '0 auto', width: '100%', paddingBottom: '10rem' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'white', letterSpacing: '-1.5px' }}>App Settings</h1>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', opacity: 0.8 }}>
          Configure your interface preferences and notification behavior.
        </p>
      </div>

      {/* Preferences */}
      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Settings size={20} color="var(--admin-brand)" />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Interface Preferences</h2>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
          <div>
            <div style={{ fontWeight: '900', color: 'white', fontSize: '0.95rem' }}>Interface Theme</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Switch between dark and light modes.</div>
          </div>
          <button 
            onClick={toggleTheme}
            style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}
          >
            {theme === 'dark' ? <><Sun size={16} /> Light Mode</> : <><Moon size={16} /> Dark Mode</>}
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
          <div>
            <div style={{ fontWeight: '900', color: 'white', fontSize: '0.95rem' }}>Push Notifications</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Receive alerts on service status updates.</div>
          </div>
          <div style={{ position: 'relative', width: '50px', height: '26px', background: 'var(--admin-brand)', borderRadius: '25px', cursor: 'pointer', padding: '4px' }}>
            <div style={{ width: '18px', height: '18px', background: 'white', borderRadius: '50%', position: 'absolute', right: '4px' }} />
          </div>
        </div>
      </section>

      <div style={{ background: 'rgba(var(--admin-brand-rgb), 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--admin-border)', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>
          Looking for account security or profile management? <br/>
          <span style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900' }} onClick={() => window.location.href='/customer/profile'}>Go to My Profile →</span>
        </p>
      </div>

    </div>
  );
};
export default CustomerSettings;
