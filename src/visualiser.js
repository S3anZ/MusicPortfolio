/**
 * visualiser.js — Real-time audiography
 *
 * Drives the waveform bars with actual audio data from the AnalyserNode.
 * Single rAF loop handles all 6 track waveforms efficiently.
 */

import { getFrequencyData, getTimeDomainData, getNowPlaying } from './audio.js';

// ── State ────────────────────────────────────────────────────
const waveformBars = {};  // { trackNum: HTMLElement[] }
let rafId = null;
let isRunning = false;

// ── Build waveform bars for all tracks ───────────────────────
export function buildWaveforms() {
  for (let t = 1; t <= 6; t++) {
    const wf = document.getElementById('wf' + t);
    if (!wf) continue;

    // Clear existing bars
    wf.innerHTML = '';
    const bars = [];
    const barCount = 100;

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
}

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

      // Update glow intensity based on bass
      const bassAvg = (freqData[0] + freqData[1] + freqData[2] + freqData[3]) / (4 * 255);
      const wfContainer = document.getElementById('wf' + playing);
      if (wfContainer) {
        const glow = wfContainer.parentElement?.querySelector('.wf-glow');
        if (glow) {
          glow.style.opacity = (0.04 + bassAvg * 0.18).toFixed(3);
        }
      }
    }
  }

  rafId = requestAnimationFrame(animate);
}
