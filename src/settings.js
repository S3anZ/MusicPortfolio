import { setVolume } from './audio.js';

// Default settings
export const settingsState = {
  volume: 1.0,
  autoplay: false,
  crossfade: true,
  stopOnScroll: true
};

export function initSettings() {
  const panel = document.getElementById('settings-panel');
  const toggleBtn = document.getElementById('settings-toggle');
  const volInput = document.getElementById('setting-vol');
  const autoplayToggle = document.getElementById('setting-autoplay');
  const stopScrollToggle = document.getElementById('setting-stopscroll');
  const crossfadeToggle = document.getElementById('setting-crossfade');
  const crossfadeRow = document.getElementById('row-crossfade');

  if (!panel || !toggleBtn) return;

  // Toggle settings panel visibility
  toggleBtn.addEventListener('click', () => {
    panel.classList.toggle('open');
  });

  // Volume control
  if (volInput) {
    volInput.addEventListener('input', (e) => {
      const vol = parseFloat(e.target.value);
      settingsState.volume = vol;
      setVolume(vol);
    });
  }

  // Autoplay toggle
  if (autoplayToggle) {
    autoplayToggle.addEventListener('change', (e) => {
      settingsState.autoplay = e.target.checked;
      
      // Toggle crossfade visibility
      if (crossfadeRow) {
        if (settingsState.autoplay) {
          crossfadeRow.style.display = 'flex';
          // small delay to allow display block to take effect before fading in
          setTimeout(() => crossfadeRow.style.opacity = '1', 10);
        } else {
          crossfadeRow.style.opacity = '0';
          setTimeout(() => crossfadeRow.style.display = 'none', 300);
        }
      }
    });
  }
  
  // Crossfade toggle
  if (crossfadeToggle) {
    crossfadeToggle.addEventListener('change', (e) => {
      settingsState.crossfade = e.target.checked;
    });
  }

  // Stop on scroll toggle
  if (stopScrollToggle) {
    stopScrollToggle.addEventListener('change', (e) => {
      settingsState.stopOnScroll = e.target.checked;
    });
  }
}
