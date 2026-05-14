import React from 'react';
import { Clock, ShieldCheck, User, FileText, ChevronRight, CheckCircle, Car, CalendarOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ActiveBookingContainer = ({ booking, loading }) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'var(--admin-brand)';
      case 'confirmed': return 'var(--admin-info)';
      case 'ongoing': return '#a855f7';
      case 'completed': return 'var(--admin-success)';
      default: return 'var(--admin-text-secondary)';
    }
  };

  const cardStyle = {
    background: 'var(--admin-card)',
    borderRadius: 'var(--admin-radius-lg)',
    border: '1px solid var(--admin-border)',
    overflow: 'hidden',
    boxShadow: 'var(--admin-card-shadow)',
    position: 'relative'
  };

  const sectionHeaderStyle = {
    fontSize: '0.7rem',
    fontWeight: '950',
    color: 'var(--admin-text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: '0.75rem'
  };

  if (loading) {
    return (
      <div style={{ ...cardStyle, padding: '3rem', textAlign: 'center' }}>
        <div style={{ color: 'var(--admin-brand)', fontWeight: '900', fontSize: '0.9rem' }}>Loading active booking...</div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div style={{ ...cardStyle, padding: '3rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
        <CalendarOff size={48} color="var(--admin-text-secondary)" style={{ opacity: 0.3 }} />
        <div style={{ color: 'var(--admin-text-primary)', fontWeight: '900', fontSize: '1.1rem' }}>No Active Booking</div>
        <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>You don't have any ongoing or scheduled appointments right now.</div>
        <button
          onClick={() => navigate('/customer/book')}
          className="admin-card-hover"
          style={{ marginTop: '0.5rem', padding: '0.85rem 1.5rem', background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          + Book Appointment
        </button>
      </div>
    );
  }

  const vehicles = booking.vehicles || [];
  
  // 🚀 DERIVED STATUS LOGIC
  const vehicleStatuses = vehicles.map(v => v.status?.toUpperCase());
  const anyUnitStarted = vehicleStatuses.includes('IN_PROGRESS');
  const allUnitsFinished = vehicleStatuses.length > 0 && vehicleStatuses.every(s => s === 'COMPLETED' || s === 'CANCELLED');
  
  let derivedStatus = (booking.status || 'scheduled').toLowerCase();
  if (anyUnitStarted && derivedStatus === 'scheduled') derivedStatus = 'in_progress';
  if (allUnitsFinished && derivedStatus !== 'cancelled') derivedStatus = 'completed';

  const vehicleCount = vehicles.length;
  const serviceCount = vehicles.reduce((sum, v) => sum + (v.services?.length || 0), 0);
  const scheduleDate = booking.start_datetime ? new Date(booking.start_datetime) : null;
  const formattedDate = scheduleDate ? scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
  const formattedTime = scheduleDate ? scheduleDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
  const staffName = booking.assigned_staff ? `${booking.assigned_staff.first_name} ${booking.assigned_staff.last_name}` : 'Unassigned';

  return (
    <div style={cardStyle}>
      {/* Top Banner */}
      <div style={{
        background: `linear-gradient(90deg, rgba(var(--admin-brand-rgb), 0.15), transparent)`,
        padding: '1.5rem',
        borderBottom: '1px solid var(--admin-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div style={sectionHeaderStyle}>Active Operation Tracker</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <div style={{
              width: '12px', height: '12px', borderRadius: '50%',
              background: getStatusColor(derivedStatus),
              boxShadow: `0 0 10px ${getStatusColor(derivedStatus)}`
            }} />
            <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '950', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>
              {derivedStatus?.replace('_', ' ')}
            </h2>
          </div>
          <div style={{ fontSize: '0.85rem', color: 'var(--admin-text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Clock size={14} /> Last updated: Just now
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Ref No.</div>
          <div style={{ fontSize: '1.1rem', fontWeight: '900', color: 'var(--admin-text-primary)', fontFamily: 'monospace' }}>#{booking.id?.substring(0, 8).toUpperCase()}</div>
        </div>
      </div>

      <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Middle Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          {/* Payment */}
          <div style={{ padding: '1rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)' }}>
            <div style={sectionHeaderStyle}>Billing Snapshot</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <ShieldCheck size={16} color="var(--admin-success)" />
              <span style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}>{booking.paymentStatus?.replace('_', ' ') || 'UNPAID'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.25rem' }}>
              <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Amount Paid:</span>
              <span style={{ color: 'var(--admin-success)', fontWeight: '800' }}>₱{(booking.totalPaid || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--admin-text-secondary)', fontWeight: '600' }}>Balance:</span>
              <span style={{ color: 'var(--admin-warning)', fontWeight: '800' }}>₱{((booking.total_amount || 0) - (booking.totalPaid || 0)).toLocaleString()}</span>
            </div>
          </div>

          {/* Technician */}
          <div style={{ padding: '1rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-md)', border: '1px solid var(--admin-border)' }}>
            <div style={sectionHeaderStyle}>Assigned Technician</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(var(--admin-brand-rgb), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(var(--admin-brand-rgb), 0.3)' }}>
                <User size={20} color="var(--admin-brand)" />
              </div>
              <div>
                <div style={{ fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{staffName}</div>
                <div style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--admin-brand)' }}>{booking.staff_id ? 'Assigned' : 'Pending Assignment'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Appointment Details */}
        <div>
          <div style={sectionHeaderStyle}>Appointment Details</div>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-primary)', background: 'var(--admin-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
              <Clock size={14} color="var(--admin-text-secondary)" /> {formattedDate} • {formattedTime}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-primary)', background: 'var(--admin-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
              <Car size={14} color="var(--admin-text-secondary)" /> {vehicleCount} Vehicle{vehicleCount !== 1 ? 's' : ''}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: '600', color: 'var(--admin-text-primary)', background: 'var(--admin-bg)', padding: '0.5rem 0.75rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
              <CheckCircle size={14} color="var(--admin-text-secondary)" /> {serviceCount} Service{serviceCount !== 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate(`/customer/bookings/${booking.id}`)}
            className="admin-card-hover"
            style={{ flex: 1, padding: '0.85rem 1rem', background: 'var(--admin-brand)', color: '#fff', border: 'none', borderRadius: 'var(--admin-radius-sm)', fontWeight: '900', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}
          >
            <FileText size={16} /> View Full Booking <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActiveBookingContainer;
