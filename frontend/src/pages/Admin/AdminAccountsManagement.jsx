import React, { useState, useEffect, useCallback, useMemo } from 'react';
import ReactDOM from 'react-dom';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import { 
  UserPlus, Users, Mail, Lock, User, Search, Trash2, 
  ShieldAlert, ShieldCheck, RefreshCcw, Loader2, 
  AlertCircle, MoreVertical, Ban, Shield, Settings,
  CheckCircle2, X, Send
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { showConfirmation } from '../../utils/logoutConfirm';
import { logger } from '../../utils/logger';
import { useAuth } from '../../hooks/useAuth';

const AdminAccountsManagement = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const { profile: currentUserProfile, user: currentUser } = useAuth();
  
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('STAFF'); // STAFF or ADMIN
  
  // Invitation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: '',
    firstName: '',
    lastName: ''
  });

  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      logger.admin('Synchronizing account directory...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role', ['STAFF', 'ADMIN'])
        .order('full_name');

      if (error) throw error;
      setAccounts(data || []);
      logger.admin('Account directory synchronized.');
    } catch (err) {
      logger.error('Account Fetch Error', err);
      toast.error('Failed to load accounts.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleSendInvite = async (e) => {
    e.preventDefault();
    if (!inviteForm.email) {
      toast.error('Please provide an email address');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(`Generating invitation for ${inviteForm.email}...`);
    
    try {
      logger.admin(`Generating ${activeTab} invitation for: ${inviteForm.email}`);
      
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/admin/generate-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          role: activeTab // Uses the active tab (ADMIN/STAFF) as the role
        })
      });

      const result = await response.json();

      if (!response.ok) throw new Error(result.error || 'Failed to generate invitation');

      toast.success('Invitation link generated and sent!', { id: toastId });
      setIsModalOpen(false);
      setInviteForm({ email: '', firstName: '', lastName: '' }); // keep names empty
    } catch (err) {
      logger.error('Invitation Error', err);
      toast.error(`Failed to send invitation: ${err.message}`, { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };


  const handleDeactivate = (member) => {
    if (member.email === 'speedway.automox@gmail.com') {
      toast.error('System default admin cannot be deactivated.');
      return;
    }

    showConfirmation({
      title: 'Revoke Access?',
      message: `Are you sure you want to deactivate ${member.full_name?.toUpperCase()}? They will be reverted to a CUSTOMER account.`,
      icon: ShieldAlert,
      confirmLabel: 'Deactivate',
      onConfirm: async () => {
        setIsSubmitting(true);
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ role: 'CUSTOMER' })
            .eq('id', member.id);
          if (error) throw error;
          toast.success('Account deactivated successfully');
          fetchAccounts();
        } catch (err) {
          toast.error('Failed to deactivate account');
        } finally {
          setIsSubmitting(false);
        }
      },
      variant: 'danger'
    });
  };

  const filteredAccounts = useMemo(() => {
    return accounts.filter(a => a.role === activeTab && (
      a.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.email?.toLowerCase().includes(searchQuery.toLowerCase())
    ));
  }, [accounts, activeTab, searchQuery]);

  const cardStyle = {
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius)',
    padding: '1.5rem',
    color: 'var(--admin-text-primary)'
  };

  const isSuperAdmin = currentUserProfile?.role === 'ADMIN';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader 
        badge="ACCOUNT INFRASTRUCTURE"
        title="Accounts Management"
        subtitle="Manage system access levels and administrative privileges via secure invitation."
        onRefresh={fetchAccounts}
      />

      <div style={{ ...cardStyle }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--admin-border)', marginBottom: '1.5rem', gap: '2rem' }}>
          <button 
            onClick={() => setActiveTab('STAFF')}
            style={{ 
              padding: '1rem 0.5rem', background: 'none', border: 'none', 
              color: activeTab === 'STAFF' ? 'var(--admin-brand)' : 'var(--admin-text-secondary)',
              borderBottom: activeTab === 'STAFF' ? '2px solid var(--admin-brand)' : '2px solid transparent',
              fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', textTransform: 'uppercase'
            }}
          >
            Staff Accounts
          </button>
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveTab('ADMIN')}
              style={{ 
                padding: '1rem 0.5rem', background: 'none', border: 'none', 
                color: activeTab === 'ADMIN' ? 'var(--admin-brand)' : 'var(--admin-text-secondary)',
                borderBottom: activeTab === 'ADMIN' ? '2px solid var(--admin-brand)' : '2px solid transparent',
                fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', textTransform: 'uppercase'
              }}
            >
              Admin Accounts
            </button>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ position: 'relative', width: isMobile ? '100%' : '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)', opacity: 0.5 }} />
            <input 
              type="text" 
              placeholder={`SEARCH ${activeTab}S...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                width: '100%', padding: '0.75rem 1rem 0.75rem 2.5rem', background: 'var(--admin-bg)', 
                border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', 
                color: 'var(--admin-text-primary)', fontSize: '0.75rem', fontWeight: '950', 
                outline: 'none', textTransform: 'uppercase'
              }}
            />
          </div>
          
          <button 
            onClick={() => setIsModalOpen(true)}
            style={{ 
              padding: '0.75rem 1.25rem', background: 'var(--admin-brand)', color: 'white', 
              border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', 
              fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' 
            }}
          >
            <UserPlus size={16} /> SEND {activeTab} INVITE
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {loading ? (
            [1,2,3].map(i => (
              <div key={i} style={{ height: '80px', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }} className="animate-pulse"></div>
            ))
          ) : filteredAccounts.length > 0 ? (
            filteredAccounts.map((member) => (
              <div 
                key={member.id}
                style={{ 
                  padding: '1rem 1.5rem', background: 'var(--admin-bg)', 
                  borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)',
                  display: 'flex', alignItems: 'center', gap: '1.25rem'
                }}
              >
                <div style={{ 
                  width: '42px', height: '42px', borderRadius: 'var(--admin-radius-sm)', 
                  background: 'var(--admin-card)', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', color: member.role === 'ADMIN' ? '#f59e0b' : 'var(--admin-brand)', 
                  fontSize: '1rem', fontWeight: '950', border: '1px solid var(--admin-border)'
                }}>
                  {member.role === 'ADMIN' ? <Shield size={18} /> : member.full_name?.charAt(0).toUpperCase()}
                </div>

                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.9rem', fontWeight: '950', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {member.full_name}
                    {member.email === 'speedway.automox@gmail.com' && (
                      <span style={{ fontSize: '0.55rem', background: 'var(--admin-brand)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '2px' }}>DEFAULT ADMIN</span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700' }}>
                    <Mail size={12} /> {member.email}
                  </div>
                </div>

                {member.email !== 'speedway.automox@gmail.com' && (
                  <button 
                    onClick={() => handleDeactivate(member)}
                    style={{ 
                      padding: '0.6rem 1rem', borderRadius: 'var(--admin-radius-sm)', 
                      background: 'rgba(239, 68, 68, 0.05)', color: '#ef4444', 
                      fontSize: '0.65rem', fontWeight: '950', border: '1px solid rgba(239, 68, 68, 0.2)',
                      cursor: 'pointer', textTransform: 'uppercase'
                    }}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            ))
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px dashed var(--admin-border)' }}>
              <Users size={40} style={{ marginBottom: '1rem', opacity: 0.15 }} />
              <p style={{ fontWeight: '950', fontSize: '0.7rem', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>No accounts found in this category</p>
            </div>
          )}
        </div>
      </div>

      {/* INVITATION MODAL */}
      {isModalOpen && ReactDOM.createPortal(
        <div style={{ 
          position: 'fixed', 
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', 
          zIndex: 9999, backdropFilter: 'blur(8px)' 
        }}>
          <div style={{ background: 'var(--admin-card)', padding: '2rem', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', maxWidth: '500px', width: '95%', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
              <h2 style={{ margin: 0, fontWeight: '950', fontSize: '1.25rem', textTransform: 'uppercase' }}>INVITE NEW {activeTab}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--admin-text-secondary)', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', marginBottom: '1.5rem', fontWeight: '700' }}>
              Send a secure invitation link. The user will receive an email to confirm their identity and set their password.
            </p>

            <form onSubmit={handleSendInvite} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>Email Address</label>
                <div style={{ position: 'relative' }}>
                  <Mail size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
                  <input 
                    type="email" 
                    required
                    placeholder="e.g. name@example.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({...inviteForm, email: e.target.value})}
                    style={{ width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', outline: 'none', fontWeight: '700' }}
                  />
                </div>
              </div>

              <div style={{ padding: '1rem', background: 'rgba(169, 27, 24, 0.1)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid rgba(169, 27, 24, 0.2)' }}>
                <p style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', margin: 0, fontWeight: '700' }}>
                  The user will be invited as <strong style={{ color: 'var(--admin-brand)' }}>{activeTab}</strong>. 
                  They will provide their name and password when they accept the invitation.
                </p>
              </div>


              <button 
                type="submit"
                disabled={isSubmitting}
                style={{ 
                  padding: '1rem', background: 'var(--admin-brand)', color: 'white', 
                  border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', 
                  fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', 
                  justifyContent: 'center', gap: '0.75rem', marginTop: '1rem', textTransform: 'uppercase'
                }}
              >
                {isSubmitting ? <RefreshCcw size={18} className="animate-spin" /> : <><Send size={18} /> SEND INVITATION</>}
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      <style>{`
        .animate-pulse { animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AdminAccountsManagement;
