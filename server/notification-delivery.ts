import webpush, { type PushSubscription } from "web-push";
export interface NotificationMessage {
  gameId: string;
  kind: string;
}
export interface NotificationDelivery {
  emailEnabled: boolean;
  pushPublicKey: string | null;
  sendEmail(email: string, message: NotificationMessage): Promise<void>;
  sendPush(subscription: PushSubscription, message: NotificationMessage): Promise<void>;
}
export class DeliveryError extends Error {
  constructor(readonly statusCode: number) {
    super(`Notification provider status ${statusCode}`);
  }
}
export function createNotificationDelivery(
  baseURL: string,
  env: NodeJS.ProcessEnv = process.env,
): NotificationDelivery {
  const origin = new URL(baseURL).origin;
  const emailEnabled = Boolean(env.BREVO_API_KEY && env.BREVO_SENDER_EMAIL);
  const pushPublicKey =
    env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
      ? env.VAPID_PUBLIC_KEY
      : null;
  const content = (message: NotificationMessage) => ({
    title: "Chess Prodigy",
    body:
      message.kind === "started"
        ? "Your opponent joined. Your game is ready."
        : "It is your turn in a friend game.",
    url: `${origin}/game/${encodeURIComponent(message.gameId)}`,
  });
  return {
    emailEnabled,
    pushPublicKey,
    async sendEmail(email, message) {
      if (!emailEnabled) throw new DeliveryError(503);
      const data = content(message);
      const response = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(10000),
        headers: {
          "api-key": env.BREVO_API_KEY!,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { email: env.BREVO_SENDER_EMAIL, name: env.BREVO_SENDER_NAME || "Chess Prodigy" },
          to: [{ email }],
          subject: data.body,
          textContent: `${data.body}\n\nOpen your private game: ${data.url}\n\nManage game notifications in your Chess Prodigy account.`,
        }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new DeliveryError(response.status);
      }
      await response.body?.cancel();
    },
    async sendPush(subscription, message) {
      if (!pushPublicKey) throw new DeliveryError(503);
      await webpush.sendNotification(subscription, JSON.stringify(content(message)), {
        TTL: 600,
        timeout: 10000,
        vapidDetails: {
          subject: env.VAPID_SUBJECT!,
          publicKey: pushPublicKey,
          privateKey: env.VAPID_PRIVATE_KEY!,
        },
      });
    },
  };
}
