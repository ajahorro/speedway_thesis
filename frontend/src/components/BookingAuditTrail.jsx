import React from 'react';
import { Clock, CheckCircle2, User, CreditCard, AlertCircle } from 'lucide-react';

const BookingAuditTrail = ({ logs = [] }) => {
  const formatLabel = (str) => {
    if (!str) return 'System Event';
    return str.split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const getEventConfig = (type) => {
    const t = (type || '').toUpperCase();
    if (t.includes('PAYMENT') || t.includes('REFUND') || t.includes('VERIFIED')) {
      return { color: '#10b981', icon: <CreditCard size={14} /> };
    }
    if (t.includes('STAFF') || t.includes('ASSIGN')) {
      return { color: '#3b82f6', icon: <User size={14} /> };
    }
    if (t.includes('COMPLETED') || t.includes('SUCCESS')) {
      return { color: '#10b981', icon: <CheckCircle2 size={14} /> };
    }
    return { color: 'var(--admin-text-secondary)', icon: <Clock size={14} /> };
  };

  const formatAuditDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    }) + ' • ' + d.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div style={{ position: 'relative', paddingLeft: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Timeline Connector Line */}
      <div style={{ 
        position: 'absolute', 
        left: '0.45rem', 
        top: '1rem', 
        bottom: '1rem', 
        width: '2px', 
        background: 'var(--admin-border)',
        opacity: 0.5 
      }}></div>

      {logs.map((log, i) => {
        const config = getEventConfig(log.event_type);
        const isRecent = i === 0;

        return (
          <div key={i} style={{ position: 'relative' }}>
            {/* Timeline Node */}
            <div style={{ 
              position: 'absolute', 
              left: '-1.45rem', 
              top: '0.25rem', 
              width: '10px', 
              height: '10px', 
              borderRadius: '50%', 
              background: config.color,
              border: '2px solid var(--admin-bg)',
              zIndex: 2
            }}></div>

            <div style={{ 
              padding: '1.25rem', 
              background: isRecent ? 'rgba(255,255,255,0.02)' : 'var(--admin-card)', 
              border: `1px solid ${isRecent ? 'var(--admin-brand)' : 'var(--admin-border)'}`, 
              borderRadius: 'var(--admin-radius-sm)',
              boxShadow: isRecent ? '0 4px 20px rgba(0,0,0,0.2)' : 'none'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ color: config.color }}>{config.icon}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: '950', color: '#fff' }}>{formatLabel(log.event_type)}</span>
                  {isRecent && (
                    <span style={{ 
                      fontSize: '0.5rem', 
                      fontWeight: '950', 
                      background: 'var(--admin-brand)', 
                      color: 'white', 
                      padding: '0.1rem 0.4rem', 
                      borderRadius: '2px',
                      letterSpacing: '0.5px'
                    }}>RECENT</span>
                  )}
                </div>
                <span style={{ fontSize: '0.65rem', color: 'var(--admin-text-secondary)', fontWeight: '800' }}>
                  {formatAuditDate(log.created_at)}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--admin-text-secondary)', fontWeight: '600', lineHeight: 1.5 }}>
                {log.metadata?.details || log.details || 'System event recorded.'}
              </p>
            </div>
          </div>
        );
      })}
      
      {logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '2rem', background: 'var(--admin-bg)', borderRadius: 'var(--admin-radius)', border: '1px dashed var(--admin-border)', opacity: 0.5 }}>
          <AlertCircle size={24} style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontSize: '0.8rem', fontWeight: '800' }}>No activity logs synchronized.</div>
        </div>
      )}
    </div>
  );
};

export default BookingAuditTrail;
