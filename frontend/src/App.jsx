import { lazy, Suspense, useEffect, useRef, Component } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import './styles/globals.css';

gsap.registerPlugin(ScrollTrigger);

// ─── Eager (above fold) ─────────────────────────────────────────────────────
import Navbar from './components/Navbar';

// ─── Lazy (below fold) ─────────────────────────────────────────────────────
const HeroScene         = lazy(() => import('./components/HeroScene'));
const FeaturesSection   = lazy(() => import('./components/FeaturesSection'));
const ArchitectureFlow  = lazy(() => import('./components/ArchitectureFlow'));
const MonitoringSection = lazy(() => import('./components/MonitoringSection'));
const NexusPolicyEngine = lazy(() => import('./components/NexusPolicyEngine'));
const ActionQueue       = lazy(() => import('./components/ActionQueue'));
const DashboardPreview  = lazy(() => import('./components/DashboardPreview'));
const CTA               = lazy(() => import('./components/CTA'));
const Footer            = lazy(() => import('./components/Footer'));

// ─── Section skeleton ────────────────────────────────────────────────────────
function SectionSkeleton({ height = '60vh' }) {
  return (
    <div
      style={{ minHeight: height, background: 'rgba(11,15,25,0.5)' }}
      className="flex items-center justify-center"
      aria-hidden="true"
    >
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: 'rgba(0,245,255,0.3)',
              animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Error boundary ──────────────────────────────────────────────────────────
class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    if (import.meta.env.DEV) console.error('[Section]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div
          className="flex items-center justify-center py-20 text-xs font-mono"
          style={{ color: '#3D4663' }}
          role="alert"
        >
          SECTION UNAVAILABLE
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Wrapped section helper ──────────────────────────────────────────────────
function Section({ children, height }) {
  return (
    <SectionErrorBoundary>
      <Suspense fallback={<SectionSkeleton height={height} />}>
        {children}
      </Suspense>
    </SectionErrorBoundary>
  );
}

// ─── AI Detection section ─────────────────────────────────────────────────────
// Inline (not lazy) — NEVER set opacity:0 on mount.
// Use gsap.from with immediateRender:false so the element stays visible
// until ScrollTrigger fires, then animates in from below.
function AIDetectionSection() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ctx = gsap.context(() => {
      gsap.from(ref.current, {
        y: 60,
        opacity: 0,
        duration: 0.85,
        ease: 'power3.out',
        immediateRender: false, // ← CRITICAL: don't set opacity:0 before trigger fires
        scrollTrigger: {
          trigger: ref.current,
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section
      id="ai-detection"
      ref={ref}
      aria-label="SENTINAL AI Detection Engine"
      className="relative py-32 overflow-hidden"
    >
      <div className="absolute inset-0 cyber-grid opacity-15 pointer-events-none" aria-hidden="true" />
      <div className="relative z-10 max-w-7xl mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">

          {/* Left column */}
          <div>
            <p className="text-xs tracking-[0.3em] text-cyber-blue font-mono uppercase mb-3">
              SYS.AI — DETECTION ENGINE
            </p>
            <h2 className="text-3xl font-display font-bold text-white mb-6">
              Transformer Model
              <br />
              <span className="text-cyber-blue">Trained on Attacks</span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-8">
              Our detection model processes every request as a structured token
              sequence — headers, payload, timing, and behavioral signals scored
              simultaneously against a 99.7%-accurate anomaly classifier.
            </p>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Model Accuracy',      value: '99.7%',  color: '#00F5FF' },
                { label: 'False Positive Rate', value: '0.003%', color: '#00FF88' },
                { label: 'Attack Signatures',   value: '2.4M+',  color: '#00F5FF' },
                { label: 'Model Version',       value: 'v7.2',   color: '#FFB800' },
              ].map((stat) => (
                <div key={stat.label} className="glass-panel rounded-xl p-4">
                  <p
                    className="text-2xl font-display font-bold tabular-nums mb-1"
                    style={{ color: stat.color }}
                  >
                    {stat.value}
                  </p>
                  <p className="text-[9px] font-mono text-gray-600 uppercase tracking-widest">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Right column — neural network SVG */}
          <div
            className="relative flex items-center justify-center"
            role="img"
            aria-label="Neural network diagram representing AI detection model"
          >
            <svg
              viewBox="0 0 320 280"
              className="w-full max-w-sm"
              fill="none"
              aria-hidden="true"
            >
              {['INPUT', 'HIDDEN 1', 'HIDDEN 2', 'OUTPUT'].map((l, i) => (
                <text key={l} x={30 + i * 85} y="18" textAnchor="middle"
                  fill="rgba(0,245,255,0.3)" fontSize="7" fontFamily="monospace">
                  {l}
                </text>
              ))}
              {[
                ...[[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1],[2,2]].map(
                  ([a,b]) => ({ x1:30,  y1:60+a*60,  x2:115, y2:50+b*70,  attack: a===1 && b===1 })
                ),
                ...[[0,0],[0,1],[1,0],[1,1],[1,2],[2,1],[2,2]].map(
                  ([a,b]) => ({ x1:115, y1:50+a*70,  x2:200, y2:55+b*60,  attack: false })
                ),
                ...[[0,0],[1,0],[1,1],[2,1]].map(
                  ([a,b]) => ({ x1:200, y1:55+a*60,  x2:285, y2:90+b*80,  attack: false })
                ),
              ].map((edge, i) => (
                <line key={i}
                  x1={edge.x1} y1={edge.y1} x2={edge.x2} y2={edge.y2}
                  stroke={edge.attack ? '#FF3D71' : 'rgba(0,245,255,0.12)'}
                  strokeWidth={edge.attack ? '1.5' : '0.8'}
                />
              ))}
              {[60,120,180].map((y,i) => (
                <circle key={i} cx="30" cy={y} r="8"
                  fill="rgba(0,245,255,0.08)" stroke="#00F5FF" strokeWidth="1" />
              ))}
              {[50,120,190].map((y,i) => (
                <circle key={i} cx="115" cy={y} r="8"
                  fill={i===1 ? 'rgba(255,61,113,0.15)' : 'rgba(0,245,255,0.06)'}
                  stroke={i===1 ? '#FF3D71' : 'rgba(0,245,255,0.4)'} strokeWidth="1" />
              ))}
              {[55,115,175].map((y,i) => (
                <circle key={i} cx="200" cy={y} r="8"
                  fill="rgba(0,245,255,0.06)" stroke="rgba(0,245,255,0.4)" strokeWidth="1" />
              ))}
              {[90,170].map((y,i) => (
                <circle key={i} cx="285" cy={y} r="10"
                  fill={i===0 ? 'rgba(255,61,113,0.15)' : 'rgba(0,255,136,0.1)'}
                  stroke={i===0 ? '#FF3D71' : '#00FF88'} strokeWidth="1.5" />
              ))}
              <text x="304" y="94"  fill="#FF3D71" fontSize="8" fontFamily="monospace">THREAT</text>
              <text x="304" y="174" fill="#00FF88" fontSize="8" fontFamily="monospace">CLEAN</text>
              <circle cx="115" cy="120" r="14"
                fill="none" stroke="#FF3D71" strokeWidth="1"
                strokeDasharray="3 2" opacity="0.6" />
              <text x="115" y="124" textAnchor="middle"
                fill="#FF3D71" fontSize="6" fontFamily="monospace">ANOM</text>
            </svg>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── App ────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <>
      <Navbar />
      <main
        id="main-content"
        className="relative"
        style={{ background: '#0B0F19', minHeight: '100dvh' }}
      >
        <Section height="100vh"><HeroScene /></Section>
        <Section height="80vh"><FeaturesSection /></Section>
        <Section height="70vh"><ArchitectureFlow /></Section>
        <Section height="80vh"><MonitoringSection /></Section>

        {/* AIDetectionSection is NOT lazy — always rendered, never hidden */}
        <AIDetectionSection />

        <Section height="80vh"><NexusPolicyEngine /></Section>
        <Section height="80vh"><ActionQueue /></Section>
        <Section height="70vh"><DashboardPreview /></Section>
        <Section height="60vh"><CTA /></Section>
      </main>
      <Section height="20vh"><Footer /></Section>
    </>
  );
}
