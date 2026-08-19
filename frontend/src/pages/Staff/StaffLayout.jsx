import React, { useCallback, useEffect } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import {
  ClipboardList, CheckCircle2, User, LogOut,
  Menu, X, Bell, LayoutDashboard, History, Settings, Clock
} from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import { useUI } from '../../context/UIContext';
import { useAuth } from '../../hooks/useAuth';
import { confirmLogout } from '../../utils/logoutConfirm';

const StaffLayout = () => {
  const { openModal, closeModal } = useUI(); const { user, profile, signOut, logout, fetchProfile, setProfile, toggleShift } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(!isMobile);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const userId = user?.id || profile?.id;

  const fetchUnreadCount = useCallback(async () => {
    if (!userId) return;
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      setUnreadCount(count || 0);
    } catch {
      setUnreadCount(0);
    }
  }, [userId]);

  useEffect(() => {
    fetchUnreadCount();
    if (!userId) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchUnreadCount();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);

    const channel = supabase
      .channel(`staff-notif-badge-${userId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, () => fetchUnreadCount())
      .subscribe();

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      supabase.removeChannel(channel);
    };
  }, [userId, fetchUnreadCount]);

  const menuItems = [
    { icon: ClipboardList, label: 'My Jobs', path: '/staff' },
    { icon: History, label: 'Work History', path: '/staff/history' },
    { icon: User, label: 'My Profile', path: '/staff/profile' },
  ];

  const handleToggleShift = async () => {
    if (!profile?.id) return;
    const isClockingOut = profile.is_clocked_in;

    if (isClockingOut) {
      openModal({
        title: "End Shift?",
        message: "Confirming clock-out will mark you as unavailable for new detailing assignments.",
        confirmText: "Clock Out",
        type: "danger",
        onConfirm: async () => {
          await toggleShift(false);
        }
      });
      return;
    }

    await toggleShift(true);
  };

  const handleLogout = () => {
    confirmLogout(openModal, async () => {
      // 1. Close any active modal first to prevent UI flashes
      if (typeof closeModal === 'function') {
        closeModal();
      }

      // 2. Perform sign out
      await signOut();

      // 3. Force clean redirect to homepage
      window.location.href = '/';
    });
  };

  const navItemStyle = (path) => {
    const isActive = location.pathname === path || (path === '/staff' && (location.pathname === '/staff' || location.pathname === '/staff/tasks'));
    return {
      display: 'flex',
      alignItems: 'center',
      gap: '0.75rem',
      padding: '0.85rem 1.25rem',
      borderRadius: '4px',
      color: isActive ? 'white' : '#8E9196',
      background: isActive ? '#E61E2A' : 'transparent',
      textDecoration: 'none',
      fontWeight: '800',
      fontSize: '0.85rem',
      transition: 'all 0.2s ease',
      textTransform: 'uppercase',
      letterSpacing: '0.5px'
    };
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0A0B0D', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* Mobile Backdrop */}
      {isMobile && isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 40, backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Sidebar */}
      <aside style={{
        width: '280px',
        background: '#15171A',
        borderRight: '1px solid rgba(255, 255, 255, 0.05)',
        display: 'flex',
        flexDirection: 'column',
        position: isMobile ? 'fixed' : 'relative',
        height: '100vh',
        zIndex: 50,
        transform: isMobile && !isSidebarOpen ? 'translateX(-100%)' : 'translateX(0)',
        transition: 'transform 0.3s ease'
      }}>
        <div style={{ padding: '2rem', borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '950', margin: 0, fontStyle: 'italic', letterSpacing: '1px' }}>
            SPEEDWAY<span style={{ color: '#E61E2A' }}>STAFF</span>
          </h1>
          <p style={{ fontSize: '0.6rem', color: '#444', fontWeight: '900', marginTop: '0.4rem', textTransform: 'uppercase', letterSpacing: '2px' }}>
            Operational Detailing Portal
          </p>
        </div>

        <nav style={{ flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {menuItems.map((item) => (
            <Link key={item.path} to={item.path} className="admin-card-hover" style={navItemStyle(item.path)} onClick={() => isMobile && setIsSidebarOpen(false)}>
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>

        <div style={{ padding: '1.5rem', borderTop: '1px solid rgba(255, 255, 255, 0.05)' }}>
          {/* 🕹️ Primary Footer Action: Shift Lifecycle Controller */}
          <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button
              onClick={handleToggleShift}
              style={{
                width: '100%', padding: '0.85rem', borderRadius: '4px',
                background: profile?.is_clocked_in ? '#333' : '#E61E2A',
                border: 'none', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
                cursor: 'pointer', transition: 'all 0.2s', fontWeight: '950',
                textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem'
              }}
            >
              {profile?.is_clocked_in ? <LogOut size={16} /> : <Clock size={16} />}
              {profile?.is_clocked_in ? 'CLOCK OUT' : 'CLOCK IN'}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#0A0B0D', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: '#E61E2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>
              {profile?.full_name?.charAt(0) || 'T'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '950', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>{profile?.full_name}</div>
              <div style={{ fontSize: '0.65rem', color: '#8E9196', fontWeight: '900', textTransform: 'uppercase' }}>Technician</div>
            </div>
          </div>

          <Link
            to="/staff/settings"
            onClick={() => isMobile && setIsSidebarOpen(false)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.85rem 1rem', borderRadius: '4px',
              background: location.pathname === '/staff/settings' ? '#E61E2A' : 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.05)',
              color: location.pathname === '/staff/settings' ? 'white' : '#8E9196',
              fontWeight: '800', fontSize: '0.85rem', textDecoration: 'none',
              textTransform: 'uppercase', letterSpacing: '0.5px',
              marginBottom: '0.5rem', transition: 'all 0.2s'
            }}
          >
            <Settings size={18} /> SETTINGS
          </Link>

          <button
            onClick={handleLogout}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: '0.75rem',
              padding: '0.85rem', borderRadius: '4px', background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.05)', color: '#ef4444', fontWeight: '950',
              fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s'
            }}
          >
            <LogOut size={18} /> LOGOUT
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, height: '100vh', overflowY: 'auto', position: 'relative', background: '#0A0B0D' }}>
        {/* Top Header */}
        <header style={{
          height: '70px', background: 'rgba(21, 23, 26, 0.8)', backdropFilter: 'blur(10px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.05)', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', padding: '0 2rem', position: 'sticky', top: 0, zIndex: 30
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {isMobile && (
              <button onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>
                <Menu size={24} />
              </button>
            )}
            <h2 style={{ fontSize: '0.9rem', fontWeight: '950', color: '#8E9196', textTransform: 'uppercase', letterSpacing: '2px' }}>
              Operational Overview
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {/* 🟢 Header Status Badge */}
            <div style={{
              padding: '0.4rem 0.85rem', background: 'rgba(255,255,255,0.03)',
              borderRadius: '100px', border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', gap: '0.6rem'
            }}>
              <div style={{
                width: '6px', height: '6px', borderRadius: '50%',
                background: profile?.is_clocked_in ? '#10b981' : '#ef4444',
                boxShadow: profile?.is_clocked_in ? '0 0 10px #10b981' : 'none'
              }}></div>
              <span style={{ fontSize: '0.65rem', fontWeight: '950', color: profile?.is_clocked_in ? '#10b981' : '#ef4444', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {profile?.is_clocked_in ? 'ON DUTY' : 'OFF DUTY'}
              </span>
            </div>

            <button
              onClick={() => navigate('/staff/notifications')}
              style={{ background: '#15171A', border: '1px solid rgba(255, 255, 255, 0.05)', color: '#8E9196', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', position: 'relative' }}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: '-4px', right: '-4px',
                  background: '#E61E2A', color: 'white',
                  fontSize: '0.5rem', fontWeight: '950',
                  minWidth: '16px', height: '16px', padding: '0 3px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '2px', border: '1.5px solid #15171A'
                }}>{unreadCount > 99 ? '99+' : unreadCount}</span>
              )}
            </button>
          </div>
        </header>

        <div style={{ padding: isMobile ? '1.5rem' : '2.5rem', maxWidth: '1400px', margin: '0 auto' }}>
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default StaffLayout;
