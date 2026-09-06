let audio: AudioContext | null = null;
let activation: Promise<boolean> | null = null;
let generation = 0;
const playing = new Set<OscillatorNode>();

/** Call directly from a tap/key event so browsers can grant audio permission. */
export function activateSound(): Promise<boolean> {
  try {
    const Constructor =
      globalThis.AudioContext ??
      (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Constructor) return Promise.resolve(false);
    if (!audio || audio.state === "closed") audio = new Constructor();
    if (audio.state === "running") return Promise.resolve(true);
    if (activation) return activation;
    const context = audio;
    const resume = context.resume();
    activation = new Promise<boolean>((resolve) => {
      const timer = window.setTimeout(() => resolve(false), 1500);
      void resume.then(
        () => {
          clearTimeout(timer);
          resolve(context.state === "running");
        },
        () => {
          clearTimeout(timer);
          resolve(false);
        },
      );
    }).finally(() => {
      activation = null;
    });
    return activation;
  } catch {
    return Promise.resolve(false);
  }
}

export function silenceSound() {
  generation++;
  for (const oscillator of playing) {
    try {
      oscillator.stop();
    } catch {
      /* Already ended. */
    }
    oscillator.disconnect();
  }
  playing.clear();
}

export function playSound(kind: "move" | "capture" | "end", enabled: boolean) {
  if (!enabled) return;
  const token = generation;
  void activateSound().then((ready) => {
    if (!ready || !audio || token !== generation) return;
    try {
      const oscillator = audio.createOscillator(),
        gain = audio.createGain(),
        now = audio.currentTime;
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.frequency.value = kind === "capture" ? 180 : kind === "end" ? 520 : 340;
      oscillator.type = kind === "capture" ? "triangle" : "sine";
      gain.gain.value = kind === "capture" ? 0.16 : kind === "end" ? 0.18 : 0.14;
      gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "end" ? 0.4 : 0.18));
      playing.add(oscillator);
      oscillator.onended = () => {
        playing.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      };
      oscillator.start(now);
      oscillator.stop(now + (kind === "end" ? 0.45 : 0.22));
    } catch {
      /* The browser may interrupt audio when another app takes the speaker. */
    }
  });
}
