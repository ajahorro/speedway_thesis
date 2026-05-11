import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import AdminLayout from './pages/Admin/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminBookings from './pages/Admin/AdminBookings';
import AdminBookingDetails from './pages/Admin/AdminBookingDetails';
import AdminSchedule from './pages/Admin/AdminSchedule';
import AdminPayments from './pages/Admin/AdminPayments';
import AdminRefunds from './pages/Admin/AdminRefunds';
import AdminSalesReport from './pages/Admin/AdminSalesReport';
import AdminAuditLogs from './pages/Admin/AdminAuditLogs';
import AdminAccountsManagement from './pages/Admin/AdminAccountsManagement';
import AdminUserManagement from './pages/Admin/AdminUserManagement';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminNotifications from './pages/Admin/AdminNotifications';
import AdminProfile from './pages/Admin/AdminProfile';
import AdminAcceptInvite from './pages/Admin/AdminAcceptInvite';
import AdminSlotManagement from './pages/Admin/AdminSlotManagement';
import StaffLayout from './pages/Staff/StaffLayout';
import StaffDashboard from './pages/Staff/StaffDashboard';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import CustomerLayout from './pages/Customer/CustomerLayout';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
import CustomerBookAppointment from './pages/Customer/CustomerBookAppointment';
import CustomerMyBookings from './pages/Customer/CustomerMyBookings';
import CustomerBilling from './pages/Customer/CustomerBilling';
import CustomerGarage from './pages/Customer/CustomerGarage';
import CustomerNotifications from './pages/Customer/CustomerNotifications';
import CustomerSettings from './pages/Customer/CustomerSettings';
import CustomerBookingDetails from './pages/Customer/CustomerBookingDetails';
import './index.css';

// Suppress React Router v7 Future Flag Warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return;
  }
  originalWarn(...args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <ThemeProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/accept-invite" element={<AdminAcceptInvite />} />

          
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['ADMIN']}>
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="bookings" element={<AdminBookings />} />
            <Route path="bookings/:id" element={<AdminBookingDetails />} />
            <Route path="schedule" element={<AdminSchedule />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="refunds" element={<AdminRefunds />} />
            <Route path="analytics" element={<AdminSalesReport />} />
            <Route path="audit-logs" element={<AdminAuditLogs />} />
            <Route path="accounts" element={<AdminAccountsManagement />} />
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="slots" element={<AdminSlotManagement />} />
            <Route path="profile" element={<AdminProfile />} />
            {/* Fallback for other admin routes */}
            <Route path="*" element={<div style={{ padding: '2rem' }}>Module under development</div>} />
          </Route>

          {/* Staff Routes */}
          <Route 
            path="/staff" 
            element={
              <ProtectedRoute allowedRoles={['STAFF']}>
                <StaffLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<StaffDashboard />} />
            <Route path="tasks" element={<StaffDashboard />} />
            <Route path="history" element={<div style={{ padding: '2rem' }}>Historical logs coming soon</div>} />
            <Route path="profile" element={<div style={{ padding: '2rem' }}>Profile management coming soon</div>} />
          </Route>

          {/* Customer Routes */}
          <Route 
            path="/customer" 
            element={
              <ProtectedRoute allowedRoles={['CUSTOMER']}>
                <CustomerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<CustomerDashboard />} />
            <Route path="book" element={<CustomerBookAppointment />} />
            <Route path="bookings" element={<CustomerMyBookings />} />
            <Route path="bookings/:id" element={<CustomerBookingDetails />} />
            <Route path="billing" element={<CustomerBilling />} />
            <Route path="garage" element={<CustomerGarage />} />
            <Route path="notifications" element={<CustomerNotifications />} />
            <Route path="settings" element={<CustomerSettings />} />
          </Route>

          {/* Global Fallback: Catch-all for unknown routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster 
          position="top-right" 
          toastOptions={{
            style: {
              background: 'var(--admin-card)',
              color: 'var(--admin-text-primary)',
              border: '1px solid var(--admin-border)',
              borderRadius: 'var(--admin-radius-sm)',
              fontSize: '0.9rem',
              fontWeight: '600',
              padding: '1rem',
              boxShadow: '0 10px 30px rgba(0,0,0,0.3)'
            },
            success: {
              iconTheme: {
                primary: 'var(--admin-brand)',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            }
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);
