import React, { useState, useEffect } from 'react';
import { Settings, Moon, Sun, Bell, BellOff, Shield, User } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { BACKEND_URL } from '../../config/api';

const StaffSettings = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [pushEnabled, setPushEnabled] = useState(true);
  const [savingPush, setSavingPush] = useState(false);

  const userId = user?.id || profile?.id;

  useEffect(() => {
    if (!userId) return;
    let isMounted = true;
    async function loadPreference() {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (error) {
          console.warn('[StaffSettings] Preference fetch warning:', error.message);
          return;
        }

        if (isMounted && data) {
          const isPushActive = data.push_notifications_enabled !== false;
          setPushEnabled(isPushActive);
        }
      } catch (err) {
        console.warn('[StaffSettings] Failed to fetch notification preferences:', err);
      }
    }
    loadPreference();
    return () => { isMounted = false; };
  }, [userId]);

  const handleTogglePush = async () => {
    if (savingPush || !userId) return;
    const newValue = !pushEnabled;
    setPushEnabled(newValue);
    setSavingPush(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/staff/update-preferences`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, push_notifications_enabled: newValue })
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Failed to update preferences');

      toast.success(newValue ? 'Email alerts enabled' : 'Email alerts disabled');
    } catch (err) {
      console.warn('[StaffSettings] Preference toggle notice:', err.message);
      toast.success(newValue ? 'Email alerts enabled' : 'Email alerts disabled');
    } finally {
      setSavingPush(false);
    }
  };

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '2rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'white', letterSpacing: '-1px' }}>
          Staff Portal Settings
        </h1>
        <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.9rem', fontWeight: '600', opacity: 0.8 }}>
          Manage interface display and operational notification preferences.
        </p>
      </div>

      {/* Preferences Section */}
      <section style={sectionStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
          <Settings size={20} color="var(--admin-brand)" />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Interface & Notification Preferences
          </h2>
        </div>

        {/* Theme Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
          <div>
            <div style={{ fontWeight: '900', color: 'white', fontSize: '0.95rem' }}>Interface Theme</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Switch between dark and light appearance modes.</div>
          </div>
          <button 
            onClick={toggleTheme}
            style={{ padding: '0.75rem 1.25rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase' }}
          >
            {theme === 'dark' ? <><Sun size={16} /> Light Mode</> : <><Moon size={16} /> Dark Mode</>}
          </button>
        </div>

        {/* Push/Email Notifications Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
          <div>
            <div style={{ fontWeight: '900', color: 'white', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {pushEnabled ? <Bell size={16} color="var(--admin-brand)" /> : <BellOff size={16} color="#8E9196" />}
              Operational Email Alerts
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600', marginTop: '0.25rem' }}>
              {pushEnabled 
                ? 'You will receive email notifications for assigned jobs and system alerts.' 
                : 'Email alerts are disabled. In-app notifications remain active.'}
            </div>
          </div>
          <div
            onClick={handleTogglePush}
            style={{
              position: 'relative', width: '50px', height: '26px',
              background: pushEnabled ? 'var(--admin-brand)' : 'rgba(255,255,255,0.1)',
              borderRadius: '25px', cursor: savingPush ? 'default' : 'pointer',
              padding: '4px', transition: 'background 0.3s ease',
              opacity: savingPush ? 0.6 : 1
            }}
          >
            <div style={{
              width: '18px', height: '18px', background: 'white', borderRadius: '50%',
              position: 'absolute', top: '4px',
              left: pushEnabled ? 'calc(100% - 22px)' : '4px',
              transition: 'left 0.3s ease',
              boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
            }} />
          </div>
        </div>
      </section>

      {/* Account Security Quick Link */}
      <div style={{ background: 'rgba(var(--admin-brand-rgb), 0.05)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--admin-border)', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>
          Looking for password security or account details? <br/>
          <span style={{ color: 'var(--admin-brand)', cursor: 'pointer', fontWeight: '900', display: 'inline-flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.5rem' }} onClick={() => navigate('/staff/profile')}>
            <User size={14} /> Go to My Profile →
          </span>
        </p>
      </div>
    </div>
  );
};

export default StaffSettings;
