import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    // Safe fallback to avoid crashes if provider hasn't mounted yet
    return {
      user: null,
      loading: true,
      error: null,
      login: async () => {},
      register: async () => {},
      logout: () => {},
      updateUser: () => {},
      clearError: () => {},
      isAuthenticated: false,
    };
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Cookie helpers for session-mode storage
  const setCookie = (name, value, maxAgeSeconds) => {
    const parts = [`${name}=${encodeURIComponent(value)}`, 'path=/'];
    if (maxAgeSeconds && Number.isFinite(maxAgeSeconds)) parts.push(`max-age=${Math.floor(maxAgeSeconds)}`);
    document.cookie = parts.join('; ');
  };
  const getCookie = (name) => {
    const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()\[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  };
  const eraseCookie = (name) => { document.cookie = `${name}=; Max-Age=0; path=/`; };

  // Check if user is logged in on app start
  useEffect(() => {
    const rememberMe = localStorage.getItem('rememberMe');
    try {
      if (rememberMe === 'true') {
        // Persistent storage via localStorage
        const token = localStorage.getItem('accessToken');
        const userData = localStorage.getItem('user');
        if (token && userData) setUser(JSON.parse(userData));
      } else {
        // Session-first: check sessionStorage, then cookies
        const token = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('accessToken')) || getCookie('accessToken');
        const userData = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('user')) || getCookie('user');
        if (token && userData) setUser(JSON.parse(userData));
      }
    } catch (err) {
      console.error('Auth init error:', err);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
      eraseCookie('accessToken');
      eraseCookie('refreshToken');
      eraseCookie('user');
    }
    setLoading(false);
  }, []);

  const login = async (emailOrUsername, password, rememberMe = false) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emailOrUsername, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      // Store tokens and user data per mode
      if (rememberMe) {
        // 30-day persistent
        localStorage.setItem('accessToken', data.tokens.accessToken);
        localStorage.setItem('refreshToken', data.tokens.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('rememberMe', 'true');
        // Mirror in cookies for convenience (optional)
        setCookie('accessToken', data.tokens.accessToken, 60 * 60 * 24 * 30);
        setCookie('refreshToken', data.tokens.refreshToken, 60 * 60 * 24 * 30);
        setCookie('user', JSON.stringify(data.user), 60 * 60 * 24 * 30);
      } else {
        // Session mode: sessionStorage + session cookies
        localStorage.removeItem('rememberMe');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('accessToken', data.tokens.accessToken);
          sessionStorage.setItem('refreshToken', data.tokens.refreshToken);
          sessionStorage.setItem('user', JSON.stringify(data.user));
        }
        setCookie('accessToken', data.tokens.accessToken);
        setCookie('refreshToken', data.tokens.refreshToken);
        setCookie('user', JSON.stringify(data.user));
      }

      setUser(data.user);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('http://localhost:5000/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('accessToken');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('user');
    }
    eraseCookie('accessToken');
    eraseCookie('refreshToken');
    eraseCookie('user');
    setUser(null);
    setError(null);
  };

  const updateUser = (userData) => {
    setUser(userData);
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    if (rememberMe) {
      localStorage.setItem('user', JSON.stringify(userData));
      setCookie('user', JSON.stringify(userData), 60 * 60 * 24 * 30);
    } else {
      setCookie('user', JSON.stringify(userData));
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    login,
    register,
    logout,
    updateUser,
    clearError,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
