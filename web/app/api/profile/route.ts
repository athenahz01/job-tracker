import { NextRequest, NextResponse } from "next/server";

import { extensionSecretMatches } from "../../../lib/extension-auth";
import { createSupabaseServerClient } from "../../../lib/supabase";

type ProfileApiRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  website_url: string | null;
  work_authorization: string | null;
  work_authorized: string | null;
  requires_sponsorship: boolean | null;
  years_experience: string | null;
  current_title: string | null;
  gender: string | null;
  race_ethnicity: string | null;
  hispanic_latino: string | null;
  veteran_status: string | null;
  disability_status: string | null;
  lgbtq_status: string | null;
  skills: string[] | null;
  updated_at: string;
};

type EducationApiRow = {
  id: string;
  school: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  gpa: string | null;
  sort_order: number;
  updated_at: string;
};

type WorkExperienceApiRow = {
  id: string;
  company: string | null;
  title: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  sort_order: number;
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
  "first_name",
  "last_name",
  "full_name",
  "email",
  "phone",
  "location",
  "city",
  "state",
  "country",
  "postal_code",
  "linkedin_url",
  "github_url",
  "portfolio_url",
  "website_url",
  "work_authorization",
  "work_authorized",
  "requires_sponsorship",
  "years_experience",
  "current_title",
  "gender",
  "race_ethnicity",
  "hispanic_latino",
  "veteran_status",
  "disability_status",
  "lgbtq_status",
  "skills",
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
    const [profileResponse, educationResponse, workResponse, answersResponse] = await Promise.all([
      supabase.from("profile").select(profileSelect).eq("id", 1).maybeSingle(),
      supabase
        .from("education")
        .select("id, school, degree, field_of_study, start_date, end_date, gpa, sort_order, updated_at")
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
      supabase
        .from("work_experience")
        .select("id, company, title, location, start_date, end_date, is_current, description, sort_order, updated_at")
        .order("sort_order", { ascending: true })
        .order("updated_at", { ascending: false }),
      supabase
        .from("screener_answers")
        .select("id, question, answer, tags, updated_at")
        .order("updated_at", { ascending: false })
    ]);

    if (profileResponse.error || educationResponse.error || workResponse.error || answersResponse.error) {
      throw profileResponse.error || educationResponse.error || workResponse.error || answersResponse.error;
    }

    return NextResponse.json({
      ok: true,
      profile: normalizeProfile(profileResponse.data),
      education: normalizeEducation(educationResponse.data),
      workExperience: normalizeWorkExperience(workResponse.data),
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
    first_name: value.first_name ?? null,
    last_name: value.last_name ?? null,
    full_name: value.full_name ?? null,
    email: value.email ?? null,
    phone: value.phone ?? null,
    location: value.location ?? null,
    city: value.city ?? null,
    state: value.state ?? null,
    country: value.country ?? null,
    postal_code: value.postal_code ?? null,
    linkedin_url: value.linkedin_url ?? null,
    github_url: value.github_url ?? null,
    portfolio_url: value.portfolio_url ?? null,
    website_url: value.website_url ?? null,
    work_authorization: value.work_authorization ?? null,
    work_authorized: value.work_authorized ?? null,
    requires_sponsorship:
      typeof value.requires_sponsorship === "boolean" ? value.requires_sponsorship : null,
    years_experience: value.years_experience ?? null,
    current_title: value.current_title ?? null,
    gender: value.gender ?? null,
    race_ethnicity: value.race_ethnicity ?? null,
    hispanic_latino: value.hispanic_latino ?? null,
    veteran_status: value.veteran_status ?? null,
    disability_status: value.disability_status ?? null,
    lgbtq_status: value.lgbtq_status ?? null,
    skills: Array.isArray(value.skills) ? value.skills : [],
    updated_at: value.updated_at
  };
}

function normalizeEducation(rows: unknown): EducationApiRow[] {
  return ((rows ?? []) as EducationApiRow[]).map((row) => ({
    ...row,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0
  }));
}

function normalizeWorkExperience(rows: unknown): WorkExperienceApiRow[] {
  return ((rows ?? []) as WorkExperienceApiRow[]).map((row) => ({
    ...row,
    is_current: Boolean(row.is_current),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0
  }));
}

function normalizeAnswers(rows: unknown): ScreenerAnswerApiRow[] {
  return ((rows ?? []) as ScreenerAnswerApiRow[]).map((row) => ({
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : []
  }));
}
