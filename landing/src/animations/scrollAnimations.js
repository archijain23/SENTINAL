import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── Navbar shrink on scroll ──────────────────────────────────────────────────
export function initNavbarAnimation(navRef) {
  if (!navRef?.current || prefersReducedMotion()) return;

  gsap.to(navRef.current, {
    scrollTrigger: {
      trigger: document.body,
      start: 'top top',
      end: '+=120',
      scrub: true,
    },
    paddingTop: '0.5rem',
    paddingBottom: '0.5rem',
    backdropFilter: 'blur(24px)',
    backgroundColor: 'rgba(11,15,25,0.95)',
    ease: 'none',
  });
}

// ─── Hero fade-in on load ──────────────────────────────────────────────────────
export function initHeroAnimation(heroRef) {
  if (!heroRef?.current || prefersReducedMotion()) return;

  const tl = gsap.timeline({ delay: 0.2 });
  tl.fromTo(
    heroRef.current.querySelectorAll('.hero-line'),
    { opacity: 0, y: 40 },
    { opacity: 1, y: 0, duration: 0.9, stagger: 0.18, ease: 'power3.out' }
  ).fromTo(
    heroRef.current.querySelectorAll('.hero-meta'),
    { opacity: 0, y: 20 },
    { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power2.out' },
    '-=0.4'
  );
}

// ─── Generic section slide-up ─────────────────────────────────────────────────
// immediateRender:false prevents GSAP from setting opacity:0 on mount.
// Without it, lazy-loaded sections that mount after the user scrolls past
// their trigger point stay invisible forever (ScrollTrigger never re-fires).
export function initSectionReveal(selector = '.section-reveal') {
  if (prefersReducedMotion()) return;

  gsap.utils.toArray(selector).forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, y: 60 },
      {
        opacity: 1,
        y: 0,
        duration: 0.85,
        ease: 'power3.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: el,
          start: 'top 82%',
          toggleActions: 'play none none none',
        },
      }
    );
  });
}

// ─── Text reveal char by char ──────────────────────────────────────────────────
export function initTextReveal(selector = '.text-reveal') {
  if (prefersReducedMotion()) return;

  gsap.utils.toArray(selector).forEach((el) => {
    gsap.fromTo(
      el,
      { opacity: 0, clipPath: 'inset(0 100% 0 0)' },
      {
        opacity: 1,
        clipPath: 'inset(0 0% 0 0)',
        duration: 1.1,
        ease: 'power4.out',
        immediateRender: false,
        scrollTrigger: {
          trigger: el,
          start: 'top 85%',
          toggleActions: 'play none none none',
        },
      }
    );
  });
}

// ─── Feature cards stagger ────────────────────────────────────────────────────
export function initFeatureCardsStagger(containerRef) {
  if (!containerRef?.current || prefersReducedMotion()) return;

  const cards = containerRef.current.querySelectorAll('.feature-card');
  gsap.fromTo(
    cards,
    { opacity: 0, y: 50, scale: 0.96 },
    {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.7,
      stagger: 0.1,
      ease: 'power3.out',
      immediateRender: false,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 78%',
        toggleActions: 'play none none none',
      },
    }
  );
}

// ─── Background parallax ──────────────────────────────────────────────────────
export function initParallax(selector = '.parallax-bg', speed = 0.4) {
  if (prefersReducedMotion()) return;

  gsap.utils.toArray(selector).forEach((el) => {
    gsap.to(el, {
      yPercent: -30 * speed,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true,
      },
    });
  });
}

// ─── Architecture flow nodes ───────────────────────────────────────────────────
export function initArchitectureFlow(containerRef) {
  if (!containerRef?.current || prefersReducedMotion()) return;

  const nodes = containerRef.current.querySelectorAll('.arch-node');
  const connectors = containerRef.current.querySelectorAll('.arch-connector');

  gsap.fromTo(
    nodes,
    { opacity: 0, scale: 0.7 },
    {
      opacity: 1,
      scale: 1,
      duration: 0.6,
      stagger: 0.15,
      ease: 'back.out(1.4)',
      immediateRender: false,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 75%',
        toggleActions: 'play none none none',
      },
    }
  );

  gsap.fromTo(
    connectors,
    { scaleX: 0, opacity: 0, transformOrigin: 'left center' },
    {
      scaleX: 1,
      opacity: 1,
      duration: 0.5,
      stagger: 0.15,
      ease: 'power2.out',
      immediateRender: false,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 70%',
        toggleActions: 'play none none none',
      },
      delay: 0.3,
    }
  );
}

// ─── Dashboard preview slide-in ───────────────────────────────────────────────
export function initDashboardReveal(containerRef) {
  if (!containerRef?.current || prefersReducedMotion()) return;

  gsap.fromTo(
    containerRef.current,
    { opacity: 0, y: 80, rotateX: 8 },
    {
      opacity: 1,
      y: 0,
      rotateX: 0,
      duration: 1.1,
      ease: 'power4.out',
      immediateRender: false,
      scrollTrigger: {
        trigger: containerRef.current,
        start: 'top 80%',
        toggleActions: 'play none none none',
      },
    }
  );
}

// ─── Alert pulse ──────────────────────────────────────────────────────────────
export function pulseAlert(el) {
  if (!el || prefersReducedMotion()) return;
  gsap.fromTo(
    el,
    { scale: 1, opacity: 1 },
    {
      scale: 1.4,
      opacity: 0,
      duration: 0.6,
      ease: 'power2.out',
      repeat: -1,
      repeatDelay: 1.2,
    }
  );
}

// ─── Kill all ScrollTriggers (cleanup) ────────────────────────────────────────
export function killAllScrollTriggers() {
  ScrollTrigger.getAll().forEach((t) => t.kill());
}
