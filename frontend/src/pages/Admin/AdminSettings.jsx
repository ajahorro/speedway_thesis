import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Save, Upload, Clock, CreditCard, Sparkles, MapPin, 
  Building2, QrCode, Trash2, Gauge, Tag, RefreshCcw, X
} from 'lucide-react';
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
    gcash_qr_url: '',
    slots_per_hour: 2
  });

  // Helper to convert "08:00 AM" to "08:00" for time input
  const formatForInput = (timeStr) => {
    if (!timeStr) return "08:00";
    if (/^\d{2}:\d{2}$/.test(timeStr)) return timeStr;
    const parts = timeStr.split(' ');
    if (parts.length !== 2) return timeStr;
    const [time, modifier] = parts;
    let [hours, minutes] = time.split(':');
    if (modifier === 'PM' && hours !== '12') hours = parseInt(hours, 10) + 12;
    if (modifier === 'AM' && hours === '12') hours = '00';
    return `${hours.toString().padStart(2, '0')}:${minutes}`;
  };

  const fetchSettings = async () => {
    setFetching(true);
    try {
      logger.admin('Fetching global studio configuration...');
      const { data, error } = await supabase
        .from('business_config')
        .select('*')
        .limit(1)
        .single();

      if (error) {
        // Fallback to local storage
        const saved = localStorage.getItem('speedway_business_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings(prev => ({ 
            ...prev, 
            ...parsed,
            opening_hour: formatForInput(parsed.opening_hour),
            closing_hour: formatForInput(parsed.closing_hour)
          }));
        }
        logger.warn('Using local settings fallback.');
      } else {
        setSettings({
          ...data,
          opening_hour: formatForInput(data.opening_hour),
          closing_hour: formatForInput(data.closing_hour)
        });
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
        .upsert({
          id: settings.id || 1,
          business_name: settings.business_name,
          contact_number: settings.contact_number,
          email_address: settings.email_address,
          business_address: settings.business_address,
          opening_hour: settings.opening_hour,
          closing_hour: settings.closing_hour,
          gcash_number: settings.gcash_number,
          gcash_name: settings.gcash_name,
          gcash_qr_url: settings.gcash_qr_url,
          slots_per_hour: settings.slots_per_hour,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      localStorage.setItem('speedway_business_settings', JSON.stringify(settings));
      toast.success('Global settings updated successfully!');
      logger.admin('Global parameters committed to database.');
    } catch (err) {
      logger.error('Settings Save Error', err);
      toast.error('Failed to sync with database.');
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
      toast.success('QR Code loaded. Save to persist.');
    };
    reader.readAsDataURL(file);
  };

  const removeQR = () => {
    setSettings(prev => ({ ...prev, gcash_qr_url: '' }));
    toast.success('QR Code cleared.');
  };

  const sectionStyle = {
    background: 'var(--admin-card)',
    borderRadius: '4px',
    border: '1px solid var(--admin-border)',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
    color: 'white'
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
    borderRadius: '4px',
    color: 'white',
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
              <label style={labelStyle}>Business Name</label>
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
              <label style={labelStyle}>Business Address</label>
              <textarea 
                value={settings.business_address}
                onChange={(e) => setSettings({...settings, business_address: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px', resize: 'vertical', fontFamily: 'inherit' }} 
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Opening Hour</label>
                <input 
                  type="time" 
                  value={settings.opening_hour}
                  onChange={(e) => setSettings({...settings, opening_hour: e.target.value})}
                  style={inputStyle} 
                />
              </div>
              <div>
                <label style={labelStyle}>Closing Hour</label>
                <input 
                  type="time" 
                  value={settings.closing_hour}
                  onChange={(e) => setSettings({...settings, closing_hour: e.target.value})}
                  style={inputStyle} 
                />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderTop: '1px solid var(--admin-border)', paddingTop: '1rem' }}>
              <Gauge size={20} color="var(--admin-brand)" />
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>Fleet Capacity (Per Hour)</label>
                <input 
                  type="number" 
                  min="1" max="10"
                  value={settings.slots_per_hour || 2}
                  onChange={(e) => setSettings({...settings, slots_per_hour: parseInt(e.target.value)})}
                  style={{ ...inputStyle, width: '80px', textAlign: 'center', fontSize: '1.25rem' }} 
                />
              </div>
            </div>

            <button 
              onClick={handleSave}
              disabled={loading}
              style={{ 
                marginTop: '1rem', padding: '0.85rem', background: 'var(--admin-brand)', 
                color: 'white', borderRadius: '4px', fontSize: '0.75rem', 
                fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase'
              }}
            >
              {loading ? 'SYNCHRONIZING...' : 'COMMIT CHANGES'}
            </button>
          </div>
        </div>

        {/* Payment & Infrastructure */}
        <div style={sectionStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <CreditCard size={20} color="var(--admin-brand)" />
            <h2 style={{ fontSize: '1rem', fontWeight: '950', margin: 0, textTransform: 'uppercase', letterSpacing: '1px' }}>Payment Infrastructure</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label style={labelStyle}>GCash Number</label>
              <input 
                type="text" 
                value={settings.gcash_number}
                onChange={(e) => setSettings({...settings, gcash_number: e.target.value})}
                style={inputStyle} 
              />
            </div>
            <div>
              <label style={labelStyle}>Account Name</label>
              <input 
                type="text" 
                value={settings.gcash_name}
                onChange={(e) => setSettings({...settings, gcash_name: e.target.value})}
                style={inputStyle} 
              />
            </div>
          </div>

          <div style={{ marginTop: '0.5rem' }}>
            <label style={labelStyle}>Payment QR Code</label>
            {settings.gcash_qr_url ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', background: 'var(--admin-bg)', padding: '1.5rem', borderRadius: '4px', border: '1px dashed var(--admin-border)' }}>
                <img src={settings.gcash_qr_url} alt="GCash QR" style={{ maxWidth: '200px', height: 'auto', borderRadius: '4px' }} />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <label style={{ padding: '0.6rem 1.25rem', background: 'var(--admin-brand)', color: 'white', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>
                    REPLACE
                    <input type="file" onChange={handleQRUpload} style={{ display: 'none' }} accept="image/*" />
                  </label>
                  <button onClick={removeQR} style={{ padding: '0.6rem 1.25rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase' }}>
                    REMOVE
                  </button>
                </div>
              </div>
            ) : (
              <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', padding: '3rem', border: '2px dashed var(--admin-border)', borderRadius: '4px', cursor: 'pointer' }}>
                <Upload size={32} style={{ opacity: 0.2 }} />
                <span style={{ fontSize: '0.75rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Upload QR Code</span>
                <input type="file" onChange={handleQRUpload} style={{ display: 'none' }} accept="image/*" />
              </label>
            )}
          </div>

          <div style={{ borderTop: '1px solid var(--admin-border)', paddingTop: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <Sparkles size={20} color="var(--admin-brand)" />
              <h3 style={{ fontSize: '0.85rem', fontWeight: '950', margin: 0, textTransform: 'uppercase' }}>System Appearance</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              {['system', 'light', 'dark'].map(t => (
                <button
                  key={t}
                  onClick={() => toggleTheme(t)}
                  style={{
                    padding: '0.75rem', background: theme === t ? 'var(--admin-brand)' : 'var(--admin-bg)',
                    color: theme === t ? '#fff' : 'var(--admin-text-primary)',
                    border: '1px solid var(--admin-border)', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase'
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminSettings;
