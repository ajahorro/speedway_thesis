import React from 'react';
import { Lock, Tag, ShieldAlert } from 'lucide-react';
import { formatDisplayHour, getOccupancyColor } from '../../utils/schedulingUtils';
import { COLORS, SHOP_CONFIG as CONFIG } from '../../config/constants';

const DetailTimeline = ({ 
  hours, 
  getBookingsForHour, 
  getBlockForHour, 
  onBookingClick, 
  onDeleteBlock 
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {hours.map((hour) => {
        const allHourBookings = getBookingsForHour(hour);
        const transientBookings = allHourBookings.filter(b => {
          const duration = (new Date(b.end_datetime) - new Date(b.start_datetime)) / (1000 * 60);
          return duration < CONFIG.FULL_DAY_THRESHOLD_MINUTES;
        });
        const block = getBlockForHour(hour);
        const occupancy = allHourBookings.length;
        const isFullyBooked = occupancy >= CONFIG.MAX_BAYS;
        const statusColor = getOccupancyColor(occupancy);

        return (
          <div key={hour} style={{ display: 'flex', borderBottom: `1px solid ${COLORS.BORDER}`, minHeight: '120px' }}>
            <div style={{ width: '100px', padding: '1.5rem 0', display: 'flex', flexDirection: 'column', alignItems: 'center', borderRight: `1px solid ${COLORS.BORDER}`, gap: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: '900', color: COLORS.MUTED }}>{formatDisplayHour(hour)}</span>
              <div style={{ 
                fontSize: '0.6rem', 
                fontWeight: '950', 
                padding: '0.25rem 0.5rem', 
                borderRadius: '4px',
                background: isFullyBooked ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255,255,255,0.05)',
                color: statusColor,
                border: `1px solid ${isFullyBooked ? 'rgba(239, 68, 68, 0.2)' : COLORS.BORDER}`
              }}>
                {occupancy}/{CONFIG.MAX_BAYS} BAYS
              </div>
            </div>
            <div style={{ flex: 1, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative' }}>
              
              {block && (
                <div style={{ 
                  position: 'absolute', inset: 0, 
                  background: 'repeating-linear-gradient(45deg, rgba(230, 30, 42, 0.08), rgba(230, 30, 42, 0.08) 10px, rgba(230, 30, 42, 0.12) 10px, rgba(230, 30, 42, 0.12) 20px)',
                  borderLeft: `4px solid ${COLORS.BRAND}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, gap: '1rem'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--admin-bg)', padding: '0.6rem 1.25rem', borderRadius: '4px', border: `1px solid ${COLORS.BRAND}`, color: COLORS.BRAND, fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px', boxShadow: '0 4px 15px rgba(0,0,0,0.3)' }}>
                    <Lock size={14} /> {block.reason || 'UNAVAILABLE'}
                  </div>
                  <button 
                    onClick={() => onDeleteBlock(block.id)}
                    style={{ background: 'rgba(230, 30, 42, 0.1)', color: COLORS.BRAND, border: `1px solid ${COLORS.BRAND}`, padding: '0.4rem 0.8rem', borderRadius: '2px', fontSize: '0.6rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', transition: 'all 0.2s' }}
                  >
                    Lift Block
                  </button>
                </div>
              )}

              {!transientBookings.length && !block && (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: '1rem', opacity: isFullyBooked ? 1 : 0.15 }}>
                  {isFullyBooked ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <ShieldAlert size={18} color={COLORS.DANGER} />
                      <span style={{ fontSize: '0.8rem', fontWeight: '950', color: COLORS.DANGER, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                        SHOP AT CAPACITY (RESOURCE LOCKED)
                      </span>
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.7rem', fontWeight: '900', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '1px' }}>
                      Available Window
                    </span>
                  )}
                </div>
              )}

              {transientBookings.map((booking, bIdx) => (
                <div 
                  key={booking.id} 
                  onClick={() => onBookingClick(booking.id)} 
                  style={{ 
                    background: 'var(--admin-bg)', border: `1px solid ${COLORS.BORDER}`, 
                    borderLeft: `4px solid ${bIdx === 0 ? COLORS.BRAND : '#8b5cf6'}`, 
                    borderRadius: '4px', padding: '1rem', cursor: 'pointer',
                    transition: '0.2s', zIndex: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Tag size={12} color={bIdx === 0 ? COLORS.BRAND : '#8b5cf6'} />
                      <span style={{ fontSize: '0.6rem', fontWeight: '950', textTransform: 'uppercase', color: COLORS.MUTED }}>Session Assigned</span>
                    </div>
                    <div style={{ fontSize: '0.6rem', fontWeight: '900', background: 'rgba(255,255,255,0.05)', padding: '0.2rem 0.5rem', borderRadius: '2px', color: COLORS.MUTED }}>
                      {booking.vehicles?.length || 0} UNITS
                    </div>
                  </div>
                  <h3 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '950', color: 'white' }}>{booking.customer?.full_name}</h3>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DetailTimeline;
