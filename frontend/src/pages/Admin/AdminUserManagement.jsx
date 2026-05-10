import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import { 
  Users, Search, Mail, Phone, User, ChevronRight, 
  History, ExternalLink, X, Calendar, Clock, CheckCircle2, 
  AlertCircle, Trash2, RefreshCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logger } from '../../utils/logger';

const AdminUserManagement = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 768px)');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [view, setView] = useState('list');
  const [selectedUser, setSelectedUser] = useState(null);
  const [userBookings, setUserBookings] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      logger.admin('Fetching customer directory...');
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'CUSTOMER')
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
      logger.admin('Customer directory synchronized.');
    } catch (err) {
      logger.error('User Fetch Error', err);
      toast.error('Failed to load user directory.');
    } finally {
      setLoading(false);
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

  const handleBackToList = () => {
    setView('list');
    setSelectedUser(null);
    setUserBookings([]);
  };

  const filteredUsers = users.filter(u => 
    u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.phone_number?.includes(searchQuery)
  );

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' };
      case 'cancelled': return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' };
      case 'scheduled': return { bg: 'rgba(59, 130, 246, 0.1)', text: '#3b82f6' };
      case 'ongoing': return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' };
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
                    gap: '1.25rem'
                  }}
                >
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: 'var(--admin-radius-sm)', 
                      background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', 
                      justifyContent: 'center', color: 'var(--admin-brand)', 
                      fontSize: '1.25rem', fontWeight: '800', border: '1px solid var(--admin-border)'
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

                  <button 
                    onClick={() => handleSeeHistory(user)}
                    style={{ 
                      width: '100%', padding: '0.75rem', borderRadius: 'var(--admin-radius-sm)', 
                      background: 'var(--admin-bg)', color: 'var(--admin-brand)', 
                      fontSize: '0.8rem', fontWeight: '800', border: '1px solid var(--admin-border)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', 
                      justifyContent: 'center', gap: '0.5rem'
                    }}
                  >
                    <History size={16} /> SERVICE HISTORY
                  </button>
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
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'transparent', border: 'none', color: 'var(--admin-brand)', fontWeight: '800', cursor: 'pointer', fontSize: '0.85rem' }}
            >
              <ChevronRight size={18} style={{ transform: 'rotate(180deg)' }} /> BACK TO DIRECTORY
            </button>

            <div style={{ 
              background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', 
              padding: '2rem', border: '1px solid var(--admin-border)',
              display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center',
              boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                width: '80px', height: '80px', borderRadius: 'var(--admin-radius)', 
                background: 'var(--admin-bg)', display: 'flex', alignItems: 'center', 
                justifyContent: 'center', color: 'var(--admin-brand)', fontSize: '2rem',
                fontWeight: '800', border: '1px solid var(--admin-border)'
              }}>
                {selectedUser?.full_name?.charAt(0)}
              </div>
              
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--admin-text-primary)', margin: '0' }}>{selectedUser?.full_name}</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '700' }}>
                    <Mail size={16} /> {selectedUser?.email}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '700' }}>
                    <CheckCircle2 size={16} /> {userBookings.length} Records
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
                        background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)',
                        padding: '1.5rem', border: '1px solid var(--admin-border)',
                        display: 'flex', flexWrap: 'wrap', gap: '2rem', alignItems: 'center'
                      }}
                    >
                      <div style={{ 
                        minWidth: '140px', padding: '1rem', background: 'var(--admin-bg)', 
                        borderRadius: 'var(--admin-radius)', textAlign: 'center', border: '1px solid var(--admin-border)'
                      }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>
                          {new Date(booking.start_datetime).getDate()}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--admin-text-secondary)' }}>
                          {new Date(booking.start_datetime).toLocaleDateString('en-US', { month: 'long', weekday: 'long' })}
                        </div>
                      </div>

                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                          <span style={{ 
                            padding: '0.35rem 0.75rem', borderRadius: 'var(--admin-radius)', 
                            background: statusInfo.bg, color: statusInfo.text, fontSize: '0.7rem', 
                            fontWeight: '800', textTransform: 'uppercase', border: `1px solid ${statusInfo.text}22`
                          }}>
                            {booking.status.replace('_', ' ')}
                          </span>
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {booking.services.map((s, idx) => (
                            <span key={idx} style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--admin-text-primary)', background: 'var(--admin-bg)', padding: '0.4rem 0.8rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
                              {s.service_name}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div style={{ textAlign: 'right', minWidth: '120px' }}>
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
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminUserManagement;
