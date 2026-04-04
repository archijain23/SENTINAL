import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();
  const location  = useLocation();
  const from      = location.state?.from?.pathname ?? '/app/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    await new Promise(r => setTimeout(r, 400)); // simulated latency
    const result = login(username, password);
    setLoading(false);
    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.error);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{
        background: '#0B0F19',
        backgroundImage: 'linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div style={{ position:'absolute', top:'30%', left:'50%', transform:'translate(-50%,-50%)', width:'600px', height:'400px', background:'radial-gradient(ellipse, rgba(0,245,255,0.05) 0%, transparent 70%)', borderRadius:'50%' }} />
      </div>

      <div className="relative w-full max-w-sm px-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
            style={{ background:'rgba(0,245,255,0.08)', border:'1px solid rgba(0,245,255,0.2)', boxShadow:'0 0 24px rgba(0,245,255,0.1)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C17.5 22.15 21 17.25 21 12V6L12 2z"
                stroke="#00F5FF" strokeWidth="1.5" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="text-lg font-display font-bold tracking-[0.2em]" style={{ color:'#00F5FF' }}>SENTINAL</h1>
          <p className="text-[10px] font-mono tracking-[0.3em] mt-1" style={{ color:'#3D4663' }}>SECURITY OPERATIONS CENTER</p>
        </div>

        {/* Form card */}
        <div className="glass-panel p-6" style={{ boxShadow:'0 8px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(0,245,255,0.08)' }}>
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase mb-6" style={{ color:'#6B7894' }}>AUTHENTICATE / OPERATOR ACCESS</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color:'#6B7894' }}>USERNAME</label>
              <input
                id="username"
                type="text"
                autoComplete="username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs font-mono rounded outline-none transition-all duration-180"
                style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(0,245,255,0.12)', color:'#E2E8F0', caretColor:'#00F5FF' }}
                onFocus={e => e.target.style.borderColor='rgba(0,245,255,0.4)'}
                onBlur={e  => e.target.style.borderColor='rgba(0,245,255,0.12)'}
                placeholder="admin"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-[10px] font-mono tracking-widest uppercase mb-1.5" style={{ color:'#6B7894' }}>PASSWORD</label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2.5 text-xs font-mono rounded outline-none transition-all duration-180"
                style={{ background:'rgba(0,0,0,0.3)', border:'1px solid rgba(0,245,255,0.12)', color:'#E2E8F0', caretColor:'#00F5FF' }}
                onFocus={e => e.target.style.borderColor='rgba(0,245,255,0.4)'}
                onBlur={e  => e.target.style.borderColor='rgba(0,245,255,0.12)'}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 px-3 py-2 rounded text-[10px] font-mono" style={{ background:'rgba(255,61,113,0.08)', border:'1px solid rgba(255,61,113,0.2)', color:'#FF3D71' }}>
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background:'#FF3D71' }} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 text-xs font-mono font-bold tracking-[0.15em] uppercase rounded transition-all duration-180"
              style={{ background: loading ? 'rgba(0,245,255,0.3)' : '#00F5FF', color:'#0B0F19', cursor: loading ? 'wait' : 'pointer' }}
            >
              {loading ? 'AUTHENTICATING...' : 'ACCESS SYSTEM'}
            </button>
          </form>

          <p className="text-center text-[9px] font-mono mt-5" style={{ color:'#3D4663' }}>
            DEMO: admin / sentinal
          </p>
        </div>
      </div>
    </div>
  );
}
