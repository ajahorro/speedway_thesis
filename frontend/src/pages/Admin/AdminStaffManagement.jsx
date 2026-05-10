import React, { useState, useEffect } from 'react';
import { mockStaff } from './AdminMockData';
import PageHeader from '../../components/PageHeader';
import { 
  UserPlus, 
  Users, 
  Mail, 
  Lock, 
  User, 
  Search, 
  Trash2, 
  ShieldAlert,
  ShieldCheck,
  RefreshCcw,
  Loader2,
  AlertCircle,
  MoreVertical,
  Ban
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { showConfirmation } from '../../utils/logoutConfirm';

const AdminStaffManagement = () => {
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: ''
  });

  const fetchStaff = async () => {
    setLoading(true);
    setTimeout(() => {
      setStaff(mockStaff);
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
        toast.success('Staff member registered successfully (Mock)');
        setIsSubmitting(false);
    }, 1000);
  };

  const handleDeactivateClick = (member) => {
    showConfirmation({
      title: 'Revoke Access?',
      message: `Are you sure you want to deactivate ${member.full_name?.toUpperCase()}? This will immediately revoke their staff privileges.`,
      icon: ShieldAlert,
      confirmLabel: 'Deactivate',
      onConfirm: () => confirmDeactivate(member),
      variant: 'danger'
    });
  };

  const confirmDeactivate = async (member) => {
    setIsSubmitting(true);
    setTimeout(() => {
        toast.success(`${member.full_name} deactivated (Mock)`);
        setIsSubmitting(false);
    }, 1000);
  };

  const handleReactivate = async (member) => {
    toast.success('Staff reactivated (Mock)');
  };

  const activeStaff = staff.filter(s => s.role === 'STAFF' && (
    s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.email?.toLowerCase().includes(searchQuery.toLowerCase())
  ));

  // Improved Safe Filter for inactive staff
  const inactiveStaff = staff.filter(s => {
    const isInactive = s.role === 'CUSTOMER';
    const matchesSearch = s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         s.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Logic: Show customers who are either marked was_staff OR use the speedway domains
    const emailLower = s.email?.toLowerCase() || '';
    const isFormerStaff = s.was_staff === true || 
                         emailLower.endsWith('@speed.way') || 
                         emailLower.endsWith('@speedway.com');
    
    return isInactive && isFormerStaff && matchesSearch;
  });


  const adminCardStyle = {
    background: 'var(--admin-card)',
    border: '1px solid var(--admin-border)',
    borderRadius: 'var(--admin-radius)', // SHARP
    padding: '1.5rem',
    boxShadow: 'var(--admin-card-shadow)',
    color: 'var(--admin-text-primary)',
    transition: 'all 0.3s ease'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader 
        badge="TEAM COORDINATION"
        title="STAFF DIRECTORY"
        subtitle="Onboard new employees and manage access permissions"
        onRefresh={fetchStaff}
      />

      <div className="responsive-grid" style={{ alignItems: 'start' }}>
        
        {/* Left: Registration Form - REMOVED FOR CLEAN STATE */}
        
        {/* Right: Team List */}
        <div style={{ ...adminCardStyle, position: 'relative', gridColumn: isMobile ? 'auto' : '1 / -1' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ padding: '0.6rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-brand)', border: '1px solid var(--admin-border)' }}>
                <Users size={20} />
              </div>
              <h2 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Personnel ({activeStaff.length})</h2>
            </div>

            <div style={{ position: 'relative', width: isMobile ? '100%' : '250px' }}>
              <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)', opacity: 0.5 }} />
              <input 
                type="text" 
                placeholder="SEARCH PERSONNEL..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', 
                  padding: '0.75rem 1rem 0.75rem 2.5rem', 
                  background: 'var(--admin-bg)', 
                  border: '1px solid var(--admin-border)', 
                  borderRadius: 'var(--admin-radius-sm)', 
                  color: 'var(--admin-text-primary)', 
                  fontSize: '0.75rem',
                  fontWeight: '950',
                  outline: 'none',
                  textTransform: 'uppercase'
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} style={{ height: '80px', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }} className="animate-pulse"></div>
              ))
            ) : activeStaff.length > 0 ? (
              activeStaff.map((member) => (
                <div 
                  key={member.id}
                  className="staff-card"
                  style={{ 
                    padding: '1rem 1.5rem', 
                    background: 'var(--admin-bg)', 
                    borderRadius: 'var(--admin-radius-sm)', 
                    border: '1px solid var(--admin-border)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.25rem'
                  }}
                >
                  <div style={{ 
                    width: '42px', 
                    height: '42px', 
                    borderRadius: 'var(--admin-radius-sm)', 
                    background: 'var(--admin-card)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--admin-brand)',
                    fontSize: '1rem',
                    fontWeight: '950',
                    border: '1px solid var(--admin-border)',
                    flexShrink: 0
                  }}>
                    {member.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '-0.2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.full_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '700', textTransform: 'uppercase' }}>
                      <Mail size={12} style={{ opacity: 0.5 }} /> {member.email}
                    </div>
                  </div>

                  <button 
                    onClick={() => handleDeactivateClick(member)}
                    style={{ 
                      padding: '0.6rem 1rem', 
                      borderRadius: 'var(--admin-radius-sm)', 
                      background: 'rgba(239, 68, 68, 0.05)', 
                      color: '#ef4444', 
                      fontSize: '0.65rem', 
                      fontWeight: '950', 
                      border: '1px solid rgba(239, 68, 68, 0.2)',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '1px'
                    }}
                  >
                    Deactivate
                  </button>
                </div>
              ))
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', border: '1px dashed var(--admin-border)' }}>
                <Users size={40} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.15 }} />
                <p style={{ fontWeight: '950', fontSize: '0.7rem', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>No active personnel</p>
              </div>
            )}
          </div>

          {inactiveStaff.length > 0 && (
            <div style={{ marginTop: '3rem', borderTop: '1px solid var(--admin-border)', paddingTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <ShieldAlert size={18} style={{ color: 'var(--admin-brand)' }} />
                <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Deactivated Personnel</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {inactiveStaff.map((member) => (
                  <div 
                    key={member.id}
                    style={{ 
                      padding: '1rem 1.25rem', 
                      background: 'rgba(255,255,255,0.01)', 
                      borderRadius: 'var(--admin-radius-sm)', 
                      border: '1px dashed var(--admin-border)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1.25rem',
                      opacity: 0.6
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>{member.full_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>{member.email}</div>
                    </div>
                    <button 
                      onClick={() => handleReactivate(member)}
                      disabled={isSubmitting}
                      style={{ 
                        padding: '0.55rem 1rem', 
                        borderRadius: 'var(--admin-radius-sm)', 
                        background: 'var(--admin-bg)', 
                        color: 'var(--admin-brand)', 
                        fontSize: '0.65rem', 
                        fontWeight: '950', 
                        border: '1px solid var(--admin-brand)',
                        cursor: 'pointer',
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}
                    >
                      Reactivate
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>



      <style>{`
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .staff-card { transition: 0.2s; }
        .staff-card:hover { border-color: var(--admin-brand) !important; transform: translateY(-2px); background: rgba(var(--admin-brand-rgb), 0.02) !important; }
      `}</style>
    </div>
  );
};

export default AdminStaffManagement;
