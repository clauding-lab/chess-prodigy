import type { Page, BrowserContext } from "@playwright/test";
import { parseSessionInput } from "../../src/storage/input";
import { SAVE_KEY } from "../../src/storage/store";

// Read current authority through the production codec; legacy seeding stays explicit in tests.
// Compact saves intentionally contain no derived neutral-review cache.
export async function savedSession(page: Page) {
  const raw = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
  const session = raw && parseSessionInput(JSON.parse(raw));
  if (!session) throw new Error("Current guest authority is absent or invalid");
  return session;
}

// Observe actual native-worker replies because derived reviews are no longer persisted.
export async function installReviewProbe(page: Page | BrowserContext) {
  await page.addInitScript(() => {
    const replies: Array<{ gameId: string; result: unknown }> = [];
    Reflect.set(window, "__neutralReviewReplies", replies);
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.addEventListener("message", (event) => {
          if (event.data.type === "analyse" && event.data.ok)
            replies.push(structuredClone({ gameId: event.data.gameId, result: event.data.result }));
        });
      }
    };
  });
}
export async function workerReviews(page: Page, gameId: string) {
  return page.evaluate((id) => {
    const replies = Reflect.get(window, "__neutralReviewReplies") as Array<{
      gameId: string;
      result: { score: number; review: { purpose: string; position: string; policy: string } };
    }>;
    return replies.filter((reply) => reply.gameId === id).map((reply) => reply.result);
  }, gameId);
}
