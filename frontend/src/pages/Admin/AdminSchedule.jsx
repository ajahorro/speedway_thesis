import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Calendar as CalendarIcon, ShieldAlert, Lock, Zap, CheckCircle2, RotateCw, Tag } from 'lucide-react';
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

import { useUI } from '../../context/UIContext';
import { sendStatusEmail } from '../../services/notificationService';

const AdminSchedule = () => {
  const navigate = useNavigate();
  const { settings } = useConfig();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const { openModal, showToast } = useUI();

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
      const nextMonthStart = new Date(Date.UTC(year, month, 1)).toISOString();

      const { data, error } = await supabase
        .from('bookings')
        .select('start_datetime')
        .gte('start_datetime', `${firstDay}T00:00:00Z`)
        .lt('start_datetime', nextMonthStart)
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
      await flagOverdueBookings();

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
        .not('status', 'ilike', 'cancelled');

      if (bookingsError) throw bookingsError;

      // 🛡️ MANUAL PROFILE RESOLUTION
      const bookingsData = [];
      if (bookingsRaw && bookingsRaw.length > 0) {
        for (const b of bookingsRaw) {
          if (!b.customer_id) {
            bookingsData.push({ ...b, customer: { full_name: b.customer_name || 'System/Guest User', email: b.customer_email || null } });
            continue;
          }

          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, email, phone_number')
            .eq('id', b.customer_id)
            .maybeSingle();
          bookingsData.push({ ...b, customer: profile || { full_name: b.customer_name || 'System/Guest User', email: b.customer_email || null } });
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

  const flagOverdueBookings = async () => {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: overdueBookings, error } = await supabase
      .from('bookings')
      .select('id')
      .in('status', ['scheduled', 'confirmed'])
      .lte('start_datetime', cutoff);

    if (error || !overdueBookings?.length) return;

    for (const overdue of overdueBookings) {
      const { error: updateError } = await supabase
        .from('bookings')
        .update({
          status: 'FLAGGED_NOSHOW',
          needs_attention: true,
          staff_id: null,
          bay_id: null,
          refund_status: 'QUEUED',
          updated_at: new Date().toISOString()
        })
        .eq('id', overdue.id)
        .in('status', ['scheduled', 'confirmed']);

      if (updateError) continue;

      await supabase.from('payments')
        .update({ status: 'REFUND_PENDING' })
        .eq('booking_id', overdue.id)
        .in('status', ['PAID', 'FOR_VERIFICATION']);

      await sendStatusEmail(overdue.id, 'FLAGGED_NOSHOW', 'No-show: service was not started within one hour of the scheduled time.');
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

    openModal({
      title: "Confirm Schedule Restriction",
      message: confirmMsg,
      confirmText: "Commit Restriction",
      type: "danger",
      onConfirm: async () => {
        try {
          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
          const res = await fetch(`${BACKEND_URL}/api/admin/blocked-slots`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          const resData = await res.json().catch(() => ({}));
          if (!res.ok || !resData.success) {
            const conflictIds = (resData.bookings || []).map(booking => `#${booking.id.substring(0, 8).toUpperCase()}`).join(', ');
            throw new Error(conflictIds ? `${resData.error} Affected bookings: ${conflictIds}.` : (resData.error || 'Failed to commit restriction'));
          }

          showToast('Schedule restriction committed', 'success');
          setIsAddingBlock(false);
          fetchDailyContext();
          fetchMonthData();
        } catch (err) {
          logger.error('Block Error', err);
          showToast(err.message || 'Failed to commit restriction', 'error');
        }
      }
    });
  };

  const handleDeleteBlock = async (id, targetBlock = null) => {
    const isFullDay = targetBlock ? !targetBlock.start_time : false;
    const timeDesc = targetBlock
      ? (isFullDay ? 'Full Day Restriction' : `Time Window ${targetBlock.start_time} - ${targetBlock.end_time}`)
      : 'this restriction';

    openModal({
      title: "Lift Schedule Restriction",
      message: `Are you sure you want to lift ${timeDesc}? This will reopen resource bays for booking.`,
      confirmText: "Lift Restriction",
      type: "brand",
      onConfirm: async () => {
        // 1. Snapshot current state for rollback
        const snapshot = blockedSlots;
        // 2. Optimistic remove immediately
        setBlockedSlots(prev => prev.filter(b => b.id !== id));
        try {
          const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
          const res = await fetch(`${BACKEND_URL}/api/admin/blocked-slots/${id}`, {
            method: 'DELETE'
          });

          if (!res.ok) throw new Error('Failed to delete block');

          showToast('Restriction lifted', 'success');
          fetchDailyContext();
          fetchMonthData();
        } catch (err) {
          logger.error('Block delete error', err);
          showToast('Failed to lift restriction', 'error');
          // 3. Rollback on failure
          setBlockedSlots(snapshot);
        }
      }
    });
  };

  const getBookingsForHour = (hour) => {
    const hourStart = new Date(`${selectedDate}T${String(hour).padStart(2, '0')}:00:00`);
    const hourEnd = new Date(`${selectedDate}T${String(hour + 1).padStart(2, '0')}:00:00`);

    return bookings.filter(b => {
      const bStart = new Date(b.start_datetime);
      const bEnd = new Date(b.end_datetime);
      return bEnd > hourStart && bStart < hourEnd;
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

  const promoVehicleOptions = ['Sedan', 'SUV', 'Truck', 'Luxury'];
  const promoServiceOptions = ['Interior Detail', 'Full Detail', 'Paint Correction', 'Express Wash'];

  const defaultPromoRules = [
    {
      id: 'winter-wash',
      name: 'Winter Wash',
      type: 'percentage',
      value: 10,
      validFrom: '2026-09-21T00:00',
      validUntil: '2026-09-30T23:59',
      vehicleTypes: ['Sedan'],
      serviceMatches: ['Full Detail'],
      isOngoing: true
    },
    {
      id: 'vip-detailing',
      name: 'VIP Detailing',
      type: 'fixed',
      value: 500,
      validFrom: '2026-09-21T00:00',
      validUntil: '2026-09-30T23:59',
      vehicleTypes: ['SUV'],
      serviceMatches: ['Paint Correction'],
      isOngoing: true
    }
  ];

  const [promoRules, setPromoRules] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('speedway_promo_rules') || '[]');
      return Array.isArray(saved) && saved.length ? saved : defaultPromoRules;
    } catch {
      return defaultPromoRules;
    }
  });

  const defaultPromoDraft = {
    name: 'Weekend Special',
    type: 'percentage',
    value: 10,
    validFrom: '2026-09-21T00:00',
    validUntil: '2026-09-30T23:59',
    vehicleTypes: ['Sedan', 'SUV'],
    serviceMatches: ['Interior Detail', 'Full Detail'],
    neverExpires: false
  };

  const [promoDraft, setPromoDraft] = useState(defaultPromoDraft);
  const [promoValidationError, setPromoValidationError] = useState('');
  const [promoPublishing, setPromoPublishing] = useState(false);
  const [promoEditingId, setPromoEditingId] = useState(null);

  const formatPromoDate = (isoDate) => {
    if (!isoDate) return '—';
    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) return isoDate;
    return date.toLocaleString('en-PH', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const togglePromoSelection = (field, item) => {
    setPromoDraft(prev => {
      const selected = new Set(prev[field]);
      if (selected.has(item)) selected.delete(item);
      else selected.add(item);
      return { ...prev, [field]: Array.from(selected) };
    });
    setPromoValidationError('');
  };

  const syncPromoRules = (nextRules) => {
    setPromoRules(nextRules);
    localStorage.setItem('speedway_promo_rules', JSON.stringify(nextRules));
  };

  const resetPromoDraft = () => {
    setPromoDraft(defaultPromoDraft);
    setPromoEditingId(null);
    setPromoValidationError('');
  };

  const bulkTogglePromo = (field, mode) => {
    const values = field === 'vehicleTypes' ? promoVehicleOptions : promoServiceOptions;
    setPromoDraft(prev => ({
      ...prev,
      [field]: mode === 'all' ? values : []
    }));
    setPromoValidationError('');
  };

  const handleCommitPromo = () => {
    if (!promoDraft.name.trim()) {
      setPromoValidationError('Please enter a promo name.');
      return;
    }
    if (!promoDraft.value || Number(promoDraft.value) <= 0) {
      setPromoValidationError('Please enter a valid discount value.');
      return;
    }
    if (!promoDraft.validFrom || !promoDraft.validUntil) {
      setPromoValidationError('Please set both valid dates.');
      return;
    }
    if (!promoDraft.neverExpires && new Date(promoDraft.validUntil) <= new Date(promoDraft.validFrom)) {
      setPromoValidationError('Valid Until must be later than Valid From.');
      return;
    }
    if (!promoDraft.vehicleTypes.length || !promoDraft.serviceMatches.length) {
      setPromoValidationError('Please select at least 1 vehicle type and service.');
      return;
    }

    setPromoPublishing(true);
    setPromoValidationError('');

    const nextRule = {
      id: promoEditingId || `promo-${Date.now()}`,
      name: promoDraft.name.trim(),
      type: promoDraft.type,
      value: Number(promoDraft.value),
      validFrom: promoDraft.validFrom,
      validUntil: promoDraft.neverExpires ? 'never' : promoDraft.validUntil,
      vehicleTypes: promoDraft.vehicleTypes,
      serviceMatches: promoDraft.serviceMatches,
      isOngoing: true,
      neverExpires: promoDraft.neverExpires
    };

    window.setTimeout(() => {
      const nextRules = promoEditingId
        ? promoRules.map(rule => rule.id === promoEditingId ? nextRule : rule)
        : [nextRule, ...promoRules];

      syncPromoRules(nextRules);
      toast.success(`Promo "${nextRule.name}" published successfully!`);
      resetPromoDraft();
      setPromoPublishing(false);
    }, 600);
  };

  const handleEditPromo = (rule) => {
    setPromoEditingId(rule.id);
    setPromoDraft({
      name: rule.name,
      type: rule.type,
      value: rule.value,
      validFrom: rule.validFrom || '2026-09-21T00:00',
      validUntil: rule.neverExpires ? '2026-09-30T23:59' : (rule.validUntil || '2026-09-30T23:59'),
      vehicleTypes: rule.vehicleTypes || [],
      serviceMatches: rule.serviceMatches || [],
      neverExpires: Boolean(rule.neverExpires)
    });
    setPromoValidationError('');
  };

  const handleRemovePromo = (promoId) => {
    const target = promoRules.find(rule => rule.id === promoId);
    if (!target) return;

    openModal({
      title: 'Remove promo?',
      message: `Remove ${target.name} from the active campaign list? This will immediately stop it from being shown to customers.`,
      confirmText: 'Delete Promo',
      cancelText: 'Cancel',
      type: 'danger',
      onConfirm: () => {
        const nextRules = promoRules.filter(rule => rule.id !== promoId);
        syncPromoRules(nextRules);
        toast.success(`Promo "${target.name}" removed.`);
      }
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem', maxWidth: '1600px', margin: '0 auto' }}>
      <PageHeader
        badge="STUDIO"
        title="STUDIO CALENDAR"
        subtitle="Track bay utilization and live service flow."
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

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '350px 1fr', gap: '2rem', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', overflow: 'hidden' }}>
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
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                >&lsaquo;</button>
                <button
                  onClick={() => { const d = new Date(viewDate); d.setMonth(d.getMonth() + 1); setViewDate(d); }}
                  style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.25rem 0.6rem', borderRadius: '4px', cursor: 'pointer' }}
                >&rsaquo;</button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'rgba(0,0,0,0.2)' }}>
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                <div key={i} style={{ textAlign: 'center', fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', padding: '0.75rem 0' }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--admin-border)' }}>
              {(() => {
                const today = new Date().toLocaleDateString('en-CA');
                const year = viewDate.getFullYear();
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
                        color: isSelected || isToday ? 'var(--admin-text-primary)' : 'var(--admin-text-secondary)',
                        position: 'relative',
                        border: isSelected ? '2px solid var(--admin-brand)' : isToday ? '1px solid rgba(230,30,42,0.4)' : 'none'
                      }}
                    >
                      {day}
                      {hasBookings && (
                        <div style={{ position: 'absolute', bottom: '8px', width: '4px', height: '4px', borderRadius: '50%', background: 'var(--admin-brand)' }} />
                      )}
                    </div>
                  );
                }
                return cells;
              })()}
            </div>
          </div>

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
                      <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>{block.reason || 'MAINTENANCE'}</p>
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
            style={{ width: '100%', padding: '1rem', background: isAddingBlock ? 'rgba(230, 30, 42, 0.1)' : 'var(--admin-card)', color: isAddingBlock ? 'var(--admin-brand)' : 'var(--admin-text-primary)', border: `1px solid ${isAddingBlock ? 'var(--admin-brand)' : 'var(--admin-border)'}`, borderRadius: '8px', fontWeight: '950', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}
          >
            {isAddingBlock ? <Zap size={18} /> : <Lock size={18} />}
            {isAddingBlock ? 'Cancel Restriction' : 'Restrict Resources'}
          </button>
        </div>

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
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }}
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
                        style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>End Date</label>
                      <input
                        type="date"
                        value={blockData.endDate}
                        onChange={(e) => setBlockData({ ...blockData, endDate: e.target.value })}
                        style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }}
                      />
                    </div>
                  </div>
                )}

                {blockData.scope === 'window' && (
                  <div style={{ display: 'flex', gap: '1rem' }}>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>Start</label>
                      <SegmentedTimePicker value={blockData.startTime} onChange={(v) => setBlockData({ ...blockData, startTime: v })} />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>End</label>
                      <SegmentedTimePicker value={blockData.endTime} onChange={(v) => setBlockData({ ...blockData, endTime: v })} />
                    </div>
                  </div>
                )}

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <label style={{ fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.6rem', display: 'block' }}>Rationale / Reason</label>
                  <input
                    type="text"
                    placeholder="e.g., Shop Maintenance, Staff Holiday..."
                    value={blockData.reason}
                    onChange={(e) => setBlockData({ ...blockData, reason: e.target.value })}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', padding: '0.85rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: '900', outline: 'none' }}
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
                  selectedDate={selectedDate}
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

      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '1.25rem', marginTop: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem' }}>
          <Tag size={16} color="var(--admin-brand)" />
          <h4 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>Promo Management</h4>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--admin-border)', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', fontFamily: 'inherit', fontSize: 'clamp(0.9rem, 0.8vw + 0.7rem, 1.05rem)' }}>
          <div style={{ fontSize: 'clamp(0.78rem, 0.6vw + 0.66rem, 0.9rem)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-secondary)', marginBottom: '1rem' }}>Create New Promo Rule</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div>
              <div style={{ fontSize: 'clamp(0.72rem, 0.5vw + 0.6rem, 0.82rem)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem' }}>Basic Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.5fr 1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: 'clamp(0.66rem, 0.4vw + 0.56rem, 0.74rem)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-secondary)' }}>Promo Name</label>
                  <input
                    type="text"
                    value={promoDraft.name}
                    onChange={(e) => setPromoDraft(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Weekend Special"
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.8rem 0.9rem', fontSize: 'clamp(0.88rem, 0.7vw + 0.72rem, 1rem)', fontWeight: '700', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: 'clamp(0.66rem, 0.4vw + 0.56rem, 0.74rem)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-secondary)' }}>Discount Type</label>
                  <select
                    value={promoDraft.type}
                    onChange={(e) => setPromoDraft(prev => ({ ...prev, type: e.target.value }))}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.8rem 0.9rem', fontSize: 'clamp(0.88rem, 0.7vw + 0.72rem, 1rem)', fontWeight: '700', fontFamily: 'inherit' }}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed">Fixed Amount</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: 'clamp(0.66rem, 0.4vw + 0.56rem, 0.74rem)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-secondary)' }}>Discount Value</label>
                  <input
                    type="number"
                    min="1"
                    value={promoDraft.value}
                    onChange={(e) => setPromoDraft(prev => ({ ...prev, value: Number(e.target.value) || 0 }))}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.8rem 0.9rem', fontSize: 'clamp(0.88rem, 0.7vw + 0.72rem, 1rem)', fontWeight: '700', fontFamily: 'inherit' }}
                  />
                </div>
              </div>
            </div>

            <div>
              <div style={{ fontSize: 'clamp(0.72rem, 0.5vw + 0.6rem, 0.82rem)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem' }}>Duration & Schedule</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: 'clamp(0.66rem, 0.4vw + 0.56rem, 0.74rem)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-secondary)' }}>Valid From</label>
                  <input
                    type="datetime-local"
                    value={promoDraft.validFrom}
                    onChange={(e) => setPromoDraft(prev => ({ ...prev, validFrom: e.target.value }))}
                    style={{ width: '100%', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.8rem 0.9rem', fontSize: 'clamp(0.88rem, 0.7vw + 0.72rem, 1rem)', fontWeight: '700', fontFamily: 'inherit' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: 'clamp(0.66rem, 0.4vw + 0.56rem, 0.74rem)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-secondary)' }}>Valid Until</label>
                  <input
                    type="datetime-local"
                    value={promoDraft.validUntil}
                    disabled={promoDraft.neverExpires}
                    onChange={(e) => setPromoDraft(prev => ({ ...prev, validUntil: e.target.value }))}
                    style={{ width: '100%', background: promoDraft.neverExpires ? 'rgba(255,255,255,0.03)' : 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: promoDraft.neverExpires ? 'var(--admin-text-secondary)' : 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.8rem 0.9rem', fontSize: 'clamp(0.88rem, 0.7vw + 0.72rem, 1rem)', fontWeight: '700', fontFamily: 'inherit', opacity: promoDraft.neverExpires ? 0.6 : 1 }}
                  />
                </div>
              </div>
              <label style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.55rem', color: 'var(--admin-text-primary)', fontSize: 'clamp(0.76rem, 0.5vw + 0.66rem, 0.88rem)', fontWeight: '700' }}>
                <input
                  type="checkbox"
                  checked={promoDraft.neverExpires}
                  onChange={(e) => setPromoDraft(prev => ({ ...prev, neverExpires: e.target.checked }))}
                />
                Never Expires
              </label>
            </div>

            <div>
              <div style={{ fontSize: 'clamp(0.72rem, 0.5vw + 0.6rem, 0.82rem)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-secondary)', marginBottom: '0.5rem' }}>Target Scope</div>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.45rem', fontSize: 'clamp(0.66rem, 0.4vw + 0.56rem, 0.74rem)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-secondary)' }}>Vehicle Types</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(110px, 1fr))', gap: '0.5rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.75rem' }}>
                    {promoVehicleOptions.map(vehicle => (
                      <label key={vehicle} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'clamp(0.75rem, 0.5vw + 0.62rem, 0.88rem)', fontWeight: '700', color: 'var(--admin-text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={promoDraft.vehicleTypes.includes(vehicle)}
                          onChange={() => togglePromoSelection('vehicleTypes', vehicle)}
                        />
                        {vehicle}
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.45rem' }}>
                    <label style={{ fontSize: 'clamp(0.66rem, 0.4vw + 0.56rem, 0.74rem)', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--admin-text-secondary)' }}>Service Match</label>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => bulkTogglePromo('serviceMatches', 'all')} style={{ border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: 'clamp(0.56rem, 0.35vw + 0.48rem, 0.68rem)', fontWeight: '900', cursor: 'pointer' }}>Select All</button>
                      <button type="button" onClick={() => bulkTogglePromo('serviceMatches', 'none')} style={{ border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)', borderRadius: '4px', padding: '0.25rem 0.5rem', fontSize: 'clamp(0.56rem, 0.35vw + 0.48rem, 0.68rem)', fontWeight: '900', cursor: 'pointer' }}>Clear All</button>
                    </div>
                  </div>
                  <div style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.75rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                      {promoServiceOptions.map(service => (
                        <label key={service} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'clamp(0.74rem, 0.5vw + 0.6rem, 0.82rem)', fontWeight: '700', color: 'var(--admin-text-primary)', background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.45rem 0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={promoDraft.serviceMatches.includes(service)}
                            onChange={() => togglePromoSelection('serviceMatches', service)}
                          />
                          {service}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {promoValidationError && (
              <div style={{ color: '#fca5a5', fontSize: 'clamp(0.72rem, 0.45vw + 0.62rem, 0.8rem)', fontWeight: '800', marginTop: '0.25rem' }}>
                {promoValidationError}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button
                type="button"
                disabled={promoPublishing}
                onClick={handleCommitPromo}
                style={{
                  background: promoPublishing ? '#374151' : 'var(--admin-brand)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '4px',
                  fontWeight: '950',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  fontSize: 'clamp(0.72rem, 0.45vw + 0.62rem, 0.8rem)',
                  cursor: promoPublishing ? 'not-allowed' : 'pointer',
                  padding: '0.8rem 1.2rem',
                  minWidth: '200px',
                  boxShadow: '0 0 0 1px rgba(230,30,42,0.25)',
                  transition: 'transform 0.15s ease, filter 0.15s ease, box-shadow 0.15s ease',
                  transform: promoPublishing ? 'none' : 'translateY(0)',
                  opacity: promoPublishing ? 0.8 : 1,
                }}
                onMouseEnter={(e) => {
                  if (!promoPublishing) {
                    e.currentTarget.style.filter = 'brightness(1.08)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 8px 18px rgba(230, 30, 42, 0.22)';
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.filter = 'none';
                  e.currentTarget.style.transform = promoPublishing ? 'none' : 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 0 0 1px rgba(230,30,42,0.25)';
                }}
                onMouseDown={(e) => {
                  if (!promoPublishing) e.currentTarget.style.transform = 'translateY(1px) scale(0.99)';
                }}
                onMouseUp={(e) => {
                  if (!promoPublishing) e.currentTarget.style.transform = 'translateY(-1px)';
                }}
              >
                {promoPublishing ? 'Publishing...' : '+ Create Promo Rule'}
              </button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', borderBottom: '1px solid var(--admin-border)', paddingBottom: '0.75rem' }}>
          <div style={{ fontSize: 'clamp(0.76rem, 0.45vw + 0.67rem, 0.86rem)', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--admin-text-secondary)' }}>Active Promo Rules ({promoRules.length})</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {promoRules.map(rule => (
            <div key={rule.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.9rem 1rem', boxShadow: rule.id === promoEditingId ? '0 0 0 2px rgba(230,30,42,0.18)' : 'none', animation: 'promoCardPulse 0.7s ease', fontFamily: 'inherit' }}>
              <div>
                <div style={{ fontWeight: '950', fontSize: 'clamp(0.98rem, 0.6vw + 0.82rem, 1.18rem)' }}>{rule.name}</div>
                <div style={{ color: 'var(--admin-text-secondary)', fontSize: 'clamp(0.76rem, 0.5vw + 0.64rem, 0.9rem)', marginTop: '0.18rem' }}>
                  {rule.type === 'percentage' ? `${rule.value}% OFF` : `₱${Number(rule.value || 0).toLocaleString()} OFF`} · {rule.vehicleTypes.join(', ')} · {rule.serviceMatches.join(', ')}
                </div>
                <div style={{ fontSize: 'clamp(0.68rem, 0.35vw + 0.58rem, 0.78rem)', color: '#10b981', marginTop: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: '900' }}>
                  Ongoing promo · Valid: {formatPromoDate(rule.validFrom)} to {rule.neverExpires ? 'Never' : formatPromoDate(rule.validUntil)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => handleEditPromo(rule)} style={{ border: '1px solid var(--admin-border)', background: 'transparent', color: 'var(--admin-text-primary)', padding: '0.5rem 0.8rem', borderRadius: '4px', fontWeight: '900', cursor: 'pointer', fontSize: 'clamp(0.68rem, 0.35vw + 0.58rem, 0.8rem)' }}>Edit</button>
                <button type="button" onClick={() => handleRemovePromo(rule.id)} style={{ border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', padding: '0.5rem 0.8rem', borderRadius: '4px', fontWeight: '900', cursor: 'pointer', fontSize: 'clamp(0.68rem, 0.35vw + 0.58rem, 0.8rem)' }}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSchedule;
