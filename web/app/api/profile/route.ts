import { NextRequest, NextResponse } from "next/server";

import { extensionSecretMatches } from "../../../lib/extension-auth";
import { createSupabaseServerClient } from "../../../lib/supabase";

type ProfileApiRow = {
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  website_url: string | null;
  work_authorization: string | null;
  requires_sponsorship: boolean | null;
  years_experience: string | null;
  current_title: string | null;
  updated_at: string;
};

type ScreenerAnswerApiRow = {
  id: string;
  question: string;
  answer: string;
  tags: string[] | null;
  updated_at: string;
};

const profileSelect = [
  "id",
  "full_name",
  "email",
  "phone",
  "location",
  "linkedin_url",
  "github_url",
  "portfolio_url",
  "website_url",
  "work_authorization",
  "requires_sponsorship",
  "years_experience",
  "current_title",
  "updated_at"
].join(", ");

export async function GET(request: NextRequest) {
  return handleProfileRequest(request);
}

export async function POST(request: NextRequest) {
  return handleProfileRequest(request);
}

async function handleProfileRequest(request: NextRequest) {
  const providedSecret = request.headers.get("x-extension-api-secret");

  if (!extensionSecretMatches(providedSecret, process.env.EXTENSION_API_SECRET)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const [profileResponse, answersResponse] = await Promise.all([
      supabase.from("profile").select(profileSelect).eq("id", 1).maybeSingle(),
      supabase
        .from("screener_answers")
        .select("id, question, answer, tags, updated_at")
        .order("updated_at", { ascending: false })
    ]);

    if (profileResponse.error || answersResponse.error) {
      throw profileResponse.error || answersResponse.error;
    }

    return NextResponse.json({
      ok: true,
      profile: normalizeProfile(profileResponse.data),
      answers: normalizeAnswers(answersResponse.data)
    });
  } catch {
    return NextResponse.json({ ok: false, reason: "profile_error" }, { status: 500 });
  }
}

function normalizeProfile(row: unknown): ProfileApiRow | null {
  if (!row || typeof row !== "object") {
    return null;
  }
  const value = row as ProfileApiRow;
  return {
    id: value.id,
    full_name: value.full_name ?? null,
    email: value.email ?? null,
    phone: value.phone ?? null,
    location: value.location ?? null,
    linkedin_url: value.linkedin_url ?? null,
    github_url: value.github_url ?? null,
    portfolio_url: value.portfolio_url ?? null,
    website_url: value.website_url ?? null,
    work_authorization: value.work_authorization ?? null,
    requires_sponsorship:
      typeof value.requires_sponsorship === "boolean" ? value.requires_sponsorship : null,
    years_experience: value.years_experience ?? null,
    current_title: value.current_title ?? null,
    updated_at: value.updated_at
  };
}

function normalizeAnswers(rows: unknown): ScreenerAnswerApiRow[] {
  return ((rows ?? []) as ScreenerAnswerApiRow[]).map((row) => ({
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : []
  }));
}
