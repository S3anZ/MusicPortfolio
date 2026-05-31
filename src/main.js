/**
 * main.js — SeanZ Portfolio entry point
 *
 * Imports all modules, initialises the app, and wires up
 * event handlers for audio playback + visualisation.
 */

import './style.css';
import { initCursor, setCursorLabel } from './cursor.js';
import { initAudio, toggle, seek, formatTime, getAudioContext, TRACK_NAMES, TRACKS, TRACK_ACCENTS, getNowPlaying } from './audio.js';
import { setAudioContext, playAmbient } from './ambient.js';
import { buildWaveforms, startVisualiserLoop, resetBars } from './visualiser.js';
import { initScroll, setAuroraInstance, goTo } from './scroll.js';
import { toast } from './toast.js';
import { loadLyrics, updateLyrics, hideLyrics } from './lyrics.js';
import initBounceCards from './BounceCards.js';
import initAurora from './Aurora.js';
import { initSettings, settingsState } from './settings.js';

// ── Player UI helpers ────────────────────────────────────────
const DEFAULT_TITLE = "SeanZ — Producer Portfolio · A Sound Unfinished";

function onPlay(trackNum) {
  const btn = document.getElementById('pb' + trackNum);
  const wf = document.getElementById('wf' + trackNum);
  const hudEq = document.getElementById('hudEq');
  const hudName = document.getElementById('hudName');
  const sec = document.getElementById('s' + trackNum);

  if (btn) { btn.textContent = '❚❚'; btn.classList.add('playing'); btn.setAttribute('aria-label', 'Pause ' + TRACK_NAMES[trackNum]); }
  if (wf) wf.classList.add('playing');
  if (hudEq) hudEq.classList.add('playing');
  if (hudName) { hudName.textContent = TRACK_NAMES[trackNum]; hudName.classList.add('on'); }
  if (sec) sec.classList.add('playing');

  // Update tab title to reflect playing track
  document.title = `▶︎ Playing - ${TRACK_NAMES[trackNum]}`;

  // Set hero section accent color
  document.documentElement.style.setProperty('--hero-accent-color', TRACK_ACCENTS[trackNum]);

  // Start visualiser loop (idempotent — safe to call multiple times)
  startVisualiserLoop();
}

function onPause(trackNum) {
  const btn = document.getElementById('pb' + trackNum);
  const wf = document.getElementById('wf' + trackNum);
  const hudEq = document.getElementById('hudEq');
  const sec = document.getElementById('s' + trackNum);

  if (btn) { btn.textContent = '▶'; btn.classList.remove('playing'); btn.setAttribute('aria-label', 'Play ' + TRACK_NAMES[trackNum]); }
  if (wf) wf.classList.remove('playing');
  if (hudEq) hudEq.classList.remove('playing');
  if (sec) sec.classList.remove('playing');

  // Revert tab title to default if nothing else is playing
  if (getNowPlaying() === null) {
    document.title = DEFAULT_TITLE;
  }

  // Revert hero section accent color if nothing is playing, or switch to the other playing track
  const activeTrack = getNowPlaying();
  if (activeTrack === null) {
    document.documentElement.style.removeProperty('--hero-accent-color');
  } else {
    document.documentElement.style.setProperty('--hero-accent-color', TRACK_ACCENTS[activeTrack]);
  }

  // Reset waveform bars to resting state
  resetBars(trackNum);
  hideLyrics(trackNum);
}

function onEnd(trackNum) {
  const activeTrack = getNowPlaying();
  if (activeTrack !== null && activeTrack !== trackNum) {
    // If another track is currently playing (e.g. crossfaded), just clean up UI
    resetBars(trackNum);
    hideLyrics(trackNum);
    return;
  }

  onPause(trackNum);

  if (settingsState.autoplay && trackNum < 6) {
    const nextTrack = trackNum + 1;
    goTo(nextTrack);

    // Slight delay to allow scroll animation to engage
    setTimeout(() => {
      const nextBtn = document.getElementById('pb' + nextTrack);
      if (nextBtn) nextBtn.click();
    }, 800);
  }
}

function onTick(trackNum, audioEl) {
  if (getNowPlaying() !== trackNum) return;
  if (!audioEl || !audioEl.duration) return;
  const pct = (audioEl.currentTime / audioEl.duration) * 100;
  const pf = document.getElementById('pf' + trackNum);
  const pt = document.getElementById('pt' + trackNum);

  if (pf) pf.style.width = pct + '%';
  if (pt) pt.textContent = formatTime(audioEl.currentTime) + ' / ' + formatTime(audioEl.duration);
  updateLyrics(trackNum, audioEl.currentTime, audioEl.duration);

  // Crossfade Autoplay Overlap
  if (settingsState.autoplay && settingsState.crossfade && trackNum < 6 && getNowPlaying() === trackNum) {
    if (audioEl.duration - audioEl.currentTime <= 2) {
      if (!audioEl._crossfadeTriggered) {
        audioEl._crossfadeTriggered = true;
        const nextTrack = trackNum + 1;
        goTo(nextTrack);
        setTimeout(() => {
          const nextBtn = document.getElementById('pb' + nextTrack);
          if (nextBtn) nextBtn.click();
        }, 300); // Trigger next track right as scroll starts
      }
    } else {
      audioEl._crossfadeTriggered = false; // Reset in case of backwards seek
    }
  }
}

// ── Wire up play buttons ─────────────────────────────────────
function initPlayButtons() {
  for (let t = 1; t <= 6; t++) {
    const btn = document.getElementById('pb' + t);
    if (btn) {
      btn.addEventListener('click', () => {
        toggle(t, { onPlay, onPause, onEnd, onTick });
      });
    }
  }
}

// ── Wire up seek bars ────────────────────────────────────────
function initSeekBars() {
  document.querySelectorAll('.pbar').forEach(bar => {
    const trackNum = parseInt(bar.dataset.track);
    if (!trackNum) return;

    bar.addEventListener('click', (e) => {
      const rect = bar.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      seek(trackNum, Math.max(0, Math.min(1, frac)));
    });
  });
}

const HERO_IMAGES = [
  '/vinyls/cover/Insomanic.png',
  '/vinyls/cover/Glass Stranger.png',
  '/vinyls/cover/Neon Ghost Rain.png',
  '/vinyls/cover/Was it ever real_.png',
  '/vinyls/cover/Film you never shot.png',
  '/vinyls/cover/Peace in Between.png'
];

async function preloadAssets() {
  const promises = [];

  // Preload Images
  for (const src of HERO_IMAGES) {
    promises.push(new Promise((resolve) => {
      const img = new Image();
      img.src = src;
      img.onload = resolve;
      img.onerror = resolve; // Continue even if error
    }));
  }

  // Preload Audio
  Object.entries(TRACKS).forEach(([trackNum, track]) => {
    promises.push(new Promise((resolve) => {
      const audio = new Audio();
      audio.src = track.file;
      audio.preload = 'auto';

      audio.addEventListener('loadedmetadata', () => {
        const pt = document.getElementById('pt' + trackNum);
        if (pt) {
          pt.textContent = '0:00 / ' + formatTime(audio.duration);
        }
      });

      audio.addEventListener('canplaythrough', resolve, { once: true });
      audio.addEventListener('error', resolve, { once: true });
    }));
  });

  // Guarantee a minimum of 2.2 seconds to show off the premium equalizer loader animation
  promises.push(new Promise(resolve => setTimeout(resolve, 2200)));

  await Promise.all(promises);
}

// ── Unlock screen ────────────────────────────────────────────
function initUnlock() {
  const unlockBtn = document.getElementById('ulBtn');
  const unlockScreen = document.getElementById('unlock');
  const loader = document.getElementById('ul-loader');

  if (!unlockBtn || !unlockScreen) return;

  const triggerReady = async () => {
    await preloadAssets();

    // 1. Fade out the loader
    if (loader) {
      loader.classList.add('loaded');
    }

    // 2. Fade in the "Enter with Audio" button shortly after
    setTimeout(() => {
      unlockBtn.classList.add('ready');
    }, 350);
  };

  // Wait for the full page to compile and assets to load
  if (document.readyState === 'complete') {
    triggerReady();
  } else {
    window.addEventListener('load', triggerReady);
  }

  unlockBtn.addEventListener('click', () => {
    const ctx = initAudio();
    setAudioContext(ctx);
    unlockScreen.classList.add('gone');
    toast('Audio enabled — scroll to begin');
    playAmbient(0);

    // Trigger BounceCards entrance animation exactly when entering the site
    initHeroCards();

    // Completely remove unlock screen from DOM after transition to prevent focus/clicks
    unlockScreen.addEventListener('transitionend', () => {
      unlockScreen.remove();
    }, { once: true });
  });
}

// ── Remove default Vite content ──────────────────────────────
function cleanupViteDefaults() {
  // Remove the default #app div if it exists
  const appDiv = document.getElementById('app');
  if (appDiv && appDiv.childElementCount === 0) {
    appDiv.remove();
  }
}

// ── Init Hero Cards ──────────────────────────────────────────
function initHeroCards() {
  const container = document.getElementById('hero-cards');
  if (!container) return;

  // Detect smaller desktop / laptop resolutions (width <= 1440 or height <= 900)
  const isSmallScreen = window.innerWidth <= 1440 || window.innerHeight <= 900;
  const containerWidth = isSmallScreen ? 340 : 450;
  const containerHeight = isSmallScreen ? 230 : 300;

  const transformStyles = [
    'rotate(-12deg) translate(-10.5vw)',
    'rotate(8deg) translate(-6.3vw)',
    'rotate(-4deg) translate(-2.1vw)',
    'rotate(10deg) translate(2.1vw)',
    'rotate(-6deg) translate(6.3vw)',
    'rotate(12deg) translate(10.5vw)'
  ];

  initBounceCards(container, {
    images: HERO_IMAGES,
    containerWidth,
    containerHeight,
    animationDelay: 1.2,
    animationStagger: 0.15,
    duration: 2.2,
    easeType: 'elastic.out(1, 0.5)',
    transformStyles,
    enableHover: true,
    onHover: (idx) => {
      const name = TRACK_NAMES[idx + 1];
      setCursorLabel(name);
    },
    onLeave: () => {
      setCursorLabel(null);
    },
    onClick: (idx) => {
      const trackId = idx + 1;
      goTo(trackId);

      // If it's not already playing, hit the play button shortly after scrolling starts
      if (getNowPlaying() !== trackId) {
        setTimeout(() => {
          const btn = document.getElementById('pb' + trackId);
          if (btn) btn.click();
        }, 600);
      }
    }
  });
}

// ── Init Aurora WebGL Background ─────────────────────────────
function initAuroraBg() {
  const container = document.getElementById('aurora-bg');
  if (!container) return;

  const instance = initAurora(container, {
    colorStops: ['#c9a96e', '#1a1202', '#c9a96e'], // Warm Gold for default state
    blend: 0.25,
    amplitude: 1.0,
    speed: 0.3
  });

  // Link WebGL instance to the scroll engine to enable dynamic color morphing
  setAuroraInstance(instance);
}

// ── Init ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  cleanupViteDefaults();
  initCursor();
  buildWaveforms();
  initPlayButtons();
  initSeekBars();
  initUnlock();
  initScroll();
  loadLyrics();
  initAuroraBg();
  initSettings();
});
