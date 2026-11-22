// Sound with no sound files: a few WebAudio bleeps, made in code. Everything is
// quiet until the player first presses a key or clicks, which is when the
// browser allows audio to start.
export function createSound() {
  let context = null;
  let alarmOscillator = null;
  let alarmGain = null;

  function ensureContext() {
    if (context) return context;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
    } catch {
      context = null;
    }
    return context;
  }

  /** A short tone: frequency in Hz, seconds long, at this volume. */
  function tone(frequency, seconds, volume, when = 0) {
    const ctx = ensureContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime + when);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + seconds);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime + when);
    oscillator.stop(ctx.currentTime + when + seconds + 0.02);
  }

  return {
    /** Call on the first user gesture so the browser unlocks audio. */
    unlock() {
      const ctx = ensureContext();
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    },
    pickup() {
      tone(880, 0.12, 0.12);
      tone(1320, 0.16, 0.1, 0.07);
    },
    sapphire() {
      tone(523, 0.14, 0.14);
      tone(659, 0.14, 0.14, 0.1);
      tone(784, 0.22, 0.14, 0.2);
      tone(1046, 0.3, 0.12, 0.3);
    },
    smoke() {
      tone(220, 0.25, 0.08);
    },
    emp() {
      tone(180, 0.1, 0.1);
      tone(90, 0.2, 0.1, 0.08);
    },
    spotted() {
      tone(660, 0.12, 0.12);
      tone(660, 0.12, 0.12, 0.16);
    },
    caught() {
      tone(392, 0.25, 0.16);
      tone(311, 0.25, 0.16, 0.2);
      tone(233, 0.5, 0.16, 0.4);
    },
    escaped() {
      tone(523, 0.15, 0.14);
      tone(659, 0.15, 0.14, 0.12);
      tone(784, 0.15, 0.14, 0.24);
      tone(1046, 0.4, 0.14, 0.36);
    },
    /** The alarm hum follows the meter: silent when hidden, urgent when seen. */
    setAlarmLevel(level) {
      const ctx = ensureContext();
      if (!ctx) return;
      if (level <= 0.02) {
        if (alarmOscillator) {
          try {
            alarmOscillator.stop();
          } catch {}
          alarmOscillator = null;
          alarmGain = null;
        }
        return;
      }
      if (!alarmOscillator) {
        alarmOscillator = ctx.createOscillator();
        alarmGain = ctx.createGain();
        alarmOscillator.type = 'triangle';
        alarmOscillator.frequency.value = 110;
        alarmGain.gain.value = 0;
        alarmOscillator.connect(alarmGain);
        alarmGain.connect(ctx.destination);
        alarmOscillator.start();
      }
      alarmOscillator.frequency.value = 110 + level * 160;
      alarmGain.gain.value = 0.015 + level * 0.05;
    },
  };
}
