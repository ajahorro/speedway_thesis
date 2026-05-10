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
import AdminStaffManagement from './pages/Admin/AdminStaffManagement';
import AdminUserManagement from './pages/Admin/AdminUserManagement';
import AdminSettings from './pages/Admin/AdminSettings';
import AdminNotifications from './pages/Admin/AdminNotifications';
import AdminProfile from './pages/Admin/AdminProfile';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
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
          <Route path="/login" element={<Login />} />
          
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
            <Route path="staff" element={<AdminStaffManagement />} />
            <Route path="users" element={<AdminUserManagement />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="profile" element={<AdminProfile />} />
            {/* Fallback for other admin routes */}
            <Route path="*" element={<div style={{ padding: '2rem' }}>Module under development</div>} />
          </Route>

          {/* Root redirect: Authenticated users to Admin, Others to Login (handled by ProtectedRoute) */}
          <Route path="/" element={<Navigate to="/admin" replace />} />
          
          {/* Global Fallback: Catch-all for unknown routes */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  </ThemeProvider>
);
