import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, Clock, CheckCircle2, AlertCircle, 
  Car, User, ArrowRight, Play, Loader2, Image, Save, UploadCloud, TrendingUp, Bell
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { sendStatusEmail } from '../../services/notificationService';
import ConfirmationToast from '../../components/ConfirmationToast';
const StaffDashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ pending: 0, active: 0, completed: 0 });
  const [updatingTask, setUpdatingTask] = useState(null);
  const [localNotes, setLocalNotes] = useState({});

  useEffect(() => {
    fetchAssignedTasks();

    // 📡 REQ-SYS-05: Real-time synchronization
    const channel = supabase
      .channel(`staff-tasks-${profile?.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'bookings',
        filter: `staff_id=eq.${profile?.id}`
      }, () => {
        fetchAssignedTasks();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const fetchAssignedTasks = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(full_name, email, phone_number),
          vehicles:booking_vehicles!booking_vehicles_booking_id_fkey(*, services:booking_vehicle_services(*))
        `)
        .eq('staff_id', profile.id)
        .neq('status', 'cancelled')
        .order('start_datetime', { ascending: true });

      if (error) throw error;

      const allVehicleTasks = (data || []).flatMap(b => 
        b.vehicles.map(v => ({
          ...v,
          customer: b.customer,
          booking_id: b.id,
          booking_status: b.status,
          start_datetime: b.start_datetime
        }))
      ).filter(v => v.status?.toUpperCase() !== 'COMPLETED');

      setTasks(allVehicleTasks);
      const notesObj = {};
      allVehicleTasks.forEach(t => { notesObj[t.id] = t.service_notes || ''; });
      setLocalNotes(notesObj);
      
      const pending = allVehicleTasks.filter(t => t.status?.toUpperCase() === 'PENDING').length;
      const active = allVehicleTasks.filter(t => t.status?.toUpperCase() === 'IN_PROGRESS').length;
      const completed = allVehicleTasks.filter(t => t.status?.toUpperCase() === 'COMPLETED').length;
      setStats({ pending, active, completed });
    } catch (err) {
      console.error('Task Fetch Error:', err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (task, newStatus) => {
    if (task.booking_status?.toLowerCase() === 'completed' || task.booking_status?.toLowerCase() === 'cancelled') {
      return toast.error('Booking is finalized.');
    }
    const toastId = toast.loading(`Updating unit status...`);
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
        toast.success(`Unit marked as ${newStatus.toUpperCase()}`, { id: toastId });
        return fetchAssignedTasks();
      }
      throw new Error('Backend failed');
    } catch (err) {
      // Fallback
      await supabase.from('booking_vehicles').update({ status: newStatus.toUpperCase() }).eq('id', task.id);
      await sendStatusEmail(task.booking_id, newStatus.toUpperCase(), localNotes[task.id]);
      toast.success('Status updated (Syncing...)', { id: toastId });
      fetchAssignedTasks();
    }
  };

  const handleSaveNotes = async (taskId) => {
    const toastId = toast.loading('Saving notes...');
    try {
      const { error } = await supabase.from('booking_vehicles').update({ service_notes: localNotes[taskId] }).eq('id', taskId);
      if (error) throw error;
      toast.success('Notes saved!', { id: toastId });
      fetchAssignedTasks();
    } catch (err) {
      toast.error('Failed to save notes', { id: toastId });
    }
  };

  const handleUploadPhoto = async (taskId, file, currentProofUrl) => {
    if (!file) return;
    const toastId = toast.loading('Uploading evidence...');
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${taskId}-${Date.now()}.${fileExt}`;
      const filePath = `service-proofs/${fileName}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file);
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(filePath);
      
      // Parse existing photos array (supports old string format for backward compat)
      let existingPhotos = [];
      if (currentProofUrl) {
        try {
          const parsed = JSON.parse(currentProofUrl);
          existingPhotos = Array.isArray(parsed) ? parsed : [currentProofUrl];
        } catch {
          existingPhotos = [currentProofUrl]; // legacy single URL string
        }
      }
      const updatedPhotos = [...existingPhotos, publicUrl];
      
      const { error: dbError } = await supabase
        .from('booking_vehicles')
        .update({ photo_proof_url: JSON.stringify(updatedPhotos) })
        .eq('id', taskId);
      if (dbError) throw dbError;
      toast.success(`Evidence uploaded! (${updatedPhotos.length} photo${updatedPhotos.length > 1 ? 's' : ''})`, { id: toastId });
      fetchAssignedTasks();
    } catch (err) {
      toast.error('Upload failed.', { id: toastId });
    }
  };

  const broadcasts = [
    { id: 1, title: 'Real-time Messaging', content: 'This part will be available for capstone 2.', date: 'Upcoming' },
    { id: 2, title: 'Performance Analytics', content: 'This part will be available for capstone 2.', date: 'Upcoming' }
  ];

  if (loading) return <LoadingState message="Synchronizing your daily task hub..." />;

  const badgeStyle = (status) => {
    const s = status?.toUpperCase();
    return {
      fontSize: '0.6rem',
      fontWeight: '950',
      padding: '0.35rem 0.75rem',
      borderRadius: '4px',
      textTransform: 'uppercase',
      border: '1px solid currentColor',
      background: s === 'COMPLETED' ? 'rgba(16, 185, 129, 0.1)' : (s === 'IN_PROGRESS' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255,255,255,0.05)'),
      color: s === 'COMPLETED' ? '#10b981' : (s === 'IN_PROGRESS' ? '#f59e0b' : '#8E9196'),
      letterSpacing: '1px'
    };
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '2rem' }}>
        <PageHeader 
          badge="OPERATIONAL HUB"
          title="Daily Task Queue"
          subtitle={`Ready for duty, ${profile?.full_name?.split(' ')[0]}. Manage your assigned vehicle jobs below.`}
        />
        
        <div style={{ background: '#15171A', padding: '1.25rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1.5px', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <TrendingUp size={14} color="#10b981" /> SHIFT ACTIVITY SNAPSHOT
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '950', color: '#10b981' }}>{stats.completed}</div>
              <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: '950', textTransform: 'uppercase' }}>COMPLETED</div>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.05)' }}></div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '950', color: '#f59e0b' }}>{stats.active + stats.pending}</div>
              <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: '950', textTransform: 'uppercase' }}>OUTSTANDING</div>
            </div>
            <div style={{ width: '1px', height: '30px', background: 'rgba(255,255,255,0.05)' }}></div>
            <div style={{ textAlign: 'center', flex: 1 }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '950', color: 'white' }}>{Math.round((stats.completed / Math.max(1, stats.completed + stats.active + stats.pending)) * 100)}%</div>
              <div style={{ fontSize: '0.55rem', color: '#444', fontWeight: '950', textTransform: 'uppercase' }}>YIELD</div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '2rem', alignItems: 'start' }}>
        <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
            <ClipboardList size={20} color="#E61E2A" />
            <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Pending Job Queue
            </h3>
          </div>

          {tasks.length > 0 ? (
            tasks.map((task) => (
              <div key={task.id} style={{ background: '#15171A', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden', transition: 'all 0.2s', opacity: task.status === 'COMPLETED' ? 0.7 : 1 }}>
                <div style={{ padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)' }}>
                  <div 
                    onClick={() => navigate(`/staff/job/${task.id}`)}
                    style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', cursor: 'pointer' }}
                  >
                    <div style={{ width: '56px', height: '56px', borderRadius: '8px', background: '#0A0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E61E2A', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <Car size={28} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <span style={{ fontSize: '0.6rem', fontWeight: '950', color: '#E61E2A', background: 'rgba(230, 30, 42, 0.1)', padding: '0.2rem 0.5rem', borderRadius: '2px', letterSpacing: '1px' }}>JOB #{task.id.slice(0, 8).toUpperCase()}</span>
                        <span style={{ fontSize: '0.6rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase' }}>• Plate: {task.plate_number || 'N/A'}</span>
                      </div>
                      <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{task.brand} {task.model}</h3>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={badgeStyle(task.status)}>{task.status?.toUpperCase()}</div>
                    <div style={{ fontSize: '0.6rem', color: '#444', fontWeight: '900', marginTop: '0.5rem', textTransform: 'uppercase' }}>
                      Sch: {new Date(task.start_datetime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  <div style={{ background: '#0A0B0D', borderRadius: '6px', padding: '1.25rem', border: '1px solid rgba(255,255,255,0.03)' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: '950', color: '#444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.75rem' }}>Service Breakdown</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem' }}>
                      {task.services?.map((s, idx) => (
                        <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: '#15171A', padding: '0.4rem 0.8rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.05)' }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#E61E2A' }}></div>
                          <span style={{ fontSize: '0.7rem', color: 'white', fontWeight: '800', textTransform: 'uppercase' }}>{s.service_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {task.status?.toUpperCase() !== 'PENDING' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
                      <div style={{ position: 'relative' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: '950', color: '#444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Detailing Observations</div>
                        <textarea 
                          placeholder="Document service steps or vehicle conditions..."
                          value={localNotes[task.id] || ''}
                          onChange={(e) => setLocalNotes({ ...localNotes, [task.id]: e.target.value })}
                          disabled={!profile?.is_clocked_in || task.status?.toUpperCase() === 'COMPLETED'}
                          style={{ width: '100%', minHeight: '100px', background: '#0A0B0D', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', padding: '1rem', color: 'white', fontSize: '0.8rem', fontWeight: '600', outline: 'none', resize: 'none' }}
                        />
                        <button onClick={() => handleSaveNotes(task.id)} disabled={!profile?.is_clocked_in || task.status?.toUpperCase() === 'COMPLETED'} style={{ position: 'absolute', bottom: '0.5rem', right: '0.5rem', background: '#E61E2A', color: 'white', border: 'none', borderRadius: '4px', padding: '0.5rem', cursor: 'pointer' }}>
                          <Save size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ fontSize: '0.6rem', fontWeight: '950', color: '#444', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '0.5rem' }}>Service Evidence</div>
                        {(() => {
                          // Parse photo array (supports legacy string URL)
                          let photos = [];
                          if (task.photo_proof_url) {
                            try { photos = JSON.parse(task.photo_proof_url); if (!Array.isArray(photos)) photos = [task.photo_proof_url]; }
                            catch { photos = [task.photo_proof_url]; }
                          }
                          return (
                            <div style={{ flex: 1, background: '#0A0B0D', border: '1px dashed rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem', minHeight: '100px' }}>
                              {photos.length > 0 ? (
                                <>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '4px' }}>
                                    {photos.map((url, i) => (
                                      <img key={i} src={url} alt={`Evidence ${i + 1}`} style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.1)' }} />
                                    ))}
                                  </div>
                                  <div style={{ fontSize: '0.55rem', color: '#10b981', fontWeight: '950', textAlign: 'center' }}>{photos.length} PHOTO{photos.length > 1 ? 'S' : ''} CAPTURED</div>
                                </>
                              ) : (
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                  <UploadCloud size={20} color="#444" />
                                  <span style={{ fontSize: '0.6rem', fontWeight: '950', color: '#444' }}>NO PHOTOS YET</span>
                                </div>
                              )}
                              {/* Always show upload input when clocked in and not completed */}
                              {profile?.is_clocked_in && task.status?.toUpperCase() !== 'COMPLETED' && (
                                <label htmlFor={`upload-${task.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', padding: '0.4rem', background: 'rgba(230,30,42,0.1)', border: '1px solid rgba(230,30,42,0.2)', borderRadius: '4px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: '950', color: '#E61E2A' }}>
                                  <UploadCloud size={12} /> ADD PHOTO
                                </label>
                              )}
                              <input type="file" hidden id={`upload-${task.id}`} accept="image/*" disabled={!profile?.is_clocked_in || task.status?.toUpperCase() === 'COMPLETED'} onChange={(e) => handleUploadPhoto(task.id, e.target.files[0], task.photo_proof_url)} />
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem' }}>
                    {task.status?.toUpperCase() === 'PENDING' && (
                      <button onClick={() => handleUpdateStatus(task, 'IN_PROGRESS')} disabled={!profile?.is_clocked_in} style={{ flex: 1, padding: '1rem', background: '#E61E2A', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}>
                        <Play size={18} /> START SERVICE
                      </button>
                    )}
                    {task.status?.toUpperCase() === 'IN_PROGRESS' && (
                      <button 
                        onClick={() => {
                          toast.custom((t) => (
                            <ConfirmationToast
                              t={t}
                              title="Finalize Service?"
                              message={`Confirming completion for ${task.brand} ${task.model}. This will notify the customer and prepare the final invoice.`}
                              icon={CheckCircle2}
                              confirmLabel="Finish Job"
                              variant="brand"
                              centered={true}
                              onConfirm={() => {
                                toast.dismiss(t.id);
                                handleUpdateStatus(task, 'COMPLETED');
                              }}
                              onCancel={() => toast.dismiss(t.id)}
                            />
                          ), { duration: Infinity });
                        }} 
                        disabled={!profile?.is_clocked_in} 
                        style={{ flex: 1, padding: '1rem', background: '#10b981', color: 'white', border: 'none', borderRadius: '4px', fontWeight: '950', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', textTransform: 'uppercase', letterSpacing: '1px' }}
                      >
                        <CheckCircle2 size={18} /> MARK AS FINISHED
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div style={{ background: '#15171A', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', textAlign: 'center', padding: '5rem 2rem' }}>
              <ClipboardList size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '950', color: '#444' }}>No tasks assigned yet</h3>
              <p style={{ color: '#333', fontSize: '0.75rem', fontWeight: '700', marginTop: '0.5rem' }}>Your daily queue is empty. Refresh later for new assignments.</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', position: 'sticky', top: '100px' }}>
          <div style={{ background: '#E61E2A', borderRadius: '8px', padding: '1.5rem', color: 'white', boxShadow: '0 10px 20px rgba(230, 30, 42, 0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <User size={24} />
              </div>
              <div style={{ fontSize: '0.6rem', fontWeight: '950', background: 'rgba(0,0,0,0.2)', padding: '0.2rem 0.5rem', borderRadius: '2px', letterSpacing: '1px' }}>OFFICIAL STAFF ID</div>
            </div>
            <div>
              <div style={{ fontSize: '1.2rem', fontWeight: '950', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{profile?.full_name}</div>
              <div style={{ fontSize: '0.65rem', fontWeight: '800', opacity: 0.8, textTransform: 'uppercase', letterSpacing: '1px' }}>ID: SW-{profile?.id?.slice(0, 8).toUpperCase()}</div>
            </div>
          </div>

          <div style={{ background: '#15171A', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <Bell size={18} color="#E61E2A" />
              <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '950', color: 'white', textTransform: 'uppercase', letterSpacing: '1px' }}>System Broadcasts</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {broadcasts.map(b => (
                <div key={b.id} style={{ padding: '1.25rem', borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '900', color: 'white' }}>{b.title}</div>
                    <div style={{ fontSize: '0.55rem', fontWeight: '900', color: '#444' }}>{b.date}</div>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#8E9196', fontWeight: '600', lineHeight: 1.4 }}>{b.content}</div>
                </div>
              ))}
            </div>
          </div>

          {!profile?.is_clocked_in && (
            <div style={{ padding: '1.25rem', background: 'rgba(230, 30, 42, 0.05)', border: '1px solid rgba(230, 30, 42, 0.1)', borderRadius: '8px', textAlign: 'center' }}>
              <Clock size={24} color="#E61E2A" style={{ margin: '0 auto 0.75rem' }} />
              <div style={{ fontSize: '0.7rem', fontWeight: '950', color: '#E61E2A', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Attendance Missing</div>
              <div style={{ fontSize: '0.65rem', color: '#8E9196', fontWeight: '700' }}>Clock in from the sidebar to enable service controls.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
