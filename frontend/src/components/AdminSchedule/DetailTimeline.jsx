import React from 'react';
import { Lock, Tag, ShieldAlert } from 'lucide-react';
import { formatDisplayHour, getOccupancyColor } from '../../utils/schedulingUtils';
import { COLORS, SHOP_CONFIG as CONFIG } from '../../config/constants';

const DetailTimeline = ({ 
  hours, 
  selectedDate,
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
        background: 'repeating-linear-gradient(45deg, rgba(148, 163, 184, 0.04), rgba(148, 163, 184, 0.04) 12px, rgba(148, 163, 184, 0.1) 12px, rgba(148, 163, 184, 0.1) 24px)',
        border: `1px dashed ${COLORS.BORDER}`,
        borderRadius: '6px',
        padding: '3.5rem 2rem',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)',
        margin: '1rem 0'
      }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%',
          background: 'rgba(230, 30, 42, 0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: COLORS.MUTED, border: `1px solid ${COLORS.BORDER}`
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
            color: COLORS.MUTED,
            border: `1px solid ${COLORS.BORDER}`,
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
  const openingHour = Number(config.OPENING_HOUR || CONFIG.OPENING_HOUR || 7);
  const closingHour = Number(config.CLOSING_HOUR || CONFIG.CLOSING_HOUR || 21);
  const totalHours = Math.max(1, closingHour - openingHour);

  const currentDate = new Date(selectedDate || new Date());
  currentDate.setHours(0, 0, 0, 0);
  const dateStr = currentDate.toLocaleDateString('en-CA');

  const allDayBookings = (hours.flatMap(hour => getBookingsForHour(hour))).filter((booking, index, arr) => arr.findIndex(item => item.id === booking.id) === index);
  const dayBookings = allDayBookings.filter((booking) => {
    const dt = new Date(booking.start_datetime);
    return dt.toLocaleDateString('en-CA') === dateStr;
  });
  const getBookingService = (booking) => booking.vehicles?.flatMap(vehicle => vehicle.services || []).map(service => service.service_name).filter(Boolean)[0] || 'Service booking';

  const getBookingEnd = (booking) => {
    const start = new Date(booking.start_datetime);
    const end = new Date(booking.end_datetime);
    if (!Number.isNaN(end.getTime()) && end > start) return end;
    const fallbackEnd = new Date(start);
    fallbackEnd.setMinutes(fallbackEnd.getMinutes() + 60);
    return fallbackEnd;
  };

  const getOverlapLayout = (booking, columnBookings) => {
    const start = new Date(booking.start_datetime).getTime();
    const end = getBookingEnd(booking).getTime();
    const overlapping = columnBookings
      .filter(candidate => {
        if (candidate.id === booking.id) return false;
        const candidateStart = new Date(candidate.start_datetime).getTime();
        const candidateEnd = getBookingEnd(candidate).getTime();
        return candidateStart < end && candidateEnd > start;
      })
      .sort((left, right) => new Date(left.start_datetime) - new Date(right.start_datetime) || String(left.id).localeCompare(String(right.id)));
    const concurrent = [booking, ...overlapping].sort((left, right) => new Date(left.start_datetime) - new Date(right.start_datetime) || String(left.id).localeCompare(String(right.id)));
    const position = concurrent.findIndex(candidate => candidate.id === booking.id);
    return { left: `${(position / concurrent.length) * 100}%`, width: `${100 / concurrent.length}%` };
  };

  const getBookingTop = (booking) => {
    const start = new Date(booking.start_datetime);
    const startHourValue = start.getHours() + (start.getMinutes() / 60);
    const clampedStart = Math.max(startHourValue, openingHour);
    return ((clampedStart - openingHour) / totalHours) * 100;
  };

  const getBookingHeight = (booking) => {
    const start = new Date(booking.start_datetime);
    const end = getBookingEnd(booking);
    const startHourValue = start.getHours() + (start.getMinutes() / 60);
    const endHourValue = end.getHours() + (end.getMinutes() / 60);
    const clampedStart = Math.max(startHourValue, openingHour);
    const clampedEnd = Math.min(endHourValue, closingHour);
    const spanHours = Math.max(clampedEnd - clampedStart, 0.5);
    return (spanHours / totalHours) * 100;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0, overflowX: 'auto' }}>
      <div style={{ display: 'flex', minWidth: '322px', borderBottom: `1px solid ${COLORS.BORDER}` }}>
        <div style={{ width: '72px', padding: '0.65rem 0.5rem', fontSize: '0.62rem', fontWeight: '950', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '1px' }} />
        <div style={{ flex: 1, minWidth: '250px', padding: '0.7rem 0.5rem', textAlign: 'center' }}>
          <div style={{ fontSize: '0.62rem', fontWeight: '900', color: COLORS.MUTED, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            {currentDate.toLocaleDateString('en-US', { weekday: 'short' })} · {currentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', minWidth: '322px' }}>
        <div style={{ width: '72px', borderRight: `1px solid ${COLORS.BORDER}` }}>
          {hours.map((hour) => (
            <div key={`time-${hour}`} style={{ height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: '950', color: COLORS.MUTED, borderBottom: `1px solid ${COLORS.BORDER}` }}>
              {formatDisplayHour(hour)}
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', flex: 1, minWidth: '250px', borderLeft: `1px solid ${COLORS.BORDER}` }}>
          {hours.map((hour) => (
            <div key={`slot-${dateStr}-${hour}`} style={{ height: '52px', borderBottom: `1px solid ${COLORS.BORDER}`, background: 'rgba(255,255,255,0.015)' }} />
          ))}

          {dayBookings.map((booking) => {
            const status = booking.status?.toLowerCase();
            const accentColor = { pending: '#f59e0b', confirmed: '#10b981', in_progress: '#a855f7', completed: '#6b7280' }[status] || '#64748b';
            const backgroundColor = { pending: 'rgba(245, 158, 11, 0.2)', confirmed: 'rgba(16, 185, 129, 0.2)', in_progress: 'rgba(168, 85, 247, 0.22)', completed: 'rgba(100, 116, 139, 0.2)' }[status] || 'rgba(100, 116, 139, 0.16)';
            const top = getBookingTop(booking);
            const height = getBookingHeight(booking);
            const overlap = getOverlapLayout(booking, dayBookings);

            return (
              <div
                key={booking.id}
                onClick={() => onBookingClick(booking.id)}
                title={`${booking.customer?.full_name || 'Booking'} • ${booking.status || 'SCHEDULED'}`}
                style={{
                      position: 'absolute',
                      left: `calc(${overlap.left} + 4px)`,
                      width: `calc(${overlap.width} - 8px)`,
                      minWidth: '120px',
                      top: `${Math.max(0, top)}%`,
                      height: `${Math.max(height, 3.5)}%`,
                      minHeight: '28px',
                      borderRadius: '3px',
                      border: `1px solid ${accentColor}`,
                      background: backgroundColor,
                      color: '#fff',
                      fontSize: '0.52rem',
                      fontWeight: '950',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      textAlign: 'left',
                      padding: '8px',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.16)',
                      overflow: 'hidden',
                      zIndex: 2,
                      cursor: 'pointer'
                }}
              >
                <strong style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{booking.customer?.full_name || 'System/Guest User'}</strong>
                <span style={{ maxWidth: '100%', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.48rem', fontWeight: '700', color: 'rgba(255,255,255,0.82)' }}>{getBookingService(booking)}</span>
                <span style={{ maxWidth: '100%', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.45rem', fontWeight: '700', color: 'rgba(255,255,255,0.68)' }}>#{String(booking.id).slice(0, 8).toUpperCase()}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DetailTimeline;
