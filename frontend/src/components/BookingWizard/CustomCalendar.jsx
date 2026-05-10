import React, { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CustomCalendar = ({ selectedDate, onDateSelect }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDayClick = (day) => {
    const selected = new Date(year, month, day);
    if (selected >= today) {
      // Format as YYYY-MM-DD
      const yyyy = selected.getFullYear();
      const mm = String(selected.getMonth() + 1).padStart(2, '0');
      const dd = String(selected.getDate()).padStart(2, '0');
      onDateSelect(`${yyyy}-${mm}-${dd}`);
    }
  };

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(<div key={`empty-${i}`} style={{ padding: '0.5rem' }} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month, day);
    const isPast = dateObj < today;
    
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const dateString = `${yyyy}-${mm}-${dd}`;
    
    const isSelected = selectedDate === dateString;

    days.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        disabled={isPast}
        style={{
          padding: '0.75rem 0',
          background: isSelected ? 'var(--admin-brand)' : 'transparent',
          color: isPast ? 'var(--admin-text-secondary)' : isSelected ? '#fff' : 'var(--admin-text-primary)',
          border: '1px solid',
          borderColor: isSelected ? 'var(--admin-brand)' : 'transparent',
          borderRadius: 'var(--admin-radius-sm)',
          cursor: isPast ? 'not-allowed' : 'pointer',
          opacity: isPast ? 0.3 : 1,
          fontWeight: isSelected ? '900' : '600',
          transition: 'all 0.2s ease',
          outline: 'none'
        }}
        onMouseEnter={(e) => {
          if (!isPast && !isSelected) {
            e.target.style.background = 'var(--admin-bg)';
            e.target.style.borderColor = 'var(--admin-border)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isPast && !isSelected) {
            e.target.style.background = 'transparent';
            e.target.style.borderColor = 'transparent';
          }
        }}
      >
        {day}
      </button>
    );
  }

  return (
    <div style={{ background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-md)', padding: '1.5rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <button 
          onClick={handlePrevMonth} 
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-primary)', cursor: 'pointer' }}
        >
          <ChevronLeft size={16} />
        </button>
        <div style={{ fontWeight: '900', textTransform: 'uppercase', letterSpacing: '1px', fontSize: '1rem', color: 'var(--admin-text-primary)' }}>
          {monthNames[month]} {year}
        </div>
        <button 
          onClick={handleNextMonth} 
          style={{ background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--admin-text-primary)', cursor: 'pointer' }}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Weekdays */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', marginBottom: '0.5rem', textAlign: 'center' }}>
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} style={{ fontSize: '0.75rem', fontWeight: '800', color: 'var(--admin-text-secondary)', textTransform: 'uppercase' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Days Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem' }}>
        {days}
      </div>
    </div>
  );
};

export default CustomCalendar;
