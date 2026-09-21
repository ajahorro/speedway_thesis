import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const useAuthFlow = () => {
  const navigate = useNavigate();
  const { user, profile, signInWithPassword, requestPasswordReset } = useAuth();
  
  const [mode, setMode] = useState('LOGIN'); // LOGIN, REGISTER, VERIFY, AWAIT_LINK, RECOVER, RECOVER_VERIFY, RESET
  const [isLoading, setIsLoading] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [loginError, setLoginError] = useState('');

  // Auto-redirect whenever session and profile are both available
  useEffect(() => {
    if (user && profile) {
      const routes = {
        ADMIN: '/admin',
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
    setLoginError('');
    try {
      const { error } = await signInWithPassword(email, password);
      if (error) throw error;
      
      toast.success('Successfully logged in!', {
        style: { background: 'var(--admin-card)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)', backdropFilter: 'blur(12px)' }
      });
    } catch (error) {
      setLoginError(error.message || 'Login failed.');
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
      const email = userData.email.trim().toLowerCase();
      const fullName = `${userData.firstName.trim()} ${userData.lastName.trim()}`.trim();
      if (userData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }
      if (!userData.firstName.trim() || !userData.lastName.trim()) {
        throw new Error('First and last name are required.');
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password: userData.password,
        options: {
          data: {
            full_name: fullName,
            first_name: userData.firstName.trim(),
            last_name: userData.lastName.trim(),
            phone_number: userData.phone.trim(),
            role: 'CUSTOMER'
          }
        }
      });
      if (error) throw error;

      if (data.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
          id: data.user.id,
          email,
          full_name: fullName,
          first_name: userData.firstName.trim(),
          last_name: userData.lastName.trim(),
          phone_number: userData.phone.trim(),
          role: 'CUSTOMER',
          is_active: true
        }, { onConflict: 'id' });
        if (profileError) throw profileError;
      }

      setVerificationEmail(email);

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
      // Route through backend relay for branded Resend delivery
      const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
      const res = await fetch(`${BACKEND_URL}/api/auth/recover-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.error || 'Recovery request failed');

      
      setVerificationEmail(email);
      toast.success('Recovery link sent to your email!', {
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

  const updatePassword = async (newPassword) => {
    setIsLoading(true);
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session?.user) {
        throw new Error('Your password reset link has expired or is invalid. Please request a fresh reset link from the login screen.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Tokenized recovery sessions must be closed after a successful password reset.
      await supabase.auth.signOut();

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
    updatePassword,
    loginError,
    clearLoginError: () => setLoginError(''),
  };
};
