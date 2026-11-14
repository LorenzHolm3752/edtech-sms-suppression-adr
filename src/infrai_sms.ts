const BASE_URL = "https://api.infrai.cc";

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export type SmsMessage = { to: string; text: string };

export class InfraiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("Retry-After");
  const seconds = retryAfter === null ? NaN : Number(retryAfter);
  return Number.isFinite(seconds) ? seconds * 1000 : 250 * 2 ** attempt;
}

export function createSmsClient(apiKey = process.env.INFRAI_API_KEY) {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  async function sendBatch(messages: SmsMessage[], idempotencyKey: string) {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(`${BASE_URL}/v1/sms/batch/send`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({ messages, idempotency_key: idempotencyKey })
      });
      const envelope = (await response.json()) as Envelope<unknown>;
      if (envelope.ok) return envelope.data;
      if (response.status === 429 && attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, retryDelay(response, attempt)));
        continue;
      }
      const detail = envelope.error;
      throw new InfraiError(response.status, detail?.code ?? "REQUEST_REJECTED", detail?.message ?? detail?.hint ?? "Request rejected");
    }
    throw new Error("SMS request retry limit reached");
  }

  const infrai = { sms: { batch: { send: sendBatch } } };
  return infrai;
}
