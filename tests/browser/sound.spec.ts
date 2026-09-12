import { enterPlay } from "./enter-play";
import { expect, test } from "@playwright/test";
test("a board tap unlocks audio during a browser-approved gesture", async ({ page }, info) => {
  test.skip(info.project.name !== "mobile", "Requires touch input");
  await page.goto("/");
  await enterPlay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
  await page.getByRole("button", { name: "e4, empty", exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(
        () => JSON.parse(localStorage.getItem("chess-prodigy-state-v3")!).game.hist.length,
      ),
    )
    .toBe(2);
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    Object.assign(window, { permittedAudioStarts: 0 });
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        if (!navigator.userActivation.isActive) throw new Error("Audio needs a completed tap");
        super(options);
        (window as typeof window & { permittedAudioStarts: number }).permittedAudioStarts++;
      }
    };
  });
  await page.reload();
  await enterPlay(page);
  await page.getByRole("button", { name: "g1, white knight", exact: true }).tap();
  await expect
    .poll(() =>
      page.evaluate(
        () => (window as typeof window & { permittedAudioStarts: number }).permittedAudioStarts,
      ),
    )
    .toBeGreaterThan(0);
});
test("sound enable produces a real audio signal and muting stops subsequent moves", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    const meter = { peak: 0, contexts: 0 };
    Object.assign(window, { chessAudioMeter: meter });
    window.AudioContext = class extends Native {
      constructor(options?: AudioContextOptions) {
        super(options);
        meter.contexts++;
        const analyser = this.createAnalyser();
        analyser.fftSize = 256;
        const createGain = this.createGain.bind(this);
        this.createGain = () => {
          const gain = createGain();
          gain.connect(analyser);
          return gain;
        };
        const sample = new Float32Array(analyser.fftSize);
        setInterval(() => {
          analyser.getFloatTimeDomainData(sample);
          meter.peak = Math.max(meter.peak, ...sample.map(Math.abs));
        }, 10);
      }
    };
  });
  await page.goto("/");
  await enterPlay(page);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await page.getByRole("button", { name: "Sound off", exact: true }).click();
  const peak = () =>
    page.evaluate(
      () => (window as typeof window & { chessAudioMeter: { peak: number } }).chessAudioMeter.peak,
    );
  await expect.poll(peak).toBeGreaterThan(0.01);
  await page.getByRole("button", { name: "Sound on", exact: true }).click();
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    (window as typeof window & { chessAudioMeter: { peak: number } }).chessAudioMeter.peak = 0;
  });
  await page.getByRole("button", { name: "e2, white pawn", exact: true }).click();
  await page.getByRole("button", { name: "e4, empty", exact: true }).click();
  await page.waitForTimeout(1600);
  expect(await peak()).toBeLessThan(0.001);
});
