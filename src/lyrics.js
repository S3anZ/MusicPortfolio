/**
 * lyrics.js — Dynamic lyric synchronization
 *
 * Loads per-track .lrc files for timestamped sync, with
 * fallback to the monolithic lyrics.md for untimed tracks.
 */

import { TRACK_NAMES, getActiveAudio } from './audio.js';

let lyricsData = {}; // { trackNum: { time?: number, text: string, hasTimestamp: boolean }[] }
let currentLyrIdx = {}; // { trackNum: index }
let tapLineIndex = {}; // { trackNum: index }

// Map track numbers to their .lrc filenames
const LRC_FILES = {
  1: '/music/lyrics/Insomanic.lrc',
  2: '/music/lyrics/Glass Stranger.lrc',
  3: '/music/lyrics/Neon Ghost Rain.lrc',
  4: '/music/lyrics/Was It Ever Real.lrc',
  5: '/music/lyrics/Film You Never Shot.lrc',
  6: '/music/lyrics/Peace In Between.lrc',
};

export async function loadLyrics() {
  // 1. Try loading individual .lrc files for each track
  const lrcPromises = Object.entries(LRC_FILES).map(async ([trackNum, path]) => {
    try {
      const res = await fetch(path);
      if (!res.ok) return;
      const text = await res.text();
      parseLrc(parseInt(trackNum), text);
      console.log(`[Lyrics] Loaded LRC for Track ${trackNum}`);
    } catch (e) {
      console.warn(`[Lyrics] Failed to load LRC for Track ${trackNum}:`, e);
    }
  });
  await Promise.all(lrcPromises);

  // 2. Fall back to lyrics.md for any tracks that don't have an LRC file
  try {
    const res = await fetch('/music/lyrics/lyrics.md');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const text = await res.text();
    parseLyricsMd(text);
  } catch (e) {
    console.warn('[Lyrics] lyrics.md fallback not found (this is fine if all tracks have .lrc files)');
  }
}

/**
 * Parse a standard .lrc file for a specific track.
 * Format: [mm:ss.xx]Lyric text
 * Metadata tags like [ar:], [ti:], [al:] are skipped.
 */
function parseLrc(trackNum, text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  lyricsData[trackNum] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip LRC metadata tags like [ar:Artist], [ti:Title], [al:Album]
    if (/^\[[a-z]{2,}:/i.test(line)) continue;

    // Parse timestamp: [mm:ss.xx]Text
    const tsMatch = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/);
    if (tsMatch) {
      const minutes = parseInt(tsMatch[1]);
      const seconds = parseFloat(tsMatch[2]);
      const time = minutes * 60 + seconds;
      const text = tsMatch[3].trim();
      // Only add non-empty lyric lines
      if (text) {
        lyricsData[trackNum].push({ time, text, hasTimestamp: true });
      }
    }
  }
}

/**
 * Parse the monolithic lyrics.md — only for tracks that
 * don't already have LRC data loaded.
 */
function parseLyricsMd(text) {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let currentTrack = null;

  for (let rawLine of lines) {
    const line = rawLine.trim();

    const matchHeader = line.match(/^([1-6])\.\s*(.*)/);
    if (matchHeader) {
      currentTrack = parseInt(matchHeader[1]);

      // Skip this track if we already loaded an LRC file for it
      if (lyricsData[currentTrack] && lyricsData[currentTrack].length > 0) {
        currentTrack = null; // null it out so subsequent lines are skipped
        continue;
      }

      lyricsData[currentTrack] = [];
      const headerText = matchHeader[2].trim();
      const trackName = TRACK_NAMES[currentTrack]?.toLowerCase().replace(/[^a-z0-9]/g, '');
      const cleanedHeader = headerText.toLowerCase().replace(/[^a-z0-9]/g, '');

      if (headerText && cleanedHeader !== trackName) {
        processLine(currentTrack, headerText);
      }
      continue;
    }

    if (currentTrack !== null) {
      processLine(currentTrack, line);
    }
  }
}

function processLine(trackNum, line) {
  const tsMatch = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)/);
  if (tsMatch) {
    const minutes = parseInt(tsMatch[1]);
    const seconds = parseFloat(tsMatch[2]);
    const time = minutes * 60 + seconds;
    const text = tsMatch[3].trim();
    lyricsData[trackNum].push({ time, text, hasTimestamp: true });
  } else {
    lyricsData[trackNum].push({ text: line, hasTimestamp: false });
  }
}

export function updateLyrics(trackNum, currentTime, duration) {
  const el = document.getElementById('lyr' + trackNum);
  if (!el) return;

  const trackLyrics = lyricsData[trackNum] || [];
  if (trackLyrics.length === 0) return;

  // Initialize the scrolling container if it doesn't exist
  let scrollDiv = el.querySelector('.lyrics-scroll');
  if (!scrollDiv) {
    scrollDiv = document.createElement('div');
    scrollDiv.className = 'lyrics-scroll';
    trackLyrics.forEach((lyric, idx) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'lyric-line';
      lineDiv.textContent = lyric.text || '\u00A0';
      scrollDiv.appendChild(lineDiv);
    });
    el.innerHTML = '';
    el.appendChild(scrollDiv);
  }

  const hasTimestamps = trackLyrics.some(l => l.hasTimestamp);

  let activeIndex = -1;

  if (hasTimestamps) {
    // Find the last line whose timestamp is <= currentTime
    for (let i = 0; i < trackLyrics.length; i++) {
      const lyric = trackLyrics[i];
      if (lyric.hasTimestamp && currentTime >= lyric.time) {
        activeIndex = i;
      }
    }
  } else {
    // Fallback: linear mapping based on track duration
    const progress = currentTime / duration;
    activeIndex = Math.min(
      trackLyrics.length - 1,
      Math.floor(progress * trackLyrics.length)
    );
  }

  if (activeIndex === -1) {
    el.classList.remove('active');
    return;
  }

  if (currentLyrIdx[trackNum] === activeIndex) return;
  currentLyrIdx[trackNum] = activeIndex;

  const lineText = trackLyrics[activeIndex].text;

  // If text is empty (instrumental break), fade out the display
  if (!lineText || lineText.trim() === '') {
    el.classList.remove('active');
    return;
  }

  el.classList.add('active');

  // Update classes on lines
  const lines = scrollDiv.querySelectorAll('.lyric-line');
  lines.forEach((line, idx) => {
    line.className = 'lyric-line'; // Reset
    if (idx === activeIndex) {
      line.classList.add('lyric-active');
    } else if (Math.abs(idx - activeIndex) <= 1) {
      line.classList.add('lyric-dimmed');
    } else if (Math.abs(idx - activeIndex) <= 2) {
      line.classList.add('lyric-far');
    }
  });

  // Calculate transform to center the active line
  const activeLineEl = lines[activeIndex];
  if (activeLineEl) {
    const containerCenter = el.clientHeight / 2;
    const lineCenter = activeLineEl.offsetTop + (activeLineEl.clientHeight / 2);
    const offset = containerCenter - lineCenter;
    scrollDiv.style.transform = `translateY(${offset}px)`;
  }
}

export function hideLyrics(trackNum) {
  const el = document.getElementById('lyr' + trackNum);
  if (el) {
    el.classList.remove('active');
  }
  // Clear cached lyric index on pause/hide so resuming instantly triggers visibility updates
  delete currentLyrIdx[trackNum];
}

// ── Developer Keyboard Lyric Tapper ──────────────────────────────
window.addEventListener('keydown', (e) => {
  // Press 't' or 'T' to tap and log timestamp for the next lyric line
  if (e.key.toLowerCase() === 't') {
    const audio = getActiveAudio();
    if (!audio) {
      console.warn('[Lyrics Tapper] Play a track first to begin tapping.');
      return;
    }

    // Find playing track number
    const playBtn = document.querySelector('.pbtn.playing');
    if (!playBtn) return;
    const trackNum = parseInt(playBtn.dataset.track);
    if (!trackNum) return;

    const trackLyrics = lyricsData[trackNum] || [];
    if (trackLyrics.length === 0) return;

    if (tapLineIndex[trackNum] === undefined) {
      tapLineIndex[trackNum] = 0;
    }

    let index = tapLineIndex[trackNum];
    // Skip any leading empty lines in the tapping index
    while (index < trackLyrics.length && trackLyrics[index].text.trim() === '') {
      index++;
    }

    if (index >= trackLyrics.length) {
      console.log(`[Lyrics Tapper] Finished tapping all lyrics for Track ${trackNum}!`);
      return;
    }

    const lyric = trackLyrics[index];
    const time = audio.currentTime;
    const m = Math.floor(time / 60);
    const s = Math.floor(time % 60);
    const ms = Math.floor((time % 1) * 100);
    const timestamp = `[${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(2, '0')}]`;

    console.log(`%c${timestamp} ${lyric.text}`, 'color: #c9a96e; font-weight: bold;');

    // Inject timestamp in-memory for instant feedback
    lyric.time = time;
    lyric.hasTimestamp = true;

    tapLineIndex[trackNum] = index + 1;
  }

  // Press 'r' or 'R' to reset the tap index for the current playing track
  if (e.key.toLowerCase() === 'r') {
    const playBtn = document.querySelector('.pbtn.playing');
    if (!playBtn) return;
    const trackNum = parseInt(playBtn.dataset.track);
    if (trackNum) {
      tapLineIndex[trackNum] = 0;
      console.log(`%c[Lyrics Tapper] Reset tap index for Track ${trackNum}. Tap 'T' to start from the first line again.`, 'color: #7eb8c8;');
    }
  }
});
