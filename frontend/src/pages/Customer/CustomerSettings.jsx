import React, { useState, useEffect } from 'react';
import { 
  Moon, Sun, Settings, Bell, BellOff
} from 'lucide-react';
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

        {/* Theme Toggle */}
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

        {/* Push Notification Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '12px', border: '1px solid var(--admin-border)' }}>
          <div>
            <div style={{ fontWeight: '900', color: 'white', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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


