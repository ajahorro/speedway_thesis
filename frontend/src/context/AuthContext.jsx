import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../utils/logger';
import toast from 'react-hot-toast';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState(null);
  
  const activeFetchRef = useRef(0);
  const fetchedForRef = useRef(null);
  const profileRef = useRef(null);

  // Sync ref with state
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);

  const signOut = async () => {
    try {
      logger.auth('Initiating sign out sequence...');
      setUser(null);
      setProfile(null);
      fetchedForRef.current = null;
      await supabase.auth.signOut();
      logger.auth('Sign out complete.');
    } catch (err) {
      logger.error('Sign Out Error', err);
    } finally {
      setLoading(false);
      setIsInitialized(true);
    }
  };

  const fetchProfile = useCallback(async (userId, source = 'unknown', force = false) => {
    if (!userId) return;
    
    if (!force && fetchedForRef.current === userId && profileRef.current) return;

    const fetchId = ++activeFetchRef.current;
    fetchedForRef.current = userId;

    try {
      setError(null);
      setLoading(true);
      
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select('id, role, email, is_active, deactivated_at, first_name, last_name, full_name, phone_number, is_clocked_in')
        .eq('id', userId)
        .maybeSingle();

      if (fetchId !== activeFetchRef.current) {
        logger.auth(`Ignoring stale response (ID: ${fetchId})`);
        return;
      }

      if (supabaseError) throw supabaseError;

      if (data) {
        if (data.is_active === false) {
          const deactDate = new Date(data.deactivated_at);
          const now = new Date();
          const diffDays = Math.ceil((now - deactDate) / (1000 * 60 * 60 * 24));
          
          if (diffDays <= 15) {
            const shouldRecover = window.confirm(`This account is DEACTIVATED (Day ${diffDays}/15). Would you like to RECOVER and reactivate it?`);
            if (shouldRecover) {
              const res = await recoverAccount(userId);
              if (res.success) return; // fetchProfile will be called again inside recoverAccount
            }
          } else {
            toast.error('Account has been permanently purged after grace period.');
          }
          await signOut();
          return;
        }
        setProfile(data);
      } else {
        logger.warn(`Profile missing for user (ID: ${fetchId})`);
        setProfile(null);
      }
    } catch (err) {
      if (fetchId !== activeFetchRef.current) return;
      logger.error(`Sync Error (ID: ${fetchId})`, err);
      setError(err.message);
    } finally {
      if (fetchId === activeFetchRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        logger.auth('Bootstrap initialization starting...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          // 🛡️ CRITICAL: Wait for profile before marking as initialized
          // to prevent landing page race conditions
          await fetchProfile(session.user.id, 'BOOTSTRAP');
        }

        setIsInitialized(true);
        logger.auth('Bootstrap complete.');
      } catch (err) {
        logger.error('Bootstrap Error', err);
        setIsInitialized(true);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return;

      logger.auth(`Event: ${event}`);
      
      if (session?.user) {
        setUser(session.user);
        if (event === 'SIGNED_IN' && fetchedForRef.current !== session.user.id) {
          fetchProfile(session.user.id, 'LISTENER_SIGN_IN');
        }
      } else {
        setUser(null);
        setProfile(null);
        fetchedForRef.current = null;
        setLoading(false);
        setIsInitialized(true);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signInWithPassword = async (email, password) => {
    logger.auth('Attempting sign in with credentials...');
    const result = await supabase.auth.signInWithPassword({ email, password });
    if (result.data?.user) {
      fetchProfile(result.data.user.id, 'MANUAL_LOGIN');
    }
    return result;
  };

  const resetPassword = async (email) => {
    logger.auth('Requesting password reset...');
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login?reset=true`,
    });
  };

  const updateProfile = async (updates) => {
    if (!user) return;
    logger.auth('Updating user profile...');
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    setProfile(data);
    return data;
  };

  const verifyPassword = async (password) => {
    if (!user) return { success: false, error: 'Not authenticated' };
    try {
      const response = await fetch('http://localhost:3000/api/auth/verify-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, password })
      });
      return await response.json();
    } catch (err) {
      return { success: false, error: 'Connection failed' };
    }
  };

  const requestEmailChange = async (newEmail) => {
    if (!user) return;
    try {
      const response = await fetch('http://localhost:3000/api/auth/request-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, oldEmail: user.email, newEmail })
      });
      return await response.json();
    } catch (err) {
      return { success: false, error: 'Request failed' };
    }
  };

  const confirmEmailChange = async (otp) => {
    if (!user) return;
    try {
      const response = await fetch('http://localhost:3000/api/auth/confirm-email-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, otp })
      });
      const result = await response.json();
      if (result.success) {
        await fetchProfile(user.id, 'EMAIL_CHANGE_COMPLETE');
      }
      return result;
    } catch (err) {
      return { success: false, error: 'Confirmation failed' };
    }
  };

  const deactivateAccount = async () => {
    if (!user) return;
    try {
      const response = await fetch('http://localhost:3000/api/auth/deactivate-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });
      const result = await response.json();
      if (result.success) {
        await signOut();
      }
      return result;
    } catch (err) {
      return { success: false, error: 'Deactivation failed' };
    }
  };

  const recoverAccount = async (userId) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: true, deactivated_at: null })
        .eq('id', userId);
      if (error) throw error;
      await fetchProfile(userId, 'ACCOUNT_RECOVERY');
      toast.success('Account successfully recovered!');
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  };

  const toggleShift = async (newStatus) => {
    if (!profile?.id) return;
    const toastId = toast.loading(newStatus ? 'Clocking in...' : 'Clocking out...');
    
    try {
      // 🛡️ REQ-AUTH-09: Use secure backend relay for administrative shift toggle
      // This bypasses RLS restrictions on the profiles table for staff.
      const response = await fetch('http://localhost:3000/api/staff/toggle-shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id, newStatus })
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Backend shift toggle failed');
      }

      // Immediately sync local state from the backend's source of truth
      if (result.profile) {
        setProfile(result.profile);
      }

      toast.success(newStatus ? 'Successfully Clocked In!' : 'Successfully Clocked Out!', { id: toastId });
      
      // Secondary background re-sync to ensure any other profile fields are fresh
      setTimeout(async () => {
        await fetchProfile(profile.id, 'SHIFT_TOGGLE', true);
      }, 500);

      return { success: true };
    } catch (err) {
      logger.error('Shift Toggle Relay Error', err);
      toast.error('Failed to update shift status. System relay unavailable.', { id: toastId });
      return { success: false, error: err.message };
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isInitialized, signInWithPassword, signOut, resetPassword, 
      updateProfile, verifyPassword, requestEmailChange, confirmEmailChange, deactivateAccount, recoverAccount, fetchProfile, setProfile,
      toggleShift
    }}>
      {children}
    </AuthContext.Provider>
  );
};
