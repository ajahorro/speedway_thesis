import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Tag, ArrowRight } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

const AdminSchedule = () => {
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  const hours = Array.from({ length: 11 }, (_, i) => i + 8); // 8 AM to 6 PM

  useEffect(() => {
    fetchDailyBookings();
  }, [selectedDate]);

  const fetchDailyBookings = async () => {
    setLoading(true);
    try {
      logger.admin(`Fetching timeline for ${selectedDate}...`);
      
      const { data, error } = await supabase
        .from('bookings')
        .select(`*`)
        .order('start_datetime', { ascending: true });

      // DEDUPLICATION ENGINE: Ensure unique IDs only
      const uniqueBookings = Array.from(
        new Map((data || []).map(b => [b.id, b])).values()
      );

      // Relaxed filter for full visibility
      const dailyBookings = uniqueBookings.filter(b => {
        const bDate = new Date(b.start_datetime).toISOString().split('T')[0];
        return bDate === selectedDate;
      });

      if (error) throw error;
      setBookings(dailyBookings);
      logger.admin('Timeline synchronized.');
    } catch (err) {
      logger.error('Schedule Sync Error', err);
      toast.error('Failed to load schedule');
    } finally {
      setLoading(false);
    }
  };

  const getBookingsForHour = (hour) => bookings.filter(b => {
    const startHour = new Date(b.start_datetime).getHours();
    return startHour === hour;
  });

  const isHourOccupied = (hour) => bookings.some(b => {
    const startHour = new Date(b.start_datetime).getHours();
    const endHour = new Date(b.end_datetime || b.start_datetime).getHours();
    return hour >= startHour && hour < (endHour || startHour + 1);
  });

  const panelStyle = { background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', padding: '1.5rem', color: 'var(--admin-text-primary)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      <PageHeader badge="TIMELINE OVERVIEW" title="SCHEDULE" subtitle={`${bookings.length} ${bookings.length === 1 ? 'booking' : 'bookings'} today.`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'var(--admin-bg)', padding: '0.45rem 0.85rem', borderRadius: 'var(--admin-radius-sm)', border: '1px solid var(--admin-border)' }}>
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() - 1); setSelectedDate(d.toISOString().split('T')[0]); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><ChevronLeft size={18} color="var(--admin-brand)" /></button>
          <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} style={{ background: 'transparent', border: 'none', color: 'var(--admin-text-primary)', fontWeight: '800', fontSize: '0.85rem', outline: 'none', width: '125px' }} />
          <button onClick={() => { const d = new Date(selectedDate); d.setDate(d.getDate() + 1); setSelectedDate(d.toISOString().split('T')[0]); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><ChevronRight size={18} color="var(--admin-brand)" /></button>
        </div>
      </PageHeader>

      <div style={{ ...panelStyle, minHeight: '600px' }}>
        {loading ? <LoadingState message="Generating timeline..." /> : hours.map((hour) => {
          const hourBookings = getBookingsForHour(hour);
          const isOccupied = isHourOccupied(hour);
          const displayHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
          return (
            <div key={hour} style={{ display: 'flex', borderBottom: hour === 18 ? 'none' : '1px solid var(--admin-border)', minHeight: isMobile ? '80px' : '100px' }}>
              <div style={{ width: isMobile ? '60px' : '90px', padding: '1.5rem 0', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>{displayHour}</div>
              <div style={{ flex: 1, padding: isMobile ? '0.5rem' : '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {!isOccupied && <span style={{ color: 'var(--admin-text-secondary)', opacity: 0.15, fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', padding: '0.75rem 0' }}>Available</span>}
                {hourBookings.map((booking, bIdx) => {
                  const fleetSize = booking.vehicles?.length || 0;
                  const vehicleText = fleetSize > 1 ? `${fleetSize} Vehicles (Fleet)` : (booking.vehicles?.[0]?.vehicle_type || 'Vehicle');
                  return (
                    <div key={booking.id} onClick={() => navigate(`/admin/bookings/${booking.id}`)} style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderLeft: `4px solid ${bIdx === 0 ? 'var(--admin-brand)' : '#8b5cf6'}`, borderRadius: 'var(--admin-radius)', padding: '0.75rem 1rem', cursor: 'pointer' }}>
                       <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <div style={{ color: bIdx === 0 ? 'var(--admin-brand)' : '#8b5cf6', fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase' }}>APPOINTMENT</div>
                         <div style={{ fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)' }}>{vehicleText}</div>
                       </div>
                       <h3 style={{ margin: '0.2rem 0', fontSize: '0.95rem', fontWeight: '900', color: 'var(--admin-text-primary)' }}>{booking.customer_name || booking.customer?.full_name || 'Anonymous'}</h3>
                       <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'var(--admin-brand)' }}>₱{Number(booking.total_amount).toLocaleString()}</div>
                     </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  );
};

export default AdminSchedule;
