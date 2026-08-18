import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import { 
  Users, Search, Mail, Phone, User, ChevronRight, 
  History, ExternalLink, X, Calendar, Clock, CheckCircle2, 
  AlertCircle, Trash2, RefreshCcw, ShieldCheck, UserCog,
  ShieldAlert, MoreVertical, Shield
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logger } from '../../utils/logger';
import { BACKEND_URL } from '../../config/api';

const AdminUserManagement = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  
  const [view, setView] = useState('list');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      logger.admin('Fetching system directory...');
      const response = await fetch(`${BACKEND_URL}/api/admin/profiles`);
      const result = await response.json();
      if (!result.success) throw new Error(result.error);
      setUsers(result.data || []);
      logger.admin('System directory synchronized.');
    } catch (err) {
      logger.error('User Fetch Error', err);
      toast.error('Failed to load user directory.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    const toastId = toast.loading(`Updating role to ${newRole}...`);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      
      toast.success(`Role updated to ${newRole}`, { id: toastId });
      setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u));
    } catch (err) {
      toast.error('Failed to update role', { id: toastId });
    }
  };

  const handleSeeHistory = async (user) => {
    setSelectedUser(user);
    setView('history');
    setLoadingHistory(true);
    try {
      logger.admin(`Fetching history for user: ${user.id}`);
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          vehicles:booking_vehicles(*, services:booking_vehicle_services(*))
        `)
        .eq('customer_id', user.id)
        .order('start_datetime', { ascending: false });

      if (error) throw error;
      
      const processed = (data || []).map(b => ({
        ...b,
        services: b.vehicles?.flatMap(v => v.services || []) || []
      }));

      setUserBookings(processed);
      logger.admin('User history synchronized.');
    } catch (err) {
      logger.error('History Fetch Error', err);
      toast.error('Failed to load user history.');
    } finally {
      setLoadingHistory(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone_number?.includes(searchQuery);
    
    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (role) => {
    switch (role) {
      case 'ADMIN': return { color: '#ef4444', label: 'ADMINISTRATOR', icon: <Shield size={10} /> };
      case 'STAFF': return { color: '#3b82f6', label: 'STAFF', icon: <UserCog size={10} /> };
      default: return { color: 'var(--admin-text-secondary)', label: 'CUSTOMER', icon: <User size={10} /> };
    }
  };

  const getStatusColor = (status) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'COMPLETED': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' };
      case 'CANCELLED': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' };
      case 'PAID': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' };
      default: return { bg: 'var(--admin-bg)', text: 'var(--admin-text-secondary)' };
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', animation: 'fadeIn 0.5s ease' }}>
      <PageHeader 
        badge="ACCESS CONTROL"
        title={view === 'list' ? "User Directory" : "Customer History"}
        subtitle={view === 'list' ? "Manage authority levels and monitor system activity" : `Service timeline for ${selectedUser?.full_name}`}
        onRefresh={view === 'list' ? fetchUsers : () => handleSeeHistory(selectedUser)}
      />

      {view === 'list' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
          {/* Controls Bar */}
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '300px' }}>
              <Search size={18} style={{ position: 'absolute', left: '1.25rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
              <input 
                type="text" 
                placeholder="Search by name, email, or phone..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ 
                  width: '100%', padding: '0.85rem 1.25rem 0.85rem 3.5rem', 
                  background: 'var(--admin-card)', border: '1px solid var(--admin-border)', 
                  borderRadius: '4px', color: 'white', fontWeight: '700', outline: 'none'
                }}
              />
            </div>
            
            <div style={{ display: 'flex', background: 'var(--admin-card)', padding: '0.25rem', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
              {['ALL', 'CUSTOMER', 'STAFF', 'ADMIN'].map((role) => (
                <button
                  key={role}
                  onClick={() => setRoleFilter(role)}
                  style={{
                    padding: '0.6rem 1rem', border: 'none', borderRadius: '4px',
                    background: roleFilter === role ? 'var(--admin-brand)' : 'transparent',
                    color: roleFilter === role ? 'white' : 'var(--admin-text-secondary)',
                    fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer',
                    transition: '0.2s', textTransform: 'uppercase'
                  }}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>

          {/* User Grid - RE-DESIGNED TO SQUARES */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(260px, 1fr))', gap: '1.25rem' }}>
            {loading ? (
              [1,2,3,4,5,6,7,8].map(i => (
                <div key={i} style={{ height: '240px', background: 'var(--admin-card)', borderRadius: '4px', border: '1px solid var(--admin-border)' }} className="animate-pulse"></div>
              ))
            ) : filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const roleBadge = getRoleBadge(user.role);
                return (
                  <div 
                    key={user.id}
                    className="user-card"
                    style={{ 
                      background: 'var(--admin-card)', border: '1px solid var(--admin-border)', 
                      borderRadius: '4px', padding: '1.5rem', display: 'flex', flexDirection: 'column', 
                      alignItems: 'center', textAlign: 'center', position: 'relative', gap: '1rem'
                    }}
                  >
                    {/* Compact History Action */}
                    <button 
                      onClick={() => handleSeeHistory(user)}
                      title="View Booking History"
                      style={{ 
                        position: 'absolute', top: '1rem', right: '1rem',
                        padding: '0.4rem', borderRadius: '4px', background: 'var(--admin-bg)', 
                        color: 'var(--admin-text-secondary)', border: '1px solid var(--admin-border)', cursor: 'pointer',
                        transition: '0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.color = 'var(--admin-brand)'}
                      onMouseLeave={(e) => e.currentTarget.style.color = 'var(--admin-text-secondary)'}
                    >
                      <History size={14} />
                    </button>

                    <div style={{ 
                      width: '64px', height: '64px', borderRadius: '4px', 
                      background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', 
                      justifyContent: 'center', color: roleBadge.color, 
                      fontSize: '1.75rem', fontWeight: '950', border: `1px solid ${roleBadge.color}44`,
                      marginBottom: '0.5rem'
                    }}>
                      {user.full_name?.charAt(0).toUpperCase() || <User size={28} />}
                    </div>

                    <div style={{ width: '100%' }}>
                      <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '950', color: 'white', textTransform: 'uppercase' }}>{user.full_name}</h3>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.55rem', fontWeight: '950', color: roleBadge.color, background: `${roleBadge.color}11`, padding: '0.15rem 0.5rem', borderRadius: '2px', border: `1px solid ${roleBadge.color}33`, textTransform: 'uppercase' }}>
                        {roleBadge.icon} {roleBadge.label}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', width: '100%', borderTop: '1px solid var(--admin-border)', paddingTop: '1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '700' }}>
                        <Mail size={10} /> {user.email}
                      </div>
                      {user.phone_number && (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.7rem', fontWeight: '700' }}>
                          <Phone size={10} /> {user.phone_number}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '5rem', background: 'var(--admin-card)', borderRadius: '4px', border: '1px dashed var(--admin-border)' }}>
                <Users size={64} style={{ color: 'var(--admin-text-secondary)', marginBottom: '1.5rem', opacity: 0.1 }} />
                <h3 style={{ fontSize: '1.25rem', fontWeight: '950', color: 'white', textTransform: 'uppercase' }}>No matching profiles found</h3>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ width: '100%' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <button 
              onClick={() => setView('list')}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--admin-brand)', fontWeight: '950', cursor: 'pointer', fontSize: '0.8rem', textTransform: 'uppercase' }}
            >
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> BACK TO DIRECTORY
            </button>

            <div style={{ 
              background: 'var(--admin-card)', borderRadius: '4px', 
              padding: '2rem', border: '1px solid var(--admin-border)',
              display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center'
            }}>
              <div style={{ 
                width: '80px', height: '80px', borderRadius: '4px', 
                background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', color: 'var(--admin-brand)', fontSize: '2.5rem',
                fontWeight: '950', border: '1px solid var(--admin-border)'
              }}>
                {selectedUser?.full_name?.charAt(0)}
              </div>
              
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '2rem', fontWeight: '950', color: 'white', margin: '0', textTransform: 'uppercase' }}>{selectedUser?.full_name}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '800' }}>
                    <Mail size={16} color="var(--admin-brand)" /> {selectedUser?.email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '800' }}>
                    <CheckCircle2 size={16} color="var(--admin-brand)" /> {userBookings.length} SYSTEM RECORDS
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {loadingHistory ? (
                [1,2,3].map(i => (
                  <div key={i} style={{ height: '110px', background: 'var(--admin-card)', borderRadius: '4px', border: '1px solid var(--admin-border)' }} className="animate-pulse"></div>
                ))
              ) : userBookings.length > 0 ? (
                userBookings.map((booking) => {
                  const statusInfo = getStatusColor(booking.status);
                  return (
                    <div 
                      key={booking.id}
                      style={{
                        background: 'var(--admin-card)', borderRadius: '4px',
                        padding: '1.5rem', border: '1px solid var(--admin-border)',
                        display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center'
                      }}
                    >
                      <div style={{ 
                        minWidth: '140px', padding: '1rem', background: 'var(--admin-bg)', 
                        borderRadius: '4px', textAlign: 'center', border: '1px solid var(--admin-border)'
                      }}>
                        <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white' }}>
                          {new Date(booking.start_datetime).getDate()}
                        </div>
                        <div style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                          {new Date(booking.start_datetime).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                          <span style={{ 
                            padding: '0.2rem 0.6rem', borderRadius: '2px', 
                            background: statusInfo.bg, color: statusInfo.text, fontSize: '0.65rem', 
                            fontWeight: '950', textTransform: 'uppercase', border: `1px solid ${statusInfo.text}44`
                          }}>
                            {booking.status.replace('_', ' ')}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>#{booking.id.slice(0, 8).toUpperCase()}</span>
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {booking.services.map((s, idx) => (
                            <span key={idx} style={{ fontSize: '0.8rem', fontWeight: '900', color: 'white', background: 'var(--admin-bg)', padding: '0.35rem 0.75rem', borderRadius: '4px', border: '1px solid var(--admin-border)', textTransform: 'uppercase' }}>
                              {s.service_name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-brand)' }}>
                          ₱{booking.total_amount?.toLocaleString()}
                        </div>
                        <div style={{ fontSize: '0.65rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>TOTAL REVENUE</div>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '4rem', background: 'var(--admin-card)', borderRadius: '4px', border: '1px dashed var(--admin-border)' }}>
                  <Calendar size={48} style={{ color: 'var(--admin-text-secondary)', marginBottom: '1.25rem', opacity: 0.1 }} />
                  <h3 style={{ fontSize: '1.15rem', fontWeight: '950', color: 'white', textTransform: 'uppercase' }}>No system records found</h3>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        .user-card { transition: all 0.3s ease; }
        .user-card:hover { transform: translateY(-4px); border-color: var(--admin-brand); box-shadow: 0 10px 30px rgba(230, 30, 42, 0.05); }
      `}</style>
    </div>
  );
};

export default AdminUserManagement;
