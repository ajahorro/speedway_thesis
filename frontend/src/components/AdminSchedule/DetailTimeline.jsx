import React from 'react';
import { Lock, Tag, ShieldAlert } from 'lucide-react';
import { formatDisplayHour, getOccupancyColor } from '../../utils/schedulingUtils';
import { COLORS, SHOP_CONFIG as CONFIG } from '../../config/constants';

const DetailTimeline = ({ 
  hours, 
  getBookingsForHour, 
  getBlockForHour, 
  onBookingClick, 
  onDeleteBlock,
  config = CONFIG
}) => {
  // Check if a Full Day block (start_time === null) exists for this date
  const fullDayBlock = hours.map(h => getBlockForHour(h)).find(b => b && !b.start_time);

  if (fullDayBlock) {
    return (
      <div style={{
        background: 'repeating-linear-gradient(45deg, rgba(230, 30, 42, 0.08), rgba(230, 30, 42, 0.08) 12px, rgba(230, 30, 42, 0.14) 12px, rgba(230, 30, 42, 0.14) 24px)',
        border: `1px solid ${COLORS.BRAND}`,
        borderRadius: '6px',
        padding: '3.5rem 2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        boxShadow: '0 8px 30px rgba(230, 30, 42, 0.15)',
        margin: '1rem 0'
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(230, 30, 42, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: COLORS.BRAND, border: `1px solid ${COLORS.BRAND}`
        }}>
          <Lock size={28} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '950', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>
            FULL DAY RESOURCE RESTRICTION
          </h3>
          <p style={{ margin: '0.5rem 0 0 0', color: COLORS.MUTED, fontSize: '0.85rem', fontWeight: '700' }}>
            {fullDayBlock.reason || 'ALL RESOURCE BAYS LOCKED FOR THIS DAY'}
          </p>
        </div>
        <button
          onClick={() => onDeleteBlock(fullDayBlock.id, fullDayBlock)}
          style={{
            marginTop: '0.5rem',
            padding: '0.75rem 1.75rem',
            background: 'var(--admin-bg)',
            color: COLORS.BRAND,
            border: `1px solid ${COLORS.BRAND}`,
            borderRadius: '4px',
            fontWeight: '950',
            fontSize: '0.75rem',
            cursor: 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            transition: 'all 0.2s ease'
          }}
        >
          Lift Full Day Restriction
        </button>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {hours.map((hour) => {
        const allHourBookings = getBookingsForHour(hour);
        const transientBookings = allHourBookings;
        const block = getBlockForHour(hour);
        const occupancy = allHourBookings.reduce((sum, b) => sum + (b.vehicles?.length || 1), 0);
        const isFullyBooked = occupancy >= config.MAX_BAYS;
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
                {occupancy}/{config.MAX_BAYS} BAYS
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
                    <Lock size={14} /> {block.start_time ? `WINDOW (${block.start_time.slice(0,5)} - ${block.end_time.slice(0,5)})` : 'FULL DAY'}: {block.reason || 'UNAVAILABLE'}
                  </div>
                  <button 
                    onClick={() => onDeleteBlock(block.id, block)}
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

              {transientBookings.map((booking) => {
                const vehicle = booking.vehicles?.[0] || {};
                const plateNumber = vehicle.plate_number || 'NO PLATE';
                const vehicleInfo = `${vehicle.brand || ''} ${vehicle.model || ''}`.trim() || 'Generic Vehicle';
                const serviceName = vehicle.services?.[0]?.service_name || 'Standard Service';
                
                // 🎨 STATUS-BASED COLORS (REQ-ADM-08)
                const statusColors = {
                  'pending': '#f59e0b',
                  'confirmed': '#10b981',
                  'in_progress': '#3b82f6',
                  'completed': '#6b7280'
                };
                const accentColor = statusColors[booking.status?.toLowerCase()] || COLORS.BRAND;

                return (
                  <div 
                    key={booking.id} 
                    onClick={() => onBookingClick(booking.id)} 
                    title={`Staff: ${booking.staff?.full_name || 'Unassigned'} | Total: ₱${booking.total_amount || 0}`}
                    style={{ 
                      background: 'var(--admin-card-light)', 
                      border: `1px solid ${COLORS.BORDER}`, 
                      borderLeft: `4px solid ${accentColor}`, 
                      borderRadius: '4px', padding: '0.85rem 1.25rem', 
                      cursor: 'pointer', transition: '0.2s', zIndex: 2,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      display: 'flex', flexDirection: 'column', gap: '0.25rem'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.transform = 'translateX(4px)'}
                    onMouseLeave={(e) => e.currentTarget.style.transform = 'translateX(0)'}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ padding: '0.2rem 0.4rem', background: `${accentColor}22`, color: accentColor, borderRadius: '2px', fontSize: '0.55rem', fontWeight: '950', textTransform: 'uppercase' }}>
                          {booking.status || 'SCHEDULED'}
                        </div>
                        <span style={{ fontSize: '0.65rem', fontWeight: '950', color: COLORS.MUTED }}>{plateNumber}</span>
                      </div>
                      <span style={{ fontSize: '0.65rem', fontWeight: '900', color: 'white', opacity: 0.8 }}>{vehicleInfo}</span>
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '0.25rem' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: '950', color: 'white' }}>{booking.customer?.full_name}</span>
                        <span style={{ fontSize: '0.65rem', fontWeight: '800', color: accentColor, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{serviceName}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DetailTimeline;
