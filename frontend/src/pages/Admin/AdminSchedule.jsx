import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar as CalendarIcon, ShieldAlert, Lock, Zap, CheckCircle2, RotateCw } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';
import { logger } from '../../utils/logger';

// Refactored Imports
import { COLORS } from '../../config/constants';
import { useConfig } from '../../context/ConfigContext';
import { segregateBookings } from '../../utils/schedulingUtils';
import SegmentedTimePicker from '../../components/AdminSchedule/SegmentedTimePicker';
import OccupancyShelf from '../../components/AdminSchedule/OccupancyShelf';
import DetailTimeline from '../../components/AdminSchedule/DetailTimeline';
import ConfirmationToast from '../../components/ConfirmationToast';
import { AlertTriangle, Info } from 'lucide-react';

const AdminSchedule = () => {
  const navigate = useNavigate();
  const { settings } = useConfig();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  
  // State: Navigation & Context
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [viewDate, setViewDate] = useState(new Date());
  
  // State: Data
  const [bookings, setBookings] = useState([]);
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [allMonthBookings, setAllMonthBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State: Blocking Panel
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [blockData, setBlockData] = useState({
    scope: 'day', // 'day', 'window', 'range'
    startDate: selectedDate,
    endDate: selectedDate,
    startTime: `${String(settings.OPENING_HOUR).padStart(2, '0')}:00`,
    endTime: `${String(settings.CLOSING_HOUR - 4).padStart(2, '0')}:00`,
    reason: '',
    isWholeDay: true
  });

  const hours = Array.from(
    { length: settings.CLOSING_HOUR - settings.OPENING_HOUR + 1 }, 
    (_, i) => i + settings.OPENING_HOUR
  );

  useEffect(() => {
    fetchMonthData();
  }, [viewDate]);

  useEffect(() => {
    fetchDailyContext();
    setBlockData(prev => ({ ...prev, startDate: selectedDate, endDate: selectedDate }));

    // 🛡️ REAL-TIME SYNCHRONIZATION (REQ-ADM-02)
    const channel = supabase.channel('admin-schedule-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchDailyContext();
        fetchMonthData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'blocked_slots' }, () => {
        fetchDailyContext();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedDate]);

  const fetchMonthData = async () => {
    try {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth() + 1;
      const firstDay = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay = `${year}-${String(month).padStart(2, '0')}-31`;

      const { data, error } = await supabase
        .from('bookings')
        .select('start_datetime')
        .gte('start_datetime', `${firstDay}T00:00:00Z`)
        .lte('start_datetime', `${lastDay}T23:59:59Z`)
        .not('status', 'ilike', 'cancelled');

      if (error) throw error;
      setAllMonthBookings(data || []);
    } catch (err) {
      logger.error('Month Fetch Error', err);
    }
  };

  const fetchDailyContext = async () => {
    setLoading(true);
    try {
      // 🛡️ 3-DAY BUFFER: Fetch yesterday, today, and tomorrow to capture any timezone shifts
      const d = new Date(selectedDate);
      const prev = new Date(d); prev.setDate(d.getDate() - 1);
      const next = new Date(d); next.setDate(d.getDate() + 1);
      
      const fetchStart = `${prev.toLocaleDateString('en-CA')}T00:00:00Z`;
      const fetchEnd = `${next.toLocaleDateString('en-CA')}T23:59:59Z`;
      
      const { data: bookingsRaw, error: bookingsError } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name, email),
          vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*, services:booking_vehicle_services(service_name))
        `)
        .lte('start_datetime', fetchEnd)
        .gte('end_datetime', fetchStart)
        .not('status', 'ilike', 'cancelled')
        .not('status', 'ilike', 'completed');

      if (bookingsError) throw bookingsError;

      // 🛡️ MANUAL PROFILE RESOLUTION
      const bookingsData = [];
      if (bookingsRaw && bookingsRaw.length > 0) {
        for (const b of bookingsRaw) {
          const { data: profile } = await supabase.from('profiles').select('full_name, email, phone_number').eq('id', b.customer_id).single();
          bookingsData.push({ ...b, customer: profile || { full_name: 'System/Guest User' } });
        }
      }

      const { data: blocksData, error: blocksError } = await supabase
        .from('blocked_slots')
        .select('*')
        .eq('block_date', selectedDate);

      if (blocksError) throw blocksError;

      setBookings(bookingsData || []);
      setBlockedSlots(blocksData || []);
    } catch (err) {
      logger.error('Daily Sync Error', err);
      toast.error('Failed to synchronize schedule');
    } finally {
      setLoading(false);
    }
  };

  const handleCommitBlock = async () => {
    let payload = {};
    let confirmMsg = '';

    if (blockData.scope === 'range') {
      if (!blockData.startDate || !blockData.endDate) {
        toast.error('Please specify both Start Date and End Date');
        return;
      }
      if (blockData.startDate > blockData.endDate) {
        toast.error('Start Date cannot be after End Date');
        return;
      }
      payload = {
        start_date: blockData.startDate,
        end_date: blockData.endDate,
        start_time: blockData.isWholeDay ? null : blockData.startTime,
        end_time: blockData.isWholeDay ? null : blockData.endTime,
        reason: blockData.reason || 'MULTI-DAY BLOCK'
      };
      confirmMsg = `Are you sure you want to block resource bays from ${blockData.startDate} to ${blockData.endDate}?`;
    } else {
      const isWindow = blockData.scope === 'window';
      payload = {
        block_date: selectedDate,
        start_time: isWindow ? blockData.startTime : null,
        end_time: isWindow ? blockData.endTime : null,
        reason: blockData.reason || (isWindow ? 'TIME WINDOW RESTRICTION' : 'FULL DAY BLOCK')
      };
      confirmMsg = `Are you sure you want to block ${isWindow ? `time window ${blockData.startTime} - ${blockData.endTime}` : 'the full working day'} on ${selectedDate}?`;
    }

    toast.custom((t) => (
      <ConfirmationToast
        t={t}
        title="Confirm Schedule Restriction"
        message={confirmMsg}
        icon={AlertTriangle}
        confirmLabel="Commit Restriction"
        variant="danger"
        onConfirm={async () => {
          toast.dismiss(t.id);
          try {
            const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const res = await fetch(`${BACKEND_URL}/api/admin/blocked-slots`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const resData = await res.json().catch(() => ({}));
            if (!res.ok || !resData.success) {
              throw new Error(resData.error || 'Failed to commit restriction');
            }

            toast.success('Schedule restriction committed');
            setIsAddingBlock(false);
            fetchDailyContext();
            fetchMonthData();
          } catch (err) {
            logger.error('Block Error', err);
            toast.error(err.message || 'Failed to commit restriction');
          }
        }}
        onCancel={() => toast.dismiss(t.id)}
      />
    ), { duration: Infinity });
  };

  const handleDeleteBlock = async (id, targetBlock = null) => {
    const isFullDay = targetBlock ? !targetBlock.start_time : false;
    const timeDesc = targetBlock
      ? (isFullDay ? 'Full Day Restriction' : `Time Window ${targetBlock.start_time} - ${targetBlock.end_time}`)
      : 'this restriction';

    toast.custom((t) => (
      <ConfirmationToast
        t={t}
        title="Lift Schedule Restriction"
        message={`Are you sure you want to lift ${timeDesc}? This will reopen resource bays for booking.`}
        icon={Info}
        confirmLabel="Lift Restriction"
        variant="brand"
        centered={true}
        onConfirm={async () => {
          toast.dismiss(t.id);
          // 1. Snapshot current state for rollback
          const snapshot = blockedSlots;
          // 2. Optimistic remove immediately
          setBlockedSlots(prev => prev.filter(b => b.id !== id));
          try {
            const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
            const res = await fetch(`${BACKEND_URL}/api/admin/blocked-slots/${id}`, {
              method: 'DELETE'
            });

            const resData = await res.json().catch(() => ({}));
            if (!res.ok || !resData.success) {
              throw new Error(resData.error || 'Failed to lift restriction');
            }

            toast.success('Restriction lifted');
            // 3. Delayed re-sync to prevent DB race condition
            setTimeout(() => {
              fetchDailyContext();
              fetchMonthData();
            }, 500);
          } catch (err) {
            logger.error('Delete Block Error', err);
            // 4. Rollback optimistic update on failure
            setBlockedSlots(snapshot);
            toast.error('Failed to lift restriction');
          }
        }}
        onCancel={() => toast.dismiss(t.id)}
      />
    ), { duration: Infinity });
  };

  const getBookingsForHour = (hour) => {
    return bookings.filter(b => {
      // 🛡️ NAIVE LOCAL COMPARISON: Treat DB string as a wall-clock anchor
      const bStart = new Date(b.start_datetime.substring(0, 19));
      const bEnd = new Date(b.end_datetime.substring(0, 19));
      
      const checkTime = new Date(`${selectedDate}T${String(hour).padStart(2, '0')}:00:00`);
      
      return checkTime >= bStart && checkTime < bEnd;
    });
  };

  const getBlockForHour = (hour) => {
    return blockedSlots.find(block => {
      if (!block.start_time) return true; // NULL start_time = whole-day block
      const [sh] = block.start_time.split(':').map(Number);
      const [eh] = block.end_time.split(':').map(Number);
      return hour >= sh && hour < eh;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <PageHeader 
        badge="SERVICE_RESOURCES"
        title="SERVICE SCHEDULE" 
        subtitle="Manage resource occupancy and daily throughput."
        onRefresh={fetchDailyContext}
      >
        <button 
          onClick={() => { fetchDailyContext(); fetchMonthData(); }}
          title="Refresh schedule data"
          style={{ background: 'transparent', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)', padding: '0.6rem', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <RotateCw size={16} className={loading ? 'animate-spin' : ''} />
        </button>
      </PageHeader>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '350px 1fr', gap: '2rem', marginTop: '0.5rem' }}>
        {/* Left Panel: Calendar & Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* ── INDUSTRIAL CALENDAR (PHOTO MATCH) ── */}
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', overflow: 'hidden' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1.25rem', borderBottom: '1px solid var(--admin-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <CalendarIcon size={18} color="var(--admin-brand)" />
                <span style={{ fontWeight: '950', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {viewDate.toLocaleString('default', { month: 'long' })} {viewDate.getFullYear()}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() - 1); setViewDate(d); }}
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                >&lsaquo;</button>
                <button
                  onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d); }}
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                >&rsaquo;</button>
              </div>
            </div>

            {/* Weekday Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(0,0,0,0.2)' }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', padding: '0.75rem 0' }}>{d}</div>
              ))}
            </div>

            {/* Days Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--admin-border)' }}>
              {(() => {
                const today = new Date().toLocaleDateString('en-CA');
                const year  = viewDate.getFullYear();
                const month = viewDate.getMonth();
                const firstDay = new Date(year, month, 1).getDay();
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const cells = [];

                for (let i = 0; i < firstDay; i++) cells.push(<div key={`empty-${i}`} style={{ background: 'var(--admin-card)', height: '50px' }} />);

                for (let day = 1; day <= daysInMonth; day++) {
                  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const isToday = dateStr === today;
                  const isSelected = dateStr === selectedDate;
                  const hasBookings = allMonthBookings.some(b => {
                    const d = new Date(b.start_datetime);
                    const bDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    return bDate === dateStr;
                  });

                  cells.push(
                    <div
                      key={dateStr}
                      onClick={() => {
                        setSelectedDate(dateStr);
                        if (new Date(dateStr).getMonth() !== viewDate.getMonth()) setViewDate(new Date(dateStr));
                      }}
                      style={{
                        background: isSelected ? 'rgba(255,255,255,0.05)' : 'var(--admin-card)',
                        height: '50px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        fontWeight: '900',
                        color: isSelected || isToday ? 'white' : 'var(--admin-text-secondary)',
                        position: 'relative',
                        border: isSelected ? '2px solid var(--admin-brand)' : isToday ? '1px solid rgba(230,30,42,0.4)' : 'none'
                      }}
                    >
                      {day}
                      {hasBookings && (
                        <div style={{ position: 'absolute', bottom: '8px', width: '4px', height: '4px', borderRadius: '50%', background: isSelected ? 'white' : 'var(--admin-brand)' }} />
                      )}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </div>

          {/* Active Restrictions Panel (PHOTO MATCH) */}
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem' }}>
              <ShieldAlert size={16} color="var(--admin-brand)" />
              <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Restrictions</h4>
            </div>
            {blockedSlots.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {blockedSlots.map(block => (
                  <div key={block.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(230,30,42,0.05)', padding: '0.75rem', borderRadius: '4px', border: '1px solid rgba(230,30,42,0.1)' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', color: 'white' }}>{block.reason || 'MAINTENANCE'}</p>
                      <p style={{ margin: 0, fontSize: '0.6rem', color: 'var(--admin-text-secondary)', fontWeight: '700' }}>
                        {block.start_time ? `${block.start_time} - ${block.end_time}` : 'FULL DAY BLOCK'}
                      </p>
                    </div>
                    <button 
                      onClick={() => handleDeleteBlock(block.id)}
                      style={{ background: 'none', border: '1px solid rgba(230,30,42,0.3)', color: 'var(--admin-brand)', fontSize: '0.55rem', fontWeight: '950', padding: '0.25rem 0.5rem', borderRadius: '2px', cursor: 'pointer', textTransform: 'uppercase' }}
                    >Lift</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ margin: '1rem 0', textAlign: 'center', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', opacity: 0.5 }}>No Active Blocks</p>
            )}
          </div>

          <button 
            onClick={() => setIsAddingBlock(!isAddingBlock)}
            style={{ width: '100%', padding: '1rem', background: isAddingBlock ? 'rgba(230, 30, 42, 0.1)' : 'var(--admin-card)', color: isAddingBlock ? 'var(--admin-brand)' : 'white', border: `1px solid ${isAddingBlock ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '8px', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
          >
            {isAddingBlock ? <Zap size={18} /> : <Lock size={18} />}
            {isAddingBlock ? 'Cancel Restriction' : 'Restrict Resources'}
          </button>
        </div>

        {/* Right Panel: Timeline */}
        <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', overflow: 'hidden' }}>
          {isAddingBlock && (
            <div style={{ padding: '1.25rem', background: 'rgba(230, 30, 42, 0.05)', borderBottom: '1px solid var(--admin-border)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'flex-end' }}>
                <div style={{ flex: '0 0 220px' }}>
                  <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>Restriction Scope</label>
                  <select 
                    value={blockData.scope} 
                    onChange={(e) => {
                      const s = e.target.value;
                      setBlockData(prev => ({
                        ...prev,
                        scope: s,
                        isWholeDay: s !== 'window'
                      }));
                    }}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', padding: '0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }}
                  >
                    <option value="day">Full Working Day (Single Date)</option>
                    <option value="window">Specific Time Frame (Single Date)</option>
                    <option value="range">Multi-Day Date Range</option>
                  </select>
                </div>

                {blockData.scope === 'range' && (
                  <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>Start Date</label>
                      <input 
                        type="date" 
                        value={blockData.startDate} 
                        onChange={(e) => setBlockData({ ...blockData, startDate: e.target.value })}
                        style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }} 
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>End Date</label>
                      <input 
                        type="date" 
                        value={blockData.endDate} 
                        onChange={(e) => setBlockData({ ...blockData, endDate: e.target.value })}
                        style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }} 
                      />
                    </div>
                  </div>
                )}

                {blockData.scope === 'window' && (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>Start</label>
                      <SegmentedTimePicker value={blockData.startTime} onChange={(v) => setBlockData({...blockData, startTime: v})} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>End</label>
                      <SegmentedTimePicker value={blockData.endTime} onChange={(v) => setBlockData({...blockData, endTime: v})} />
                    </div>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>Rationale / Reason</label>
                  <input 
                    type="text" 
                    placeholder="e.g., Shop Maintenance, Staff Holiday..." 
                    value={blockData.reason} 
                    onChange={(e) => setBlockData({...blockData, reason: e.target.value})}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', padding: '0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }}
                  />
                </div>

                <button 
                  onClick={handleCommitBlock} 
                  style={{ background: 'var(--admin-brand)', color: 'white', border: 'none', padding: '0.85rem 2rem', borderRadius: '4px', fontWeight: '950', fontSize: '0.75rem', textTransform: 'uppercase', cursor: 'pointer', letterSpacing: '1px' }}
                >
                  Commit Block
                </button>
              </div>
            </div>
          )}

          <div style={{ padding: '1.5rem' }}>
            <OccupancyShelf 
              bookings={bookings} 
                  onBookingClick={(id) => navigate(`/admin/bookings/${id}`)}
              config={settings}
            />

            {loading ? <LoadingState message="Syncing timeline..." /> : (
              <>
                {/* COMPACT INLINE EMPTY STATE (REQ #1) — shown when day is clear */}
                {bookings.length === 0 && blockedSlots.length === 0 && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '1rem',
                    padding: '0.85rem 1.25rem',
                    background: 'rgba(16, 185, 129, 0.05)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '6px',
                    marginBottom: '1rem'
                  }}>
                    <CheckCircle2 size={18} color="#10b981" style={{ flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: '0.75rem', fontWeight: '950', color: '#10b981', textTransform: 'uppercase', letterSpacing: '1px' }}>Zero Administrative Records</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '600', marginLeft: '0.75rem' }}>This day is clear. No bookings or restrictions are scheduled.</span>
                    </div>
                    <button
                      onClick={() => setIsAddingBlock(true)}
                      style={{
                        padding: '0.5rem 1rem', background: 'transparent',
                        border: '1px solid var(--admin-border)',
                        borderRadius: '4px', color: 'var(--admin-text-secondary)',
                        fontWeight: '950', fontSize: '0.65rem', cursor: 'pointer',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                        flexShrink: 0
                      }}
                    >
                      Block This Day
                    </button>
                  </div>
                )}
                <DetailTimeline 
                  hours={hours}
                  getBookingsForHour={getBookingsForHour}
                  getBlockForHour={getBlockForHour}
                  onBookingClick={(id) => navigate(`/admin/bookings/${id}`)}
                  onDeleteBlock={handleDeleteBlock}
                  config={settings}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminSchedule;
