import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { joinMatchmaking } from "../src/lib/matchmaking/service";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  const cwd = process.cwd();
  loadEnvFile(path.join(cwd, ".env.local"));
  loadEnvFile(path.join(cwd, ".env"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRole) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local/.env."
    );
  }

  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const stamp = Date.now();
  const emailA = `smoke_a_${stamp}@example.com`;
  const emailB = `smoke_b_${stamp}@example.com`;
  const password = "SmokeTest!123456";

  let userAId = "";
  let userBId = "";

  try {
    const ua = await admin.auth.admin.createUser({
      email: emailA,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Smoke A" },
    });
    if (ua.error || !ua.data.user) {
      throw new Error(`Failed creating user A: ${ua.error?.message ?? "unknown error"}`);
    }
    userAId = ua.data.user.id;

    const ub = await admin.auth.admin.createUser({
      email: emailB,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Smoke B" },
    });
    if (ub.error || !ub.data.user) {
      throw new Error(`Failed creating user B: ${ub.error?.message ?? "unknown error"}`);
    }
    userBId = ub.data.user.id;

    const { data: tags, error: tagsErr } = await admin
      .from("political_tags")
      .select("id, slug")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .limit(6);

    if (tagsErr || !tags || tags.length < 3) {
      throw new Error(
        `Need at least 3 active political tags. Error: ${tagsErr?.message ?? "none"}`
      );
    }

    const chosen = tags.slice(0, 3);
    const prefsA = chosen.map((t, i) => ({
      user_id: userAId,
      tag_id: t.id,
      stance: i === 2 ? "neutral" : "support",
    }));
    const prefsB = chosen.map((t, i) => ({
      user_id: userBId,
      tag_id: t.id,
      stance: i === 2 ? "neutral" : "oppose",
    }));

    const upA = await admin.from("user_tag_preferences").upsert(prefsA, {
      onConflict: "user_id,tag_id",
    });
    if (upA.error) throw new Error(`Failed upserting prefs A: ${upA.error.message}`);
    const upB = await admin.from("user_tag_preferences").upsert(prefsB, {
      onConflict: "user_id,tag_id",
    });
    if (upB.error) throw new Error(`Failed upserting prefs B: ${upB.error.message}`);

    const r1 = await joinMatchmaking(userAId);
    const r2 = await joinMatchmaking(userBId);

    console.log("First join result:", JSON.stringify(r1));
    console.log("Second join result:", JSON.stringify(r2));

    if (!("matched" in r2) || r2.matched !== true) {
      throw new Error("Expected second user to receive a match but did not.");
    }

    const roomCheck = await admin
      .from("debate_rooms")
      .select("id, topic, match_record_id, generated_topic_meta")
      .eq("id", r2.room_id)
      .single();
    if (roomCheck.error || !roomCheck.data) {
      throw new Error(`Failed checking created room: ${roomCheck.error?.message ?? "unknown"}`);
    }

    console.log(
      "Match room created:",
      JSON.stringify({
        room_id: roomCheck.data.id,
        has_match_record_id: Boolean(roomCheck.data.match_record_id),
        topic_preview: String(roomCheck.data.topic).slice(0, 100),
      })
    );

    console.log("Smoke test passed.");
  } finally {
    if (userAId) {
      await admin.from("matchmaking_queue").delete().eq("user_id", userAId);
      await admin.from("user_tag_preferences").delete().eq("user_id", userAId);
    }
    if (userBId) {
      await admin.from("matchmaking_queue").delete().eq("user_id", userBId);
      await admin.from("user_tag_preferences").delete().eq("user_id", userBId);
    }
    if (userAId) await admin.auth.admin.deleteUser(userAId);
    if (userBId) await admin.auth.admin.deleteUser(userBId);
  }
}

void main().catch((err) => {
  console.error("Smoke test failed:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});

