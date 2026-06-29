import { createServerFn } from "@tanstack/react-start";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

type CallInput = {
  from: string;
  to: string;
  bridgeTo?: string; // if provided, this is a two-leg call: first dial `to` (your phone), then bridge to `bridgeTo`
  message?: string;  // if no bridge, speak this message via TTS
};

export const makeTwilioCall = createServerFn({ method: "POST" })
  .inputValidator((data: CallInput) => {
    if (!data?.from || !data?.to) throw new Error("from and to are required");
    return data;
  })
  .handler(async ({ data }) => {
    const lovableKey = process.env.LOVABLE_API_KEY;
    const twilioKey = process.env.TWILIO_API_KEY;
    if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
    if (!twilioKey) throw new Error("TWILIO_API_KEY is not configured");

    const twiml = data.bridgeTo
      ? `<Response><Say voice="alice">Connecting your call now.</Say><Dial callerId="${escapeXml(data.from)}">${escapeXml(data.bridgeTo)}</Dial></Response>`
      : `<Response><Say voice="alice">${escapeXml(data.message || "Hello from SolverHunt. This is a test call.")}</Say></Response>`;

    const body = new URLSearchParams({
      To: data.to,
      From: data.from,
      Twiml: twiml,
    });

    const res = await fetch(`${GATEWAY_URL}/Calls.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": twilioKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (json as { message?: string })?.message || `Twilio error ${res.status}`;
      throw new Error(msg);
    }
    return {
      sid: (json as { sid?: string }).sid ?? null,
      status: (json as { status?: string }).status ?? "queued",
    };
  });

export const listTwilioNumbers = createServerFn({ method: "GET" }).handler(async () => {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) return { numbers: [] as { phoneNumber: string; friendlyName: string }[] };

  const res = await fetch(`${GATEWAY_URL}/IncomingPhoneNumbers.json`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
    },
  });
  if (!res.ok) return { numbers: [] };
  const json = (await res.json()) as { incoming_phone_numbers?: Array<{ phone_number: string; friendly_name: string }> };
  return {
    numbers: (json.incoming_phone_numbers ?? []).map((n) => ({
      phoneNumber: n.phone_number,
      friendlyName: n.friendly_name,
    })),
  };
});

export const listRecentCalls = createServerFn({ method: "GET" }).handler(async () => {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const twilioKey = process.env.TWILIO_API_KEY;
  if (!lovableKey || !twilioKey) return { calls: [] as Array<{ sid: string; to: string; from: string; status: string; startTime: string | null; duration: string | null; direction: string }> };

  const res = await fetch(`${GATEWAY_URL}/Calls.json?PageSize=20`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": twilioKey,
    },
  });
  if (!res.ok) return { calls: [] };
  const json = (await res.json()) as {
    calls?: Array<{ sid: string; to: string; from: string; status: string; start_time: string | null; duration: string | null; direction: string }>;
  };
  return {
    calls: (json.calls ?? []).map((c) => ({
      sid: c.sid,
      to: c.to,
      from: c.from,
      status: c.status,
      startTime: c.start_time,
      duration: c.duration,
      direction: c.direction,
    })),
  };
});

function escapeXml(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}
