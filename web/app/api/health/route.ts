import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase";

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("sync_state")
      .select("id")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      return NextResponse.json(
        { status: "error", error: error.message },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";

    return NextResponse.json(
      { status: "error", error: message },
      { status: 503 }
    );
  }
}
