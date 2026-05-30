let labelEl = null;

export function setCursorLabel(text) {
  if (!labelEl) labelEl = document.getElementById('cursor-label');
  if (!labelEl) return;

  if (text) {
    labelEl.textContent = text;
    labelEl.classList.add('visible');
  } else {
    labelEl.classList.remove('visible');
  }
}

export function initCursor() {
  // Skip on touch / coarse-pointer devices
  if (window.matchMedia('(pointer: coarse)').matches) return;

  const cur = document.getElementById('cursor');
  const ring = document.getElementById('cursor-ring');
  const label = document.getElementById('cursor-label');
  if (!cur || !ring) return;

  let mouseX = 0, mouseY = 0;
  let ringX = 0, ringY = 0;
  let rafId = null;

  // Smooth ring follow via rAF instead of setTimeout
  function updateRing() {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    ring.style.left = ringX + 'px';
    ring.style.top = ringY + 'px';

    if (label) {
      label.style.left = ringX + 'px';
      label.style.top = ringY + 'px';
    }

    rafId = requestAnimationFrame(updateRing);
  }

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cur.style.left = mouseX + 'px';
    cur.style.top = mouseY + 'px';
  });

  // Start the smooth ring animation
  rafId = requestAnimationFrame(updateRing);

  // Hover expansion on interactive elements
  const hoverables = 'a, button, .dot, .pbtn, .pbar, .tag, .card';

  document.addEventListener('mouseenter', (e) => {
    if (e.target.matches?.(hoverables)) {
      document.body.classList.add('hov');
    }
  }, true);

  document.addEventListener('mouseleave', (e) => {
    if (e.target.matches?.(hoverables)) {
      document.body.classList.remove('hov');
    }
  }, true);
}
