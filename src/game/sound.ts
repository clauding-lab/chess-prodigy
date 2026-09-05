let audio: AudioContext | null = null;
export function playSound(kind: "move" | "capture" | "end", enabled: boolean) {
  if (!enabled || typeof AudioContext === "undefined") return;
  try {
    audio ??= new AudioContext();
    void audio.resume().catch(() => undefined);
    const oscillator = audio.createOscillator(),
      gain = audio.createGain(),
      now = audio.currentTime;
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.frequency.value = kind === "capture" ? 180 : kind === "end" ? 520 : 340;
    oscillator.type = kind === "capture" ? "square" : "sine";
    gain.gain.value = kind === "capture" ? 0.06 : kind === "end" ? 0.08 : 0.05;
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "end" ? 0.4 : 0.12));
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + (kind === "end" ? 0.45 : 0.15));
  } catch {
    /* Sound is optional when browser audio is unavailable. */
  }
}
