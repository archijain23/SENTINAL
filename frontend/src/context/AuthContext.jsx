import { createContext, useContext, useState, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Stored in memory only — no localStorage (sandboxed iframe blocks it)
  const [user, setUser] = useState(null);

  const login = useCallback((username, password) => {
    // Simple in-memory auth gate — replace with real API call in production
    if (username === 'admin' && password === 'sentinal') {
      setUser({ username, role: 'admin', token: 'demo-token' });
      return { success: true };
    }
    return { success: false, error: 'Invalid credentials' };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
