import "server-only";

import { requireDashboardAccess } from "./dashboard-auth";
import {
  analyzeRequirementsWithClaude,
  scoreFitWithClaude,
  tailorApplicationWithClaude,
  tailorResumeVariantWithClaude
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

export type FitResult = {
  fit_score: number;
  fit_summary: string;
  missing_keywords: string[];
};

export type FitScoreInput = {
  company: string;
  role: string | null;
  jobDescription: string | null;
  resumeText: string;
};

type TailoringResult = {
  ai_tailored_bullets: string[];
  ai_cover_letter: string;
};

export type RequirementMatchStatus = "met" | "partial" | "missing";

export type RequirementMatch = {
  requirement: string;
  status: RequirementMatchStatus;
  evidence: string;
};

export type ProfileSaveStatus = "profile_saved" | "profile_error";
export type FitScoreStatus = "fit_scored" | "resume_missing" | "fit_error" | "invalid";
export type TailoringStatus = "tailor_saved" | "resume_missing" | "tailor_error" | "invalid";
export type RequirementScoreStatus =
  | "requirements_saved"
  | "resume_missing"
  | "requirements_error"
  | "invalid";
export type TailoredResumeStatus =
  | "tailored_resume_saved"
  | "resume_missing"
  | "tailored_resume_error"
  | "invalid";

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
    parsed = await scoreJobFit({
      company: application.company,
      role: application.role,
      jobDescription: application.notes,
      resumeText
    });
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

export async function scoreJobFit(input: FitScoreInput): Promise<FitResult | null> {
  const result = await scoreFitWithClaude(input);
  return normalizeFitResult(result);
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
  } catch (error) {
    console.error("Could not tailor application.", error);
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

export async function scoreApplicationRequirements(
  applicationId: string
): Promise<RequirementScoreStatus> {
  await requireDashboardAccess();

  if (!isUuid(applicationId)) {
    return "invalid";
  }

  const supabase = createSupabaseServerClient();
  const application = await loadApplicationForAi(supabase, applicationId);
  const profile = await loadProfile(supabase);

  if (!application) {
    return "requirements_error";
  }

  const resumeText = cleanLongText(profile?.resume_text ?? null, 200000);
  if (!resumeText) {
    return "resume_missing";
  }

  let matches: RequirementMatch[] | null = null;
  try {
    const result = await analyzeRequirementsWithClaude({
      company: application.company,
      role: application.role,
      jobDescription: application.notes,
      resumeText
    });
    matches = normalizeRequirementMatches(result);
  } catch (error) {
    console.error("Could not score application requirements.", error);
  }

  if (!matches) {
    return "requirements_error";
  }

  const { error } = await supabase
    .from("applications")
    .update({
      requirement_matches: matches,
      requirements_scored_at: new Date().toISOString()
    })
    .eq("id", applicationId)
    .is("merged_into_id", null);

  if (error) {
    console.error("Could not store requirement matches.");
    return "requirements_error";
  }

  return "requirements_saved";
}

export async function generateTailoredResumeVariant(
  applicationId: string
): Promise<TailoredResumeStatus> {
  await requireDashboardAccess();

  if (!isUuid(applicationId)) {
    return "invalid";
  }

  const supabase = createSupabaseServerClient();
  const application = await loadApplicationForAi(supabase, applicationId);
  const profile = await loadProfile(supabase);

  if (!application) {
    return "tailored_resume_error";
  }

  const resumeText = cleanLongText(profile?.resume_text ?? null, 200000);
  if (!resumeText) {
    return "resume_missing";
  }

  let tailoredResume: string | null = null;
  try {
    const result = await tailorResumeVariantWithClaude({
      company: application.company,
      role: application.role,
      jobDescription: application.notes,
      resumeText
    });
    tailoredResume = cleanLongText(result, 200000);
  } catch (error) {
    console.error("Could not generate tailored resume variant.", error);
  }

  if (!tailoredResume) {
    return "tailored_resume_error";
  }

  const { error } = await supabase
    .from("applications")
    .update({
      ai_tailored_resume: tailoredResume,
      tailored_resume_at: new Date().toISOString()
    })
    .eq("id", applicationId)
    .is("merged_into_id", null);

  if (error) {
    console.error("Could not store tailored resume variant.");
    return "tailored_resume_error";
  }

  return "tailored_resume_saved";
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
    fit_summary: cleanInlineText(value.fit_summary, 700) ?? "",
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

export function normalizeRequirementMatches(value: unknown): RequirementMatch[] | null {
  const rawItems = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.requirements)
      ? value.requirements
      : null;

  if (!rawItems) {
    return null;
  }

  const matches: RequirementMatch[] = [];
  const seen = new Set<string>();
  for (const item of rawItems) {
    if (!isRecord(item)) {
      continue;
    }

    const requirement = typeof item.requirement === "string"
      ? cleanInlineText(item.requirement, 500)
      : null;
    const status = normalizeRequirementStatus(item.status);
    const evidence = typeof item.evidence === "string"
      ? cleanInlineText(item.evidence, 500)
      : null;

    if (!requirement || !status || !evidence) {
      continue;
    }

    const key = requirement.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    matches.push({ requirement, status, evidence });
    if (matches.length >= 12) {
      break;
    }
  }

  return matches.length ? matches : null;
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

function normalizeRequirementStatus(value: unknown): RequirementMatchStatus | null {
  return value === "met" || value === "partial" || value === "missing" ? value : null;
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
