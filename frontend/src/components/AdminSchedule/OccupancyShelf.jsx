import React from 'react';
import { Zap } from 'lucide-react';
import { segregateBookings } from '../../utils/schedulingUtils';

const OccupancyShelf = ({ bookings, onBookingClick }) => {
  const { fullDay } = segregateBookings(bookings);

  if (fullDay.length === 0) return null;

  return (
    <div style={{ marginBottom: '2rem', background: 'rgba(var(--admin-brand-rgb), 0.03)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '1.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
        <Zap size={16} color="var(--admin-brand)" />
        <h3 style={{ margin: 0, fontSize: '0.8rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-primary)' }}>Full-Day Sessions & Long-Term Restorations</h3>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
        {fullDay.map(booking => (
          <div 
            key={booking.id} 
            onClick={() => onBookingClick(booking.id)}
            style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderLeft: '4px solid var(--admin-brand)', borderRadius: '4px', padding: '1rem', cursor: 'pointer', minWidth: '280px', flex: '1' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase' }}>PERSISTENT BLOCK</span>
              <span style={{ fontSize: '0.6rem', fontWeight: '900', color: 'var(--admin-text-secondary)' }}>
                {Math.ceil((new Date(booking.end_datetime) - new Date(booking.start_datetime)) / (1000 * 60 * 60))}H DURATION
              </span>
            </div>
            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: 'white' }}>{booking.customer?.full_name}</h4>
            <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>
              {new Date(booking.start_datetime).toLocaleDateString()} - {new Date(booking.end_datetime).toLocaleDateString()}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OccupancyShelf;
