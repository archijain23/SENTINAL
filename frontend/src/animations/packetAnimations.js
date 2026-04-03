import { gsap } from 'gsap';

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Animate a DOM packet element along a defined SVG path or from point A → B.
 * Used in the ArchitectureFlow and NetworkTopology overlay layers.
 *
 * @param {HTMLElement} packet - The packet DOM element
 * @param {{x: number, y: number}} from - Start position (px, relative to container)
 * @param {{x: number, y: number}} to   - End position
 * @param {object} options
 */
export function animatePacket(packet, from, to, options = {}) {
  if (!packet || prefersReducedMotion()) return;

  const {
    duration = 1.4,
    delay = 0,
    color = '#00F5FF',
    onComplete = null,
    attack = false,
    blocked = false,
  } = options;

  gsap.set(packet, {
    x: from.x,
    y: from.y,
    opacity: 1,
    scale: 1,
    backgroundColor: attack ? '#FF3D71' : color,
    boxShadow: attack
      ? '0 0 10px #FF3D71, 0 0 20px #FF3D71'
      : `0 0 8px ${color}, 0 0 16px ${color}`,
  });

  const tl = gsap.timeline({ delay, onComplete });

  if (blocked) {
    // Packet travels halfway then stops with a flash
    const midX = from.x + (to.x - from.x) * 0.5;
    const midY = from.y + (to.y - from.y) * 0.5;
    tl.to(packet, {
      x: midX,
      y: midY,
      duration: duration * 0.5,
      ease: 'power2.out',
    }).to(packet, {
      scale: 1.8,
      opacity: 0,
      backgroundColor: '#FF3D71',
      boxShadow: '0 0 20px #FF3D71, 0 0 40px #FF3D71',
      duration: 0.3,
      ease: 'power3.out',
    });
  } else {
    tl.to(packet, {
      x: to.x,
      y: to.y,
      duration,
      ease: 'power1.inOut',
    }).to(
      packet,
      {
        opacity: 0,
        scale: 0.6,
        duration: 0.2,
        ease: 'power2.in',
      },
      `-=${duration * 0.15}`
    );
  }

  return tl;
}

/**
 * Continuously loop packets between pipeline nodes.
 * @param {HTMLElement[]} packets - Array of packet DOM elements
 * @param {Array<{from, to}>} routes - Array of route definitions
 */
export function loopPackets(packets, routes) {
  if (!packets?.length || prefersReducedMotion()) return;

  packets.forEach((packet, i) => {
    const route = routes[i % routes.length];
    const loopFn = () => {
      animatePacket(packet, route.from, route.to, {
        duration: 1.2 + Math.random() * 0.8,
        delay: Math.random() * 0.4,
        attack: Math.random() < 0.15,
        blocked: Math.random() < 0.1,
        onComplete: () => setTimeout(loopFn, 400 + Math.random() * 600),
      });
    };
    setTimeout(loopFn, i * 200);
  });
}

/**
 * Spawn a single attack flash on a node element.
 * @param {HTMLElement} node
 */
export function flashAttackNode(node) {
  if (!node || prefersReducedMotion()) return;

  gsap.fromTo(
    node,
    { boxShadow: '0 0 0px #FF3D71', borderColor: '#FF3D71' },
    {
      boxShadow: '0 0 0 6px rgba(255,61,113,0.3), 0 0 30px #FF3D71',
      borderColor: '#FF3D71',
      duration: 0.25,
      yoyo: true,
      repeat: 3,
      ease: 'power2.inOut',
    }
  );
}

/**
 * Ripple shield impact — expands outward from center.
 * @param {HTMLElement} rippleEl
 */
export function shieldImpactRipple(rippleEl) {
  if (!rippleEl || prefersReducedMotion()) return;

  gsap.fromTo(
    rippleEl,
    { scale: 0.6, opacity: 0.9, borderColor: '#FF3D71' },
    {
      scale: 2.2,
      opacity: 0,
      duration: 0.9,
      ease: 'power2.out',
      borderColor: '#FF3D71',
    }
  );
}

/**
 * Scanning wave — CSS ring that expands radially.
 * @param {HTMLElement} ring
 */
export function scanWave(ring) {
  if (!ring || prefersReducedMotion()) return;

  gsap.fromTo(
    ring,
    { scale: 0.3, opacity: 0.7 },
    {
      scale: 1.6,
      opacity: 0,
      duration: 2,
      ease: 'sine.out',
      repeat: -1,
      repeatDelay: 0.5,
    }
  );
}
