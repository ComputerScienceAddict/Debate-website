import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gatewayErrorMessage } from "@/lib/gateway-error";
import type { FinalScoreRequest, FinalScoreResponse } from "@/lib/referee/types";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://127.0.0.1:3001";
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || "";
const SKIP_AUTH = process.env.REFEREE_PROXY_SKIP_AUTH === "true";

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

  let body: FinalScoreRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (!body.room_id || !body.topic || !body.affirmative_transcript || !body.negative_transcript) {
    return NextResponse.json(
      { error: "Missing required fields: room_id, topic, affirmative_transcript, negative_transcript" },
      { status: 400 }
    );
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 220_000);
    try {
      const response = await fetch(`${AI_GATEWAY_URL}/referee/final-score`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-ai-key": AI_GATEWAY_KEY,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return NextResponse.json(
          { error: gatewayErrorMessage(errorData.detail) },
          { status: response.status }
        );
      }

      const data: FinalScoreResponse = await response.json();
      return NextResponse.json(data);
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return NextResponse.json(
        { error: "Request timed out" },
        { status: 504 }
      );
    }
    console.error("Final score proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach AI gateway" },
      { status: 502 }
    );
  }
}
