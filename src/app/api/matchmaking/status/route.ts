import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchValidActiveMatchedRoomOrHeal } from "@/lib/matchmaking/status-helper";

export async function GET() {
  try {
    // Auth check via regular client (cookies)
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Use admin client for reads so RLS never blocks the check
    let admin: ReturnType<typeof createAdminClient>;
    try {
      admin = createAdminClient();
    } catch {
      return NextResponse.json({ error: "Server misconfigured" }, { status: 503 });
    }

    // Only count a match when both participant slots exist (FK set-null can orphan a row).
    const activeRoom = await fetchValidActiveMatchedRoomOrHeal(admin, user.id);

    if (activeRoom) {
      return NextResponse.json({
        state: "matched" as const,
        room_id: activeRoom.id,
        topic: activeRoom.topic || "Open debate",
      });
    }

    // Check if still in queue
    const { data: q } = await admin
      .from("matchmaking_queue")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (q) {
      return NextResponse.json({ state: "queued" as const });
    }

    return NextResponse.json({ state: "idle" as const });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
