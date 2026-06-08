import "server-only";

import { requireDashboardAccess } from "./dashboard-auth";
import {
  scoreFitWithClaude,
  tailorApplicationWithClaude
} from "./anthropic";
import { createSupabaseServerClient } from "./supabase";

type ApplicationForAi = {
  id: string;
  company: string;
  role: string | null;
  notes: string | null;
};

type ProfileRecord = {
  id: number;
  resume_text: string | null;
};

type FitResult = {
  fit_score: number;
  fit_summary: string;
  missing_keywords: string[];
};

type TailoringResult = {
  ai_tailored_bullets: string[];
  ai_cover_letter: string;
};

export type ProfileSaveStatus = "profile_saved" | "profile_error";
export type FitScoreStatus = "fit_scored" | "resume_missing" | "fit_error" | "invalid";
export type TailoringStatus = "tailor_saved" | "resume_missing" | "tailor_error" | "invalid";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function saveProfileResume(resumeText: string | null): Promise<ProfileSaveStatus> {
  await requireDashboardAccess();

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("profile").upsert(
    {
      id: 1,
      resume_text: cleanLongText(resumeText, 200000),
      updated_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );

  if (error) {
    console.error("Could not save profile resume.");
    return "profile_error";
  }

  return "profile_saved";
}

export async function scoreApplicationFit(applicationId: string): Promise<FitScoreStatus> {
  await requireDashboardAccess();

  if (!isUuid(applicationId)) {
    return "invalid";
  }

  const supabase = createSupabaseServerClient();
  const application = await loadApplicationForAi(supabase, applicationId);
  const profile = await loadProfile(supabase);

  if (!application) {
    return "fit_error";
  }

  const resumeText = cleanLongText(profile?.resume_text ?? null, 200000);
  if (!resumeText) {
    return "resume_missing";
  }

  let parsed: FitResult | null = null;
  try {
    const result = await scoreFitWithClaude({
      company: application.company,
      role: application.role,
      jobDescription: application.notes,
      resumeText
    });
    parsed = normalizeFitResult(result);
  } catch {
    console.error("Could not score application fit.");
  }

  if (!parsed) {
    return "fit_error";
  }

  const { error } = await supabase
    .from("applications")
    .update({
      fit_score: parsed.fit_score,
      fit_summary: parsed.fit_summary,
      missing_keywords: parsed.missing_keywords,
      scored_at: new Date().toISOString()
    })
    .eq("id", applicationId)
    .is("merged_into_id", null);

  if (error) {
    console.error("Could not store application fit score.");
    return "fit_error";
  }

  return "fit_scored";
}

export async function tailorApplication(applicationId: string): Promise<TailoringStatus> {
  await requireDashboardAccess();

  if (!isUuid(applicationId)) {
    return "invalid";
  }

  const supabase = createSupabaseServerClient();
  const application = await loadApplicationForAi(supabase, applicationId);
  const profile = await loadProfile(supabase);

  if (!application) {
    return "tailor_error";
  }

  const resumeText = cleanLongText(profile?.resume_text ?? null, 200000);
  if (!resumeText) {
    return "resume_missing";
  }

  let parsed: TailoringResult | null = null;
  try {
    const result = await tailorApplicationWithClaude({
      company: application.company,
      role: application.role,
      jobDescription: application.notes,
      resumeText
    });
    parsed = normalizeTailoringResult(result);
  } catch {
    console.error("Could not tailor application.");
  }

  if (!parsed) {
    return "tailor_error";
  }

  const { error } = await supabase
    .from("applications")
    .update({
      ai_tailored_bullets: parsed.ai_tailored_bullets,
      ai_cover_letter: parsed.ai_cover_letter,
      tailored_at: new Date().toISOString()
    })
    .eq("id", applicationId)
    .is("merged_into_id", null);

  if (error) {
    console.error("Could not store application tailoring.");
    return "tailor_error";
  }

  return "tailor_saved";
}

export function normalizeFitResult(value: unknown): FitResult | null {
  if (!isRecord(value) || !Array.isArray(value.missing_keywords)) {
    return null;
  }

  const rawScore = Number(value.fit_score);
  if (!Number.isFinite(rawScore) || typeof value.fit_summary !== "string") {
    return null;
  }

  return {
    fit_score: clamp(Math.round(rawScore), 0, 100),
    fit_summary: cleanInlineText(value.fit_summary, 1800) ?? "",
    missing_keywords: cleanTextArray(value.missing_keywords, 20, 80)
  };
}

export function normalizeTailoringResult(value: unknown): TailoringResult | null {
  if (
    !isRecord(value) ||
    !Array.isArray(value.ai_tailored_bullets) ||
    typeof value.ai_cover_letter !== "string"
  ) {
    return null;
  }

  const result = {
    ai_tailored_bullets: cleanTextArray(value.ai_tailored_bullets, 8, 500),
    ai_cover_letter: cleanLongText(value.ai_cover_letter, 5000) ?? ""
  };

  return result.ai_tailored_bullets.length || result.ai_cover_letter ? result : null;
}

async function loadApplicationForAi(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  applicationId: string
): Promise<ApplicationForAi | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role, notes")
    .eq("id", applicationId)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error) {
    console.error("Could not load application for AI action.");
    return null;
  }

  return (data as ApplicationForAi | null) ?? null;
}

async function loadProfile(
  supabase: ReturnType<typeof createSupabaseServerClient>
): Promise<ProfileRecord | null> {
  const { data, error } = await supabase
    .from("profile")
    .select("id, resume_text")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Could not load profile resume.");
    return null;
  }

  return (data as ProfileRecord | null) ?? null;
}

function cleanLongText(value: string | null, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanInlineText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanTextArray(value: unknown[], maxItems: number, maxLength: number) {
  const seen = new Set<string>();
  const cleaned: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const text = cleanInlineText(item, maxLength);
    if (!text) {
      continue;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    cleaned.push(text);
    if (cleaned.length >= maxItems) {
      break;
    }
  }

  return cleaned;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuid(value: string) {
  return uuidPattern.test(value);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
