/**
 * ambient.js — Ambient chord drones per section (Web Audio API)
 */

let audioCtx = null;

// Chord definitions per section (0=hero, 1-6=tracks, 7=about)
const CHORDS = [
  { f: [55, 82, 110],  t: 'sine' },      // Hero: deep sub
  { f: [220, 293, 440], t: 'triangle' },  // Insomanic
  { f: [196, 261, 392], t: 'triangle' },  // Glass Stranger
  { f: [110, 146, 220], t: 'sawtooth' },  // Neon Ghost Rain
  { f: [165, 220, 330], t: 'triangle' },  // Was It Ever Real
  { f: [165, 196, 294], t: 'triangle' },  // Film You Never Shot
  { f: [73, 110, 146],  t: 'sine' },      // Peace In Between
  { f: [60, 90, 120],   t: 'sine' },      // About: deep sub
];

export function setAudioContext(ctx) {
  audioCtx = ctx;
}

export function playAmbient(sectionIndex) {
  if (!audioCtx) return;

  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(() => playAmbient(sectionIndex));
    return;
  }

  const chord = CHORDS[sectionIndex];
  if (!chord) return;

  const now = audioCtx.currentTime;

  // Create soft pad chord
  chord.f.forEach((freq, i) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.value = 480 + i * 90;

    osc.type = chord.t;
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq * 1.003, now + 5);

    // Soft envelope
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.026 / chord.f.length, now + 0.9);
    gain.gain.linearRampToValueAtTime(0.010 / chord.f.length, now + 3.5);
    gain.gain.linearRampToValueAtTime(0, now + 6);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(now);
    osc.stop(now + 6.1);
  });

  // Subtle click / transition sound for track sections
  if (sectionIndex > 0 && sectionIndex <= 6) {
    const click = audioCtx.createOscillator();
    const clickGain = audioCtx.createGain();

    click.type = 'sine';
    click.frequency.setValueAtTime(700, now);
    click.frequency.exponentialRampToValueAtTime(20, now + 0.11);

    clickGain.gain.setValueAtTime(0.05, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    click.connect(clickGain);
    clickGain.connect(audioCtx.destination);

    click.start(now);
    click.stop(now + 0.12);
  }
}
