import React from 'react';

const SegmentedTimePicker = ({ value, onChange }) => {
  // Parse initial 24h value (e.g., "19:30")
  const [h24, m24] = (value || "08:00").split(':').map(Number);
  
  const hour12 = h24 % 12 || 12;
  const minute = m24;
  const ampm = h24 >= 12 ? 'PM' : 'AM';

  const updateTime = (newH12, newM, newAmpm) => {
    let finalH24 = newH12 % 12;
    if (newAmpm === 'PM') finalH24 += 12;
    const finalTime = `${finalH24.toString().padStart(2, '0')}:${newM.toString().padStart(2, '0')}:00`;
    onChange(finalTime);
  };

  const segmentStyle = {
    padding: '0.5rem 1rem',
    background: 'var(--admin-bg)',
    border: '1px solid var(--admin-border)',
    borderRadius: '4px',
    color: 'white',
    fontSize: '1rem',
    fontWeight: '950',
    cursor: 'pointer',
    textAlign: 'center',
    minWidth: '60px'
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <select 
        value={hour12} 
        onChange={(e) => updateTime(Number(e.target.value), minute, ampm)}
        style={segmentStyle}
      >
        {Array.from({ length: 12 }, (_, i) => i + 1).map(h => (
          <option key={h} value={h}>{h.toString().padStart(2, '0')}</option>
        ))}
      </select>
      <span style={{ fontWeight: '950', color: 'var(--admin-text-secondary)' }}>:</span>
      <select 
        value={minute} 
        onChange={(e) => updateTime(hour12, Number(e.target.value), ampm)}
        style={segmentStyle}
      >
        {['00', '15', '30', '45'].map(m => (
          <option key={m} value={Number(m)}>{m}</option>
        ))}
      </select>
      <button 
        onClick={() => updateTime(hour12, minute, ampm === 'AM' ? 'PM' : 'AM')}
        style={{ ...segmentStyle, background: 'var(--admin-card)', border: '1px solid var(--admin-brand)', color: 'var(--admin-brand)' }}
      >
        {ampm}
      </button>
    </div>
  );
};

export default SegmentedTimePicker;
