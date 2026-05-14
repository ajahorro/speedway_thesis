import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { History, Car, Calendar, CheckCircle2, Search, FileText } from 'lucide-react';
import PageHeader from '../../components/PageHeader';
import LoadingState from '../../components/LoadingState';
import toast from 'react-hot-toast';

const StaffWorkHistory = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchHistory();
  }, [profile?.id]);

  const fetchHistory = async () => {
    if (!profile?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('booking_vehicles')
        .select(`
          *,
          booking:bookings!inner(staff_id, status, updated_at, total_amount),
          services:booking_vehicle_services(*)
        `)
        .eq('booking.staff_id', profile.id)
        .in('status', ['COMPLETED', 'CANCELLED'])
        .order('id', { ascending: false });

      if (error) throw error;

      const historyUnits = (data || []).map(v => ({
        ...v,
        booking_status: v.status.toLowerCase(),
        finalized_at: v.booking.updated_at,
        total_amount: v.booking.total_amount
      }));

      setHistory(historyUnits);
    } catch (err) {
      console.error('History Fetch Error:', err);
      toast.error('Failed to load work history');
    } finally {
      setLoading(false);
    }
  };

  const filteredHistory = history.filter(item => 
    item.plate_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.model?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <LoadingState message="Retrieving your service records..." />;

  const tableHeaderStyle = {
    padding: '1rem 1.5rem',
    fontSize: '0.65rem',
    fontWeight: '950',
    color: '#8E9196',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
    textAlign: 'left'
  };

  const tableRowStyle = {
    padding: '1.25rem 1.5rem',
    fontSize: '0.85rem',
    fontWeight: '700',
    color: 'white',
    borderBottom: '1px solid rgba(255, 255, 255, 0.02)',
    verticalAlign: 'middle'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
      <PageHeader 
        badge="AUDIT & ARCHIVE"
        title="Work History"
        subtitle="Review your completed detailing jobs and historical service performance."
      />

      <div style={{ background: '#15171A', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '8px', overflow: 'hidden' }}>
        {/* Search Bar & Stats */}
        <div style={{ 
          padding: '1.5rem', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          justifyContent: 'space-between', 
          alignItems: isMobile ? 'flex-start' : 'center',
          gap: '1.25rem'
        }}>
          <div style={{ position: 'relative', width: isMobile ? '100%' : '300px' }}>
            <Search size={16} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: '#444' }} />
            <input 
              type="text" 
              placeholder="Search by Plate or Model..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '100%', background: '#0A0B0D', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', padding: '0.75rem 1rem 0.75rem 2.5rem', color: 'white', fontSize: '0.85rem', outline: 'none' }}
            />
          </div>
          <div style={{ fontSize: '0.65rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Total Records: {filteredHistory.length}
          </div>
        </div>

        {isMobile ? (
          /* 📱 Card Layout for Mobile */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filteredHistory.length > 0 ? (
              filteredHistory.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => navigate(`/staff/job/${item.id}`)}
                  style={{ 
                    padding: '1.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', 
                    display: 'flex', flexDirection: 'column', gap: '1rem', cursor: 'pointer',
                    background: 'rgba(255,255,255,0.01)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '4px', background: '#0A0B0D', border: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E61E2A' }}>
                        <Car size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '1rem', fontWeight: '950', textTransform: 'uppercase' }}>{item.brand} {item.model}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem' }}>
                          <span style={{ background: '#E61E2A', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '2px', fontSize: '0.65rem', fontWeight: '950' }}>
                            {item.plate_number}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: '#8E9196', fontWeight: '700' }}>
                            {new Date(item.finalized_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} | {new Date(item.finalized_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div style={{ 
                      fontSize: '0.55rem', fontWeight: '950', padding: '0.2rem 0.5rem', 
                      borderRadius: '2px', background: item.booking_status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                      color: item.booking_status === 'completed' ? '#10b981' : '#ef4444', border: '1px solid currentColor', textTransform: 'uppercase'
                    }}>
                      {item.booking_status}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                    {item.services?.slice(0, 3).map((s, i) => (
                      <span key={i} style={{ fontSize: '0.6rem', color: '#8E9196', background: 'rgba(255,255,255,0.03)', padding: '0.2rem 0.5rem', borderRadius: '2px' }}>{s.service_name}</span>
                    ))}
                    {item.services?.length > 3 && <span style={{ fontSize: '0.6rem', color: '#444' }}>+{item.services.length - 3} more</span>}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '5rem', textAlign: 'center' }}>
                <History size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
                <div style={{ fontSize: '0.9rem', color: '#444', fontWeight: '950', textTransform: 'uppercase' }}>No history records</div>
              </div>
            )}
          </div>
        ) : (
          /* 🖥️ Table Layout for Desktop */
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(255,255,255,0.01)' }}>
                <th style={tableHeaderStyle}>Vehicle Unit</th>
                <th style={tableHeaderStyle}>Plate</th>
                <th style={tableHeaderStyle}>Service Period</th>
                <th style={tableHeaderStyle}>Final Status</th>
                <th style={tableHeaderStyle}>Proof</th>
              </tr>
            </thead>
            <tbody>
              {filteredHistory.length > 0 ? (
                filteredHistory.map((item) => (
                  <tr 
                    key={item.id} 
                    className="admin-card-hover" 
                    style={{ transition: 'all 0.2s', cursor: 'pointer' }}
                    onClick={() => navigate(`/staff/job/${item.id}`)}
                  >
                    <td style={tableRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: '#0A0B0D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E61E2A' }}>
                          <Car size={18} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.9rem', textTransform: 'uppercase' }}>{item.brand} {item.model}</div>
                          <div style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase' }}>Unit ID: {item.id.slice(0, 8)}</div>
                        </div>
                      </div>
                    </td>
                    <td style={tableRowStyle}>
                      <span style={{ background: '#0A0B0D', padding: '0.25rem 0.5rem', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.05)', color: '#8E9196' }}>
                        {item.plate_number}
                      </span>
                    </td>
                    <td style={tableRowStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Calendar size={14} color="#444" />
                        <div style={{ fontSize: '0.75rem' }}>{new Date(item.finalized_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</div>
                      </div>
                    </td>
                    <td style={tableRowStyle}>
                      <div style={{ 
                        display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                        fontSize: '0.6rem', fontWeight: '950', padding: '0.3rem 0.6rem',
                        borderRadius: '2px', border: '1px solid currentColor',
                        color: item.booking_status === 'completed' ? '#10b981' : '#ef4444',
                        background: item.booking_status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                        textTransform: 'uppercase'
                      }}>
                        {item.booking_status === 'completed' ? <CheckCircle2 size={12} /> : null}
                        {item.booking_status}
                      </div>
                    </td>
                    <td style={tableRowStyle}>
                      {item.photo_proof_url ? (
                        <a href={item.photo_proof_url} target="_blank" rel="noreferrer" style={{ color: '#E61E2A', fontSize: '0.75rem', textDecoration: 'underline' }}>
                          View Image
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: '#444' }}>No Proof</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ padding: '5rem', textAlign: 'center' }}>
                    <History size={48} style={{ margin: '0 auto 1.5rem', opacity: 0.1 }} />
                    <div style={{ fontSize: '0.9rem', color: '#444', fontWeight: '950', textTransform: 'uppercase' }}>No history records found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default StaffWorkHistory;
