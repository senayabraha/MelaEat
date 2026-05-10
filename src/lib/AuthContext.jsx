import React, { createContext, useState, useContext, useCallback, useEffect, useRef } from 'react';
import { melaeat, supabase } from '@/api/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const authRunId = useRef(0);

  const clearAuthState = useCallback(() => {
    melaeat.auth.clearCache();
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setAuthChecked(true);
    setIsLoadingAuth(false);
  }, []);

  const checkUserAuth = useCallback(async (sessionOverride) => {
    const runId = ++authRunId.current;
    setIsLoadingAuth(true);
    setAuthError(null);
    try {
      if (sessionOverride === null) {
        if (runId === authRunId.current) clearAuthState();
        return null;
      }

      const currentUser = sessionOverride
        ? await melaeat.auth.fromSession(sessionOverride)
        : await melaeat.auth.me();

      if (runId !== authRunId.current) return currentUser;

      if (!currentUser) {
        setUser(null);
        setIsAuthenticated(false);
        setAuthChecked(true);
        return null;
      }

      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthChecked(true);
      return currentUser;
    } catch (error) {
      if (runId !== authRunId.current) return null;
      console.error('Supabase auth check failed:', error);
      melaeat.auth.clearCache();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'unknown', message: error.message || 'Failed to load user' });
      setAuthChecked(true);
      return null;
    } finally {
      if (runId === authRunId.current) setIsLoadingAuth(false);
    }
  }, [clearAuthState]);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error || !data.session) {
        checkUserAuth(null);
        return;
      }
      checkUserAuth(data.session);
    });

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      if (event === 'SIGNED_OUT' || !session) {
        checkUserAuth(null);
        return;
      }

      checkUserAuth(session);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [checkUserAuth]);

  const logout = () => melaeat.auth.logout(user?.role);
  const navigateToLogin = () => melaeat.auth.redirectToLogin(window.location.href, user?.role);

  return (
    <AuthContext.Provider value={{
      user,
      isAuthenticated,
      isLoadingAuth,
      isLoadingPublicSettings: false,
      authError,
      appPublicSettings: null,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState: checkUserAuth,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
