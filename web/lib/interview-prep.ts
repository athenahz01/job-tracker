import "server-only";

import { generateInterviewPrepWithClaude } from "./anthropic";
import { requireDashboardAccess } from "./dashboard-auth";
import {
  normalizeInterviewPrep,
  type InterviewPrep
} from "./interview-prep-shape";
import { createSupabaseServerClient } from "./supabase";

type ApplicationForPrep = {
  id: string;
  company: string;
  role: string | null;
  notes: string | null;
  requirement_matches: Array<{
    requirement: string;
    status: string;
    evidence: string;
  }> | null;
};

type ProfileRecord = {
  id: number;
  resume_text: string | null;
};

export type InterviewPrepStatus =
  | "interview_prep_saved"
  | "resume_missing"
  | "interview_prep_error"
  | "invalid";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function generateApplicationInterviewPrep(
  applicationId: string
): Promise<InterviewPrepStatus> {
  await requireDashboardAccess();

  if (!isUuid(applicationId)) {
    return "invalid";
  }

  const supabase = createSupabaseServerClient();
  const application = await loadApplicationForPrep(supabase, applicationId);
  const profile = await loadProfile(supabase);

  if (!application) {
    return "interview_prep_error";
  }

  const resumeText = cleanLongText(profile?.resume_text ?? null, 200000);
  if (!resumeText) {
    return "resume_missing";
  }

  let prep: InterviewPrep | null = null;
  try {
    const result = await generateInterviewPrepWithClaude({
      company: application.company,
      role: application.role,
      jobDescription: application.notes,
      resumeText,
      requirementMatches: Array.isArray(application.requirement_matches)
        ? application.requirement_matches
        : []
    });
    prep = normalizeInterviewPrep(result);
  } catch (error) {
    console.error("Could not generate interview prep.", error);
  }

  if (!prep) {
    return "interview_prep_error";
  }

  const { error } = await supabase
    .from("applications")
    .update({
      ai_interview_prep: prep,
      interview_prep_at: new Date().toISOString()
    })
    .eq("id", applicationId)
    .is("merged_into_id", null);

  if (error) {
    console.error("Could not store interview prep.");
    return "interview_prep_error";
  }

  return "interview_prep_saved";
}

async function loadApplicationForPrep(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  applicationId: string
): Promise<ApplicationForPrep | null> {
  const { data, error } = await supabase
    .from("applications")
    .select("id, company, role, notes, requirement_matches")
    .eq("id", applicationId)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error) {
    console.error("Could not load application for interview prep.");
    return null;
  }

  return (data as ApplicationForPrep | null) ?? null;
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
    console.error("Could not load profile resume for interview prep.");
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

function isUuid(value: string) {
  return uuidPattern.test(value);
}
