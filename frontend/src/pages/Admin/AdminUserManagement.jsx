import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockUsers, mockBookings } from './AdminMockData';
import PageHeader from '../../components/PageHeader';
import { 
  Users, 
  Search, 
  Mail, 
  Phone, 
  User, 
  ChevronRight, 
  History, 
  ExternalLink,
  X,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Trash2,
  RefreshCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const AdminUserManagement = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // View State
  const [view, setView] = useState('list'); // 'list' or 'history'
  const [selectedUser, setSelectedUser] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(null); // stores the user object being deleted

  const fetchUsers = async () => {
    setLoading(true);
    setTimeout(() => {
      setUsers(mockUsers);
      setLoading(false);
    }, 500);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSeeHistory = async (user) => {
    setSelectedUser(user);
    setView('history');
    setLoadingHistory(true);
    setTimeout(() => {
      setUserBookings(mockBookings.filter(b => b.customer_id === user.id));
      setLoadingHistory(false);
    }, 500);
  };

  const handleBackToList = () => {
    setView('list');
    setSelectedUser(null);
    setUserBookings([]);
  };

  // Exclude staff/admin accounts that may have role=CUSTOMER (deactivated staff)
  const isStaffAccount = (u) => {
    const emailLower = u.email?.toLowerCase() || '';
    return u.was_staff === true || 
           emailLower.endsWith('@speed.way') || 
           emailLower.endsWith('@speedway.com');
  };

  const filteredUsers = users.filter(u => 
    !isStaffAccount(u) && (
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone_number?.includes(searchQuery)
    )
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' };
      case 'cancelled': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' };
      case 'scheduled': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' };
      case 'in_progress': return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' };
      case 'curing': return { bg: 'rgba(139, 92, 246, 0.1)', text: '#8b5cf6' };
      case 'ready_for_pickup': return { bg: 'rgba(20, 184, 166, 0.1)', text: '#14b8a6' };
      default: return { bg: 'var(--admin-bg)', text: 'var(--admin-text-secondary)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.5s ease' }}>
      <PageHeader 
        badge="ACCESS CONTROL"
        title={view === 'list' ? "User Directory" : "Customer History"}
        subtitle={view === 'list' ? "Manage customer profiles and review booking histories" : `Service timeline for ${selectedUser?.full_name}`}
        onRefresh={view === 'list' ? fetchUsers : () => handleSeeHistory(selectedUser)}
      />



      {view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          <div style={{ position: 'relative' }}>
            <Search size={20} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
            <input 
              type="text" 
              placeholder="Search by name, email, or phone number..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ 
                width: '100%', 
                padding: '1rem 1.25rem 1rem 3.5rem', 
                background: 'var(--admin-input-bg)', 
                border: '1px solid var(--admin-border)', 
                borderRadius: 'var(--admin-radius)', 
                color: 'var(--admin-text-primary)', 
                fontSize: '1rem',
                fontWeight: '600',
                outline: 'none',
                boxShadow: '0 4px 15px rgba(0,0,0,0.05)'
              }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.25rem' }}>
            {loading ? (
              [1,2,3,4].map(i => (
                <div key={i} style={{ height: '160px', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)' }} className="animate-pulse"></div>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => (
                <div 
                  key={user.id}
                  className="user-card"
                  style={{ 
                    background: 'var(--admin-card)', 
                    border: '1px solid var(--admin-border)', 
                    borderRadius: 'var(--admin-radius)', 
                    padding: '1.25rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'default'
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '48px', 
                      height: '48px', 
                      borderRadius: 'var(--admin-radius-sm)', 
                      background: 'var(--admin-bg)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      color: 'var(--admin-brand)',
                      fontSize: '1.25rem',
                      fontWeight: '800',
                      border: '1px solid var(--admin-border)'
                    }}>
                      {user.full_name?.charAt(0) || <User size={20} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{user.full_name}</h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.2rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>
                          <Mail size={12} style={{ color: 'var(--admin-brand)' }} /> {user.email}
                        </div>
                        {user.phone_number && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '600' }}>
                            <Phone size={12} style={{ color: 'var(--admin-brand)' }} /> {user.phone_number}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button 
                      onClick={() => handleSeeHistory(user)}
                      className="action-btn"
                      style={{ 
                        flex: 1,
                        padding: '0.75rem', 
                        borderRadius: 'var(--admin-radius-sm)', 
                        background: 'var(--admin-bg)', 
                        color: 'var(--admin-brand)', 
                        fontSize: '0.8rem', 
                        fontWeight: '800', 
                        border: '1px solid var(--admin-border)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.5rem'
                      }}
                    >
                      <History size={16} /> SERVICE HISTORY
                    </button>
                    {user.role !== 'CUSTOMER' && (
                      <button 
                        onClick={() => setIsDeletingUser(user)}
                        className="action-btn"
                        style={{ 
                          padding: '0.75rem', 
                          borderRadius: 'var(--admin-radius-sm)', 
                          background: 'rgba(239, 68, 68, 0.05)', 
                          color: '#ef4444', 
                          border: '1px solid var(--admin-border)',
                          cursor: 'pointer'
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px dashed var(--admin-border)' }}>
                <Users size={64} strokeWidth={1} style={{ color: 'var(--admin-text-secondary)', marginBottom: '1.5rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>No customers found</h3>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <button 
            onClick={handleBackToList}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--admin-brand)', 
              fontWeight: '800', 
              cursor: 'pointer',
              padding: '0.5rem 0',
              fontSize: '0.85rem'
            }}
          >
            <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> BACK TO DIRECTORY
          </button>

          <div style={{ 
            background: 'var(--admin-card)', 
            borderRadius: 'var(--admin-radius)', 
            padding: '2rem', 
            border: '1px solid var(--admin-border)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '2rem',
            alignItems: 'center',
            boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
          }}>
            <div style={{ 
              width: '80px', 
              height: '80px', 
              borderRadius: 'var(--admin-radius)', 
              background: 'var(--admin-bg)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--admin-brand)',
              fontSize: '2rem',
              fontWeight: '800',
              border: '1px solid var(--admin-border)'
            }}>
              {selectedUser?.full_name?.charAt(0)}
            </div>
            
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', margin: '0 0 0.5rem 0', letterSpacing: '-0.5px' }}>{selectedUser?.full_name}</h2>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '700' }}>
                  <Mail size={16} style={{ color: 'var(--admin-brand)' }} /> {selectedUser?.email}
                </div>
                {selectedUser?.phone_number && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '700' }}>
                    <Phone size={16} style={{ color: 'var(--admin-brand)' }} /> {selectedUser?.phone_number}
                  </div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '700' }}>
                  <CheckCircle2 size={16} style={{ color: '#10b981' }} /> {userBookings.length} Total Records
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {loadingHistory ? (
              [1,2,3].map(i => (
                <div key={i} style={{ height: '110px', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)' }} className="animate-pulse"></div>
              ))
            ) : userBookings.length > 0 ? (
              userBookings.map((booking) => {
                const statusInfo = getStatusColor(booking.status);
                return (
                  <div 
                    key={booking.id}
                    style={{
                      background: 'var(--admin-card)',
                      borderRadius: 'var(--admin-radius)',
                      padding: '1.5rem',
                      border: '1px solid var(--admin-border)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '2rem',
                      alignItems: 'center',
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div style={{ 
                      minWidth: '140px', 
                      padding: '1rem', 
                      background: 'var(--admin-bg)', 
                      borderRadius: 'var(--admin-radius)', 
                      textAlign: 'center',
                      border: '1px solid var(--admin-border)'
                    }}>
                      <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.15rem', opacity: 0.7 }}>
                        {new Date(booking.start_datetime).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>
                        {new Date(booking.start_datetime).getDate()}
                      </div>
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>
                        {new Date(booking.start_datetime).toLocaleDateString('en-US', { weekday: 'long' })}
                      </div>
                    </div>

                    <div style={{ flex: 1, minWidth: '280px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                        <span style={{ 
                          padding: '0.35rem 0.75rem', 
                          borderRadius: 'var(--admin-radius)', 
                          background: statusInfo.bg, 
                          color: statusInfo.text, 
                          fontSize: '0.7rem', 
                          fontWeight: '800',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          border: `1px solid ${statusInfo.text}22`
                        }}>
                          {booking.status.replace('_', ' ')}
                        </span>
                        <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <Clock size={14} /> {new Date(booking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                        {booking.services.map((s, idx) => (
                          <span key={idx} style={{ 
                            fontSize: '0.9rem', 
                            fontWeight: '700', 
                            color: 'var(--admin-text-primary)',
                            background: 'var(--admin-bg)',
                            padding: '0.4rem 0.8rem',
                            borderRadius: 'var(--admin-radius-sm)',
                            border: '1px solid var(--admin-border)'
                          }}>
                            {s.service_name}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right', minWidth: '120px' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', marginBottom: '0.15rem', opacity: 0.7 }}>TOTAL VALUE</div>
                      <div style={{ fontSize: '1.35rem', fontWeight: '800', color: 'var(--admin-brand)' }}>
                        ₱{booking.total_amount?.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px dashed var(--admin-border)' }}>
                <Calendar size={48} strokeWidth={1} style={{ color: 'var(--admin-text-secondary)', marginBottom: '1.25rem', opacity: 0.3 }} />
                <h3 style={{ fontSize: '1.15rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>No booking history found</h3>
                <p style={{ color: 'var(--admin-text-secondary)', fontWeight: '600', fontSize: '0.9rem', marginTop: '0.5rem' }}>This customer has no recorded service activity.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      )}

      {/* DELETION MODAL */}
      {isDeletingUser && (
        <div style={{ 
          position: 'fixed',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(8px)',
          zIndex: 100000,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{ 
            background: 'var(--bg-panel)', 
            border: '1px solid var(--glass-border)', 
            borderRadius: 'var(--admin-radius)', 
            padding: isMobile ? '1.5rem' : '2.5rem', 
            width: 'min(400px, 95vw)',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
            animation: 'modalIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
            backdropFilter: 'blur(12px)',
            margin: '1.25rem'
          }}>
            <div style={{ marginBottom: isMobile ? '1rem' : '1.5rem', textAlign: 'center' }}>
              <div style={{ width: isMobile ? '48px' : '64px', height: isMobile ? '48px' : '64px', borderRadius: 'var(--admin-radius)', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem auto', color: '#ef4444' }}>
                <Trash2 size={isMobile ? 24 : 32} />
              </div>
              <h2 style={{ fontSize: isMobile ? '1.25rem' : '1.5rem', fontWeight: '800', color: 'var(--panel-text)', margin: '0 0 0.5rem 0' }}>Confirm Deletion</h2>
              <p style={{ fontSize: isMobile ? '0.8rem' : '0.9rem', color: 'var(--panel-text)', opacity: 0.6, fontWeight: '500', lineHeight: '1.6', margin: '0.75rem 0 0 0' }}>
                Are you sure you want to remove <span style={{ color: 'var(--primary-color)', fontWeight: '800' }}>{isDeletingUser.full_name}</span>? This action will permanently delete their account and history.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', flexDirection: isMobile ? 'column' : 'row' }}>
              <button 
                onClick={() => setIsDeletingUser(null)}
                className="action-btn"
                style={{ 
                  flex: 1, 
                  padding: '0.875rem', 
                  borderRadius: 'var(--admin-radius)', 
                  background: 'var(--admin-bg)', 
                  color: 'var(--panel-text)', 
                  border: '1px solid var(--glass-border)', 
                  fontWeight: '800', 
                  fontSize: '0.85rem', 
                  cursor: 'pointer'
                }}
              >
                CANCEL
              </button>
              <button 
                onClick={async () => {
                  const userId = isDeletingUser.id;
                  setIsDeletingUser(null);
                  const loadingToast = toast.loading('Deleting user...', {
                    style: { background: 'var(--bg-panel)', color: 'var(--panel-text)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }
                  });
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/\/$/, '')}/functions/v1/manage-staff`;
                    const response = await fetch(functionUrl, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
                      },
                      body: JSON.stringify({ action: 'delete-user', userId })
                    });
                    
                    if (!response.ok) {
                      const errText = await response.text();
                      let message = 'Failed to delete user';
                      try {
                        const errData = JSON.parse(errText);
                        message = errData.error || errData.message || message;
                      } catch (e) {}
                      
                      // User-friendly mapping for common DB constraint errors
                      if (message.includes('foreign key constraint') || message.includes('Database error')) {
                        message = 'Cannot delete user: Active records (bookings/history) found.';
                      }
                      
                      throw new Error(message);
                    }
                    toast.success('User removed from system', { 
                      id: loadingToast,
                      style: { background: 'var(--bg-panel)', color: 'var(--panel-text)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(12px)' }
                    });
                    fetchUsers();
                  } catch (err) {
                    toast.error(err.message || 'Deletion failed', { 
                      id: loadingToast,
                      style: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }
                    });
                  }
                }}
                className="action-btn"
                style={{ 
                  flex: 1, 
                  padding: '0.875rem', 
                  borderRadius: 'var(--admin-radius)', 
                  background: '#ef4444', 
                  color: '#fff', 
                  border: 'none', 
                  fontWeight: '800', 
                  fontSize: '0.85rem', 
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
                }}
              >
                DELETE USER
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
        .user-card {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .user-card:hover {
          transform: translateY(-4px);
          border-color: var(--admin-brand) !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.1);
        }
        .action-btn {
          transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .action-btn:hover {
          transform: scale(1.02);
        }
      `}</style>
    </div>
  );
};

export default AdminUserManagement;
