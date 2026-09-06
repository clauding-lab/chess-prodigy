import { expect, test } from "@playwright/test";
test("sound enable produces a real audio signal and muting stops subsequent moves", async ({ page }) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const meter = { peak: 0, contexts: 0 };
    Object.assign(window, { chessAudioMeter: meter });
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options); meter.contexts++;
        const analyser = this.createAnalyser(); analyser.fftSize = 256;
        const createGain = this.createGain.bind(this);
        this.createGain = () => { const gain = createGain(); gain.connect(analyser); return gain; };
        const sample = new Float32Array(analyser.fftSize);
        setInterval(() => { analyser.getFloatTimeDomainData(sample); meter.peak = Math.max(meter.peak, ...sample.map(Math.abs)); }, 10);
      }
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  const peak = () => page.evaluate(() => (window as typeof window & { chessAudioMeter: { peak: number } }).chessAudioMeter.peak);
  await expect.poll(peak).toBeGreaterThan(0.01);
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await page.waitForTimeout(250);
  await page.evaluate(() => { (window as typeof window & { chessAudioMeter: { peak: number } }).chessAudioMeter.peak = 0; });
  await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
  await page.getByRole("button", { name: "e4, empty", exact: true }).click();
  await page.waitForTimeout(1600);
  expect(await peak()).toBeLessThan(0.001);
});
