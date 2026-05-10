import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Save, Upload, Clock, CreditCard, Sparkles, MapPin, Building2, QrCode, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/PageHeader';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../hooks/useAuth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logger } from '../../utils/logger';

const AdminSettings = () => {
  const { profile } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  const [settings, setSettings] = useState({
    business_name: '',
    contact_number: '',
    email_address: '',
    business_address: '',
    opening_hour: '',
    closing_hour: '',
    gcash_number: '',
    gcash_name: '',
    gcash_qr_url: ''
  });

  const fetchSettings = async () => {
    setFetching(true);
    try {
      logger.admin('Fetching global studio configuration...');
      const { data, error } = await supabase
        .from('business_config')
        .select('*')
        .eq('id', 1)
        .single();

      if (error) {
        // Fallback to local storage if table doesn't exist yet (for seamless dev transition)
        const saved = localStorage.getItem('speedway_business_settings');
        if (saved) setSettings(prev => ({ ...prev, ...JSON.parse(saved) }));
        logger.warn('Using local settings fallback. Ensure SQL migration is run.');
      } else {
        setSettings(data);
        logger.admin('Global studio parameters synchronized.');
      }
    } catch (err) {
      logger.error('Fetch Settings Error', err);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setLoading(true);
    try {
      logger.admin('Updating global business parameters...');
      
      const { error } = await supabase
        .from('business_config')
        .update({
          business_name: settings.business_name,
          contact_number: settings.contact_number,
          email_address: settings.email_address,
          business_address: settings.business_address,
          opening_hour: settings.opening_hour,
          closing_hour: settings.closing_hour,
          gcash_qr_url: settings.gcash_qr_url,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1);

      if (error) throw error;

      // Also update local storage for redundancy
      localStorage.setItem('speedway_business_settings', JSON.stringify(settings));
      
      toast.success('Global settings updated successfully!');
      logger.admin('Global parameters committed to database.');
    } catch (err) {
      logger.error('Settings Save Error', err);
      // Attempt local-only save if DB fails
      localStorage.setItem('speedway_business_settings', JSON.stringify(settings));
      toast.error('DB sync failed, but saved locally. Check migration.');
    } finally {
      setLoading(false);
    }
  };

  const handleQRUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings(prev => ({ ...prev, gcash_qr_url: reader.result }));
      toast.success('QR Code loaded into buffer. Save to persist.');
    };
    reader.readAsDataURL(file);
  };

  const removeQR = () => {
    setSettings(prev => ({ ...prev, gcash_qr_url: '' }));
    toast.success('QR Code cleared from buffer.');
  };

  const sectionStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-border)',
    padding: isMobile ? '1.25rem' : '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    color: 'var(--admin-text-primary)'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: '950',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.5rem'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius-sm)',
    color: 'var(--admin-text-primary)',
    fontSize: '0.9rem',
    outline: 'none',
    fontWeight: '700'
  };

  if (fetching) return <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontWeight: '950' }}>SYNCHRONIZING STUDIO PARAMETERS...</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '3rem' }}>
      <PageHeader 
        badge="STUDIO CONFIGURATION"
        title="Settings & Logistics"
        subtitle="Operational parameters, business hours, and payment infrastructure."
        onRefresh={fetchSettings}
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fit, minmax(400px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        
        {/* Business Settings Module */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Building2 size={20} color="var(--admin-brand)" />
            <h2 style={{ fontSize: '1rem', fontWeight: '950', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Business Settings</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            <div>
              <label style={labelStyle}><Building2 size={12} /> Business Name</label>
              <input 
                type="text" 
                value={settings.business_name}
                onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                style={inputStyle} 
              />
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Contact Number</label>
                <input 
                  type="text" 
                  value={settings.contact_number}
                  onChange={(e) => setSettings({...settings, contact_number: e.target.value})}
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Email Address</label>
                <input 
                  type="email" 
                  value={settings.email_address}
                  onChange={(e) => setSettings({...settings, email_address: e.target.value})}
                  style={inputStyle} 
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}><MapPin size={12} /> Business Address</label>
              <textarea 
                value={settings.business_address}
                onChange={(e) => setSettings({...settings, business_address: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}><Clock size={12} /> Opening Hour</label>
                <input 
                  type="text" 
                  value={settings.opening_hour}
                  placeholder="e.g. 08:00 AM"
                  onChange={(e) => setSettings({...settings, opening_hour: e.target.value})}
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}><Clock size={12} /> Closing Hour</label>
                <input 
                  type="text" 
                  value={settings.closing_hour}
                  placeholder="e.g. 06:00 PM"
                  onChange={(e) => setSettings({...settings, closing_hour: e.target.value})}
                  style={inputStyle} 
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={loading}
              style={{ 
                marginTop: '1rem',
                padding: '0.85rem',
                background: 'var(--admin-bg)',
                border: '1px solid var(--admin-border)',
                color: 'var(--admin-brand)',
                borderRadius: 'var(--admin-radius-sm)',
                fontSize: '0.75rem',
                fontWeight: '950',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                transition: '0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--admin-brand)'}
              onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--admin-border)'}
            >
              <Save size={14} /> Update Business Config
            </button>
          </div>

          <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <QrCode size={20} color="var(--admin-brand)" />
              <h3 style={{ fontSize: '0.85rem', fontWeight: '950', margin: 0, textTransform: 'uppercase' }}>Payment QR Code</h3>
            </div>

            {settings.gcash_qr_url ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', background: 'var(--admin-bg)', padding: '1.5rem', borderRadius: 'var(--admin-radius-sm)', border: '1px dashed var(--admin-border)' }}>
                <img src={settings.gcash_qr_url} alt="GCash QR" style={{ maxWidth: '200px', height: 'auto', borderRadius: '8px' }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{ padding: '0.6rem 1.25rem', background: 'var(--admin-brand)', color: 'white', borderRadius: 'var(--admin-radius-sm)', fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>
                    <Upload size={14} /> Replace
                    <input type="file" onChange={handleQRUpload} style={{ display: 'none' }} accept="image/*" />
                  </label>
                  <button onClick={removeQR} style={{ padding: '0.6rem 1.25rem', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', color: '#ef4444', borderRadius: 'var(--admin-radius-sm)', fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', border: '2px dashed var(--admin-border)', borderRadius: 'var(--admin-radius)', cursor: 'pointer', transition: '0.2s' }}>
                <Upload size={32} style={{ opacity: 0.2 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Upload QR Code Image</span>
                <input type="file" onChange={handleQRUpload} style={{ display: 'none' }} accept="image/*" />
              </label>
            )}
          </div>
        </div>

        {/* System Appearance */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <Sparkles size={20} color="var(--admin-brand)" />
            <h2 style={{ fontSize: '1rem', fontWeight: '950', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>System Appearance</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
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
                  fontWeight: '950',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
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
            padding: '1rem 3rem', 
            borderRadius: 'var(--admin-radius-sm)', 
            fontWeight: '950', 
            fontSize: '0.85rem', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}
        >
          {loading ? 'SYNCHRONIZING...' : <><Save size={18} /> COMMIT CHANGES</>}
        </button>
      </div>
    </div>
  );
};

export default AdminSettings;
