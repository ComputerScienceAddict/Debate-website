import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // Check if the user has an active matched room
    const { data: activeRoom } = await admin
      .from("debate_rooms")
      .select("id, topic")
      .or(`affirmative_user_id.eq.${user.id},negative_user_id.eq.${user.id}`)
      .eq("status", "active")
      .not("match_record_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeRoom?.id) {
      return NextResponse.json({
        state: "matched" as const,
        room_id: activeRoom.id as string,
        topic: (activeRoom.topic as string) || "Open debate",
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
