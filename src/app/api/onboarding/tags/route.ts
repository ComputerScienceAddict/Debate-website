import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { TagStance } from "@/lib/matchmaking/types";

const STANCES: TagStance[] = ["support", "oppose", "neutral"];

function isTagStance(v: unknown): v is TagStance {
  return typeof v === "string" && STANCES.includes(v as TagStance);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("political_tags")
      .select("id, slug, label, description, category, sort_order")
      .eq("is_active", true)
      .order("category", { ascending: true })
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const tags = data ?? [];
    const byCategory: Record<
      string,
      Array<{
        id: string;
        slug: string;
        label: string;
        description: string | null;
        category: string;
        sort_order: number;
      }>
    > = {};
    for (const row of tags) {
      const cat = row.category;
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(row);
    }

    return NextResponse.json({ categories: byCategory, tags });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load tags";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: { preferences?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const raw = body.preferences;
    if (!Array.isArray(raw)) {
      return NextResponse.json(
        { error: "Expected { preferences: Array<{ tag_id, stance }> }" },
        { status: 400 }
      );
    }

    const rows: { user_id: string; tag_id: string; stance: TagStance }[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const rec = item as Record<string, unknown>;
      const tagId = rec.tag_id;
      const stance = rec.stance;
      if (typeof tagId !== "string" || !isTagStance(stance)) {
        return NextResponse.json(
          { error: "Each preference needs tag_id (string) and valid stance" },
          { status: 400 }
        );
      }
      rows.push({ user_id: user.id, tag_id: tagId, stance });
    }

    if (rows.length === 0) {
      const { error: delErr } = await supabase
        .from("user_tag_preferences")
        .delete()
        .eq("user_id", user.id);
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 500 });
      }
      return NextResponse.json({ ok: true, saved: 0 });
    }

    const { error: upsertError } = await supabase
      .from("user_tag_preferences")
      .upsert(rows, { onConflict: "user_id,tag_id" });

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, saved: rows.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to save preferences";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
