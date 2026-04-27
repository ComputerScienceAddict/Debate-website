import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type RoomRow = {
  id: string;
  topic: string;
  debate_format: string | null;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("debate_rooms")
      .select("id, topic, debate_format")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      return NextResponse.json({ rooms: [] });
    }

    const rooms = (data ?? []).map((room: RoomRow) => ({
      id: room.id,
      title: room.topic,
      topic: room.topic,
      referee: "AI Referee",
      viewers: 0,
      tags: [room.debate_format ?? "casual_1v1"],
    }));

    return NextResponse.json({ rooms });
  } catch {
    // Supabase not configured yet: return empty dataset, no fake data.
    return NextResponse.json({ rooms: [] });
  }
}
