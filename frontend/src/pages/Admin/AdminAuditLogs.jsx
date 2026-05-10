import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockAuditLogs } from './AdminMockData';
import PageHeader from '../../components/PageHeader';
import { 
  Search, 
  Filter, 
  Calendar, 
  Database, 
  ArrowRight, 
  RefreshCcw, 
  X,
  ChevronRight,
  User,
  Clock,
  ExternalLink,
  ShieldCheck,
  AlertCircle
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
    setTimeout(() => {
      try {
        setLogs(mockAuditLogs.map(l => ({
            ...l,
            event_type: l.action_type,
            profiles: { full_name: 'Admin User', role: 'SUPER_ADMIN' },
            created_at: l.created_at
        })));
      } catch (err) {
        logger.error('Error fetching audit logs', err);
        toast.error('Failed to load audit trail');
      } finally {
        setLoading(false);
      }
    }, 500);
  };

  const getEventIcon = (type) => {
    if (type.includes('CREATE')) return <Calendar size={18} />;
    if (type.includes('DELETE') || type.includes('CANCEL')) return <AlertCircle size={18} />;
    return <Database size={18} />;
  };

  const getBadgeColor = (type) => {
    const t = type.toUpperCase();
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
    return log.metadata?.description || `${log.event_type} event triggered`;
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.event_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesFilter = filterType === 'All' || log.event_type.includes(filterType);
    
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
            flexWrap: 'wrap', 
            boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
          }}>
        <div style={{ position: 'relative', flex: 1, minWidth: isMobile ? '100%' : '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
          <input 
            type="text" 
            placeholder="Search action or performer..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 1rem 0.75rem 2.75rem', 
              background: 'var(--admin-input-bg)', 
              border: '1px solid var(--admin-input-border)', 
              borderRadius: 'var(--admin-radius-sm)', 
              color: 'var(--admin-text-primary)', 
              fontSize: '0.85rem',
              outline: 'none',
              fontWeight: '600'
            }}
          />
        </div>
        <div style={{ position: 'relative', width: isMobile ? '100%' : '180px' }}>
          <Filter size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--admin-text-secondary)' }} />
          <select 
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '0.75rem 1rem 0.75rem 2.75rem', 
              background: 'var(--admin-input-bg)', 
              border: '1px solid var(--admin-input-border)', 
              borderRadius: 'var(--admin-radius-sm)', 
              color: 'var(--admin-text-primary)', 
              fontSize: '0.85rem',
              outline: 'none',
              appearance: 'none',
              fontWeight: '600'
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
                  display: 'flex',
                  gap: isMobile ? '0.75rem' : '1.5rem',
                  alignItems: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: 'var(--admin-text-primary)'
                }}
              >
                <div style={{ 
                  width: isMobile ? '36px' : '44px', 
                  height: isMobile ? '36px' : '44px', 
                  background: 'var(--admin-bg)', 
                  borderRadius: 'var(--admin-radius-sm)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  color: 'var(--admin-brand)',
                  border: '1px solid var(--admin-border)',
                  flexShrink: 0
                }}>
                  {getEventIcon(log.event_type)}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                    <span style={{ 
                      padding: '0.2rem 0.5rem', 
                      background: badge.bg, 
                      color: badge.text, 
                      borderRadius: 'var(--admin-radius-sm)', 
                      fontSize: '0.6rem', 
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      whiteSpace: 'nowrap'
                    }}>
                      {log.event_type.replace(/_/g, ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--admin-text-secondary)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      by <span style={{ fontWeight: '800', color: 'var(--admin-text-primary)' }}>{log.profiles?.full_name?.split(' ')[0] || 'System'}</span>
                    </span>
                  </div>
                  <p style={{ margin: 0, fontSize: isMobile ? '0.85rem' : '0.95rem', fontWeight: '500', color: 'var(--admin-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {formatDescription(log)}
                  </p>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', alignItems: 'center', gap: isMobile ? '0.5rem' : '1.5rem', flexShrink: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>
                      {new Date(log.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                    <span style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '600' }}>
                      {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {!isMobile && <ChevronRight size={18} color="var(--admin-text-secondary)" style={{ opacity: 0.5 }} />}
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem 1rem', background: 'var(--admin-card)', borderRadius: 'var(--admin-radius)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-secondary)' }}>
            <Database size={40} strokeWidth={1} style={{ marginBottom: '1rem', opacity: 0.3 }} />
            <p style={{ fontWeight: '700', fontSize: '0.9rem' }}>No logs found</p>
          </div>
        )}
      </div>

      {isModalOpen && selectedLog && (
        <div style={{ 
          position: 'fixed', 
          inset: 0, 
          background: 'rgba(15, 23, 42, 0.65)', 
          backdropFilter: 'blur(4px)', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          zIndex: 10000,
          padding: '1.5rem'
        }}>
          <div style={{ 
            width: '100%', 
            maxWidth: '600px', 
            background: 'var(--admin-card)', 
            borderRadius: 'var(--admin-radius)', 
            border: '1px solid var(--admin-border)', 
            overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'modalFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid var(--admin-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--admin-bg)' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '800', color: 'var(--admin-text-primary)' }}>Activity Detail</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--admin-text-secondary)', background: 'transparent', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            </div>

            <div style={{ padding: '2rem' }}>
              <div style={{ 
                background: 'var(--admin-bg)', 
                borderRadius: 'var(--admin-radius)', 
                padding: '1.5rem',
                display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
                gap: '1.5rem 2rem',
                marginBottom: '2rem',
                border: '1px solid var(--admin-border)'
              }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>Action</label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '800', color: 'var(--admin-brand)' }}>{selectedLog.event_type.replace(/_/g, ' ')}</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>Entity</label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--admin-text-primary)' }}>Booking (#{selectedLog.booking_id?.slice(0, 8)})</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>Performer</label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--admin-text-primary)' }}>{selectedLog.profiles?.full_name} ({selectedLog.profiles?.role})</span>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '0.4rem', letterSpacing: '0.5px' }}>Time</label>
                  <span style={{ fontSize: '0.95rem', fontWeight: '700', color: 'var(--admin-text-primary)' }}>{new Date(selectedLog.created_at).toLocaleString()}</span>
                </div>
              </div>

              <div style={{ marginBottom: '2.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', marginBottom: '1rem', letterSpacing: '0.5px' }}>Full Description</label>
                <p style={{ margin: 0, fontSize: '1.05rem', fontWeight: '600', color: 'var(--admin-text-primary)', lineHeight: '1.6' }}>
                  {formatDescription(selectedLog)}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedLog.booking_id && (
                  <button 
                    onClick={() => {
                        setIsModalOpen(false);
                        navigate(`/admin/bookings/${selectedLog.booking_id}`);
                    }}
                    style={{ 
                        width: '100%', 
                        padding: '1.15rem', 
                        borderRadius: 'var(--admin-radius-sm)', 
                        background: 'var(--admin-brand)', 
                        color: '#FFFFFF', 
                        border: 'none', 
                        fontWeight: '950', 
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.75rem',
                        transition: 'all 0.2s ease',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        fontSize: '0.75rem'
                    }}
                  >
                    VIEW BOOKING DETAILS <ExternalLink size={16} />
                  </button>
                )}
                <button 
                  onClick={() => setIsModalOpen(false)}
                  style={{ 
                    width: '100%', 
                    padding: '1.15rem', 
                    borderRadius: 'var(--admin-radius-sm)', 
                    border: '1px solid var(--admin-border)', 
                    color: 'var(--admin-text-primary)', 
                    background: 'var(--admin-bg)', 
                    fontWeight: '950', 
                    cursor: 'pointer', 
                    transition: 'all 0.2s ease', 
                    textTransform: 'uppercase', 
                    letterSpacing: '1.5px',
                    fontSize: '0.75rem'
                  }}
                >
                  Close Detail
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AdminAuditLogs;
