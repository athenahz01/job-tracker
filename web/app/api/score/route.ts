import { NextRequest, NextResponse } from "next/server";

import { extensionSecretMatches } from "../../../lib/extension-auth";
import { scoreJobFit } from "../../../lib/resume-fit";
import { createSupabaseServerClient } from "../../../lib/supabase";

type ScoreInput = {
  company?: unknown;
  role?: unknown;
  jobDescription?: unknown;
};

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get("x-extension-api-secret");

  if (!extensionSecretMatches(providedSecret, process.env.EXTENSION_API_SECRET)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  let body: ScoreInput;
  try {
    body = (await request.json()) as ScoreInput;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const company = cleanText(body.company, 180);
  if (!company) {
    return NextResponse.json({ ok: false, reason: "company_required" }, { status: 400 });
  }

  const supabase = createSupabaseServerClient();
  const profileResponse = await supabase
    .from("profile")
    .select("resume_text")
    .eq("id", 1)
    .maybeSingle();

  if (profileResponse.error) {
    return NextResponse.json({ ok: false, reason: "score_error" }, { status: 500 });
  }

  const resumeText = cleanText(profileResponse.data?.resume_text, 200000);
  if (!resumeText) {
    return NextResponse.json({ ok: false, reason: "no_resume" });
  }

  try {
    const result = await scoreJobFit({
      company,
      role: cleanText(body.role, 220),
      jobDescription: cleanText(body.jobDescription, 12000),
      resumeText
    });

    if (!result) {
      return NextResponse.json({ ok: false, reason: "score_error" }, { status: 502 });
    }

    return NextResponse.json({ ok: true, ...result });
  } catch {
    console.error("Could not score extension job fit.");
    return NextResponse.json({ ok: false, reason: "score_error" }, { status: 502 });
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}
