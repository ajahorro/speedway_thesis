import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import { User, Mail, Lock, Shield, Save, Key } from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';

const AdminProfile = () => {
  const navigate = useNavigate();
  const { user, profile, updateProfile, verifyPassword } = useAuth();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  
  // States
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null); // 'profile' or 'password'
  
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || user?.user_metadata?.first_name || '',
    lastName: profile?.last_name || user?.user_metadata?.last_name || '',
    email: user?.email || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Reset form when profile/user loads
  useEffect(() => {
    if (profile || user) {
      setFormData(prev => ({
        ...prev,
        firstName: profile?.first_name || user?.user_metadata?.first_name || '',
        lastName: profile?.last_name || user?.user_metadata?.last_name || '',
        email: user?.email || ''
      }));
    }
  }, [profile, user]);

  const handleUpdateClick = (action) => {
    if (action === 'password') {
      if (!formData.newPassword || formData.newPassword !== formData.confirmPassword) {
        return toast.error('Passwords do not match');
      }
      if (formData.newPassword.length < 6) {
        return toast.error('New password must be at least 6 characters');
      }
    }
    setPendingAction(action);
    setShowVerifyModal(true);
  };

  const executeVerifiedAction = async () => {
    const res = await verifyPassword(formData.currentPassword);
    if (!res.success) {
      return toast.error('Identity verification failed. Incorrect password.');
    }

    setShowVerifyModal(false);
    setLoading(true);
    const toastId = toast.loading('Synchronizing identity records...');

    try {
      if (pendingAction === 'profile') {
        await updateProfile({
          first_name: formData.firstName,
          last_name: formData.lastName,
          full_name: `${formData.firstName} ${formData.lastName}`.trim()
        });
        setIsEditing(false);
        toast.success('Professional identity updated', { id: toastId });
      } else if (pendingAction === 'password') {
        const { error } = await supabase.auth.updateUser({ password: formData.newPassword });
        if (error) throw error;
        toast.success('Security credentials rotated', { id: toastId });
        setFormData(prev => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
      }
    } catch (err) {
      toast.error(err.message || 'Operation failed', { id: toastId });
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  };

  const cardStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius)',
    border: '1px solid var(--admin-border)',
    padding: isMobile ? '1.5rem' : '2rem',
    boxShadow: 'var(--admin-card-shadow)',
    position: 'relative'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.85rem 1.25rem',
    background: isEditing || pendingAction === 'password' ? 'var(--admin-bg)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${isEditing ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
    borderRadius: 'var(--admin-radius-sm)',
    color: 'var(--admin-text-primary)',
    fontSize: '0.95rem',
    fontWeight: '600',
    outline: 'none',
    transition: 'all 0.2s ease',
    cursor: isEditing ? 'text' : 'not-allowed'
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
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'transparent', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)', padding: '0.5rem 1rem', borderRadius: '4px', fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Edit Identity
            </button>
          )}
          
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
                  readOnly={!isEditing}
                  value={formData.firstName}
                  onChange={e => setFormData({...formData, firstName: e.target.value})}
                />
              </div>
              <div>
                <label style={labelStyle}>Last Name</label>
                <input 
                  style={inputStyle} 
                  readOnly={!isEditing}
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
            {isEditing && (
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button 
                  onClick={() => { setIsEditing(false); setFormData({...formData, firstName: profile.first_name, lastName: profile.last_name}); }}
                  style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', color: 'white', borderRadius: '4px', fontWeight: '950', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleUpdateClick('profile')}
                  style={{ flex: 2, padding: '1rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '950', cursor: 'pointer' }}
                >
                  Authorize & Update
                </button>
              </div>
            )}
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

          <form onSubmit={(e) => { e.preventDefault(); executeVerifiedAction(); }} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label style={labelStyle}>Current Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
                <input 
                  type="password"
                  autoComplete="current-password"
                  style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text', paddingLeft: '3.25rem' }} 
                  placeholder="Verify identity"
                  value={formData.currentPassword}
                  onChange={e => setFormData({...formData, currentPassword: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
                <input 
                  type="password"
                  autoComplete="new-password"
                  style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text', paddingLeft: '3.25rem' }} 
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
                  autoComplete="new-password"
                  style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text', paddingLeft: '3.25rem' }} 
                  placeholder="Confirm new password"
                  value={formData.confirmPassword}
                  onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading || !formData.newPassword || !formData.currentPassword}
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
                gap: '0.75rem',
                opacity: loading || !formData.newPassword || !formData.currentPassword ? 0.5 : 1
              }}
            >
              <Shield size={18} /> {loading ? 'Processing...' : 'Rotate Security Key'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '0.5rem' }}>
              <button 
                type="button"
                onClick={() => {
                  const email = user?.email;
                  if (email) {
                    toast.promise(supabase.auth.resetPasswordForEmail(email), {
                      loading: 'Sending reset link...',
                      success: 'Reset link sent to your email!',
                      error: 'Failed to send reset link.'
                    });
                  }
                }}
                style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
              >
                Forgot Password?
              </button>
            </div>
          </form>
        </div>

      </div>

      {/* Verification Modal */}
      {showVerifyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <form onSubmit={(e) => { e.preventDefault(); executeVerifiedAction(); }} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', padding: '2.5rem', borderRadius: 'var(--admin-radius)', maxWidth: '400px', width: '90%', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', color: 'var(--admin-brand)' }}>
              <Shield size={32} />
            </div>
            <h2 style={{ fontWeight: '950', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Authorize Action</h2>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '700', marginBottom: '2rem' }}>Please enter your current password to verify your identity.</p>
            
            <input 
              type="password"
              autoComplete="current-password"
              placeholder="Current Password"
              value={formData.currentPassword}
              onChange={e => setFormData({...formData, currentPassword: e.target.value})}
              style={{ ...inputStyle, background: 'var(--admin-bg)', textAlign: 'center', cursor: 'text', marginBottom: '1.5rem' }}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button type="button" onClick={() => setShowVerifyModal(false)} style={{ flex: 1, padding: '0.85rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', fontWeight: '950', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ flex: 2, padding: '0.85rem', background: 'var(--admin-brand)', border: 'none', borderRadius: '4px', color: 'white', fontWeight: '950', cursor: 'pointer' }}>Verify & Proceed</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
export default AdminProfile;
