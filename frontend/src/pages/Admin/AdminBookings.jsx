import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Search, Clock, CreditCard, ExternalLink, RotateCw, Filter, Calendar, ArrowRight, User } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

const AdminBookings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 1024px)');

  // BATCHED STATE: One source of truth for the page
  const [state, setState] = useState({
    bookings: [],
    loading: true,
    searchTerm: location.state?.filter || '',
    filterStatus: 'all'
  });

  // MEMOIZED FETCH: Prevents unnecessary function recreation
  const fetchBookings = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    try {
      logger.admin('Syncing Live Booking Directory...');
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name, email),
          vehicles:booking_vehicles(*),
          payments:payments(*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // DEDUPLICATION ENGINE: Resolve Cartesian Product from nested joins
      const uniqueMap = new Map();
      (data || []).forEach(b => {
        if (!uniqueMap.has(b.id)) {
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

          uniqueMap.set(b.id, {
            ...b,
            calculatedPaymentStatus: calcStatus,
            totalPaidAmount: totalPaid
          });
        }
      });

      setState(prev => ({ ...prev, bookings: Array.from(uniqueMap.values()), loading: false }));
      logger.admin('Booking Directory synchronized.');
    } catch (err) {
      logger.error('Booking Fetch Error', err);
      toast.error('Failed to sync booking records.');
      setState(prev => ({ ...prev, loading: false }));
    }
  }, []);

  useEffect(() => {
    fetchBookings();
    
    // Live synchronization channel
    const channel = supabase.channel('admin-bookings-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchBookings())
      .subscribe();
      
    return () => { supabase.removeChannel(channel); };
  }, [fetchBookings]);

  // MEMOIZED FILTERING: Only re-calculates when data or search changes
  const filteredBookings = useMemo(() => {
    return state.bookings.filter(b => {
      const matchesSearch = `
        ${b.id} 
        ${b.customer?.full_name || ''} 
        ${b.vehicles?.map(v => v.vehicle_type).join(' ') || ''} 
        ${b.vehicles?.map(v => v.plate_number).join(' ') || ''} 
      `.toLowerCase().includes(state.searchTerm.toLowerCase());
      
      const matchesStatus = state.filterStatus === 'all' || b.status === state.filterStatus;
      
      return matchesSearch && matchesStatus;
    });
  }, [state.bookings, state.searchTerm, state.filterStatus]);

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
    borderRadius: 'var(--admin-radius)',
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
        onRefresh={fetchBookings}
      />

      <div style={{ background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', overflow: 'hidden', border: '1px solid var(--admin-border)', padding: '1rem' }}>
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '0.75rem' }}>
          <div style={{ position: 'relative', background: 'var(--admin-bg)', padding: '0.85rem 1.25rem', borderRadius: 'var(--admin-radius-sm)', flex: 1, border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Search size={18} color="var(--admin-text-secondary)" style={{ flexShrink: 0 }} />
            <input 
              type="text"
              placeholder="Search by customer, vehicle, plate..." 
              value={state.searchTerm}
              onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
              style={{ border: 'none', background: 'transparent', color: 'var(--admin-text-primary)', width: '100%', outline: 'none', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase' }} 
            />
          </div>
        </div>
      </div>

      {state.loading ? (
        <LoadingState message="Retrieving booking records..." />
      ) : filteredBookings.length === 0 ? (
        <div style={{ ...containerStyle, padding: '4rem', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '0.8rem', fontWeight: '900', textTransform: 'uppercase' }}>No matching records found</div>
      ) : isMobile ? (
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
                    border: '1px solid currentColor', textTransform: 'uppercase'
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
        <div className="table-responsive-container" style={containerStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-sidebar)' }}>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Record</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Customer</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Vehicle</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Schedule</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}>Total Amount</th>
                <th style={{ padding: '1.25rem 1.5rem', color: 'var(--admin-text-secondary)', fontSize: '0.65rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1.5px' }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredBookings.map(booking => {
                const pStatus = getPaymentStatus(booking);
                return (
                  <tr key={booking.id} style={{ borderBottom: '1px solid var(--admin-border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '950', fontSize: '0.7rem' }}>
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
                    </td>
                     <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: '800', color: 'var(--admin-text-primary)', fontSize: '0.8rem' }}>{new Date(booking.start_datetime).toLocaleDateString()}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>{new Date(booking.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem' }}>
                      <div style={{ fontWeight: '950', color: 'var(--admin-brand)', fontSize: '1rem', fontFamily: 'monospace' }}>
                        ₱{(booking.total_amount || 0).toLocaleString()}
                      </div>
                      <div style={{ fontSize: '0.55rem', fontWeight: '950', color: pStatus.color }}>{pStatus.label}</div>
                    </td>
                    <td style={{ padding: '1.25rem 1.5rem', textAlign: 'right' }}>
                      <button 
                        onClick={() => navigate(`/admin/bookings/${booking.id}`)}
                        style={{ 
                          background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', 
                          color: 'var(--admin-text-primary)', padding: '0.6rem 1rem', borderRadius: 'var(--admin-radius-sm)', 
                          fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase'
                        }}
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
    </div>
  );
};

export default AdminBookings;
