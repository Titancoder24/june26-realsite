let ctx: AudioContext | null = null;

function getCtx() {
  if (!ctx && typeof window !== "undefined") ctx = new AudioContext();
  return ctx;
}

export function playShutter() {
  const c = getCtx();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = "sine";
  o.frequency.setValueAtTime(880, c.currentTime);
  o.frequency.exponentialRampToValueAtTime(440, c.currentTime + 0.08);
  g.gain.setValueAtTime(0.15, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.12);
  o.connect(g);
  g.connect(c.destination);
  o.start();
  o.stop(c.currentTime + 0.12);
}

export function playSuccess() {
  const c = getCtx();
  if (!c) return;
  [523, 659, 784].forEach((freq, i) => {
    const o = c.createOscillator();
    const g = c.createGain();
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.08, c.currentTime + i * 0.1);
    g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + i * 0.1 + 0.2);
    o.connect(g);
    g.connect(c.destination);
    o.start(c.currentTime + i * 0.1);
    o.stop(c.currentTime + i * 0.1 + 0.2);
  });
}
