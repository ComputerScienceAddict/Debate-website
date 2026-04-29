import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // First check if user has an active/waiting room (they may have been matched by opponent)
    const { data: rooms, error: roomErr } = await supabase
      .from("debate_rooms")
      .select("id, topic, status, match_record_id")
      .or(
        `affirmative_user_id.eq.${user.id},negative_user_id.eq.${user.id}`
      )
      .in("status", ["waiting", "active"])
      .order("created_at", { ascending: false })
      .limit(5);

    if (roomErr) {
      return NextResponse.json({ error: roomErr.message }, { status: 500 });
    }

    for (const r of rooms ?? []) {
      if (r.match_record_id && r.status === "active") {
        return NextResponse.json({
          state: "matched" as const,
          room_id: r.id as string,
          topic: r.topic as string,
        });
      }
    }

    // Check queue status
    const { data: q } = await supabase
      .from("matchmaking_queue")
      .select("user_id, status")
      .eq("user_id", user.id)
      .maybeSingle();

    if (q) {
      if (q.status === "matched") {
        // We were matched by someone else - check for room again
        const { data: matchedRooms } = await supabase
          .from("debate_rooms")
          .select("id, topic")
          .or(
            `affirmative_user_id.eq.${user.id},negative_user_id.eq.${user.id}`
          )
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (matchedRooms) {
          return NextResponse.json({
            state: "matched" as const,
            room_id: matchedRooms.id as string,
            topic: matchedRooms.topic as string,
          });
        }
      }
      return NextResponse.json({ state: "queued" as const });
    }

    return NextResponse.json({ state: "idle" as const });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Status failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
