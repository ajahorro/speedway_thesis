import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, Calendar, Car, ClipboardList, FileText, LayoutDashboard, Search, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

const CustomerSearch = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const searchRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isOpen, setIsOpen] = useState(false);

  const pages = [
    { name: 'Dashboard', path: '/customer', icon: LayoutDashboard, category: 'Pages' },
    { name: 'Book Appointment', path: '/customer/book', icon: Calendar, category: 'Pages' },
    { name: 'My Bookings', path: '/customer/bookings', icon: ClipboardList, category: 'Pages' },
    { name: 'Transactions & Billing', path: '/customer/billing', icon: FileText, category: 'Pages' },
    { name: 'Vehicle Garage', path: '/customer/garage', icon: Car, category: 'Pages' },
    { name: 'Notifications', path: '/customer/notifications', icon: FileText, category: 'Pages' },
    { name: 'Settings', path: '/customer/settings', icon: Settings, category: 'Pages' }
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const searchCustomerData = async () => {
      const normalizedQuery = query.trim().toLowerCase();
      if (!user?.id || normalizedQuery.length < 2) {
        setResults([]);
        setIsOpen(false);
        return;
      }

      const [bookingsResult, vehiclesResult] = await Promise.all([
        supabase.from('bookings').select('id, status, start_datetime').eq('customer_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('vehicles').select('id, brand, model, plate_number').eq('owner_id', user.id).limit(50)
      ]);

      const pageResults = pages.filter(page => page.name.toLowerCase().includes(normalizedQuery));
      const bookingResults = (bookingsResult.data || [])
        .filter(booking => booking.id.toLowerCase().includes(normalizedQuery) || booking.status?.toLowerCase().includes(normalizedQuery))
        .slice(0, 5)
        .map(booking => ({
          name: `Booking #${booking.id.slice(0, 8).toUpperCase()}`,
          detail: `${booking.status?.replaceAll('_', ' ') || 'Scheduled'}${booking.start_datetime ? ` · ${new Date(booking.start_datetime).toLocaleDateString()}` : ''}`,
          path: `/customer/bookings/${booking.id}`,
          icon: ClipboardList,
          category: 'My Bookings'
        }));
      const vehicleResults = (vehiclesResult.data || [])
        .filter(vehicle => `${vehicle.brand} ${vehicle.model} ${vehicle.plate_number}`.toLowerCase().includes(normalizedQuery))
        .slice(0, 5)
        .map(vehicle => ({
          name: `${vehicle.brand} ${vehicle.model}`,
          detail: vehicle.plate_number,
          path: '/customer/garage',
          icon: Car,
          category: 'My Garage'
        }));

      setResults([...pageResults, ...bookingResults, ...vehicleResults]);
      setIsOpen(true);
    };

    const timeoutId = setTimeout(searchCustomerData, 250);
    return () => clearTimeout(timeoutId);
  }, [query, user?.id]);

  const handleSelect = (path) => {
    navigate(path);
    setQuery('');
    setIsOpen(false);
  };

  return (
    <div ref={searchRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', width: 'min(100%, 320px)' }}>
      <Search size={16} style={{ position: 'absolute', left: '1rem', color: 'var(--admin-text-secondary)', opacity: 0.7, zIndex: 1 }} />
      <input
        type="text"
        placeholder="SEARCH YOUR ACCOUNT..."
        value={query}
        onChange={event => setQuery(event.target.value)}
        onFocus={() => query.length > 0 && setIsOpen(true)}
        style={{ width: '100%', boxSizing: 'border-box', padding: '0.65rem 1rem 0.65rem 2.75rem', borderRadius: 'var(--admin-radius-sm)', background: 'var(--admin-bg)', border: '1px solid var(--admin-border)', color: 'var(--admin-text-primary)', fontSize: '0.75rem', fontWeight: '700', outline: 'none' }}
      />
      {isOpen && results.length > 0 && (
        <div style={{ position: 'absolute', top: 'calc(100% + 0.5rem)', left: 0, right: 0, background: 'var(--admin-card)', border: '1px solid var(--admin-border)', borderRadius: 'var(--admin-radius-sm)', boxShadow: 'var(--admin-card-shadow)', zIndex: 2000, maxHeight: '400px', overflowY: 'auto' }}>
          {['Pages', 'My Bookings', 'My Garage'].map(category => {
            const categoryResults = results.filter(result => result.category === category);
            if (categoryResults.length === 0) return null;
            return <div key={category} style={{ borderBottom: '1px solid var(--admin-border)' }}>
              <div style={{ padding: '0.75rem 1rem', fontSize: '0.6rem', fontWeight: '900', color: 'var(--admin-brand)', textTransform: 'uppercase', letterSpacing: '1px' }}>{category}</div>
              {categoryResults.map((result, index) => {
                const Icon = result.icon;
                return <button key={`${result.path}-${index}`} type="button" onClick={() => handleSelect(result.path)} style={{ width: '100%', padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: 'transparent', border: 0, color: 'var(--admin-text-primary)', textAlign: 'left' }}>
                  <Icon size={14} color="var(--admin-text-secondary)" />
                  <span style={{ flex: 1, minWidth: 0 }}><strong style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{result.name}</strong>{result.detail && <small style={{ display: 'block', marginTop: '0.2rem', color: 'var(--admin-text-secondary)', fontSize: '0.68rem' }}>{result.detail}</small>}</span>
                  <ArrowRight size={12} color="var(--admin-text-secondary)" />
                </button>;
              })}
            </div>;
          })}
        </div>
      )}
    </div>
  );
};

export default CustomerSearch;
