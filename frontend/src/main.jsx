import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UIProvider } from './context/UIContext';
import { AuthProvider } from './context/AuthContext';
import { UnifiedProvider } from './context/UnifiedContext';
import { ThemeProvider } from './context/ThemeContext';
import { ConfigProvider } from './context/ConfigContext';
import { ChatProvider } from './context/ChatContext';
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
import AdminWalkInForm from './pages/Admin/AdminWalkInWizard';
import StaffLayout from './pages/Staff/StaffLayout';
import StaffDashboard from './pages/Staff/StaffDashboard';
import StaffActiveJobs from './pages/Staff/StaffActiveJobs';
import StaffWorkHistory from './pages/Staff/StaffWorkHistory';
import StaffJobDetails from './pages/Staff/StaffJobDetails';
import StaffProfile from './pages/Staff/StaffProfile';
import StaffNotifications from './pages/Staff/StaffNotifications';
import StaffSettings from './pages/Staff/StaffSettings';
import Landing from './pages/Landing';
import Login from './pages/Login';
import ProtectedRoute from './components/ProtectedRoute';
import CustomerLayout from './pages/Customer/CustomerLayout';
import CustomerDashboard from './pages/Customer/CustomerDashboard';
import CustomerBookAppointment from './pages/Customer/CustomerBookAppointment';
import CustomerMyBookings from './pages/Customer/CustomerMyBookings';
import CustomerBilling from './pages/Customer/CustomerBilling';
import CustomerGarage from './pages/Customer/CustomerGarage';
import GlobalNotifications from "./pages/GlobalNotifications";
import CustomerSettings from './pages/Customer/CustomerSettings';
import CustomerProfile from './pages/Customer/CustomerProfile';
import CustomerBookingDetails from './pages/Customer/CustomerBookingDetails';
import CustomerReceipt from './pages/Customer/CustomerReceipt';
import './index.css';

const InputCapitalizationController = () => {
  useEffect(() => {
    const capitalizeFirstLetter = (event) => {
      const target = event.target;
      const isTextInput = target instanceof HTMLInputElement && target.type === 'text';
      const isTextArea = target instanceof HTMLTextAreaElement;
      if ((!isTextInput && !isTextArea) || target.dataset.noAutoCapitalize !== undefined) return;

      const match = target.value.match(/^(\s*)([a-z])/);
      if (!match) return;

      target.value = `${match[1]}${match[2].toUpperCase()}${target.value.slice(match[0].length)}`;
    };

    document.addEventListener('input', capitalizeFirstLetter, true);
    return () => document.removeEventListener('input', capitalizeFirstLetter, true);
  }, []);

  return null;
};

// Suppress React Router v7 Future Flag Warnings
const originalWarn = console.warn;
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('React Router Future Flag Warning')) {
    return;
  }
  originalWarn(...args);
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider>
    <ThemeProvider>
      <AuthProvider>
        <ChatProvider>
          <InputCapitalizationController />
          <UnifiedProvider>
            <BrowserRouter>
              <UIProvider>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<Landing />} />
                <Route path="/login" element={<Login />} />
                <Route path="/accept-invite" element={<AdminAcceptInvite />} />

                {/* Admin Routes */}
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['ADMIN']}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<AdminDashboard />} />
                  <Route path="walk-in" element={<AdminWalkInForm />} />
                  <Route path="bookings" element={<AdminBookings />} />
                  <Route path="bookings/:id" element={<AdminBookingDetails />} />
                  <Route path="schedule" element={<AdminSchedule />} />
                  <Route path="payments" element={<AdminPayments />} />
                  <Route path="refunds" element={<AdminRefunds />} />
                  <Route path="analytics" element={<AdminSalesReport />} />
                  <Route path="finance" element={<AdminSalesReport />} />
                  <Route path="audit-logs" element={<AdminAuditLogs />} />
                  <Route path="accounts" element={<AdminAccountsManagement />} />
                  <Route path="users" element={<AdminUserManagement />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="notifications" element={<AdminNotifications />} />
                  <Route path="slots" element={<Navigate to="/admin/schedule" replace />} />
                  <Route path="profile" element={<AdminProfile />} />
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
                  <Route path="tasks" element={<StaffActiveJobs />} />
                  <Route path="history" element={<StaffWorkHistory />} />
                  <Route path="job/:id" element={<StaffJobDetails />} />
                  <Route path="profile" element={<StaffProfile />} />
                  <Route path="notifications" element={<StaffNotifications />} />
                  <Route path="settings" element={<StaffSettings />} />
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
                  <Route path="notifications" element={<GlobalNotifications />} />
                  <Route path="settings" element={<CustomerSettings />} />
                  <Route path="profile" element={<CustomerProfile />} />
                  <Route path="receipt/:id" element={<CustomerReceipt />} />
                </Route>
                </Routes>
              </UIProvider>
            </BrowserRouter>
          </UnifiedProvider>
        </ChatProvider>
      </AuthProvider>
    </ThemeProvider>
  </ConfigProvider>
);
