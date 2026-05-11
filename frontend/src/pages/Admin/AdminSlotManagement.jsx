import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calendar as CalendarIcon, Clock, Trash2, Plus, AlertCircle, 
  CalendarDays, Trash, ShieldAlert, Loader2, RefreshCcw, X,
  ChevronLeft, ChevronRight
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

const AdminSlotManagement = () => {
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Calendar State
  const [viewDate, setViewDate] = useState(new Date());
  
  // Form State
  const [formData, setFormData] = useState({
    date: '',
    startTime: '08:00',
    endTime: '17:00',
    reason: '',
    isWholeDay: true
  });

  useEffect(() => {
    fetchBlockedSlots();
  }, []);

  const fetchBlockedSlots = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('blocked_slots')
        .select('*')
        .order('block_date', { ascending: true });

      if (error) throw error;
      setBlockedSlots(data || []);
    } catch (err) {
      toast.error('Failed to load blocked slots');
    } finally {
      setLoading(false);
    }
  };

  const handleAddSlot = async (e) => {
    if (e) e.preventDefault();
    if (!formData.date) return toast.error('Please select a date');
    
    const toastId = toast.loading('Syncing restriction...');
    try {
      const { error } = await supabase
        .from('blocked_slots')
        .insert([{
          block_date: formData.date,
          start_time: formData.isWholeDay ? null : formData.startTime,
          end_time: formData.isWholeDay ? null : formData.endTime,
          reason: formData.reason.toUpperCase()
        }]);

      if (error) throw error;

      toast.success('Restriction applied successfully!', { id: toastId });
      setIsAdding(false);
      setFormData({ ...formData, reason: '', isWholeDay: true });
      fetchBlockedSlots();
    } catch (err) {
      toast.error('Failed to apply restriction', { id: toastId });
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm('Delete this availability override?')) return;
    
    const toastId = toast.loading('Updating...');
    try {
      const { error } = await supabase
        .from('blocked_slots')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Slot unblocked!', { id: toastId });
      fetchBlockedSlots();
    } catch (err) {
      toast.error('Failed to delete');
    }
  };

  // Calendar Logic
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    return { days, firstDay };
  };

  const { days, firstDay } = getDaysInMonth(viewDate);
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1;
    if (day > 0 && day <= days) {
      return new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    }
    return null;
  });

  const isDayBlocked = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return blockedSlots.some(s => s.block_date === dateStr);
  };

  const labelStyle = { fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem', display: 'block' };
  const inputStyle = { width: '100%', padding: '0.75rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', fontWeight: '700', fontSize: '0.85rem', outline: 'none' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '4rem' }}>
      <PageHeader 
        badge="SLOT MANAGEMENT"
        title="Availability Terminal"
        subtitle="Surgically override availability for maintenance or holidays."
        onRefresh={fetchBlockedSlots}
        actionLabel={isAdding ? "CLOSE PANEL" : "ADD NEW BLOCK"}
        onAction={() => setIsAdding(!isAdding)}
        actionIcon={isAdding ? <X size={18} /> : <Plus size={18} />}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'start' }}>
        
        {/* Month Calendar Grid */}
        <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', overflow: 'hidden' }}>
          <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <CalendarIcon size={20} color="var(--admin-brand)" />
              <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', textTransform: 'uppercase' }}>
                {viewDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </h3>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1))} style={{ padding: '0.5rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', cursor: 'pointer' }}><ChevronLeft size={16} /></button>
              <button onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1))} style={{ padding: '0.5rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', color: 'white', cursor: 'pointer' }}><ChevronRight size={16} /></button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--admin-bg)', borderBottom: '1px solid var(--admin-border)' }}>
            {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map(d => (
              <div key={d} style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '950', color: 'var(--admin-text-secondary)' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '1px', background: 'var(--admin-border)' }}>
            {calendarDays.map((date, i) => {
              const isSelected = date && formData.date === date.toISOString().split('T')[0];
              const isBlocked = isDayBlocked(date);
              
              return (
                <div 
                  key={i} 
                  onClick={() => {
                    if (date) {
                      setFormData({...formData, date: date.toISOString().split('T')[0]});
                      setIsAdding(true);
                    }
                  }}
                  style={{ 
                    aspectRatio: '1', background: date ? 'var(--admin-card)' : 'transparent',
                    padding: '0.5rem', cursor: date ? 'pointer' : 'default',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '0.25rem', position: 'relative',
                    border: isSelected ? '2px solid var(--admin-brand)' : 'none',
                    transition: '0.2s'
                  }}
                  onMouseEnter={(e) => { if (date) e.currentTarget.style.background = 'var(--admin-bg)'; }}
                  onMouseLeave={(e) => { if (date) e.currentTarget.style.background = 'var(--admin-card)'; }}
                >
                  {date && (
                    <>
                      <span style={{ fontSize: '0.9rem', fontWeight: '950', color: isBlocked ? 'var(--admin-brand)' : 'white' }}>{date.getDate()}</span>
                      {isBlocked && <div style={{ width: '4px', height: '4px', background: 'var(--admin-brand)', borderRadius: '50%' }} />}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {isAdding && (
            <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-brand)', borderRadius: '4px', padding: '1.5rem', animation: 'slideIn 0.3s ease' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
                <ShieldAlert size={20} color="var(--admin-brand)" />
                <h3 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '950', textTransform: 'uppercase' }}>Apply Restriction</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={labelStyle}>Selected Date</label>
                  <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} style={inputStyle} />
                </div>

                <div>
                  <label style={labelStyle}>Block Type</label>
                  <select value={formData.isWholeDay ? 'day' : 'time'} onChange={(e) => setFormData({...formData, isWholeDay: e.target.value === 'day'})} style={inputStyle}>
                    <option value="day">Whole Day</option>
                    <option value="time">Specific Window</option>
                  </select>
                </div>

                {!formData.isWholeDay && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={labelStyle}>Start</label>
                      <select value={formData.startTime} onChange={(e) => setFormData({...formData, startTime: e.target.value})} style={inputStyle}>
                        {Array.from({ length: 24 * 2 }).map((_, i) => {
                          const t = `${Math.floor(i / 2).toString().padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`;
                          return <option key={t} value={t}>{t}</option>;
                        })}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>End</label>
                      <select value={formData.endTime} onChange={(e) => setFormData({...formData, endTime: e.target.value})} style={inputStyle}>
                        {Array.from({ length: 24 * 2 }).map((_, i) => {
                          const t = `${Math.floor(i / 2).toString().padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`;
                          return <option key={t} value={t}>{t}</option>;
                        })}
                      </select>
                    </div>
                  </div>
                )}

                <div>
                  <label style={labelStyle}>Reason / Note</label>
                  <input type="text" placeholder="e.g. MAINTENANCE" value={formData.reason} onChange={(e) => setFormData({...formData, reason: e.target.value.toUpperCase()})} style={inputStyle} />
                </div>

                <button onClick={handleAddSlot} style={{ width: '100%', background: 'var(--admin-brand)', color: 'white', border: 'none', borderRadius: '4px', padding: '0.85rem', fontWeight: '950', cursor: 'pointer', textTransform: 'uppercase', marginTop: '0.5rem' }}>
                  Commit Block
                </button>
              </div>
            </div>
          )}

          {/* Active List (Small Summary) */}
          <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Clock size={18} color="var(--admin-text-secondary)" />
              <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', textTransform: 'uppercase', color: 'var(--admin-text-secondary)' }}>Upcoming Blocks</h3>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
              {blockedSlots.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>NO OVERRIDES SCHEDULED</div>
              ) : blockedSlots.slice(0, 5).map(slot => (
                <div key={slot.id} style={{ padding: '1rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '950' }}>{new Date(slot.block_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--admin-brand)', fontWeight: '900' }}>{slot.start_time ? `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}` : 'WHOLE DAY'}</div>
                  </div>
                  <button onClick={() => handleDeleteSlot(slot.id)} style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem' }}><Trash size={16} /></button>
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

      <style>{`
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </div>
  );
};

export default AdminSlotManagement;
;
