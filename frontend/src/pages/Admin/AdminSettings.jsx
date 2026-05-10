import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Upload, Clock, CreditCard, Sparkles, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const AdminSettings = () => {
  const { profile, updateProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [settings, setSettings] = useState({
    business_name: 'SpeedWay AutoxMoto Detail Studio',
    contact_number: '+63 912 345 6789',
    email_address: 'info@speedwayautoxmoto.com',
    business_address: '123 Main Street, Metro Manila, Philippines',
    opening_hour: '08:00:00',
    closing_hour: '18:00:00',
    gcash_number: '09123456789',
    gcash_name: 'SpeedWay AutoxMoto Detail Studio',
    gcash_qr_url: ''
  });

  useEffect(() => {
    setTimeout(() => {
        setFetching(false);
    }, 500);
  }, []);

  const handleSave = async () => {
    setLoading(true);
    setTimeout(() => {
      toast.success('Settings saved successfully! (Mock)');
      setLoading(false);
    }, 1000);
  };

  const handleQRUpload = async (e) => {
    toast.success('QR Code uploaded! (Mock)');
  };

  const sectionStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-border)',
    padding: isMobile ? '1.25rem' : '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: isMobile ? '1.5rem' : '2rem',
    boxShadow: 'var(--admin-card-shadow)',
    color: 'var(--admin-text-primary)'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: '800',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.5rem'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'var(--admin-input-bg)',
    border: '1px solid var(--admin-input-border)',
    borderRadius: 'var(--admin-radius-sm)',
    color: 'var(--admin-text-primary)',
    fontSize: '0.95rem',
    outline: 'none',
    transition: '0.2s',
    boxSizing: 'border-box',
    fontWeight: '600'
  };

  if (fetching) return <div style={{ padding: '2rem', textAlign: 'center' }}>Synchronizing settings...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '3rem' }}>
      <PageHeader 
        badge="STUDIO MANAGEMENT"
        title="Settings & Configuration"
        subtitle="Manage your studio's operational parameters and personal appearance preferences."
        onRefresh={() => {
            setFetching(true);
            setTimeout(() => setFetching(false), 500);
            toast.success('Settings synchronized');
        }}
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(350px, 1fr))', gap: isMobile ? '1rem' : '2rem', alignItems: 'start' }}>
        
        {/* System Appearance Container */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Sparkles size={20} color="var(--admin-brand)" />
            <h2 style={{ fontSize: '1.1rem', fontWeight: '800', margin: 0 }}>System Appearance</h2>
          </div>
          <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--admin-text-secondary)', fontWeight: '600', lineHeight: '1.6' }}>
            Personalize your workspace. Choose how the Speedway Studio interface appears on your current device.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
            {['system', 'light', 'dark'].map(t => (
              <button
                key={t}
                onClick={() => toggleTheme(t)}
                style={{
                  padding: '1.25rem',
                  background: theme === t ? 'var(--admin-brand)' : 'var(--admin-bg)',
                  color: theme === t ? '#fff' : 'var(--admin-text-primary)',
                  border: theme === t ? 'none' : '1px solid var(--admin-border)',
                  borderRadius: 'var(--admin-radius)',
                  fontSize: '0.85rem',
                  fontWeight: '900',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                {t}
                {theme === t && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <button 
          onClick={handleSave}
          disabled={loading}
          style={{ 
            background: 'var(--admin-brand)', 
            color: '#fff', 
            border: 'none', 
            padding: '1rem 2.5rem', 
            borderRadius: 'var(--admin-radius-sm)', 
            fontWeight: '900', 
            fontSize: '0.9rem', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            boxShadow: '0 4px 15px rgba(220, 38, 38, 0.2)'
          }}
        >
          {loading ? 'Saving...' : <><Save size={18} /> SAVE CHANGES</>}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AdminSettings;
