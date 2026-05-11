import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { 
  ClipboardList, Clock, CheckCircle2, AlertCircle, 
  Car, User, ArrowRight, Play, Loader2, Image, Save, UploadCloud
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';

const StaffDashboard = () => {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, active: 0, completed: 0 });
  const [updatingTask, setUpdatingTask] = useState(null);
  const [localNotes, setLocalNotes] = useState({});

  useEffect(() => {
    fetchAssignedTasks();
  }, [profile?.id]);

  const fetchAssignedTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      // Fetch bookings where this staff is assigned
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name, email, phone_number),
          vehicles:booking_vehicles(*, services:booking_vehicle_services(*))
        `)
        .eq('staff_id', profile.id)
        .neq('status', 'cancelled')
        .order('start_datetime', { ascending: true });

      if (error) throw error;

      // Extract individual vehicle tasks (since technicians work on units)
      const allVehicleTasks = (data || []).flatMap(b => 
        b.vehicles.map(v => ({
          ...v,
          customer: b.customer,
          booking_id: b.id,
          booking_status: b.status,
          start_datetime: b.start_datetime
        }))
      );

      setTasks(allVehicleTasks);
      
      // Sync local notes
      const notesObj = {};
      allVehicleTasks.forEach(t => {
        notesObj[t.id] = t.service_notes || '';
      });
      setLocalNotes(notesObj);
      
      // Calculate Stats
      const pending = allVehicleTasks.filter(t => t.status === 'PENDING').length;
      const active = allVehicleTasks.filter(t => t.status === 'IN_PROGRESS').length;
      const completed = allVehicleTasks.filter(t => t.status === 'COMPLETED').length;
      setStats({ pending, active, completed });

    } catch (err) {
      console.error('Task Fetch Error:', err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (taskId, newStatus) => {
    const toastId = toast.loading(`Updating unit status...`);
    try {
      const { error } = await supabase
        .from('booking_vehicles')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;

      toast.success(`Unit marked as ${newStatus.toUpperCase()}`, { id: toastId });
      fetchAssignedTasks();
    } catch (err) {
      toast.error('Failed to update status', { id: toastId });
    }
  };

  const handleSaveNotes = async (taskId) => {
    const toastId = toast.loading('Saving notes...');
    try {
      const { error } = await supabase
        .from('booking_vehicles')
        .update({ service_notes: localNotes[taskId] })
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Notes saved!', { id: toastId });
      fetchAssignedTasks();
    } catch (err) {
      toast.error('Failed to save notes', { id: toastId });
    }
  };

  const handleUploadPhoto = async (taskId, file) => {
    if (!file) return;
    const toastId = toast.loading('Uploading evidence...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}-${Date.now()}.${fileExt}`;
      const filePath = `service-proofs/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('bookings') // Reusing bookings bucket for ease
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('bookings')
        .getPublicUrl(filePath);

      const { error: dbError } = await supabase
        .from('booking_vehicles')
        .update({ photo_proof_url: publicUrl })
        .eq('id', taskId);

      if (dbError) throw dbError;

      toast.success('Evidence uploaded successfully!', { id: toastId });
      fetchAssignedTasks();
    } catch (err) {
      console.error(err);
      toast.error('Upload failed. Ensure storage bucket exists.', { id: toastId });
    }
  };

  if (loading) return <LoadingState message="Synchronizing your daily task hub..." />;

  const cardStyle = {
    background: '#0F0F0F',
    border: '1px solid #1A1A1A',
    borderRadius: '16px',
    padding: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem'
  };

  const badgeStyle = (status) => ({
    fontSize: '0.6rem',
    fontWeight: '950',
    padding: '0.3rem 0.6rem',
    borderRadius: '2px',
    textTransform: 'uppercase',
    border: '1px solid currentColor',
    background: status === 'COMPLETED' ? 'rgba(16, 185, 129, 0.1)' : (status === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.05)'),
    color: status === 'COMPLETED' ? '#10b981' : (status === 'IN_PROGRESS' ? '#f59e0b' : '#8E9196'),
    letterSpacing: '1px'
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <PageHeader 
        badge="OPERATIONAL HUB"
        title="My Daily Tasks"
        subtitle={`Welcome back, ${profile?.full_name?.split(' ')[0]}. You have ${stats.active + stats.pending} active units to detail today.`}
      />

      {/* Duty Status Banner */}
      {!profile?.is_clocked_in && (
        <div style={{ 
          padding: '1rem 1.5rem', background: 'rgba(230, 30, 42, 0.1)', 
          border: '1px solid rgba(230, 30, 42, 0.2)', borderRadius: '4px',
          display: 'flex', alignItems: 'center', gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <AlertCircle size={20} color="#E61E2A" />
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: '950', color: '#E61E2A', textTransform: 'uppercase', letterSpacing: '1px' }}>Read-Only Mode</div>
            <div style={{ fontSize: '0.7rem', fontWeight: '900', color: '#8E9196', textTransform: 'uppercase' }}>Please Clock In from the sidebar to manage assignments.</div>
          </div>
        </div>
      )}

      {/* Stats Overview */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
        {[
          { label: 'Assigned Units', value: stats.active + stats.pending, icon: Car, color: '#E61E2A' },
          { label: 'In Progress', value: stats.active, icon: Clock, color: '#f59e0b' },
          { label: 'Completed', value: stats.completed, icon: CheckCircle2, color: '#10b981' }
        ].map((stat, i) => (
          <div key={i} className="admin-card-hover" style={{ 
            background: '#15171A', padding: '1.5rem', borderRadius: '4px', 
            border: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', 
            justifyContent: 'space-between', alignItems: 'center' 
          }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>{stat.label}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: '950', color: 'white' }}>{stat.value}</div>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: `${stat.color}10`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
              <stat.icon size={24} />
            </div>
          </div>
        ))}
      </div>

      {/* Active Tasks List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1px' }}>
          Active Workload
        </h3>

        {tasks.length > 0 ? (
          tasks.map((task) => (
            <div key={task.id} className="admin-card-hover" style={{ 
              background: '#15171A', border: '1px solid rgba(255, 255, 255, 0.05)', 
              borderRadius: '4px', overflow: 'hidden' 
            }}>
              <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '4px', background: '#0A0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E61E2A', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <Car size={24} />
                  </div>
                  <div>
                    <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1px' }}>
                      SW-UNIT-{task.id.slice(0, 4).toUpperCase()}
                    </div>
                    <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950', textTransform: 'uppercase' }}>{task.make} {task.model}</h3>
                  </div>
                </div>
                <span style={badgeStyle(task.status)}>{task.status}</span>
              </div>

              <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem', background: '#15171A' }}>
                <div style={{ display: 'flex', gap: '2rem' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>PLATE NUMBER</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: '900', color: 'white', textTransform: 'uppercase' }}>{task.plate_number || 'NOT SPECIFIED'}</div>
                  </div>
                  <div style={{ flex: 2 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>ASSIGNED SERVICES</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                      {task.services?.map((s, idx) => (
                        <span key={idx} style={{ fontSize: '0.6rem', padding: '0.2rem 0.5rem', background: '#0A0B0D', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '2px', color: 'white', fontWeight: '900', textTransform: 'uppercase' }}>{s.service_name}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Service Notes & Photos */}
                {task.status !== 'PENDING' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                      <textarea 
                        placeholder="ENTER DETAILING NOTES OR SERVICE OBSERVATIONS..."
                        value={localNotes[task.id] || ''}
                        onChange={(e) => setLocalNotes({ ...localNotes, [task.id]: e.target.value })}
                        disabled={!profile?.is_clocked_in}
                        style={{ 
                          width: '100%', minHeight: '80px', background: '#0A0B0D', border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '4px', padding: '1rem', color: 'white', fontSize: '0.85rem',
                          fontWeight: '600', outline: 'none', resize: 'none',
                          opacity: !profile?.is_clocked_in ? 0.5 : 1
                        }}
                      />
                      <button 
                        onClick={() => handleSaveNotes(task.id)}
                        disabled={!profile?.is_clocked_in}
                        style={{ 
                          position: 'absolute', bottom: '1rem', right: '1rem', 
                          background: '#E61E2A', color: 'white', border: 'none', 
                          borderRadius: '2px', padding: '0.4rem', cursor: 'pointer',
                          opacity: !profile?.is_clocked_in ? 0.5 : 1
                        }}
                      >
                        <Save size={16} />
                      </button>
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#0A0B0D', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', opacity: !profile?.is_clocked_in ? 0.6 : 1 }}>
                        {task.photo_proof_url ? (
                          <div style={{ position: 'relative' }}>
                            <img src={task.photo_proof_url} style={{ width: '40px', height: '40px', borderRadius: '2px', objectFit: 'cover' }} />
                          </div>
                        ) : (
                          <div style={{ width: '40px', height: '40px', borderRadius: '2px', background: '#15171A', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
                            <Image size={20} />
                          </div>
                        )}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '0.7rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1px' }}>SERVICE EVIDENCE</div>
                          <div style={{ fontSize: '0.6rem', fontWeight: '900', color: '#444', textTransform: 'uppercase' }}>{task.photo_proof_url ? 'EVIDENCE CAPTURED' : 'PENDING UPLOAD'}</div>
                        </div>
                        <label style={{ 
                          cursor: profile?.is_clocked_in ? 'pointer' : 'not-allowed', 
                          padding: '0.5rem', background: '#15171A', borderRadius: '2px', 
                          border: '1px solid rgba(255, 255, 255, 0.05)', opacity: !profile?.is_clocked_in ? 0.5 : 1 
                        }}>
                          <UploadCloud size={16} color="#E61E2A" />
                          <input 
                            type="file" 
                            hidden 
                            accept="image/*" 
                            disabled={!profile?.is_clocked_in}
                            onChange={(e) => handleUploadPhoto(task.id, e.target.files[0])} 
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                  {task.status === 'PENDING' && (
                    <button 
                      onClick={() => handleUpdateStatus(task.id, 'IN_PROGRESS')}
                      disabled={!profile?.is_clocked_in}
                      style={{ 
                        flex: 1, padding: '1rem', background: '#E61E2A', 
                        color: 'white', border: 'none', borderRadius: '4px', 
                        fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                        opacity: !profile?.is_clocked_in ? 0.5 : 1, textTransform: 'uppercase', letterSpacing: '1px'
                      }}
                    >
                      <Play size={18} /> START SERVICE
                    </button>
                  )}
                  {task.status === 'IN_PROGRESS' && (
                    <button 
                      onClick={() => handleUpdateStatus(task.id, 'COMPLETED')}
                      disabled={!profile?.is_clocked_in}
                      style={{ 
                        flex: 1, padding: '1rem', background: '#10b981', 
                        color: 'white', border: 'none', borderRadius: '4px', 
                        fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                        opacity: !profile?.is_clocked_in ? 0.5 : 1, textTransform: 'uppercase', letterSpacing: '1px'
                      }}
                    >
                      <CheckCircle2 size={18} /> MARK COMPLETED
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div style={{ ...cardStyle, textAlign: 'center', padding: '5rem 2rem', borderStyle: 'dashed' }}>
            <ClipboardList size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.2 }} />
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '950' }}>No tasks assigned yet</h3>
            <p style={{ color: '#444', fontSize: '0.85rem', fontWeight: '700', marginTop: '0.5rem' }}>Refresh later to see new assignments from the admin.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffDashboard;
