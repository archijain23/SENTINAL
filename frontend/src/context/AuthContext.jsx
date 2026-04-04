/**
 * AuthContext — minimal session auth for SENTINAL dashboard.
 * Credentials are validated client-side (demo mode).
 * No localStorage — uses React state + sessionStorage fallback.
 */
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

const DEMO_USERS = [
  { username: 'admin',   password: 'sentinal', role: 'admin'    },
  { username: 'analyst', password: 'sentinal', role: 'analyst'  },
];

function getStoredUser() {
  try {
    const raw = sessionStorage.getItem('sentinal_user');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => getStoredUser());

  function login(username, password) {
    const match = DEMO_USERS.find(
      u => u.username === username.trim().toLowerCase() && u.password === password
    );
    if (!match) return { success: false, error: 'Invalid credentials' };
    const profile = { username: match.username, role: match.role };
    setUser(profile);
    try { sessionStorage.setItem('sentinal_user', JSON.stringify(profile)); } catch {}
    return { success: true };
  }

  function logout() {
    setUser(null);
    try { sessionStorage.removeItem('sentinal_user'); } catch {}
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
