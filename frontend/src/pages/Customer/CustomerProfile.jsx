import React, { useState, useEffect } from 'react';
import { 
  User, Mail, Phone, Lock, Shield, Trash2, Save, Loader2, 
  Key, AlertTriangle, ChevronRight, CheckCircle, Edit3, X, 
  ShieldCheck, RefreshCw, Send
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const CustomerProfile = () => {
  const { user, profile, updateProfile, verifyPassword, requestEmailChange, confirmEmailChange, deactivateAccount } = useAuth();
  
  // States
  const [isEditing, setIsEditing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showPassModal, setShowPassModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);
  
  // Form Data
  const [formData, setFormData] = useState({
    firstName: profile?.first_name || user?.user_metadata?.first_name || '',
    lastName: profile?.last_name || user?.user_metadata?.last_name || '',
    phone: profile?.phone_number || user?.user_metadata?.phone_number || ''
  });

  const [emailData, setEmailData] = useState({
    newEmail: '',
    otp: '',
    step: 1 // 1: Request, 2: Confirm
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [pendingAction, setPendingAction] = useState(null); // 'profile' or 'password'

  // Reset form when profile loads
  useEffect(() => {
    if (profile || user) {
      setFormData({
        firstName: profile?.first_name || user?.user_metadata?.first_name || '',
        lastName: profile?.last_name || user?.user_metadata?.last_name || '',
        phone: profile?.phone_number || user?.user_metadata?.phone_number || ''
      });
    }
  }, [profile, user]);

  // --- Handlers ---

  const handleSaveProfileClick = (e) => {
    e.preventDefault();
    setPendingAction('profile');
    setShowPassModal(true);
  };

  const handleUpdatePasswordClick = async (e) => {
    e.preventDefault();
    if (!passwordData.currentPassword) return toast.error('Current password required');
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      return toast.error('New passwords do not match');
    }
    if (passwordData.newPassword.length < 6) {
      return toast.error('New password must be at least 6 characters');
    }

    const toastId = toast.loading('Verifying identity & rotating keys...');
    try {
      const isVerified = await verifyPassword(passwordData.currentPassword);
      if (!isVerified.success) {
        toast.error('Verification failed: Incorrect current password', { id: toastId });
        return;
      }

      const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
      if (error) throw error;
      
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      toast.success('Security credentials rotated successfully', { id: toastId });
    } catch (error) {
      toast.error(error.message || 'Operation failed', { id: toastId });
    }
  };

  const executeVerifiedAction = async () => {
    const isVerified = await verifyPassword(passwordData.currentPassword);
    
    if (!isVerified.success) {
      toast.error('Identity verification failed. Incorrect password.');
      return;
    }

    setShowPassModal(false);
    const toastId = toast.loading('Synchronizing security credentials...');

    try {
      if (pendingAction === 'profile') {
        await updateProfile({
          first_name: formData.firstName,
          last_name: formData.lastName,
          phone_number: formData.phone,
          full_name: `${formData.firstName} ${formData.lastName}`.trim()
        });
        setIsEditing(false);
        toast.success('Identity profile updated', { id: toastId });
      } else if (pendingAction === 'password') {
        const { error } = await supabase.auth.updateUser({ password: passwordData.newPassword });
        if (error) throw error;
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.success('Security credentials rotated successfully', { id: toastId });
      }
    } catch (error) {
      toast.error(error.message || 'Operation failed', { id: toastId });
    } finally {
      setPendingAction(null);
    }
  };

  const handleEmailRequest = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    const res = await requestEmailChange(emailData.newEmail);
    setIsUpdating(false);
    if (res.success) {
      setEmailData(prev => ({ ...prev, step: 2 }));
      toast.success('Verification code sent to your current email');
    } else {
      toast.error(res.error || 'Failed to initiate email change');
    }
  };

  const handleEmailConfirm = async (e) => {
    e.preventDefault();
    setIsUpdating(true);
    const res = await confirmEmailChange(emailData.otp);
    setIsUpdating(false);
    if (res.success) {
      setShowEmailModal(false);
      setEmailData({ newEmail: '', otp: '', step: 1 });
      toast.success('Email address updated successfully');
    } else {
      toast.error(res.error || 'Invalid or expired code');
    }
  };

  const handleDeactivate = async () => {
    const res = await deactivateAccount();
    if (res.success) {
      toast.success('Account deactivated. Grace period started.');
    } else {
      toast.error(res.error || 'Deactivation failed');
    }
  };

  // --- Styles ---
  const cardStyle = {
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius-lg)',
    padding: '2rem',
    boxShadow: 'var(--admin-card-shadow)',
    position: 'relative',
    overflow: 'hidden'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: '950',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    marginBottom: '0.5rem',
    letterSpacing: '1px'
  };

  const inputStyle = {
    width: '100%',
    background: isEditing ? 'var(--admin-bg)' : 'rgba(255,255,255,0.02)',
    border: `1px solid ${isEditing ? 'var(--admin-brand)' : 'var(--admin-border)'}`,
    borderRadius: '8px',
    padding: '0.85rem 1rem',
    color: isEditing ? 'white' : 'var(--admin-text-secondary)',
    fontWeight: '800',
    outline: 'none',
    transition: 'all 0.2s ease',
    cursor: isEditing ? 'text' : 'not-allowed'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', paddingBottom: '5rem' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: '2.5rem', fontWeight: '950', margin: '0 0 0.5rem 0', textTransform: 'uppercase', color: 'white', letterSpacing: '-1.5px' }}>My Profile</h1>
          <p style={{ margin: 0, color: 'var(--admin-text-secondary)', fontSize: '0.95rem', fontWeight: '600', opacity: 0.8 }}>
            Manage your industrial identity and security infrastructure.
          </p>
        </div>
        {!isEditing && (
          <button 
            onClick={() => setIsEditing(true)}
            style={{ padding: '0.75rem 1.5rem', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '1px' }}
          >
            <Edit3 size={16} /> Edit Profile
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        
        {/* Left Column: Personal Data */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <User size={20} color="var(--admin-brand)" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', textTransform: 'uppercase' }}>Identity Specs</h2>
            </div>

            <form onSubmit={handleSaveProfileClick} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>First Name</label>
                  <input 
                    type="text" 
                    value={formData.firstName}
                    readOnly={!isEditing}
                    onChange={(e) => setFormData({...formData, firstName: e.target.value})}
                    style={inputStyle} 
                  />
                </div>
                <div>
                  <label style={labelStyle}>Last Name</label>
                  <input 
                    type="text" 
                    value={formData.lastName}
                    readOnly={!isEditing}
                    onChange={(e) => setFormData({...formData, lastName: e.target.value})}
                    style={inputStyle} 
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Contact Number</label>
                <div style={{ position: 'relative' }}>
                  <Phone size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.4 }} />
                  <input 
                    type="tel" 
                    value={formData.phone}
                    readOnly={!isEditing}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    style={{ ...inputStyle, paddingLeft: '3rem' }} 
                  />
                </div>
              </div>

              {isEditing && (
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  <button 
                    type="button" 
                    onClick={() => { setIsEditing(false); setFormData({ firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone_number }); }}
                    style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    style={{ flex: 1.5, padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '1px' }}
                  >
                    Authorize & Save
                  </button>
                </div>
              )}
            </form>
          </section>

          {/* Email Management */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Mail size={20} color="var(--admin-brand)" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', textTransform: 'uppercase' }}>System Communication</h2>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)', marginBottom: '1.5rem' }}>
              <label style={labelStyle}>Primary Email</label>
              <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'white' }}>{user?.email}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--admin-success)', fontWeight: '900', marginTop: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem', textTransform: 'uppercase' }}>
                <ShieldCheck size={12} /> Verified Root Account
              </div>
            </div>

            <button 
              onClick={() => setShowEmailModal(true)}
              style={{ alignSelf: 'flex-start', padding: '0.75rem 1.25rem', background: 'transparent', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)', borderRadius: '8px', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', fontSize: '0.75rem' }}
            >
              Update Primary Email
            </button>
          </section>
        </div>

        {/* Right Column: Security & Danger Zone */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Password Section */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <Lock size={20} color="var(--admin-brand)" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', textTransform: 'uppercase' }}>Security Key</h2>
            </div>

            <form onSubmit={handleUpdatePasswordClick} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={labelStyle}>Current Password</label>
                <input 
                  type="password" 
                  placeholder="Verify your identity"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text' }} 
                />
              </div>
              <div>
                <label style={labelStyle}>New Password</label>
                <input 
                  type="password" 
                  placeholder="Min. 6 characters"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text' }} 
                />
              </div>
              <div>
                <label style={labelStyle}>Confirm Password</label>
                <input 
                  type="password" 
                  placeholder="Repeat new password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text' }} 
                />
              </div>
              <button 
                type="submit" 
                disabled={!passwordData.newPassword || !passwordData.currentPassword}
                style={{ width: '100%', padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', opacity: (!passwordData.newPassword || !passwordData.currentPassword) ? 0.4 : 1 }}
              >
                Rotate Password
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
          </section>

          {/* Danger Zone */}
          <section style={{ ...cardStyle, border: '1px solid rgba(239, 68, 68, 0.2)', background: 'rgba(239, 68, 68, 0.02)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
              <AlertTriangle size={20} color="#ef4444" />
              <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', textTransform: 'uppercase', color: '#ef4444' }}>Danger Zone</h2>
            </div>
            <p style={{ margin: '0 0 1.5rem 0', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600', lineHeight: 1.5 }}>
              Account deactivation initiates a 15-day grace period. After 15 days, all data will be permanently purged from Speedway servers.
            </p>
            <button 
              onClick={() => setShowDeactivateModal(true)}
              style={{ width: '100%', padding: '1rem', background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', borderRadius: '8px', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase' }}
            >
              Deactivate Account
            </button>
          </section>
        </div>
      </div>

      {/* --- MODALS --- */}

      {/* Password Challenge Modal */}
      {showPassModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: '100%', maxWidth: '400px', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <Shield size={32} color="var(--admin-brand)" />
            </div>
            <h2 style={{ fontWeight: '950', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Identity Verification</h2>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '2rem' }}>Please enter your current password to authorize this sensitive update.</p>
            
            <input 
              type="password"
              placeholder="Current Password"
              value={passwordData.currentPassword}
              onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
              style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text', textAlign: 'center', marginBottom: '1.5rem' }}
            />

            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => { setShowPassModal(false); setPasswordData({...passwordData, currentPassword: ''}); }} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer' }}>Cancel</button>
              <button onClick={executeVerifiedAction} style={{ flex: 2, padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer' }}>Verify & Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Email Change Modal */}
      {showEmailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-lg)', width: '100%', maxWidth: '450px', padding: '2.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontWeight: '950', textTransform: 'uppercase' }}>Update Email</h2>
              <button onClick={() => setShowEmailModal(false)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X /></button>
            </div>

            {emailData.step === 1 ? (
              <form onSubmit={handleEmailRequest} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(var(--admin-info-rgb), 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--admin-info)', color: 'var(--admin-info)', fontSize: '0.8rem', fontWeight: '600' }}>
                  A verification code will be sent to <strong>{user.email}</strong> to authorize this change.
                </div>
                <div>
                  <label style={labelStyle}>New Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={emailData.newEmail}
                    onChange={(e) => setEmailData({...emailData, newEmail: e.target.value})}
                    style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text' }} 
                  />
                </div>
                <button type="submit" disabled={isUpdating} style={{ padding: '1rem', background: 'var(--admin-brand)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                  {isUpdating ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                  Send Authorization Code
                </button>
              </form>
            ) : (
              <form onSubmit={handleEmailConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                <div style={{ background: 'rgba(var(--admin-success-rgb), 0.05)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--admin-success)', color: 'var(--admin-success)', fontSize: '0.8rem', fontWeight: '600' }}>
                  Code sent! Check your inbox for the authorization code.
                </div>
                <div>
                  <label style={labelStyle}>Authorization Code</label>
                  <input 
                    type="text" 
                    required
                    placeholder="6-digit code"
                    value={emailData.otp}
                    onChange={(e) => setEmailData({...emailData, otp: e.target.value})}
                    style={{ ...inputStyle, background: 'var(--admin-bg)', cursor: 'text', textAlign: 'center', fontSize: '1.5rem', letterSpacing: '8px' }} 
                  />
                </div>
                <button type="submit" disabled={isUpdating} style={{ padding: '1rem', background: 'var(--admin-success)', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer' }}>
                  {isUpdating ? <Loader2 className="animate-spin" /> : 'Confirm Change'}
                </button>
                <button type="button" onClick={() => setEmailData({...emailData, step: 1})} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', fontSize: '0.75rem', fontWeight: '800', cursor: 'pointer', textTransform: 'uppercase' }}>Didn't receive code? Try again</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Deactivation Confirmation Modal */}
      {showDeactivateModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100 }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid #ef4444', borderRadius: 'var(--admin-radius-lg)', width: '100%', maxWidth: '450px', padding: '2.5rem', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
              <AlertTriangle size={32} color="#ef4444" />
            </div>
            <h2 style={{ fontWeight: '950', textTransform: 'uppercase', color: '#ef4444' }}>Authorize Deactivation</h2>
            <p style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600', marginBottom: '2rem', lineHeight: 1.6 }}>
              This will log you out immediately. You will have 15 days to recover your account by logging back in. After that, all data is permanently purged.
            </p>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={() => setShowDeactivateModal(false)} style={{ flex: 1, padding: '1rem', background: 'transparent', border: '1px solid var(--admin-border)', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleDeactivate} style={{ flex: 2, padding: '1rem', background: '#ef4444', border: 'none', borderRadius: '8px', color: 'white', fontWeight: '950', cursor: 'pointer' }}>Yes, Deactivate</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CustomerProfile;
