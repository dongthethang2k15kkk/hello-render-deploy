// Short two-note chime for new Inbox notifications, made with Web Audio (no sound file to download).
// Browsers only allow sound after the visitor has clicked or typed on the page, so the first gesture unlocks it.

const KEY = 'jh.notification-sound';
let context: AudioContext | null = null;

export function unlockSound() {
  try {
    if (!context) context = new AudioContext();
    if (context.state === 'suspended') void context.resume();
  } catch { /* no Web Audio */ }
}

export function soundEnabled() {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
}

export function setSoundEnabled(on: boolean) {
  try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* storage blocked */ }
}

/** Plays the chime when sound is on and the page has been interacted with; returns whether it played. */
export function playChime() {
  if (!soundEnabled() || !context || context.state !== 'running') return false;
  const start = context.currentTime;
  for (const [frequency, at] of [[880, 0], [1318.5, 0.17]] as const) {
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.type = 'sine';
    tone.frequency.value = frequency;
    volume.gain.setValueAtTime(0.0001, start + at);
    volume.gain.exponentialRampToValueAtTime(0.28, start + at + 0.02);
    volume.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.6);
    tone.connect(volume).connect(context.destination);
    tone.start(start + at);
    tone.stop(start + at + 0.65);
  }
  return true;
}
