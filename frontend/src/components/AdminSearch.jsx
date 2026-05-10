import React, { useState, useEffect, useRef } from 'react';
import { Search, FileText, User, CreditCard, Bell, Settings, LayoutDashboard, Calendar, History, ClipboardList, Shield, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { mockBookings, mockUsers, mockStaff } from '../pages/Admin/AdminMockData';

const AdminSearch = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const searchRef = useRef(null);

  const pages = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, category: 'Pages' },
    { name: 'Booking Management', path: '/admin/bookings', icon: ClipboardList, category: 'Pages' },
    { name: 'Payment Verification', path: '/admin/payments', icon: CreditCard, category: 'Pages' },
    { name: 'Schedule', path: '/admin/schedule', icon: Calendar, category: 'Pages' },
    { name: 'Refund Hub', path: '/admin/refunds', icon: ClipboardList, category: 'Pages' },
    { name: 'Analytics', path: '/admin/analytics', icon: LayoutDashboard, category: 'Pages' },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: History, category: 'Pages' },
    { name: 'Staff Management', path: '/admin/staff', icon: User, category: 'Pages' },
    { name: 'Users', path: '/admin/users', icon: User, category: 'Pages' },
    { name: 'Notifications', path: '/admin/notifications', icon: Bell, category: 'Pages' },
    { name: 'Settings', path: '/admin/settings', icon: Settings, category: 'Pages' },
    { name: 'Profile', path: '/admin/profile', icon: Shield, category: 'Pages' },
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 1) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const filteredPages = pages.filter(p => p.name.toLowerCase().includes(query.toLowerCase()));
    
    const filteredBookings = mockBookings.filter(b => 
      b.id.toLowerCase().includes(query.toLowerCase()) || 
      b.customer?.full_name?.toLowerCase().includes(query.toLowerCase())
    ).map(b => ({
      name: `Booking #${b.id.slice(0, 8)} - ${b.customer?.full_name}`,
      path: `/admin/bookings/${b.id}`,
      icon: FileText,
      category: 'Recent Bookings'
    }));

    const filteredUsers = mockUsers.filter(u => 
      u.full_name.toLowerCase().includes(query.toLowerCase()) || 
      u.email.toLowerCase().includes(query.toLowerCase())
    ).map(u => ({
      name: `${u.full_name} (${u.role})`,
      path: '/admin/users',
      icon: User,
      category: 'Users & Staff'
    }));

    setResults([...filteredPages, ...filteredBookings.slice(0, 3), ...filteredUsers.slice(0, 3)]);
    setIsOpen(true);
  }, [query]);

  const handleSelect = (path) => {
    navigate(path);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <Search size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--admin-text-secondary)', opacity: 0.5, zIndex: 10 }} />
      <input 
        type="text" 
        placeholder="SYSTEM SEARCH..." 
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => query.length > 0 && setIsOpen(true)}
        style={{ 
          padding: '0.65rem 1rem 0.65rem 2.75rem', 
          borderRadius: 'var(--admin-radius-sm)', 
          background: 'var(--admin-bg)', 
          border: '1px solid var(--admin-border)', 
          color: 'var(--admin-text-primary)',
          fontSize: '0.75rem',
          fontWeight: '950',
          width: '320px',
          outline: 'none',
          transition: '0.2s',
          letterSpacing: '0.5px'
        }} 
      />

      {isOpen && results.length > 0 && (
        <div style={{ 
          position: 'absolute', 
          top: '100%', 
          left: 0, 
          right: 0, 
          background: 'var(--admin-card)', 
          border: '1px solid var(--admin-border)', 
          borderRadius: 'var(--admin-radius-sm)', 
          boxShadow: 'var(--admin-card-shadow)', 
          marginTop: '0.5rem',
          zIndex: 2000,
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {['Pages', 'Recent Bookings', 'Users & Staff'].map(category => {
            const catResults = results.filter(r => r.category === category);
            if (catResults.length === 0) return null;
            
            return (
              <div key={category} style={{ borderBottom: '1px solid var(--admin-border)' }}>
                <div style={{ padding: '0.75rem 1rem', fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8 }}>{category}</div>
                {catResults.map((res, idx) => {
                  const Icon = res.icon;
                  return (
                    <div 
                      key={idx}
                      onClick={() => handleSelect(res.path)}
                      style={{ 
                        padding: '0.75rem 1rem', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.75rem', 
                        cursor: 'pointer',
                        transition: '0.2s',
                        background: 'transparent'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <Icon size={14} style={{ color: 'var(--admin-text-secondary)' }} />
                      <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--admin-text-primary)', flex: 1 }}>{res.name}</div>
                      <ArrowRight size={12} style={{ color: 'var(--admin-text-secondary)', opacity: 0.3 }} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminSearch;

