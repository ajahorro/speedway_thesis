import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Clock, User, ChevronLeft, ChevronRight, 
  AlertCircle, LayoutGrid, Calendar, Users,
  Maximize2, ExternalLink, RefreshCcw, Search, CreditCard, RotateCw, Filter, ArrowRight
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { getPaymentStatusUI } from '../../utils/paymentUtils';
import { getStatusColor } from '../../utils/bookingHelpers';
import { useAdminBookings } from '../../hooks/useAdminBookings';

import AdminSchedulingGrid from './AdminSchedulingGrid';

const AdminBookings = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 1024px)');

  // REQ-NFR-05: Decoupled data layer via custom hook (realtime multi-table sync)
  const { bookings, loading, refresh } = useAdminBookings();

  // UI-only state (search, filter, view mode)
  const [state, setState] = useState({
    searchTerm: location.state?.filter || '',
    filterStatus: 'all',
    view: 'list'
  });

  useEffect(() => {
    // Check for URL filters
    const params = new URLSearchParams(location.search);
    const filter = params.get('filter');
    if (filter === 'unassigned') {
      setState(prev => ({ ...prev, filterStatus: 'unassigned' }));
    } else if (filter === 'overdue' || filter === 'FLAGGED_NOSHOW') {
      setState(prev => ({ ...prev, filterStatus: 'FLAGGED_NOSHOW' }));
    }
  }, [location.search]);

  // MEMOIZED FILTERING: Only re-calculates when data or search changes
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesSearch = `
        ${b.id} 
        ${b.customer?.full_name || ''} 
        ${b.vehicles?.map(v => v.vehicle_type).join(' ') || ''} 
        ${b.vehicles?.map(v => v.plate_number).join(' ') || ''} 
      `.toLowerCase().includes(state.searchTerm.toLowerCase());
      
      let matchesStatus = state.filterStatus === 'all' || b.status?.toLowerCase() === state.filterStatus.toLowerCase();
      
      // SPECIAL FILTERS
      if (state.filterStatus === 'unassigned') {
        matchesStatus = !b.staff_id && b.status?.toLowerCase() !== 'cancelled';
      } else if (state.filterStatus === 'FLAGGED_NOSHOW') {
        matchesStatus = b.status?.toUpperCase() === 'FLAGGED_NOSHOW';
      }
      
      return matchesSearch && matchesStatus;
    });
  }, [bookings, state.searchTerm, state.filterStatus]);

  const getPaymentStatus = (booking) => {
    return getPaymentStatusUI(booking.calculatedPaymentStatus);
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
        onRefresh={refresh}
        actionLabel={state.view === 'list' ? "SWITCH TO GRID VIEW" : "SWITCH TO LIST VIEW"}
        onAction={() => setState(prev => ({ ...prev, view: prev.view === 'list' ? 'grid' : 'list' }))}
        actionIcon={state.view === 'list' ? <LayoutGrid size={18} /> : <RotateCw size={18} />}
      />

      {state.view === 'grid' ? (
        <AdminSchedulingGrid onBack={() => setState(prev => ({ ...prev, view: 'list' }))} />
      ) : (
        <>

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

          <div style={{ display: 'flex', gap: '0.5rem', background: 'var(--admin-bg)', padding: '0.4rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)', overflowX: 'auto' }}>
            {['all', 'unassigned', 'FLAGGED_NOSHOW', 'scheduled', 'ongoing', 'completed', 'cancelled'].map(f => (
              <button 
                key={f}
                onClick={() => setState(prev => ({ ...prev, filterStatus: f }))}
                style={{ 
                  padding: '0.5rem 0.85rem', borderRadius: '6px', border: 'none',
                  background: state.filterStatus === f ? 'var(--admin-brand)' : 'transparent',
                  color: state.filterStatus === f ? 'white' : 'var(--admin-text-secondary)',
                  fontSize: '0.65rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase',
                  whiteSpace: 'nowrap'
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
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
        </>
      )}
    </div>
  );
};

export default AdminBookings;
