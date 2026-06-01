import Lenis from 'lenis';
import gsap from 'gsap';

let lenis = null;

export function initLenisScroll() {
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch) {
    return; // Completely disable Lenis on mobile to allow native touch scroll and CSS snapping
  }

  lenis = new Lenis({
    lerp: 0.15,
    wheelMultiplier: 1.7,
    smoothWheel: true,
    autoRaf: false
  });

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });

  gsap.ticker.lagSmoothing(0);
  
  // Initially stop lenis until we enter the tall section
  lenis.stop();
}

export function startLenis() {
  if (lenis) lenis.start();
}

export function stopLenis() {
  if (lenis) lenis.stop();
}
