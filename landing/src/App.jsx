/**
 * SENTINAL Landing Page — App root
 * Stage 1: Skeleton — mounts all section components in correct order.
 * Each section is a stub; full 3D + animation added in subsequent stages.
 */
import Navbar            from './components/Navbar.jsx';
import HeroScene         from './components/HeroScene.jsx';
import NetworkTopology   from './components/NetworkTopology.jsx';
import DefenseShield     from './components/DefenseShield.jsx';
import ThreatScanner     from './components/ThreatScanner.jsx';
import ArchitectureFlow  from './components/ArchitectureFlow.jsx';
import DashboardPreview  from './components/DashboardPreview.jsx';
import CTA               from './components/CTA.jsx';
import Footer            from './components/Footer.jsx';

export default function App() {
  return (
    <div className="app">
      <Navbar />
      <main>
        <HeroScene />
        <NetworkTopology />
        <DefenseShield />
        <ThreatScanner />
        <ArchitectureFlow />
        <DashboardPreview />
        <CTA />
      </main>
      <Footer />
    </div>
  );
}
