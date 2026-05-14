import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Clock, User, ChevronLeft, ChevronRight, 
  AlertCircle, LayoutGrid, Calendar, Users,
  Maximize2, ExternalLink, RefreshCcw
} from 'lucide-react';
import { logger } from '../../utils/logger';
import toast from 'react-hot-toast';

const AdminSchedulingGrid = ({ onBack }) => {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [bookings, setBookings] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Expanded Command Hours: 06:00 AM - 11:00 PM
  const timeSlots = Array.from({ length: 18 }, (_, i) => i + 6);

  const fetchGridData = async () => {
    setLoading(true);
    try {
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch Staff
      const { data: staffData } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'STAFF');
      setStaff(staffData || []);

      // Fetch Bookings for the day
      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name),
          vehicles:booking_vehicles(*),
          staff:profiles!bookings_staff_id_fkey(full_name)
        `)
        .gte('start_datetime', startOfDay.toISOString())
        .lte('start_datetime', endOfDay.toISOString());

      if (bookingError) throw bookingError;
      setBookings(bookingData || []);
      
      logger.admin(`Grid synchronized for ${selectedDate.toDateString()}`);
    } catch (err) {
      logger.error('Grid Sync Error', err);
      toast.error('Failed to sync grid data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGridData();
  }, [selectedDate]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return 'var(--admin-brand)';
      case 'in_progress': return '#a855f7';
      case 'completed': return '#10b981';
      case 'cancelled': return '#ef4444';
      default: return 'var(--admin-text-secondary)';
    }
  };

  const renderTimeMarkers = () => (
    <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${timeSlots.length}, 1fr)`, borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-sidebar)' }}>
      <div style={{ padding: '1rem', borderRight: '1px solid var(--admin-border)' }}></div>
      {timeSlots.map((hour, i) => (
        <div key={hour} style={{ padding: '1rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', borderRight: '1px solid var(--admin-border)', borderLeft: i === 0 ? 'none' : '1px solid var(--admin-border)' }}>
          {hour.toString().padStart(2, '0')}:00
        </div>
      ))}
    </div>
  );

  const renderBookingBlock = (booking) => {
    const startHour = new Date(booking.start_datetime).getHours();
    const startMinutes = new Date(booking.start_datetime).getMinutes();
    
    // Estimate 2 hours per booking if not specified
    const duration = 2; 
    
    const leftOffset = ((startHour - 6) + (startMinutes / 60)) * (100 / timeSlots.length);
    const width = duration * (100 / timeSlots.length);

    return (
      <div 
        key={booking.id}
        onClick={() => navigate(`/admin/bookings/${booking.id}`)}
        style={{
          position: 'absolute',
          left: `${leftOffset}%`,
          width: `${width}%`,
          top: '10px',
          bottom: '10px',
          background: getStatusColor(booking.status),
          borderRadius: '4px',
          padding: '0.5rem',
          color: 'white',
          fontSize: '0.65rem',
          fontWeight: '950',
          cursor: 'pointer',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          zIndex: 10,
          border: '1px solid rgba(255,255,255,0.2)'
        }}
      >
        <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {booking.customer?.full_name?.toUpperCase()}
        </div>
        <div style={{ opacity: 0.8, fontSize: '0.6rem' }}>
          {booking.vehicles?.[0]?.plate_number || 'NO PLATE'}
        </div>
      </div>
    );
  };

  const renderRow = (label, rowBookings, isUnassigned = false) => (
    <div style={{ display: 'grid', gridTemplateColumns: `180px repeat(${timeSlots.length}, 1fr)`, borderBottom: '1px solid var(--admin-border)', minHeight: '80px', position: 'relative', background: isUnassigned ? 'rgba(230, 30, 42, 0.03)' : 'transparent' }}>
      <div style={{ padding: '1rem', borderRight: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {isUnassigned ? <AlertCircle size={14} color="var(--admin-brand)" /> : <User size={14} color="var(--admin-text-secondary)" />}
        <span style={{ fontSize: '0.7rem', fontWeight: '950', color: isUnassigned ? 'var(--admin-brand)' : 'white', textTransform: 'uppercase' }}>{label}</span>
      </div>
      <div style={{ gridColumn: `2 / span ${timeSlots.length}`, position: 'relative' }}>
        {rowBookings.map(renderBookingBlock)}
        {/* Background Grid Lines */}
        <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateColumns: `repeat(${timeSlots.length}, 1fr)`, pointerEvents: 'none' }}>
          {timeSlots.map(hour => (
            <div key={hour} style={{ borderRight: '1px solid var(--admin-border)', height: '100%' }}></div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--admin-card)', padding: '1.5rem', borderRadius: '4px', border: '1px solid var(--admin-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <button onClick={onBack} style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <LayoutGrid size={14} /> LIST VIEW
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() - 1)))} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><ChevronLeft size={20} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Calendar size={18} color="var(--admin-brand)" />
              <span style={{ fontSize: '1rem', fontWeight: '950', color: 'white', textTransform: 'uppercase' }}>
                {selectedDate.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <button onClick={() => setSelectedDate(new Date(selectedDate.setDate(selectedDate.getDate() + 1)))} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}><ChevronRight size={20} /></button>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem' }}>
            {['SCHEDULED', 'ONGOING', 'COMPLETED'].map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor(s.toLowerCase()) }}></div>
                <span style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)' }}>{s}</span>
              </div>
            ))}
          </div>
          <button onClick={fetchGridData} style={{ background: 'var(--admin-brand)', border: 'none', color: 'white', padding: '0.6rem 1rem', borderRadius: '4px', cursor: 'pointer' }}><RefreshCcw size={16} /></button>
        </div>
      </div>

      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', overflowX: 'auto' }}>
        <div style={{ minWidth: '1200px' }}>
          {renderTimeMarkers()}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
          {/* Unassigned Row */}
          {renderRow('Unassigned Bay', bookings.filter(b => !b.staff_id), true)}
          
          {/* Staff Rows */}
          {staff.map(member => (
            <React.Fragment key={member.id}>
              {renderRow(
                member.full_name?.split(' ')[0] || 'Staff', 
                bookings.filter(b => b.staff_id === member.id)
              )}
            </React.Fragment>
          ))}

          {staff.length === 0 && !loading && (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--admin-text-secondary)', fontSize: '0.8rem', fontWeight: '800' }}>
              NO ACTIVE STAFF REGISTERED IN DIRECTORY
            </div>
          )}
        </div>
      </div>
    </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--admin-brand)', fontWeight: '950', letterSpacing: '2px' }}>
          SYNCHRONIZING SCHEDULING GRID...
        </div>
      )}
    </div>
  );
};

export default AdminSchedulingGrid;
