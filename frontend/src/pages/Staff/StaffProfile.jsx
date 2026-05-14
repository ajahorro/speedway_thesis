import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { User, Mail, Phone, Shield, Key, Save, Loader2, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import PageHeader from '../../components/PageHeader';

const StaffProfile = () => {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [passLoading, setPassLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    if (newPassword.length < 6) return toast.error('Password must be at least 6 characters');

    setPassLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPassLoading(false);
    }
  };

  const cardStyle = {
    background: '#15171A',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem'
  };

  const labelStyle = {
    fontSize: '0.65rem',
    fontWeight: '950',
    color: '#8E9196',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.5rem'
  };

  const inputStyle = {
    width: '100%',
    background: '#0A0B0D',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
    padding: '0.85rem 1rem',
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: '600',
    outline: 'none'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem', maxWidth: '800px' }}>
      <PageHeader 
        badge="ACCOUNT SETTINGS"
        title="Technician Profile"
        subtitle="Manage your identity, credentials, and account security settings."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        
        {/* Identity Section */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1.5rem' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '8px', background: '#E61E2A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserCircle size={40} color="white" />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', textTransform: 'uppercase' }}>{profile?.full_name}</h3>
              <div style={{ fontSize: '0.75rem', color: '#8E9196', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '1px' }}>
                Employee ID: SW-{profile?.id?.slice(0, 8).toUpperCase()}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div>
              <div style={labelStyle}>Primary Email</div>
              <div style={{ ...inputStyle, opacity: 0.6, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Mail size={16} /> {profile?.email || user?.email}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Phone Number</div>
              <div style={{ ...inputStyle, opacity: 0.6, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Phone size={16} /> {profile?.phone_number || 'Not Linked'}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Access Role</div>
              <div style={{ ...inputStyle, opacity: 0.6, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Shield size={16} color="#E61E2A" /> {profile?.role || 'TECHNICIAN'}
              </div>
            </div>
            <div>
              <div style={labelStyle}>Account Status</div>
              <div style={{ ...inputStyle, opacity: 0.6, color: '#10b981', fontWeight: '950' }}>
                ACTIVE & VERIFIED
              </div>
            </div>
          </div>
        </section>

        {/* Security Section */}
        <section style={cardStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Key size={20} color="#E61E2A" />
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>Security Credentials</h3>
          </div>

          <form onSubmit={handleUpdatePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div>
                <div style={labelStyle}>New Password</div>
                <input 
                  type="password" 
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                  required
                />
              </div>
              <div>
                <div style={labelStyle}>Confirm New Password</div>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  style={inputStyle}
                  required
                />
              </div>
            </div>
            
            <button 
              type="submit"
              disabled={passLoading}
              style={{ 
                alignSelf: 'flex-start',
                padding: '0.85rem 2rem', background: '#E61E2A', 
                color: 'white', border: 'none', borderRadius: '4px', 
                fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                textTransform: 'uppercase', letterSpacing: '1px'
              }}
            >
              {passLoading ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              Update Credentials
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

export default StaffProfile;
