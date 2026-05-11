import React from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { 
  ClipboardList, CheckCircle2, User, LogOut, 
  Menu, X, Bell, LayoutDashboard, History, Settings, Clock
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

const StaffLayout = () => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useMediaQuery('(max-width: 1024px)');
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(!isMobile);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Task Hub', path: '/staff' },
    { icon: ClipboardList, label: 'Active Jobs', path: '/staff/tasks' },
    { icon: History, label: 'Work History', path: '/staff/history' },
    { icon: Settings, label: 'My Profile', path: '/staff/profile' },
  ];

  const handleToggleShift = async () => {
    if (!profile?.id) return;
    const newStatus = !profile.is_clocked_in;
    const toastId = toast.loading(newStatus ? 'Clocking in...' : 'Clocking out...');

    try {
      // 1. Update Profile Status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_clocked_in: newStatus })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // 2. Record Shift Event
      if (newStatus) {
        await supabase.from('staff_shifts').insert({ staff_id: profile.id, status: 'active' });
      } else {
        await supabase.from('staff_shifts').update({ status: 'completed', clock_out: new Date().toISOString() }).eq('staff_id', profile.id).eq('status', 'active');
      }

      toast.success(newStatus ? 'Shift Started! Ready for assignments.' : 'Shift Ended. Great work today!', { id: toastId });
      // We rely on the auth listener to refresh the profile state, 
      // but we can also manually trigger a refresh if needed.
      window.location.reload(); // Quickest way to sync profile across all components for this demo
    } catch (err) {
      toast.error('Failed to update shift status.', { id: toastId });
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Technician logged out.');
    navigate('/login');
  };

  const navItemStyle = (path) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    padding: '0.85rem 1.25rem',
    borderRadius: '4px',
    color: location.pathname === path ? 'white' : '#8E9196',
    background: location.pathname === path ? '#E61E2A' : 'transparent',
    textDecoration: 'none',
    fontWeight: '800',
    fontSize: '0.85rem',
    transition: 'all 0.2s ease',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  });

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
          {/* Shift Controller */}
          <button 
            onClick={handleToggleShift}
            style={{ 
              width: '100%', marginBottom: '1.5rem', padding: '1rem', borderRadius: '4px',
              background: profile?.is_clocked_in ? 'rgba(16, 185, 129, 0.1)' : 'rgba(255,255,255,0.05)',
              border: `1px solid ${profile?.is_clocked_in ? '#10b981' : 'rgba(255,255,255,0.05)'}`,
              color: profile?.is_clocked_in ? '#10b981' : '#8E9196',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
              cursor: 'pointer', transition: 'all 0.2s', fontWeight: '950'
            }}
          >
            {profile?.is_clocked_in ? <CheckCircle2 size={18} /> : <Clock size={18} />}
            <span style={{ fontSize: '0.8rem', fontWeight: '950', textTransform: 'uppercase', letterSpacing: '1px' }}>
              {profile?.is_clocked_in ? 'ON DUTY' : 'CLOCK IN'}
            </span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.75rem', background: '#0A0B0D', borderRadius: '4px', border: '1px solid rgba(255, 255, 255, 0.05)', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '2px', background: '#E61E2A', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '950' }}>
              {profile?.full_name?.charAt(0) || 'T'}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: '950', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'uppercase' }}>{profile?.full_name}</div>
              <div style={{ fontSize: '0.65rem', color: '#8E9196', fontWeight: '900', textTransform: 'uppercase' }}>Technician</div>
            </div>
          </div>
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
            <button style={{ background: '#15171A', border: '1px solid rgba(255, 255, 255, 0.05)', color: '#8E9196', padding: '0.5rem', borderRadius: '4px', cursor: 'pointer', position: 'relative' }}>
              <Bell size={18} />
              <span style={{ position: 'absolute', top: '-2px', right: '-2px', width: '8px', height: '8px', background: '#E61E2A', borderRadius: '50%', border: '2px solid #15171A' }}></span>
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
