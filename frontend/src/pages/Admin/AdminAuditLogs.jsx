import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import PageHeader from '../../components/PageHeader';
import { 
  Search, Filter, Calendar, Database, ArrowRight, 
  RefreshCcw, X, ChevronRight, User, Clock, 
  ExternalLink, ShieldCheck, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { logger } from '../../utils/logger';

const AdminAuditLogs = () => {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [selectedLog, setSelectedLog] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      logger.admin('Fetching live system audit trail...');
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          profiles:profiles!audit_logs_actor_id_fkey(full_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      
      const processed = (data || []).map(l => ({
        ...l,
        event_type: l.action_type,
        profiles: l.profiles || { full_name: l.actor_name || 'System', role: l.actor_role || 'SYSTEM' }
      }));

      setLogs(processed);
      logger.admin('Audit trail synchronized.');
    } catch (err) {
      logger.error('Audit Fetch Error', err);
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (type) => {
    if (type.includes('CREATE')) return <Calendar size={18} />;
    if (type.includes('DELETE') || type.includes('CANCEL')) return <AlertCircle size={18} />;
    return <Database size={18} />;
  };

  const getBadgeColor = (type) => {
    const t = (type || '').toUpperCase();
    if (t.includes('CREATE')) return { bg: 'rgba(16, 185, 129, 0.1)', text: '#10b981' };
    if (t.includes('STAFF_ASSIGNED')) return { bg: 'var(--admin-brand-light)', text: 'var(--admin-brand)' };
    if (t.includes('CANCEL') || t.includes('DELETE')) return { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' };
    if (t.includes('UPDATE')) return { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' };
    return { bg: 'var(--admin-bg)', text: 'var(--admin-text-secondary)' };
  };

  const formatDescription = (log) => {
    if (log.event_type === 'ASSIGN_STAFF') {
        const bookingNum = log.booking_id ? `#${log.booking_id.slice(0, 4)}` : 'N/A';
        return `Staff assignment updated for booking ${bookingNum}`;
    }
    if (log.event_type === 'CREATE_BOOKING') {
        const bookingNum = log.booking_id ? `#${log.booking_id.slice(0, 4)}` : 'N/A';
        return `New booking ${bookingNum} created by customer`;
    }
    return log.details || log.metadata?.description || `${log.event_type} event triggered`;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.event_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === 'All' || (log.event_type && log.event_type.includes(filterType));
    
    return matchesSearch && matchesFilter;
  });

  const handleOpenDetail = (log) => {
    setSelectedLog(log);
    setIsModalOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <PageHeader 
        showBack
        onBack={() => navigate(-1)}
        badge="SYSTEM SECURITY"
        title="System Audit Trail"
        subtitle="Track all administrative actions and system changes"
        onRefresh={fetchLogs}
      />

      <div style={{ 
            background: 'var(--admin-input-bg)', 
            borderRadius: 'var(--admin-radius)', 
            border: '1px solid var(--admin-border)', 
            padding: '0.75rem', 
            display: 'flex', 
            gap: '0.75rem', 
            flexWrap: 'wrap'
          }}>
        <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Search action or performer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', 
              background: 'var(--admin-input-bg)', border: '1px solid var(--admin-input-border)', 
              borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', 
              fontSize: '0.85rem', outline: 'none', fontWeight: '600'
            }}
          />
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : '180px' }}>
          <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ 
              width: '100%', padding: '0.75rem 1rem 0.75rem 2.75rem', 
              background: 'var(--admin-input-bg)', border: '1px solid var(--admin-input-border)', 
              borderRadius: 'var(--admin-radius-sm)', color: 'var(--admin-text-primary)', 
              fontSize: '0.85rem', outline: 'none', appearance: 'none', fontWeight: '600'
            }}
          >
            <option value="All">All Entities</option>
            <option value="CREATE">Creation</option>
            <option value="ASSIGN">Assignments</option>
            <option value="CANCEL">Cancellations</option>
            <option value="UPDATE">Updates</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {loading ? (
          [1,2,3,4,5].map(i => (
            <div key={i} style={{ height: '80px', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)' }} className="animate-pulse"></div>
          ))
        ) : filteredLogs.length > 0 ? (
          filteredLogs.map((log) => {
            const badge = getBadgeColor(log.event_type);
            return (
              <div 
                key={log.id}
                onClick={() => handleOpenDetail(log)}
                style={{ 
                  background: 'var(--admin-card)', 
                  border: '1px solid var(--admin-border)', 
                  borderRadius: 'var(--admin-radius)', 
                  padding: isMobile ? '1rem' : '1.25rem 1.5rem',
                  display: 'flex', gap: isMobile ? '0.75rem' : '1.5rem',
                  alignItems: 'center', cursor: 'pointer', color: 'var(--admin-text-primary)'
                }}
              >
                <div style={{ 
                  width: isMobile ? '36px' : '44px', height: isMobile ? '36px' : '44px', 
                  background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius-sm)', 
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--admin-brand)', border: '1px solid var(--admin-border)'
                }}>
                  {getEventIcon(log.event_type || '')}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', background: badge.bg, color: badge.text, 
                      borderRadius: 'var(--admin-radius-sm)', fontSize: '0.6rem', 
                      fontWeight: '800', textTransform: 'uppercase'
                    }}>
                      {(log.event_type || '').replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>
                      by <span style={{ fontWeight: '800', color: 'var(--admin-text-primary)' }}>{log.profiles?.full_name?.split(' ')[0] || 'System'}</span>
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: isMobile ? '0.85rem' : '0.95rem', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatDescription(log)}
                  </p>
                </div>

                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: '800' }}>{new Date(log.created_at).toLocaleDateString()}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)' }}>{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
            <Database size={40} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>No logs found</p>
          </div>
        )}
      </div>

      {isModalOpen && selectedLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10000, padding: '1.5rem' }}>
          <div style={{ width: '100%', maxWidth: '600px', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--admin-bg)' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800' }}>Activity Detail</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--admin-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius)', padding: '1.5rem', display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: '1.5rem', border: '1px solid var(--admin-border)', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Action</label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--admin-brand)' }}>{(selectedLog.event_type || '').replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Performer</label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '700' }}>{selectedLog.profiles?.full_name} ({selectedLog.profiles?.role})</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Time</label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '700' }}>{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
              </div>
              <div style={{ marginBottom: '2rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>Description</label>
                <p style={{ margin: 0, fontSize: '1rem', fontWeight: '600' }}>{formatDescription(selectedLog)}</p>
              </div>
              {selectedLog.booking_id && (
                <button 
                  onClick={() => navigate(`/admin/bookings/${selectedLog.booking_id}`)}
                  style={{ width: '100%', padding: '1rem', background: 'var(--admin-brand)', border: 'none', color: 'white', fontWeight: '900', borderRadius: 'var(--admin-radius-sm)', cursor: 'pointer', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                >
                  <ExternalLink size={18} /> VIEW BOOKING DETAILS
                </button>
              )}
              <button onClick={() => setIsModalOpen(false)} style={{ width: '100%', padding: '1rem', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'white', fontWeight: '900', borderRadius: 'var(--admin-radius-sm)', cursor: 'pointer' }}>CLOSE DETAIL</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAuditLogs;
