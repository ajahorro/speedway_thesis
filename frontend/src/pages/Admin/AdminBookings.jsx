import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Clock, CreditCard, ExternalLink, RotateCw, Filter, Calendar, ArrowRight, User } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { mockBookings } from './AdminMockData';

const AdminBookings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(location.state?.filter || '');

  useEffect(() => {
    if (location.state?.filter) {
      setSearchTerm(location.state.filter);
    }
  }, [location.state]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setTimeout(() => {
        const combinedData = mockBookings.map(b => {
          const payments = b.payments || [];
          const totalPaid = payments.filter(p => p.status === 'PAID').reduce((sum, p) => sum + Number(p.amount), 0);
          const isPendingVerification = payments.some(p => p.status === 'FOR_VERIFICATION');
          
          let calcStatus = 'UNPAID';
          if (totalPaid >= b.total_amount && b.total_amount > 0) {
            calcStatus = 'PAID';
          } else if (isPendingVerification) {
            calcStatus = 'VERIFYING';
          } else if (totalPaid >= (b.total_amount * 0.3) && b.total_amount > 0) {
            calcStatus = 'DOWNPAYMENT_PAID';
          }

          return {
            ...b,
            calculatedPaymentStatus: calcStatus,
            totalPaidAmount: totalPaid
          };
        });
        setBookings(combinedData);
        setLoading(false);
    }, 500);
  };

  const filteredBookings = bookings.filter(b => {
    const status = b.status || 'scheduled';
    const sStatus = b.service_status || 'queued';
    const pStatus = b.payment_status || 'unpaid';
    
    const searchStr = `
      ${b.id} 
      ${b.customer?.full_name || ''} 
      ${b.vehicles?.map(v => v.vehicle_type).join(' ') || ''} 
      ${b.vehicles?.map(v => v.make).join(' ') || ''} 
      ${b.vehicles?.map(v => v.model).join(' ') || ''} 
      ${b.vehicles?.map(v => v.plate_number).join(' ') || ''} 
      ${status}
      ${sStatus}
      ${pStatus}
    `.toLowerCase();
    
    const term = searchTerm.toLowerCase().replace(/_/g, ' ');
    return searchStr.includes(searchTerm.toLowerCase()) || searchStr.includes(term);
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'var(--admin-brand)';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      case 'ongoing': return '#a855f7';
      default: return 'var(--admin-text-secondary)';
    }
  };

  const getPaymentStatus = (booking) => {
    const status = booking.calculatedPaymentStatus || 'UNPAID';
    if (status === 'PAID') return { label: 'FULLY PAID', color: '#10b981' };
    if (status === 'VERIFYING') return { label: 'VERIFYING', color: '#8b5cf6' };
    if (status === 'DOWNPAYMENT_PAID') return { label: 'DOWNPAYMENT', color: '#3b82f6' };
    return { label: 'UNPAID', color: '#ef4444' };
  };

  const containerStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius)', // SHARP
    overflow: 'hidden',
    boxShadow: 'var(--admin-card-shadow)',
    color: 'var(--admin-text-primary)',
    border: '1px solid var(--admin-border)'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      
      <PageHeader 
        badge="RECORDS MANAGEMENT"
        title="BOOKING DIRECTORY"
        subtitle="Manage and monitor all vehicle detailing appointments."
        onRefresh={() => { fetchData(); toast.success('Synchronizing database...'); }}
      />

      {/* Filter & Search Bar */}
      <div style={{ background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', overflow: 'hidden', border: '1px solid var(--admin-border)', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem' }}>
          <div style={{ position: 'relative', background: 'var(--admin-bg)', padding: '0.85rem 1.25rem', borderRadius: 'var(--admin-radius-sm)', flex: 1, border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Search size={18} color="var(--admin-text-secondary)" style={{ flexShrink: 0 }} />
            <input 
              type="text"
              placeholder="Search by customer, vehicle, plate..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ border: 'none', background: 'transparent', color: 'var(--admin-text-primary)', width: '100%', outline: 'none', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase' }} 
            />
          </div>
          <button style={{ padding: '0.85rem 1.5rem', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', fontWeight: '950', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'center', textTransform: 'uppercase', letterSpacing: '1px' }}>
            <Filter size={16} /> FILTERS
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingState message="Retrieving booking records..." />
      ) : filteredBookings.length === 0 ? (
        <div style={{ ...containerStyle, padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase' }}>No matching records found</div>
      ) : isMobile ? (
        /* Mobile Card Layout */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {filteredBookings.map(booking => {
            const pStatus = getPaymentStatus(booking);
            return (
              <div 
                key={booking.id}
                onClick={() => navigate(`/admin/bookings/${booking.id}`)}
                style={{ ...containerStyle, padding: '1.25rem', position: 'relative', cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
                  <div>
                    <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '950', fontSize: '0.65rem', letterSpacing: '0.5px' }}>#{booking.id.substring(0, 8).toUpperCase()}</span>
                    <h3 style={{ margin: '0.25rem 0 0 0', fontSize: '1rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>{booking.customer?.full_name || 'Unknown'}</h3>
                  </div>
                  <div style={{ 
                    background: 'var(--admin-bg)', color: getStatusColor(booking.status), padding: '0.4rem 0.8rem', 
                    borderRadius: 'var(--admin-radius-sm)', fontSize: '0.65rem', fontWeight: '950',
                    border: '1px solid currentColor', textTransform: 'uppercase',
                    display: 'flex', alignItems: 'center', gap: '0.4rem'
                  }}>
                    {booking.status?.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', padding: '1rem 0', borderTop: '1px solid var(--admin-border)', borderBottom: '1px solid var(--admin-border)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle</p>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', fontWeight: '800', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>
                      {booking.vehicles?.length > 1 ? `FLEET (${booking.vehicles.length})` : (booking.vehicles?.[0]?.vehicle_type || 'N/A')}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Date</p>
                    <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.8rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>{new Date(booking.start_datetime).toLocaleDateString()}</p>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                   <div style={{ color: pStatus.color, fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', background: 'rgba(255,255,255,0.02)', padding: '0.4rem 0.75rem', borderRadius: 'var(--admin-radius-sm)', border: `1px solid ${pStatus.color}40` }}>
                     ₱{(booking.total_amount || 0).toLocaleString()} • {pStatus.label}
                   </div>
                   <ArrowRight size={16} style={{ color: 'var(--admin-text-secondary)', opacity: 0.3 }} />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Table Layout */
        <div className="table-responsive-container" style={containerStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-sidebar)' }}>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Record</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Customer</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Vehicle</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Schedule</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Status Lifecycle</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Total Amount</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(booking => {
                const pStatus = getPaymentStatus(booking);
                return (
                  <tr key={booking.id} style={{ borderBottom: '1px solid var(--admin-border)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.01)'} onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '950', fontSize: '0.7rem', letterSpacing: '0.5px' }}>
                        #{booking.id.substring(0, 6).toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{ fontWeight: '950', color: 'var(--admin-text-primary)', fontSize: '0.85rem', textTransform: 'uppercase' }}>{booking.customer?.full_name || 'Unknown'}</span>
                    </td>
                     <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: '800', color: 'var(--admin-text-primary)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
                        {booking.vehicles?.length > 1 ? `FLEET (${booking.vehicles.length} UNITS)` : (booking.vehicles?.[0]?.vehicle_type || 'N/A')}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        {booking.vehicles?.[0]?.plate_number || 'N/A'}
                      </div>
                    </td>
                     <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: '800', color: 'var(--admin-text-primary)', fontSize: '0.8rem' }}>{new Date(booking.start_datetime).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>{new Date(booking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                     <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                        <span style={{ 
                          fontSize: '0.55rem', fontWeight: '950', padding: '0.25rem 0.6rem', borderRadius: 'var(--admin-radius-sm)', 
                          background: 'rgba(255,255,255,0.03)',
                          color: getStatusColor(booking.status),
                          textTransform: 'uppercase', border: '1px solid currentColor'
                        }}>
                          {booking.status}
                        </span>
                        <span style={{ 
                          fontSize: '0.55rem', fontWeight: '950', padding: '0.25rem 0.6rem', borderRadius: 'var(--admin-radius-sm)', 
                          background: 'rgba(255,255,255,0.03)',
                          color: booking.service_status === 'completed' ? '#10b981' : '#a855f7',
                          textTransform: 'uppercase', border: '1px solid currentColor'
                        }}>
                          {booking.service_status?.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: '950', color: 'var(--admin-brand)', fontSize: '1rem', fontFamily: 'monospace' }}>
                        ₱{(booking.total_amount || 0).toLocaleString()}
                      </div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <button 
                        onClick={() => navigate(`/admin/bookings/${booking.id}`)}
                        style={{ 
                          background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', 
                          color: 'var(--admin-text-primary)', padding: '0.6rem 1rem', borderRadius: 'var(--admin-radius-sm)', 
                          fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', transition: 'all 0.2s', textTransform: 'uppercase', letterSpacing: '1px'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--admin-brand)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--admin-border)'}
                      >
                        VIEW RECORD
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
};

export default AdminBookings;
