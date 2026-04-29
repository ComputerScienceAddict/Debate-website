import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gatewayErrorMessage } from "@/lib/gateway-error";
import type { LiveCheckRequest, LiveCheckResponse } from "@/lib/referee/types";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://127.0.0.1:3001";
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || "";
const SKIP_AUTH = process.env.REFEREE_PROXY_SKIP_AUTH === "true";
const ALLOW_UNREACHABLE_GATEWAY_FALLBACK =
  process.env.REFEREE_LIVE_CHECK_ALLOW_FALLBACK !== "false";

function isGatewayConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const asErrorWithCause = err as Error & { cause?: unknown };
  const cause = asErrorWithCause.cause as { code?: string } | undefined;
  return (
    cause?.code === "ECONNREFUSED" ||
    cause?.code === "ENOTFOUND" ||
    cause?.code === "EHOSTUNREACH" ||
    cause?.code === "ETIMEDOUT"
  );
}

export async function POST(request: NextRequest) {
  if (!SKIP_AUTH) {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
  }

  let body: LiveCheckRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.room_id || !body.speaker_id || !body.speaker_role || !body.topic || !body.text) {
    return NextResponse.json(
      { error: "Missing required fields: room_id, speaker_id, speaker_role, topic, text" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${AI_GATEWAY_URL}/referee/live-check`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-ai-key": AI_GATEWAY_KEY,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: gatewayErrorMessage(errorData.detail) },
        { status: response.status }
      );
    }

    const data: LiveCheckResponse = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Live check proxy error:", err);

    if (ALLOW_UNREACHABLE_GATEWAY_FALLBACK && isGatewayConnectionError(err)) {
      // Non-blocking fallback for local dev: keep debate flow running without live referee events.
      const fallback: LiveCheckResponse = {
        room_id: body.room_id,
        speaker_id: body.speaker_id,
        events: [],
      };
      return NextResponse.json(fallback);
    }

    return NextResponse.json(
      { error: "Failed to reach AI gateway" },
      { status: 502 }
    );
  }
}
