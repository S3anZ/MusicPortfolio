/**
 * visualiser.js — Real-time audiography
 *
 * Drives the waveform bars with actual audio data from the AnalyserNode.
 * Single rAF loop handles all 6 track waveforms efficiently.
 */

import { getFrequencyData, getTimeDomainData, getNowPlaying } from './audio.js';
import { gsap } from 'gsap';

// ── State ────────────────────────────────────────────────────
const waveformBars = {};  // { trackNum: HTMLElement[] }
let rafId = null;
let isRunning = false;
let hudBars = [];
let jsfDots = [];

// ── Build waveform bars for all tracks ───────────────────────
export function buildWaveforms() {
  const isMobile = window.innerWidth <= 768;
  const barCount = isMobile ? 40 : 100;

  for (let t = 1; t <= 6; t++) {
    const wf = document.getElementById('wf' + t);
    if (!wf) continue;

    // Clear existing bars
    wf.innerHTML = '';
    const bars = [];

    for (let i = 0; i < barCount; i++) {
      const bar = document.createElement('div');
      bar.className = 'wb';
      // Generate organic resting heights
      const baseH = 3 + Math.abs(Math.sin(i * 0.38 + t * 1.3) * 48) + Math.random() * 12;
      bar.style.height = baseH + 'px';
      bar.dataset.h = baseH.toFixed(1);
      wf.appendChild(bar);
      bars.push(bar);
    }

    waveformBars[t] = bars;
  }

  // Cache the small HUD visualizer bars at the bottom right
  hudBars = Array.from(document.querySelectorAll('#hudEq .hb'));

  // Cache the dots in Journey So Far
  jsfDots = Array.from(document.querySelectorAll('.jsf-dot'));
}

// Rebuild waveforms on crossing the mobile threshold (768px) to prevent vertical layout crunching
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  const currentWidth = window.innerWidth;
  if ((lastWidth > 768 && currentWidth <= 768) || (lastWidth <= 768 && currentWidth > 768)) {
    buildWaveforms();
  }
  lastWidth = currentWidth;
});

// ── Start the single animation loop ──────────────────────────
export function startVisualiserLoop() {
  if (isRunning) return;
  isRunning = true;
  animate();
}

export function stopVisualiserLoop() {
  isRunning = false;
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
}

// ── Reset a track's bars to resting state ────────────────────
export function resetBars(trackNum) {
  const bars = waveformBars[trackNum];
  if (!bars) return;
  bars.forEach(b => {
    b.style.height = b.dataset.h + 'px';
  });

  // Reset HUD visualizer bars to resting state (3px)
  if (hudBars.length === 6) {
    hudBars.forEach(b => {
      b.style.height = '3px';
    });
  }

  // Reset JSF dots
  if (jsfDots.length === 3) {
    jsfDots.forEach(d => {
      d.style.transform = 'translateY(0px)';
    });
  }

  // Smoothly fade out and shrink visualizer glow back to base state
  const wfContainer = document.getElementById('wf' + trackNum);
  if (wfContainer) {
    const glow = wfContainer.parentElement?.querySelector('.wf-glow');
    if (glow) {
      gsap.to(glow, {
        opacity: 0,
        scale: 0.96,
        duration: 0.8,
        ease: 'power4.out',
        overwrite: 'auto'
      });
    }
  }
}

// ── Animation frame ──────────────────────────────────────────
function animate() {
  if (!isRunning) return;

  const playing = getNowPlaying();

  if (playing && waveformBars[playing]) {
    const freqData = getFrequencyData();
    const timeData = getTimeDomainData();
    const bars = waveformBars[playing];

    if (freqData && timeData && bars.length > 0) {
      const binCount = freqData.length;

      for (let i = 0; i < bars.length; i++) {
        const bar = bars[i];
        const baseH = parseFloat(bar.dataset.h) || 8;

        // Map bar index to frequency bin
        const binIndex = Math.floor((i / bars.length) * binCount);
        const freqVal = freqData[binIndex] / 255; // 0..1

        // Also use time-domain for micro-variation
        const timeIndex = Math.floor((i / bars.length) * timeData.length);
        const timeVal = (timeData[timeIndex] - 128) / 128; // -1..1

        // Combine: frequency drives amplitude, time-domain adds jitter
        const multiplier = 0.3 + freqVal * 1.4 + Math.abs(timeVal) * 0.3;
        const newH = Math.max(3, baseH * multiplier);

        bar.style.height = newH + 'px';
      }

      // Update glow intensity and scale dynamically based on bass frequencies
      const bassAvg = (freqData[0] + freqData[1] + freqData[2] + freqData[3]) / (4 * 255);
      const wfContainer = document.getElementById('wf' + playing);
      if (wfContainer) {
        const glow = wfContainer.parentElement?.querySelector('.wf-glow');
        if (glow) {
          // Dynamic scale and soft opacity shifts for high-performance organic breathing
          glow.style.opacity = (0.02 + bassAvg * 0.14).toFixed(3);
          glow.style.transform = `scale(${1.0 + bassAvg * 0.12})`;
        }
      }

      // Drive the small HUD visualizer bars at the bottom right
      if (hudBars.length === 6) {
        const hudBins = [2, 6, 12, 22, 38, 64]; // Sub-bass to treble spectral mapping
        for (let i = 0; i < 6; i++) {
          const bin = hudBins[i];
          const val = (freqData[bin] || 0) / 255;
          const h = 3 + val * 15; // Map 0..1 range to 3px..18px height limits
          hudBars[i].style.height = h.toFixed(1) + 'px';
        }
      }

      // Drive the JSF dots (Journey So Far...) to the beat
      if (jsfDots.length === 3) {
        // Isolate distinct musical elements:
        // Dot 1: Sub-bass (Bin 0: ~0-170Hz)
        const subBass = Math.pow((freqData[0] || 0) / 255, 4);
        
        // Dot 2: Bass/Low-mid (Bin 2: ~340-510Hz)
        const bass = Math.pow((freqData[2] || 0) / 255, 4);
        
        // Dot 3: Kicks & Snares
        // Combines kick punch (Bin 1) with snare frequencies (Bins 12-18, ~2kHz - 3kHz)
        const snareVal = ((freqData[12] || 0) + (freqData[18] || 0)) / 2 / 255;
        const kickVal = (freqData[1] || 0) / 255;
        const kickSnare = Math.pow(snareVal, 3) + Math.pow(kickVal, 5);

        // Bounce up to -16px based strictly on their respective beats
        jsfDots[0].style.transform = `translateY(${-subBass * 16}px)`;
        jsfDots[1].style.transform = `translateY(${-bass * 16}px)`;
        jsfDots[2].style.transform = `translateY(${-Math.min(1, kickSnare) * 16}px)`;
      }
    }
  }

  rafId = requestAnimationFrame(animate);
}
