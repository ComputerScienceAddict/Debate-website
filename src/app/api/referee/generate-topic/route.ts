import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gatewayErrorMessage } from "@/lib/gateway-error";
import type { GenerateTopicRequest, GenerateTopicResponse } from "@/lib/referee/types";

const AI_GATEWAY_URL = process.env.AI_GATEWAY_URL || "http://127.0.0.1:3001";
const AI_GATEWAY_KEY = process.env.AI_GATEWAY_KEY || "";
const SKIP_AUTH = process.env.REFEREE_PROXY_SKIP_AUTH === "true";

export async function POST(request: NextRequest) {
  if (!SKIP_AUTH) {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  let body: GenerateTopicRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.room_id || !Array.isArray(body.conflicts)) {
    return NextResponse.json(
      { error: "Missing required fields: room_id, conflicts" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`${AI_GATEWAY_URL}/referee/generate-topic`, {
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

    const data: GenerateTopicResponse = await response.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("Generate topic proxy error:", err);
    return NextResponse.json(
      { error: "Failed to reach AI gateway" },
      { status: 502 }
    );
  }
}
