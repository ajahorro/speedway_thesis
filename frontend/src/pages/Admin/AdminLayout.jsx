import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import {
  LayoutDashboard, ClipboardList, CheckSquare, Calendar,
  Bell, Undo, BarChart2, History, Users, User,
  Settings, LogOut, Menu, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import ProfileHeader from '../../components/ProfileHeader';
import AdminSearch from '../../components/AdminSearch';
import NotificationPopover from '../../components/NotificationPopover';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { useTheme } from '../../context/ThemeContext';
import BrandLogo from '../../components/BrandLogo';
import { confirmLogout } from '../../utils/logoutConfirm';

const AdminLayout = () => {
  const { theme } = useTheme();
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifPopover, setShowNotifPopover] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const notifRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notifRef.current && !notifRef.current.contains(event.target)) {
        setShowNotifPopover(false);
      }
    };

    if (showNotifPopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifPopover]);

  useEffect(() => {
    fetchUnreadCount();

    const handleNotificationsRead = () => fetchUnreadCount();
    window.addEventListener('notificationsRead', handleNotificationsRead);

    return () => {
      window.removeEventListener('notificationsRead', handleNotificationsRead);
    };
  }, [user]);

  // Close sidebar on navigation (mobile)
  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [location, isMobile]);

  const fetchUnreadCount = async () => {
    setUnreadCount(3);
  };
  const handleLogout = async () => {
    confirmLogout(async () => {
      await signOut();
      navigate('/login', { replace: true });
    });
  };
  const navLinks = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
    { name: 'Booking Management', path: '/admin/bookings', icon: ClipboardList },
    { name: 'Payment Verification', path: '/admin/payments', icon: CheckSquare },
    { name: 'Schedule', path: '/admin/schedule', icon: Calendar },
    { name: 'Refund Hub', path: '/admin/refunds', icon: Undo },
    { name: 'Analytics', path: '/admin/analytics', icon: BarChart2 },
    { name: 'Audit Logs', path: '/admin/audit-logs', icon: History },
    { name: 'Staff Management', path: '/admin/staff', icon: Users },
    { name: 'Users', path: '/admin/users', icon: User },
    { name: 'Notifications', path: '/admin/notifications', icon: Bell },

  ];

  const bottomLinks = [
    { name: 'Settings', path: '/admin/settings', icon: Settings },
  ];

  const BlurGlow = ({ top, left, right, bottom, size, color }) => (
    <div style={{
      position: 'absolute',
      top, left, right, bottom,
      width: size,
      height: size,
      background: color || 'rgba(169, 27, 24, 0.4)',
      filter: 'blur(120px)',
      borderRadius: '50%',
      zIndex: 0,
      pointerEvents: 'none',
      opacity: 0.4
    }} />
  );

  const sidebarStyle = {
    width: '260px',
    background: 'var(--admin-sidebar)',
    borderRight: '1px solid var(--admin-border)',
    display: 'flex',
    flexDirection: 'column',
    padding: '0',
    position: 'fixed',
    top: 0,
    left: isMobile ? (isSidebarOpen ? 0 : '-260px') : 0,
    height: '100vh',
    zIndex: 1000,
    transition: 'left 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  const overlayStyle = {
    display: isMobile && isSidebarOpen ? 'block' : 'none',
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.7)',
    backdropFilter: 'blur(8px)',
    zIndex: 999
  };

  return (
    <div className="admin-theme" data-theme={theme} style={{ display: 'flex', height: '100vh', background: 'var(--admin-bg)', color: 'var(--admin-text-primary)', position: 'relative', overflow: 'hidden' }}>

      {/* Mobile Overlay */}
      <div style={overlayStyle} onClick={() => setIsSidebarOpen(false)} />

      <aside className="no-print" style={sidebarStyle}>
        <div style={{ 
          padding: '2rem 1.5rem', 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: '0.1rem',
          borderBottom: '1px solid var(--admin-border)',
          marginBottom: '1rem',
          background: 'rgba(var(--admin-brand-rgb), 0.03)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: '950', fontSize: '1.25rem', letterSpacing: '-1px', color: 'var(--admin-brand)', lineHeight: 1 }}>SPEEDWAY</div>
            {isMobile && <button onClick={() => setIsSidebarOpen(false)} style={{ color: 'var(--admin-text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={20} /></button>}
          </div>
          <span style={{ fontSize: '0.55rem', fontWeight: '950', color: 'var(--admin-text-secondary)', letterSpacing: '2px', textTransform: 'uppercase' }}>Fleet Operations</span>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', flex: 1, overflowY: 'auto', padding: '0 0.5rem' }}>
          <div style={{ padding: '0.75rem 1rem', fontSize: '0.6rem', fontWeight: '950', color: 'var(--admin-text-secondary)', textTransform: 'uppercase', letterSpacing: '1.5px', opacity: 0.4 }}>Command Center</div>
          {navLinks.map((link) => {
            const Icon = link.icon;
            if (link.name === 'Settings') return null;
            return (
              <NavLink
                key={link.name}
                to={link.path}
                end={link.exact}
                className="admin-card-hover"
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.85rem 1.25rem',
                  borderRadius: 'var(--admin-radius-sm)',
                  textDecoration: 'none',
                  color: isActive ? 'var(--admin-sidebar-active-text)' : 'var(--admin-text-secondary)',
                  background: isActive ? 'var(--admin-sidebar-active-bg)' : 'transparent',
                  fontWeight: isActive ? '950' : '800',
                  fontSize: '0.7rem',
                  textTransform: 'uppercase',
                  letterSpacing: '0.8px',
                  transition: 'all 0.2s',
                  borderLeft: isActive ? '2px solid var(--admin-brand)' : '2px solid transparent',
                  marginLeft: '0.25rem'
                })}
              >
                <Icon size={14} strokeWidth={2.5} />
                {link.name}
              </NavLink>
            );
          })}
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem', padding: '1rem 0.5rem', borderTop: '1px solid var(--admin-border)' }}>
          <NavLink
            to="/admin/settings"
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--admin-radius-sm)',
              textDecoration: 'none',
              color: isActive ? 'var(--admin-sidebar-active-text)' : 'var(--admin-text-secondary)',
              background: isActive ? 'var(--admin-sidebar-active-bg)' : 'transparent',
              fontWeight: isActive ? '950' : '800',
              fontSize: '0.7rem',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              borderLeft: isActive ? '2px solid var(--admin-brand)' : '2px solid transparent',
              marginLeft: '0.25rem'
            })}
          >
            <Settings size={14} strokeWidth={2.5} />
            Settings
          </NavLink>

          <button
            onClick={handleLogout}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '0.85rem 1.25rem',
              borderRadius: 'var(--admin-radius-sm)',
              color: 'var(--admin-text-secondary)',
              fontWeight: '950',
              fontSize: '0.7rem',
              width: '100%',
              textAlign: 'left',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: 'transparent',
              border: 'none',
              textTransform: 'uppercase',
              letterSpacing: '0.8px',
              marginLeft: '0.25rem'
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--admin-brand)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--admin-text-secondary)'}
          >
            <LogOut size={14} strokeWidth={2.5} />
            Log out
          </button>
        </div>
      </aside>

      <div className="admin-main-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', zIndex: 1, maxWidth: '100%', marginLeft: isMobile ? 0 : '260px' }}>
        <header className="no-print" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: isMobile ? '0.75rem 1rem' : '1rem 2.5rem',
          borderBottom: '1px solid var(--admin-border)',
          background: 'var(--admin-card)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          boxShadow: 'var(--admin-card-shadow)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '1rem' : '2rem' }}>
            {isMobile && (
              <button onClick={() => setIsSidebarOpen(true)} style={{ color: 'var(--admin-text-primary)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Menu size={20} />
              </button>
            )}
            <div
              style={{ fontSize: isMobile ? '0.9rem' : '1.1rem', fontWeight: '950', letterSpacing: '1px', cursor: 'pointer', color: 'var(--admin-text-primary)', textTransform: 'uppercase' }}
              onClick={() => navigate('/admin')}
            >
              Admin Account
            </div>
            {!isMobile && <AdminSearch />}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '1rem' : '1.5rem', position: 'relative' }}>
            <div
              onClick={() => setShowNotifPopover(!showNotifPopover)}
              style={{ position: 'relative', cursor: 'pointer', opacity: showNotifPopover ? 1 : 0.6, color: 'var(--admin-text-primary)', transition: 'all 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => { if (!showNotifPopover) e.currentTarget.style.opacity = '0.6'; }}
            >
              <Bell size={18} strokeWidth={2.5} />
              {unreadCount > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '-6px',
                  right: '-6px',
                  background: 'var(--admin-brand)',
                  color: '#fff',
                  fontSize: '0.55rem',
                  fontWeight: '950',
                  minWidth: '16px',
                  height: '16px',
                  padding: '0 4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '2px', // SHARP BADGE
                  border: '1px solid var(--admin-card)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}>{unreadCount}</div>
              )}
            </div>

            {showNotifPopover && (
              <div ref={notifRef}>
                <NotificationPopover
                  user={user}
                  profile={profile}
                  onClose={() => setShowNotifPopover(false)}
                  onRead={fetchUnreadCount}
                />
              </div>
            )}
            <div style={{ width: '1px', height: '20px', background: 'var(--admin-border)', opacity: 0.5 }}></div>
            <div 
              onClick={() => navigate('/admin/profile')} 
              style={{ cursor: 'pointer', transition: 'all 0.2s', opacity: location.pathname === '/admin/profile' ? 1 : 0.8 }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => { if (location.pathname !== '/admin/profile') e.currentTarget.style.opacity = '0.8'; }}
            >
              <ProfileHeader />
            </div>
          </div>
        </header>

        {isMobile && (
          <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--admin-border)', background: 'var(--admin-bg)' }}>
            <AdminSearch />
          </div>
        )}

        <main style={{ flex: 1, padding: isMobile ? '1.5rem 1rem' : '2.5rem', overflowY: 'auto', background: 'var(--admin-bg)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
