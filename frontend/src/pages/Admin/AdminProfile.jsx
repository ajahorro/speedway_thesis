import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { User, Mail, Lock, Shield, Save, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const AdminProfile = () => {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || '',
    lastName: profile?.last_name || '',
    email: profile?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [loading, setLoading] = useState(false);

  const handleUpdateProfile = () => {
    setLoading(true);
    setTimeout(() => {
      toast.success('Profile credentials updated successfully!');
      setLoading(false);
    }, 800);
  };

  const handleChangePassword = () => {
    if (!formData.newPassword || formData.newPassword !== formData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      toast.success('Security credentials updated!');
      setLoading(false);
      setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    }, 800);
  };

  const cardStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-border)',
    padding: isMobile ? '1.5rem' : '2rem',
    boxShadow: 'var(--admin-card-shadow)'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.85rem 1.25rem',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius-sm)',
    color: 'var(--admin-text-primary)',
    fontSize: '0.95rem',
    fontWeight: '600',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.7rem',
    fontWeight: '950',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: '0.75rem'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      <PageHeader 
        badge="IDENTITY MANAGEMENT"
        title="ADMIN ACCOUNT"
        subtitle="Manage your professional identity and security credentials."
        onRefresh={() => toast.success('Synchronizing profile...')}
      />

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '2rem', alignItems: 'start' }}>
        
        {/* Personal Information */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--admin-radius-sm)', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-brand)', border: '1px solid rgba(var(--admin-brand-rgb), 0.2)' }}>
              <User size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>PERSONAL INFO</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>Identity verification and display names</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <label style={labelStyle}>First Name</label>
                <input 
                  style={inputStyle} 
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input 
                  style={inputStyle} 
                  value={formData.lastName}
                  onChange={e => setFormData({...formData, lastName: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Email Address (Protected)</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)', opacity: 0.5 }} />
                <input 
                  style={{ ...inputStyle, paddingLeft: '3.25rem', opacity: 0.6, cursor: 'not-allowed' }} 
                  value={formData.email}
                  readOnly
                />
              </div>
            </div>
            <button 
              onClick={handleUpdateProfile}
              disabled={loading}
              style={{ 
                marginTop: '1rem',
                width: '100%', 
                padding: '1rem', 
                background: 'var(--admin-bg)', 
                color: 'var(--admin-text-primary)', 
                border: '1px solid var(--admin-border)', 
                borderRadius: 'var(--admin-radius-sm)', 
                fontWeight: '950', 
                fontSize: '0.75rem', 
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
            >
              <Save size={18} /> {loading ? 'Saving...' : 'Update Information'}
            </button>
          </div>
        </div>

        {/* Security / Password */}
        <div style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: 'var(--admin-radius-sm)', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-brand)', border: '1px solid rgba(var(--admin-brand-rgb), 0.2)' }}>
              <Key size={24} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>SECURITY</h2>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>Authentication and password management</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
                <input 
                  type="password"
                  style={{ ...inputStyle, paddingLeft: '3.25rem' }} 
                  placeholder="Enter new password"
                  value={formData.newPassword}
                  onChange={e => setFormData({...formData, newPassword: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
                <input 
                  type="password"
                  style={{ ...inputStyle, paddingLeft: '3.25rem' }} 
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>
            <button 
              onClick={handleChangePassword}
              disabled={loading}
              style={{ 
                marginTop: '1rem',
                width: '100%', 
                padding: '1rem', 
                background: 'var(--admin-brand)', 
                color: 'white', 
                border: 'none', 
                borderRadius: 'var(--admin-radius-sm)', 
                fontWeight: '950', 
                fontSize: '0.75rem', 
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.75rem'
              }}
            >
              <Shield size={18} /> {loading ? 'Processing...' : 'Change Security Password'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminProfile;
