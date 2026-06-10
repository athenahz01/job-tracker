"use server";

import {
  draftScreenerAnswerWithClaude,
  requestClaudeText,
  type ScreenerAnswerProfile
} from "./anthropic";
import {
  buildColdOutreachPrompt,
  buildContactOutreachPrompt,
  buildFollowUpDraftPrompt,
  buildNetworkingDraftPrompt,
  type NetworkingDraftVariant,
  DRAFTING_SYSTEM_PROMPT
} from "./draft-prompts";
import { requireDashboardAccess } from "./dashboard-auth";
import type { ApplicationRow, ContactRow } from "./dashboard-data";
import { createSupabaseServerClient } from "./supabase";

export type DraftActionState = {
  ok: boolean;
  text: string;
  error: string | null;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function draftApplicationFollowUpAction(
  _state: DraftActionState,
  formData: FormData
): Promise<DraftActionState> {
  await requireDashboardAccess();

  const application = await loadApplication(readString(formData.get("applicationId")));
  if (!application) {
    return draftError("Could not load that application.");
  }

  return generateDraft(
    buildFollowUpDraftPrompt({
      company: application.company,
      role: application.role,
      stage: application.stage,
      lastActivity: application.last_activity,
      nextAction: application.next_action,
      followUpOn: application.follow_up_on
    })
  );
}

export async function draftColdOutreachAction(
  _state: DraftActionState,
  formData: FormData
): Promise<DraftActionState> {
  await requireDashboardAccess();

  const application = await loadApplication(readString(formData.get("applicationId")));
  if (!application) {
    return draftError("Could not load that application.");
  }

  return generateDraft(
    buildColdOutreachPrompt({
      company: application.company,
      role: application.role,
      stage: application.stage,
      lastActivity: application.last_activity
    })
  );
}

export async function draftContactOutreachAction(
  _state: DraftActionState,
  formData: FormData
): Promise<DraftActionState> {
  await requireDashboardAccess();

  const contact = await loadContact(readString(formData.get("contactId")));
  if (!contact) {
    return draftError("Could not load that contact.");
  }

  const linkedApplication = contact.application_id
    ? await loadApplication(contact.application_id)
    : null;

  return generateDraft(
    buildContactOutreachPrompt({
      name: contact.name,
      company: contact.company,
      title: contact.title,
      relationship: contact.relationship,
      linkedApplication: linkedApplication
        ? {
            company: linkedApplication.company,
            role: linkedApplication.role,
            stage: linkedApplication.stage
          }
        : null
    })
  );
}

export async function draftNetworkingMessageAction(
  _state: DraftActionState,
  formData: FormData
): Promise<DraftActionState> {
  await requireDashboardAccess();

  const variant = readNetworkingVariant(formData.get("variant"));
  if (!variant) {
    return draftError("Choose a valid draft type.");
  }

  const contact = await loadContact(readString(formData.get("contactId")));
  if (!contact) {
    return draftError("Could not load that contact.");
  }

  const applicationId = readString(formData.get("applicationId"));
  const targetApplication = applicationId ? await loadApplication(applicationId) : null;
  if (applicationId && !targetApplication) {
    return draftError("Could not load that application.");
  }
  if (variant !== "follow_up_nudge" && !targetApplication) {
    return draftError("Choose a target application for this draft.");
  }

  return generateDraft(
    buildNetworkingDraftPrompt({
      variant,
      name: contact.name,
      company: contact.company,
      title: contact.title,
      relationship: contact.relationship,
      school: contact.school,
      pastCompanies: contact.past_companies,
      outreachStage: contact.outreach_stage,
      notes: contact.notes,
      targetApplication: targetApplication
        ? {
            company: targetApplication.company,
            role: targetApplication.role,
            stage: targetApplication.stage,
            url: targetApplication.url
          }
        : null
    })
  );
}

export async function draftInterviewPracticeAnswerAction(
  _state: DraftActionState,
  formData: FormData
): Promise<DraftActionState> {
  await requireDashboardAccess();

  const question = cleanQuestion(readString(formData.get("question")));
  if (!question) {
    return draftError("Choose an interview question first.");
  }

  const application = await loadApplication(readString(formData.get("applicationId")));
  if (!application) {
    return draftError("Could not load that application.");
  }

  const profile = await loadProfileForDraft();
  const resumeText = cleanLongText(profile?.resume_text ?? null, 200000);
  if (!resumeText) {
    return draftError("Save a master resume in Profile first.");
  }

  try {
    const text = await draftScreenerAnswerWithClaude({
      question: [
        "Interview practice question:",
        question,
        "",
        "Draft a strong first-person interview answer. Keep it honest, conversational, and grounded only in the resume and profile."
      ].join("\n"),
      company: application.company,
      role: application.role,
      jobDescription: application.notes,
      resumeText,
      profile: toScreenerProfile(profile)
    });

    return {
      ok: true,
      text: cleanDraft(text),
      error: null
    };
  } catch {
    console.error("Could not generate interview practice answer.");
    return draftError("Could not generate a practice answer right now.");
  }
}

async function generateDraft(prompt: string): Promise<DraftActionState> {
  try {
    const text = await requestClaudeText({
      system: DRAFTING_SYSTEM_PROMPT,
      prompt,
      maxTokens: 650,
      temperature: 0.3
    });

    return {
      ok: true,
      text: cleanDraft(text),
      error: null
    };
  } catch {
    console.error("Could not generate AI draft.");
    return draftError("Could not generate a draft right now.");
  }
}

async function loadApplication(applicationId: string) {
  if (!isUuid(applicationId)) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .is("merged_into_id", null)
    .maybeSingle();

  if (error) {
    console.error("Could not load application for draft.");
    return null;
  }

  return (data as ApplicationRow | null) ?? null;
}

async function loadContact(contactId: string) {
  if (!isUuid(contactId)) {
    return null;
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", contactId)
    .maybeSingle();

  if (error) {
    console.error("Could not load contact for draft.");
    return null;
  }

  return (data as ContactRow | null) ?? null;
}

async function loadProfileForDraft() {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("profile")
    .select(
      "resume_text, full_name, email, phone, location, linkedin_url, github_url, portfolio_url, website_url, work_authorization, requires_sponsorship, years_experience, current_title"
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.error("Could not load profile for interview practice.");
    return null;
  }

  return (data as (ScreenerAnswerProfile & { resume_text: string | null }) | null) ?? null;
}

function draftError(error: string): DraftActionState {
  return {
    ok: false,
    text: "",
    error
  };
}

function cleanDraft(value: string) {
  return value.trim().slice(0, 3000);
}

function cleanQuestion(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 800);
}

function cleanLongText(value: string | null, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return text ? text.slice(0, maxLength) : null;
}

function toScreenerProfile(
  profile: (ScreenerAnswerProfile & { resume_text: string | null }) | null
): ScreenerAnswerProfile | null {
  if (!profile) {
    return null;
  }
  return {
    full_name: profile.full_name ?? null,
    email: profile.email ?? null,
    phone: profile.phone ?? null,
    location: profile.location ?? null,
    linkedin_url: profile.linkedin_url ?? null,
    github_url: profile.github_url ?? null,
    portfolio_url: profile.portfolio_url ?? null,
    website_url: profile.website_url ?? null,
    work_authorization: profile.work_authorization ?? null,
    requires_sponsorship: profile.requires_sponsorship ?? null,
    years_experience: profile.years_experience ?? null,
    current_title: profile.current_title ?? null
  };
}

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function readNetworkingVariant(value: FormDataEntryValue | null): NetworkingDraftVariant | null {
  if (
    value === "referral_request" ||
    value === "warm_intro" ||
    value === "coffee_chat" ||
    value === "follow_up_nudge"
  ) {
    return value;
  }
  return null;
}

function isUuid(value: string) {
  return uuidPattern.test(value);
}
