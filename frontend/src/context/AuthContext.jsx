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

  const fetchProfile = useCallback(async (userId, source = 'unknown') => {
    if (!userId) return;
    
    if (fetchedForRef.current === userId && profile) return;

    const fetchId = ++activeFetchRef.current;
    fetchedForRef.current = userId;

    try {
      setError(null);
      setLoading(true);
      
      logger.auth(`Starting sync (ID: ${fetchId}, Source: ${source})`);
      
      const { data, error: supabaseError } = await supabase
        .from('profiles')
        .select('id, role, email, is_active, first_name, last_name')
        .eq('id', userId)
        .maybeSingle();

      if (fetchId !== activeFetchRef.current) {
        logger.auth(`Ignoring stale response (ID: ${fetchId})`);
        return;
      }

      if (supabaseError) throw supabaseError;

      if (data) {
        if (data.is_active === false) {
          toast.error('Account deactivated.');
          await signOut();
          return;
        }
        setProfile(data);
        logger.auth(`Sync successful (ID: ${fetchId})`);
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
  }, [profile]);

  useEffect(() => {
    const initAuth = async () => {
      try {
        logger.auth('Bootstrap initialization starting...');
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          setUser(session.user);
          fetchProfile(session.user.id, 'BOOTSTRAP');
        }

        setIsInitialized(true);
        logger.auth('Bootstrap complete.');
      } catch (err) {
        logger.error('Bootstrap Error', err);
        setIsInitialized(true);
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

  return (
    <AuthContext.Provider value={{ 
      user, profile, loading, isInitialized, signInWithPassword, signOut, resetPassword 
    }}>
      {children}
    </AuthContext.Provider>
  );
};
