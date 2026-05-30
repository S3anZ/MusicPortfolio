/**
 * scroll.js — Scroll-driven interactions
 *
 * Uses IntersectionObserver for section detection + scroll event
 * for progress bar (lightweight, passive).
 */

import { TRACK_NAMES, getNowPlaying } from './audio.js';
import { playAmbient } from './ambient.js';
import { isUnlocked } from './audio.js';
import { gsap } from 'gsap';
import { settingsState } from './settings.js';

// ── State ────────────────────────────────────────────────────
let lastSec = -1;
let sections = [];
let dots = [];
let abarTimers = {};  // track fade-out timers per section
let isAnimating = false;
let currentIdx = 0;
let scrollTarget = 0;
let scrollTween = null;
let snapTimer = null;

// Wheel interaction physics
let lastScrollDir = 0;
let accumulatedDelta = 0;
let decayTimer = null;
let lastStepTime = 0;
const STEP_COOLDOWN = 320;     // Minimum ms between consecutive steps in the same direction
const DELTA_THRESHOLD = 45;    // Wheel delta threshold before triggering a step

// Helper to parse hex to [r, g, b] float array (0.0 to 1.0)
function hexToRgb(hex) {
  const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
  const fullHex = hex.replace(shorthandRegex, (m, r, g, b) => r + r + g + g + b + b);
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
  return result ? [
    parseInt(result[1], 16) / 255,
    parseInt(result[2], 16) / 255,
    parseInt(result[3], 16) / 255
  ] : [0, 0, 0];
}

// ── WebGL Aurora Dynamic Color Transition State ──────────────
const SECTION_AURORA_COLORS = {
  0: [hexToRgb('#c9a96e'), hexToRgb('#1a1202'), hexToRgb('#c9a96e')],  // Hero: Warm Gold
  1: [hexToRgb('#a07ec8'), hexToRgb('#140026'), hexToRgb('#a07ec8')],  // Track 1: Purple Insomanic
  2: [hexToRgb('#7eb8c8'), hexToRgb('#001b26'), hexToRgb('#7eb8c8')],  // Track 2: Blue Glass Stranger
  3: [hexToRgb('#c96e8f'), hexToRgb('#260012'), hexToRgb('#c96e8f')],  // Track 3: Pink Neon Ghost Rain
  4: [hexToRgb('#c9a96e'), hexToRgb('#261b00'), hexToRgb('#c9a96e')],  // Track 4: Gold Was It Ever Real
  5: [hexToRgb('#9ac87e'), hexToRgb('#0b2600'), hexToRgb('#9ac87e')],  // Track 5: Green Film You Never Shot
  6: [hexToRgb('#c8a07e'), hexToRgb('#261200'), hexToRgb('#c8a07e')],  // Track 6: Bronze Peace In Between
  7: [hexToRgb('#c9a96e'), hexToRgb('#1a1202'), hexToRgb('#c9a96e')]   // About: Warm Gold
};

let auroraInstance = null;
let currentAuroraColors = {
  r0: 201/255, g0: 169/255, b0: 110/255,
  r1: 26/255,  g1: 18/255,  b1: 2/255,
  r2: 201/255, g2: 169/255, b2: 110/255
};

export function setAuroraInstance(instance) {
  auroraInstance = instance;
  // Apply initial color stops immediately to prevent any visual pop on page load
  if (auroraInstance) {
    auroraInstance.updateColorStops([
      [currentAuroraColors.r0, currentAuroraColors.g0, currentAuroraColors.b0],
      [currentAuroraColors.r1, currentAuroraColors.g1, currentAuroraColors.b1],
      [currentAuroraColors.r2, currentAuroraColors.g2, currentAuroraColors.b2]
    ]);
  }
}

function transitionAuroraColors(index) {
  if (!auroraInstance) return;

  const targetColors = SECTION_AURORA_COLORS[index] || SECTION_AURORA_COLORS[0];

  // Kill active color transitions
  gsap.killTweensOf(currentAuroraColors);

  // Smoothly morph numeric float variables for mathematically perfect interpolation
  gsap.to(currentAuroraColors, {
    r0: targetColors[0][0], g0: targetColors[0][1], b0: targetColors[0][2],
    r1: targetColors[1][0], g1: targetColors[1][1], b1: targetColors[1][2],
    r2: targetColors[2][0], g2: targetColors[2][1], b2: targetColors[2][2],
    duration: 2.2, // Slow, magical 2.2s morphing transition
    ease: 'sine.out',
    onUpdate: () => {
      if (auroraInstance) {
        auroraInstance.updateColorStops([
          [currentAuroraColors.r0, currentAuroraColors.g0, currentAuroraColors.b0],
          [currentAuroraColors.r1, currentAuroraColors.g1, currentAuroraColors.b1],
          [currentAuroraColors.r2, currentAuroraColors.g2, currentAuroraColors.b2]
        ]);
      }
    }
  });
}

export function initScroll() {
  sections = document.querySelectorAll('.sec');
  dots = document.querySelectorAll('.dot');
  
  // Initialize virtual scrollTarget to actual scroll position
  scrollTarget = window.scrollY;

  const isTouch = window.matchMedia('(pointer: coarse)').matches;

  // Dot navigation click handlers
  dots.forEach((dot) => {
    const idx = parseInt(dot.dataset.i);
    if (!isNaN(idx)) {
      dot.addEventListener('click', () => {
        scrollToSection(idx);
      });
    }
  });

  // Progress bar + section detection on scroll
  window.addEventListener('scroll', onScroll, { passive: true });

  if (!isTouch) {
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown, { passive: false });
  }

  // Update scroll target on window resize to prevent alignment shifting
  window.addEventListener('resize', () => {
    scrollTarget = window.scrollY;
  });

  // Set up IntersectionObserver for element reveals
  setupRevealObserver();

  // Set up auto-pause when track sections leave viewport
  setupAutoPauseObserver();

  // Initial state
  onScroll();
}

function onScroll() {
  const sy = window.scrollY;
  const dh = document.documentElement.scrollHeight - window.innerHeight;

  // Progress bar
  const prog = document.getElementById('prog-top');
  if (prog && dh > 0) {
    const pct = (sy / dh) * 100;
    prog.style.width = pct + '%';
    prog.setAttribute('aria-valuenow', Math.round(pct));
  }

  // Current section detection (always active for smooth indicators)
  let activeIdx = 0;
  sections.forEach((s, i) => {
    if (sy >= s.offsetTop - window.innerHeight * 0.45) {
      activeIdx = i;
    }
  });
  currentIdx = activeIdx;

  // Update dots based on their data-i section mapping
  dots.forEach((d) => {
    const idx = parseInt(d.dataset.i);
    d.classList.toggle('on', idx === currentIdx);
  });

  // Hide dots when in hero section (scrolled < 60% of it), when in the About section (idx === 7), or at the footer/bottom
  const dotsNav = document.getElementById('dots');
  if (dotsNav) {
    const heroHeight = sections[0] ? sections[0].offsetHeight : window.innerHeight;
    const isAtBottom = (sy + window.innerHeight) >= (document.documentElement.scrollHeight - 60);
    if (sy < heroHeight * 0.6 || currentIdx === 7 || isAtBottom) {
      dotsNav.classList.add('hidden');
    } else {
      dotsNav.classList.remove('hidden');
    }
  }

  // Update nav counter
  const currSpan = document.getElementById('navCurr');
  const staticSpan = document.querySelector('.nc-static');
  
  if (currSpan && staticSpan) {
    let newCountStr = (currentIdx > 0 && currentIdx <= 6) ? String(currentIdx) : '—';
    staticSpan.style.display = (currentIdx > 0 && currentIdx <= 6) ? 'inline' : 'none';
    
    if (currSpan.textContent !== newCountStr) {
      if (lastSec !== -1 && currentIdx > 0 && currentIdx <= 6 && lastSec > 0 && lastSec <= 6) {
        const isDown = currentIdx > lastSec;
        const oldSpan = document.createElement('span');
        oldSpan.className = 'nc-curr';
        oldSpan.textContent = currSpan.textContent;
        currSpan.parentElement.appendChild(oldSpan);
        
        // Force reflow
        void oldSpan.offsetWidth;
        
        oldSpan.style.transform = isDown ? 'translateY(-100%)' : 'translateY(100%)';
        oldSpan.style.opacity = '0';
        setTimeout(() => oldSpan.remove(), 400);
        
        currSpan.style.transition = 'none';
        currSpan.style.transform = isDown ? 'translateY(100%)' : 'translateY(-100%)';
        currSpan.style.opacity = '0';
        currSpan.textContent = newCountStr;
        
        void currSpan.offsetWidth;
        currSpan.style.transition = '';
        currSpan.style.transform = 'translateY(0)';
        currSpan.style.opacity = '1';
      } else {
        currSpan.textContent = newCountStr;
      }
    }
  }

  // Section change actions
  if (currentIdx !== lastSec) {
    lastSec = currentIdx;

    // Play ambient drone
    if (isUnlocked()) {
      playAmbient(currentIdx);
    }

    // Trigger smooth morphing WebGL Aurora transition to match section mood colors
    transitionAuroraColors(currentIdx);

    // ── HUD and track name ──
    const hud = document.getElementById('hud');
    const nm = document.getElementById('hudName');
    const navCountEl = document.getElementById('navCount');
    
    if (hud) {
      if (currentIdx === 7 || currentIdx === 0) {
        hud.classList.add('hidden');
      } else {
        hud.classList.remove('hidden');
      }
    }
    
    if (nm) {
      if (currentIdx === 7 || currentIdx === 0) {
        // Hide HUD name on About section and Hero
        nm.classList.add('hidden');
        nm.classList.remove('on');
      } else if (currentIdx >= 1 && currentIdx <= 6) {
        // Show track name on track sections
        nm.classList.remove('hidden');
        nm.textContent = TRACK_NAMES[currentIdx];
        nm.classList.add('on');
        setTimeout(() => nm.classList.remove('on'), 3200);
      }
    }
    
    if (navCountEl) {
      if (currentIdx >= 1 && currentIdx <= 6) {
        navCountEl.classList.add('on');
        setTimeout(() => navCountEl.classList.remove('on'), 3200);
      }
    }

    // ── Dot label: show on section change, hide after 4s ──
    handleDotLabelFade(currentIdx);
  }
}

// ── Dot label auto-hide logic ────────────────────────────────
let dotLabelTimer = null;

function handleDotLabelFade(currentIdx) {
  // Clear previous timer
  if (dotLabelTimer) {
    clearTimeout(dotLabelTimer);
    dotLabelTimer = null;
  }

  // Show the active dot's label
  dots.forEach(d => d.classList.remove('label-hidden'));

  // Hide label after 4 seconds
  dotLabelTimer = setTimeout(() => {
    dots.forEach(d => d.classList.add('label-hidden'));
  }, 4000);
}

// ── IntersectionObserver for reveal animations ───────────────
function setupRevealObserver() {
  const revealTargets = document.querySelectorAll(
    '.t-meta, .t-title, .t-inf, .pctrl, .tags, .abar, .wash, #atext, #slinks'
  );

  if (!revealTargets.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('vis');
      }
    });
  }, {
    threshold: 0.15,
    rootMargin: '0px 0px -60px 0px',
  });

  revealTargets.forEach(el => observer.observe(el));
}

// ── Auto-pause when track section leaves viewport ────────────
function setupAutoPauseObserver() {
  const trackSections = document.querySelectorAll('.tsec');
  if (!trackSections.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) {
        if (!settingsState.stopOnScroll) return;
        // Section left the viewport — check if its track is playing
        const trackNum = parseInt(entry.target.dataset.track);
        if (trackNum && getNowPlaying() === trackNum) {
          // Click the pause button to trigger full UI reset
          const btn = document.getElementById('pb' + trackNum);
          if (btn && btn.classList.contains('playing')) {
            btn.click();
          }
        }
      }
    });
  }, {
    threshold: 0.05, // Consider "gone" when <5% visible
  });

  trackSections.forEach(sec => observer.observe(sec));
}

// Export goTo for external use
export function goTo(index) {
  scrollToSection(index);
}

export function scrollToSection(index) {
  if (index < 0 || index >= sections.length) return;

  isAnimating = true;
  currentIdx = index;
  scrollTarget = sections[index].offsetTop; // Keep target synchronized

  const targetY = sections[index].offsetTop;
  const scrollObj = { y: window.scrollY };

  // Kill any active scroll tweens
  if (scrollTween) {
    scrollTween.kill();
  }
  gsap.killTweensOf(scrollObj);

  // Sleek, slightly faster 0.95s curve with powerful deceleration
  scrollTween = gsap.to(scrollObj, {
    y: targetY,
    duration: 0.95,
    ease: 'power4.out',
    onUpdate: () => {
      window.scrollTo(0, scrollObj.y);
    },
    onComplete: () => {
      isAnimating = false;
      onScroll();
    }
  });
}

function onWheel(e) {
  e.preventDefault();

  accumulatedDelta += e.deltaY;

  // Decay accumulated delta if wheel activity stops for 150ms
  clearTimeout(decayTimer);
  decayTimer = setTimeout(() => {
    accumulatedDelta = 0;
  }, 150);

  const now = Date.now();
  if (Math.abs(accumulatedDelta) >= DELTA_THRESHOLD) {
    const dir = accumulatedDelta > 0 ? 1 : -1;
    
    // Bypass cooldown if direction changed (immediate responsive correction)
    const isOpposite = (dir > 0 && lastScrollDir < 0) || (dir < 0 && lastScrollDir > 0);
    
    if (now - lastStepTime < STEP_COOLDOWN && !isOpposite) {
      accumulatedDelta = 0;
      return;
    }
    
    accumulatedDelta = 0; // Reset accumulator
    lastStepTime = now;
    lastScrollDir = dir;

    let targetIdx = currentIdx + dir;
    targetIdx = Math.max(0, Math.min(sections.length - 1, targetIdx));

    if (targetIdx !== currentIdx) {
      scrollToSection(targetIdx);
    }
  }
}

function snapToNearest() {
  clearTimeout(snapTimer);
  
  const sy = window.scrollY;
  let closestIdx = 0;
  let minDiff = Infinity;

  sections.forEach((s, i) => {
    const diff = Math.abs(sy - s.offsetTop);
    if (diff < minDiff) {
      minDiff = diff;
      closestIdx = i;
    }
  });

  // Snap to the closest section if we're not perfectly aligned
  if (Math.abs(sy - sections[closestIdx].offsetTop) > 2) {
    scrollToSection(closestIdx);
  } else {
    isAnimating = false;
    currentIdx = closestIdx;
    onScroll();
  }
}

function onKeyDown(e) {
  const keys = ['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Space'];
  if (!keys.includes(e.key)) return;

  e.preventDefault();

  let dir = 0;
  if (e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === 'Space' && !e.shiftKey)) {
    dir = 1;
  } else if (e.key === 'ArrowUp' || e.key === 'PageUp' || (e.key === 'Space' && e.shiftKey)) {
    dir = -1;
  }

  const targetIdx = currentIdx + dir;
  if (targetIdx >= 0 && targetIdx < sections.length) {
    scrollToSection(targetIdx);
  }
}
