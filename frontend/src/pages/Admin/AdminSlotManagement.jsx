import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  Calendar, Clock, Trash2, Plus, AlertCircle, 
  CalendarDays, Trash, ShieldAlert, Loader2, RefreshCcw, X
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import toast from 'react-hot-toast';

const AdminSlotManagement = () => {
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({
    date: '',
    startTime: '',
    endTime: '',
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
    e.preventDefault();
    const toastId = toast.loading('Blocking slots...');
    try {
      const { error } = await supabase
        .from('blocked_slots')
        .insert([{
          block_date: formData.date,
          start_time: formData.isWholeDay ? null : formData.startTime,
          end_time: formData.isWholeDay ? null : formData.endTime,
          reason: formData.reason
        }]);

      if (error) throw error;

      toast.success('Slot blocked successfully!', { id: toastId });
      setIsAdding(false);
      setFormData({ date: '', startTime: '', endTime: '', reason: '', isWholeDay: true });
      fetchBlockedSlots();
    } catch (err) {
      toast.error('Failed to block slot', { id: toastId });
    }
  };

  const handleDeleteSlot = async (id) => {
    if (!window.confirm('Are you sure you want to unblock this slot?')) return;
    
    const toastId = toast.loading('Unblocking...');
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHeader 
        badge="SLOT MANAGEMENT"
        title="Availability Overrides"
        subtitle="Manually block dates for maintenance, holidays, or operational limitations."
        onRefresh={fetchBlockedSlots}
        actionLabel={isAdding ? "CANCEL" : "ADD NEW BLOCK"}
        onAction={() => setIsAdding(!isAdding)}
        actionIcon={isAdding ? <X size={18} /> : <Plus size={18} />}
      />

      {/* Add Block Form */}
      {isAdding && (
        <div style={{ 
          background: 'var(--admin-card)', border: '1px solid var(--admin-brand)', 
          borderRadius: '4px', padding: '2rem', animation: 'slideDown 0.3s ease' 
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
            <Plus size={20} color="var(--admin-brand)" />
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>Create New Restriction</h3>
          </div>
          <form onSubmit={handleAddSlot} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Restriction Date</label>
              <input 
                type="date" 
                required 
                value={formData.date}
                onChange={(e) => setFormData({...formData, date: e.target.value})}
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.75rem', color: 'white', fontWeight: '700', cursor: 'pointer' }}
              />
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Type</label>
              <select 
                value={formData.isWholeDay ? 'day' : 'time'}
                onChange={(e) => setFormData({...formData, isWholeDay: e.target.value === 'day'})}
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.75rem', color: 'white', fontWeight: '700' }}
              >
                <option value="day">Whole Day</option>
                <option value="time">Specific Time Window</option>
              </select>
            </div>

            {!formData.isWholeDay && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Start Time</label>
                  <select 
                    required={!formData.isWholeDay}
                    value={formData.startTime}
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                    style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.75rem', color: 'white', fontWeight: '700' }}
                  >
                    <option value="">--:--</option>
                    {Array.from({ length: 24 * 2 }).map((_, i) => {
                      const h = Math.floor(i / 2);
                      const m = i % 2 === 0 ? '00' : '30';
                      const t = `${h.toString().padStart(2, '0')}:${m}`;
                      return <option key={t} value={t}>{t}</option>;
                    })}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <label style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>End Time</label>
                  <select 
                    required={!formData.isWholeDay}
                    value={formData.endTime}
                    onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                    style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.75rem', color: 'white', fontWeight: '700' }}
                  >
                    <option value="">--:--</option>
                    {Array.from({ length: 24 * 2 }).map((_, i) => {
                      const h = Math.floor(i / 2);
                      const m = i % 2 === 0 ? '00' : '30';
                      const t = `${h.toString().padStart(2, '0')}:${m}`;
                      return <option key={t} value={t}>{t}</option>;
                    })}
                  </select>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: '900', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Reason / Note</label>
              <input 
                type="text" 
                placeholder="e.g. Shop Maintenance"
                value={formData.reason}
                onChange={(e) => setFormData({...formData, reason: e.target.value.toUpperCase()})}
                style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '4px', padding: '0.75rem', color: 'white', fontWeight: '700' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'flex-end' }}>
              <button 
                type="submit"
                style={{ 
                  width: '100%', background: 'var(--admin-brand)', color: 'white', border: 'none', 
                  borderRadius: '4px', padding: '0.75rem', fontWeight: '950', cursor: 'pointer',
                  textTransform: 'uppercase'
                }}
              >
                Apply Restriction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Restricted Slots List */}
      <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <ShieldAlert size={20} color="var(--admin-brand)" />
          <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>Active Restrictions</h3>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {loading ? (
            <div style={{ padding: '3rem', textAlign: 'center' }}>
              <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--admin-brand)' }} />
            </div>
          ) : blockedSlots.length === 0 ? (
            <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--admin-text-secondary)' }}>
              <CalendarDays size={48} style={{ opacity: 0.1, margin: '0 auto 1rem' }} />
              <div style={{ fontWeight: '800' }}>No restrictions currently active.</div>
              <div style={{ fontSize: '0.75rem' }}>All dates are following standard operating hours.</div>
            </div>
          ) : blockedSlots.map((slot, idx) => (
            <div key={slot.id} style={{ 
              padding: '1.25rem 1.5rem', borderBottom: idx === blockedSlots.length - 1 ? 'none' : '1px solid var(--admin-border)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Calendar size={20} color="var(--admin-brand)" />
                </div>
                <div>
                  <div style={{ fontSize: '0.9rem', fontWeight: '950', color: 'var(--admin-text-primary)' }}>
                    {new Date(slot.block_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: '900', padding: '0.15rem 0.4rem', background: 'rgba(230, 30, 42, 0.1)', color: 'var(--admin-brand)', borderRadius: '2px', textTransform: 'uppercase' }}>
                      {slot.start_time ? `${slot.start_time.slice(0, 5)} - ${slot.end_time.slice(0, 5)}` : 'WHOLE DAY'}
                    </div>
                    {slot.reason && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>
                        • {slot.reason}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => handleDeleteSlot(slot.id)}
                style={{ 
                  background: 'transparent', border: 'none', color: '#ef4444', 
                  padding: '0.5rem', cursor: 'pointer', borderRadius: '4px' 
                }}
                className="delete-btn"
              >
                <Trash size={18} />
              </button>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .delete-btn:hover { background: rgba(239, 68, 68, 0.1); }
      `}</style>
    </div>
  );
};

export default AdminSlotManagement;
