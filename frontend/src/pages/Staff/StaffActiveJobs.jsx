import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, Car, Clock, Play, CheckCircle2, Save, UploadCloud, Image as ImageIcon } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import toast from 'react-hot-toast';
import { sendStatusEmail } from '../../services/notificationService';

const StaffActiveJobs = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [localNotes, setLocalNotes] = useState({});

  useEffect(() => {
    fetchActiveTasks();
  }, [profile?.id]);

  const fetchActiveTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          vehicles:booking_vehicles(*, services:booking_vehicle_services(*))
        `)
        .eq('staff_id', profile.id)
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .order('start_datetime', { ascending: true });

      if (error) throw error;

      const activeUnits = (data || []).flatMap(b => 
        b.vehicles.map(v => ({
          ...v,
          booking_id: b.id,
          booking_status: b.status,
          start_datetime: b.start_datetime
        }))
      ).filter(v => v.status?.toUpperCase() !== 'COMPLETED');

      setTasks(activeUnits);
      const notesObj = {};
      activeUnits.forEach(t => { notesObj[t.id] = t.service_notes || ''; });
      setLocalNotes(notesObj);
    } catch (err) {
      console.error('Active Jobs Error:', err);
      toast.error('Failed to load active jobs');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (task, newStatus) => {
    const toastId = toast.loading(`Updating ${task.plate_number}...`);
    try {
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${BACKEND_URL}/api/bookings/update-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: task.booking_id,
          unitId: task.id,
          newStatus: newStatus,
          notes: localNotes[task.id],
          actorName: profile?.full_name || 'Staff',
          actorRole: 'STAFF'
        })
      });
      if (response.ok) {
        await sendStatusEmail(task.booking_id, newStatus, localNotes[task.id]);
        toast.success(`Marked as ${newStatus.toUpperCase()}`, { id: toastId });
        return fetchActiveTasks();
      }
      throw new Error('Sync failed');
    } catch (err) {
      await supabase.from('booking_vehicles').update({ status: newStatus.toUpperCase() }).eq('id', task.id);
      await sendStatusEmail(task.booking_id, newStatus.toUpperCase(), localNotes[task.id]);
      toast.success('Status updated', { id: toastId });
      fetchActiveTasks();
    }
  };

  const handleSaveNotes = async (taskId) => {
    try {
      const { error } = await supabase.from('booking_vehicles').update({ service_notes: localNotes[taskId] }).eq('id', taskId);
      if (error) throw error;
      toast.success('Notes saved');
      fetchActiveTasks();
    } catch (err) {
      toast.error('Failed to save notes');
    }
  };

  if (loading) return <LoadingState message="Connecting to shop floor..." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHeader 
        badge="PRODUCTION LINE"
        title="Active Service Units"
        subtitle="Current detailing assignments requiring your technical attention."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {tasks.length > 0 ? (
          tasks.map(task => (
            <div key={task.id} style={{ background: '#15171A', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '8px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div 
                  onClick={() => navigate(`/staff/job/${task.id}`)}
                  style={{ display: 'flex', gap: '1rem', alignItems: 'center', cursor: 'pointer' }}
                >
                  <div style={{ width: '48px', height: '48px', borderRadius: '4px', background: '#0A0B0D', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E61E2A' }}>
                    <Car size={24} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>{task.brand} {task.model}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem' }}>
                      <span style={{ background: '#E61E2A', color: 'white', padding: '0.15rem 0.45rem', borderRadius: '2px', fontSize: '0.65rem', fontWeight: '950', letterSpacing: '0.5px' }}>
                        {task.plate_number}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ 
                  fontSize: '0.6rem', fontWeight: '950', padding: '0.3rem 0.6rem', 
                  borderRadius: '2px', background: task.status === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.05)',
                  color: task.status === 'IN_PROGRESS' ? '#f59e0b' : '#8E9196', border: '1px solid currentColor', textTransform: 'uppercase'
                }}>
                  {task.status}
                </div>
              </div>

              <div style={{ background: '#0A0B0D', padding: '1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {task.services?.map((s, i) => (
                    <span key={i} style={{ fontSize: '0.65rem', fontWeight: '900', color: 'white', background: '#15171A', padding: '0.25rem 0.5rem', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.05)' }}>{s.service_name}</span>
                  ))}
                </div>
              </div>

              <div style={{ position: 'relative' }}>
                <textarea 
                  value={localNotes[task.id] || ''}
                  onChange={(e) => setLocalNotes({ ...localNotes, [task.id]: e.target.value })}
                  placeholder="Technical observations..."
                  style={{ width: '100%', minHeight: '80px', background: '#0A0B0D', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '4px', padding: '1rem', color: 'white', fontSize: '0.85rem', outline: 'none', resize: 'none' }}
                />
                <button onClick={() => handleSaveNotes(task.id)} style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', background: '#E61E2A', border: 'none', borderRadius: '4px', padding: '0.4rem', cursor: 'pointer', color: 'white' }}>
                  <Save size={14} />
                </button>
              </div>

              <div style={{ display: 'flex', gap: '1rem' }}>
                {task.status?.toUpperCase() === 'PENDING' && (
                  <button onClick={() => handleUpdateStatus(task, 'IN_PROGRESS')} style={{ flex: 1, padding: '0.85rem', background: '#E61E2A', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'uppercase' }}>
                    <Play size={16} /> Start Service
                  </button>
                )}
                {task.status?.toUpperCase() === 'IN_PROGRESS' && (
                  <button onClick={() => { if (window.confirm('Finalize unit?')) handleUpdateStatus(task, 'COMPLETED') }} style={{ flex: 1, padding: '0.85rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', textTransform: 'uppercase' }}>
                    <CheckCircle2 size={16} /> Mark Finished
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div style={{ gridColumn: '1/-1', padding: '10rem', textAlign: 'center', opacity: 0.1 }}>
            <ClipboardList size={64} style={{ margin: '0 auto 1.5rem' }} />
            <div style={{ fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>No Active Units</div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffActiveJobs;
