import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const useAuthFlow = () => {
  const navigate = useNavigate();
  const { user, profile, signInWithPassword, resetPassword } = useAuth();
  
  const [mode, setMode] = useState('LOGIN'); // LOGIN, REGISTER, VERIFY, AWAIT_LINK, RECOVER, RECOVER_VERIFY, RESET
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');

  // Auto-redirect whenever session and profile are both available
  useEffect(() => {
    if (user && profile) {
      const routes = {
        ADMIN: '/admin',
        SUPER_ADMIN: '/admin',
        STAFF: '/staff',
        CUSTOMER: '/customer'
      };
      // Only redirect if we're not currently in the middle of a password reset
      if (mode !== 'RESET') {
        navigate(routes[profile.role] || '/customer');
      }
    }
  }, [user, profile, mode, navigate]);

  const login = async (email, password) => {
    setIsLoading(true);
    try {
      const { error } = await signInWithPassword(email, password);
      if (error) throw error;
      
      toast.success('Successfully logged in!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', backdropFilter: 'blur(12px)' }
      });
    } catch (error) {
      toast.error(error.message || 'Login failed.', {
        style: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(12px)' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startRegister = async (userData) => {
    setIsLoading(true);
    try {
      if (userData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      if (!userData.firstName || !userData.lastName) {
        throw new Error('First and last name are required.');
      }

      setVerificationEmail(userData.email);

      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const response = await fetch(`${BACKEND_URL}/customer/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: userData.email,
          password: userData.password,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Registration failed.');
      }

      toast.success('Registration successful!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', backdropFilter: 'blur(12px)' }
      });
      
      setMode('AWAIT_LINK');
    } catch (error) {
      toast.error(error.message || 'Registration failed.', {
        style: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(12px)' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async (otpCode) => {
    setIsLoading(true);
    try {
      // verifyOtp is now only used for Password Recovery flows
      if (mode === 'RECOVER_VERIFY') {
        setMode('RESET');
      }
    } catch (error) {
      toast.error(error.message, {
        style: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(12px)' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const recoverPassword = async (email) => {
    setIsLoading(true);
    try {
      const { error } = await resetPassword(email);
      if (error) throw error;
      
      setVerificationEmail(email);
      toast.success('Recovery link sent to your email!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', backdropFilter: 'blur(12px)' }
      });
      setMode('LOGIN'); // Or a custom recovery await view
    } catch (error) {
      toast.error(error.message, {
        style: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(12px)' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (newPassword) => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success('Password updated successfully!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', backdropFilter: 'blur(12px)' }
      });
      setMode('LOGIN');
    } catch (error) {
      toast.error(error.message, {
        style: { background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)', backdropFilter: 'blur(12px)' }
      });
    } finally {
      setIsLoading(false);
    }
  };

  return {
    mode,
    setMode,
    isLoading,
    verificationEmail,
    login,
    startRegister,
    verifyOtp,
    recoverPassword,
    updatePassword
  };
};
