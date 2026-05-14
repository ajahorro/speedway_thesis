import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { 
  Car, Clock, CheckCircle2, ChevronLeft, 
  Calendar, MapPin, Wrench, ShieldCheck, Info
} from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import toast from 'react-hot-toast';

const StaffJobDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchJobDetails();
  }, [id]);

  const fetchJobDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('booking_vehicles')
        .select(`
          *,
          booking:bookings(id, start_datetime, end_datetime, status, staff_id),
          services:booking_vehicle_services(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      setUnit(data);
    } catch (err) {
      console.error('Job Details Error:', err);
      toast.error('Failed to load job details');
      navigate('/staff/history');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingState message="Retrieving service logs..." />;
  if (!unit) return null;

  const cardStyle = {
    background: '#15171A',
    border: '1px solid rgba(255, 255, 255, 0.05)',
    borderRadius: '8px',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem'
  };

  const labelStyle = {
    fontSize: '0.65rem',
    fontWeight: '950',
    color: '#8E9196',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    marginBottom: '0.5rem'
  };

  const dataStyle = {
    fontSize: '1rem',
    fontWeight: '700',
    color: 'white'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      <button 
        onClick={() => navigate(-1)}
        style={{ 
          display: 'flex', alignItems: 'center', gap: '0.5rem', 
          background: 'none', border: 'none', color: '#8E9196', 
          fontSize: '0.75rem', fontWeight: '950', cursor: 'pointer',
          textTransform: 'uppercase', letterSpacing: '1px', alignSelf: 'flex-start'
        }}
      >
        <ChevronLeft size={16} /> Return to Queue
      </button>

      <PageHeader 
        badge={`UNIT ID: ${unit.id.slice(0, 8).toUpperCase()}`}
        title="Service Verification"
        subtitle="Reviewing technical specifications and operational timestamps for this unit."
      />

      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: '2rem' }}>
        
        <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Vehicle Specifications */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <Car size={20} color="#E61E2A" />
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase' }}>Vehicle Specifications</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
              <div>
                <div style={labelStyle}>Brand & Model</div>
                <div style={dataStyle}>{unit.brand} {unit.model}</div>
              </div>
              <div>
                <div style={labelStyle}>Plate Number</div>
                <div style={{ ...dataStyle, color: '#E61E2A' }}>{unit.plate_number}</div>
              </div>
              <div>
                <div style={labelStyle}>Vehicle Type</div>
                <div style={dataStyle}>{unit.vehicle_type || 'STANDARD'}</div>
              </div>
              <div>
                <div style={labelStyle}>Fleet Category</div>
                <div style={dataStyle}>{unit.is_fleet ? 'COMMERCIAL FLEET' : 'PRIVATE PASSENGER'}</div>
              </div>
            </div>
          </section>

          {/* Service Package */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <ShieldCheck size={20} color="#10b981" />
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase' }}>Assigned Detailing Services</h3>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
              {unit.services?.map((s, i) => (
                <div key={i} style={{ flex: '1 1 200px', background: '#0A0B0D', padding: '1rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '900', color: 'white' }}>{s.service_name}</div>
                  <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: '700', marginTop: '0.25rem' }}>PROFESSIONAL GRADE</div>
                </div>
              ))}
            </div>
            {unit.service_notes && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', borderLeft: '3px solid #E61E2A' }}>
                <div style={labelStyle}>Technical Observations</div>
                <div style={{ fontSize: '0.85rem', color: '#8E9196', lineHeight: 1.5 }}>{unit.service_notes}</div>
              </div>
            )}
          </section>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {/* Operational Timestamps */}
          <section style={cardStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '1rem' }}>
              <Clock size={20} color="#f59e0b" />
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: '950', textTransform: 'uppercase' }}>Operational Timestamps</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              <div>
                <div style={labelStyle}>Scheduled Start</div>
                <div style={{ ...dataStyle, fontSize: '0.9rem' }}>
                  {new Date(unit.booking?.start_datetime).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Service Commencement</div>
                <div style={{ ...dataStyle, fontSize: '0.9rem', color: unit.started_at ? '#10b981' : '#444' }}>
                  {unit.started_at ? new Date(unit.started_at).toLocaleString('en-US', { timeStyle: 'medium' }) : 'NOT RECORDED'}
                </div>
              </div>
              <div>
                <div style={labelStyle}>Final Completion</div>
                <div style={{ ...dataStyle, fontSize: '0.9rem', color: unit.completed_at ? '#10b981' : '#444' }}>
                  {unit.completed_at ? new Date(unit.completed_at).toLocaleString('en-US', { timeStyle: 'medium' }) : 'NOT RECORDED'}
                </div>
              </div>
            </div>
          </section>

          {/* Evidence Preview */}
          <section style={cardStyle}>
            <div style={labelStyle}>Quality Assurance Proof</div>
            {unit.photo_proof_url ? (
              <div style={{ borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.05)' }}>
                <img src={unit.photo_proof_url} alt="Service Proof" style={{ width: '100%', display: 'block' }} />
              </div>
            ) : (
              <div style={{ height: '150px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#0A0B0D', borderRadius: '4px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <Info size={24} color="#333" />
                <div style={{ fontSize: '0.65rem', color: '#444', fontWeight: '950' }}>NO IMAGE UPLOADED</div>
              </div>
            )}
          </section>
        </div>

      </div>
    </div>
  );
};

export default StaffJobDetails;
