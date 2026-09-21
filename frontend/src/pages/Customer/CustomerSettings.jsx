import React, { useState, useEffect } from 'react';
import { Monitor, Moon, Sun, Settings, Bell, BellOff } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const CustomerSettings = () => {
  const { theme, toggleTheme } = useTheme();
  const { user, profile } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true); // default ON
  const [savingPush, setSavingPush] = useState(false);

  // Load the current preference from the database
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('profiles')
      .select('push_notifications_enabled')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        // If the column doesn't exist yet or is null, default to true
        if (data && data.push_notifications_enabled !== null) {
          setPushEnabled(data.push_notifications_enabled);
        }
      });
  }, [user?.id]);

  const handleTogglePush = async () => {
    if (savingPush) return;
    const newValue = !pushEnabled;
    setPushEnabled(newValue); // optimistic
    setSavingPush(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ push_notifications_enabled: newValue })
        .eq('id', user.id);
      if (error) throw error;
      toast.success(newValue ? 'Email notifications enabled' : 'Email notifications disabled');
    } catch {
      setPushEnabled(!newValue); // rollback
      toast.error('Failed to update notification preference');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div>
          <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 2.5rem)', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'var(--admin-text-primary)', letterSpacing: '-1.5px' }}>App Settings</h1>
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

        {/* Theme Choices */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', background: 'var(--admin-input-bg)', padding: 'clamp(1rem, 3vw, 1.25rem)', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
          <div>
            <div style={{ fontWeight: '900', color: 'var(--admin-text-primary)', fontSize: '0.95rem' }}>Interface Theme</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Choose system, light, or dark appearance.</div>
          </div>
          <div role="radiogroup" aria-label="Interface theme" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(92px, 1fr))', width: 'min(100%, 390px)', gap: '0.35rem', padding: '0.35rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '10px' }}>
            {[{ value: 'system', label: 'System', icon: Monitor }, { value: 'light', label: 'Light', icon: Sun }, { value: 'dark', label: 'Dark', icon: Moon }].map(({ value, label, icon: Icon }) => {
              const isActive = theme === value;
              return <button key={value} type="button" role="radio" aria-checked={isActive} onClick={() => toggleTheme(value)} style={{ minHeight: '44px', padding: '0.65rem 0.5rem', background: isActive ? 'var(--admin-brand)' : 'transparent', border: `1px solid ${isActive ? 'var(--admin-brand)' : 'transparent'}`, borderRadius: '7px', color: isActive ? '#fff' : 'var(--admin-text-secondary)', fontWeight: '900', fontSize: '0.7rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', textTransform: 'uppercase' }}><Icon size={15} />{label}</button>;
            })}
          </div>
        </div>

        {/* Push Notification Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', background: 'var(--admin-input-bg)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--admin-border)', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontWeight: '900', color: 'var(--admin-text-primary)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {pushEnabled ? <Bell size={16} color="var(--admin-brand)" /> : <BellOff size={16} color="#8E9196" />}
              Email Notifications
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600', marginTop: '0.25rem' }}>
              {pushEnabled 
                ? 'You will receive email alerts on service status updates.' 
                : 'Email alerts are off. You will still see in-app notifications.'}
            </div>
          </div>
          {/* Toggle Switch */}
          <div
            onClick={handleTogglePush}
            style={{
              position: 'relative', width: '50px', height: '26px',
              background: pushEnabled ? 'var(--admin-brand)' : 'var(--admin-border)',
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


