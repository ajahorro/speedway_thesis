import React from 'react';
import { Calendar, Car, ChevronRight, CalendarOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const UpcomingAppointments = ({ bookings = [], loading }) => {
  const navigate = useNavigate();

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'var(--admin-brand)';
      case 'confirmed': return 'var(--admin-info)';
      default: return 'var(--admin-text-secondary)';
    }
  };

  return (
    <div style={{
      background: 'var(--admin-card)',
      borderRadius: 'var(--admin-radius-lg)',
      border: '1px solid var(--admin-border)',
      boxShadow: 'var(--admin-card-shadow)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        padding: '1.25rem 1.5rem',
        borderBottom: '1px solid var(--admin-border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>Upcoming</h3>
        <button
          onClick={() => navigate('/customer/bookings')}
          style={{ background: 'none', border: 'none', color: 'var(--admin-brand)', fontSize: '0.75rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px' }}
        >
          View All
        </button>
      </div>

      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--admin-brand)', fontWeight: '900', fontSize: '0.85rem' }}>Loading...</div>
        ) : bookings.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
            <CalendarOff size={32} color="var(--admin-text-secondary)" style={{ opacity: 0.3 }} />
            <div style={{ color: 'var(--admin-text-secondary)', fontSize: '0.85rem', fontWeight: '600' }}>No upcoming appointments</div>
          </div>
        ) : (
          bookings.slice(0, 3).map((b) => {
            const dt = b.start_datetime ? new Date(b.start_datetime) : null;
            const dateStr = dt ? dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD';
            const timeStr = dt ? dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '';
            const vehicleCount = b.vehicles?.length || 0;

            return (
              <div
                key={b.id}
                onClick={() => navigate(`/customer/bookings/${b.id}`)}
                className="admin-card-hover"
                style={{
                  padding: '1rem',
                  background: 'var(--admin-bg)',
                  borderRadius: 'var(--admin-radius-md)',
                  border: '1px solid var(--admin-border)',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--admin-text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Calendar size={14} color="var(--admin-brand)" /> {dateStr}
                  </div>
                  <div style={{ fontSize: '0.7rem', fontWeight: '950', color: getStatusColor(b.status), background: `rgba(var(--admin-brand-rgb), 0.05)`, padding: '0.2rem 0.5rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                    {b.status}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Car size={14} /> {vehicleCount} Vehicle{vehicleCount > 1 ? 's' : ''} • {timeStr}
                  </div>
                  <ChevronRight size={16} color="var(--admin-text-secondary)" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default UpcomingAppointments;
