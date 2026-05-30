/**
 * audio.js — Central audio engine
 *
 * Manages playback of local MP3s, routes through Web Audio API
 * AnalyserNode for real-time frequency / time-domain data.
 */

import { toast } from './toast.js';
import { gsap } from 'gsap';
import { settingsState } from './settings.js';

// ── Track configuration ──────────────────────────────────────
export const TRACKS = {
  1: { file: '/music/Insomanic.mp3',           name: 'Insomanic' },
  2: { file: '/music/Glass Stranger.mp3',       name: 'Glass Stranger' },
  3: { file: '/music/Neon Ghost Rain.mp3',      name: 'Neon Ghost Rain' },
  4: { file: '/music/Was It Ever Real.mp3',     name: 'Was It Ever Real' },
  5: { file: '/music/Film You Never Shot.mp3',  name: 'Film You Never Shot' },
  6: { file: '/music/Peace In Between.mp3',     name: 'Peace In Between' },
};

export const TRACK_NAMES = ['', 'Insomanic', 'Glass Stranger', 'Neon Ghost Rain', 'Was It Ever Real?', 'Film You Never Shot', 'Peace In Between'];
export const TRACK_ACCENTS = ['', '#a07ec8', '#7eb8c8', '#c96e8f', '#c9a96e', '#9ac87e', '#c8a07e'];

// ── State ────────────────────────────────────────────────────
let audioCtx = null;
let analyser = null;
const audios = {};      // { trackNum: HTMLAudioElement }
const sources = {};     // { trackNum: MediaElementSourceNode }
let nowPlaying = null;
let unlocked = false;
let currentVolume = 1.0;

// ── FFT buffers ──────────────────────────────────────────────
let freqData = null;
let timeData = null;

// ── Getters ──────────────────────────────────────────────────
export function getAudioContext() { return audioCtx; }
export function getAnalyser() { return analyser; }
export function getNowPlaying() { return nowPlaying; }
export function isUnlocked() { return unlocked; }
export function getActiveAudio() {
  if (nowPlaying && audios[nowPlaying]) {
    return audios[nowPlaying];
  }
  return null;
}

export function setVolume(vol) {
  currentVolume = vol;
  Object.values(audios).forEach(audio => {
    audio.volume = vol;
  });
}

export function getFrequencyData() {
  if (!analyser || !freqData) return null;
  analyser.getByteFrequencyData(freqData);
  return freqData;
}

export function getTimeDomainData() {
  if (!analyser || !timeData) return null;
  analyser.getByteTimeDomainData(timeData);
  return timeData;
}

// ── Initialise AudioContext (must be called from user gesture) ──
export function initAudio() {
  if (unlocked && audioCtx) {
    return audioCtx;
  }
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  // Explicitly resume context (Brave/Edge often initialize in a suspended state)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.78;
  analyser.connect(audioCtx.destination);

  freqData = new Uint8Array(analyser.frequencyBinCount);
  timeData = new Uint8Array(analyser.fftSize);

  unlocked = true;
  return audioCtx;
}

// ── Toggle play/pause ────────────────────────────────────────
export function toggle(trackNum, callbacks = {}) {
  if (!unlocked) {
    toast('Enable audio first');
    return;
  }

  // Ensure AudioContext is active (Edge/Brave can suspend it dynamically or on tab visibility changes)
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  const { onPlay, onPause, onEnd, onTick } = callbacks;

  // Pause current track
  if (nowPlaying === trackNum) {
    audios[trackNum].pause();
    nowPlaying = null;
    if (onPause) onPause(trackNum);
    return;
  }

  // Stop previously playing track
  if (nowPlaying && audios[nowPlaying]) {
    const prev = nowPlaying;
    const oldAudio = audios[prev];
    nowPlaying = null;
    if (onPause) onPause(prev);
    
    if (settingsState.crossfade) {
      gsap.to(oldAudio, {
        volume: 0,
        duration: 2,
        onComplete: () => {
          oldAudio.pause();
          oldAudio.volume = currentVolume; // Reset volume for next playback
        }
      });
    } else {
      oldAudio.pause();
    }
  }

  // Create audio element if needed
  if (!audios[trackNum]) {
    const track = TRACKS[trackNum];
    if (!track) return;

    const audio = new Audio(track.file);
    audio.preload = 'auto';
    audio.volume = currentVolume;
    audios[trackNum] = audio;

    // Route through analyser
    const source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    sources[trackNum] = source;

    // Events
    audio.addEventListener('timeupdate', () => {
      if (onTick) onTick(trackNum, audio);
    });

    audio.addEventListener('ended', () => {
      if (nowPlaying === trackNum) {
        nowPlaying = null;
      }
      if (onEnd) onEnd(trackNum);
    });

    audio.addEventListener('error', () => {
      toast('Could not load — check Music folder');
      if (nowPlaying === trackNum) {
        nowPlaying = null;
      }
      if (onEnd) onEnd(trackNum);
    });
  }

  // Play
  const playPromise = audios[trackNum].play();
  if (playPromise !== undefined) {
    playPromise.then(() => {
      nowPlaying = trackNum;
      if (onPlay) onPlay(trackNum);
      
      if (settingsState.crossfade) {
        audios[trackNum].volume = 0;
        gsap.to(audios[trackNum], { volume: currentVolume, duration: 2 });
      } else {
        audios[trackNum].volume = currentVolume;
      }
    }).catch(() => {
      toast('Could not play audio');
    });
  }
}

// ── Seek ─────────────────────────────────────────────────────
export function seek(trackNum, fraction) {
  const audio = audios[trackNum];
  if (!audio || !audio.duration) return;
  audio.currentTime = fraction * audio.duration;
}

// ── Format time ──────────────────────────────────────────────
export function formatTime(seconds) {
  if (!seconds || !isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = String(Math.floor(seconds % 60)).padStart(2, '0');
  return `${m}:${s}`;
}
