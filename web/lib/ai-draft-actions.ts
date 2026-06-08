"use server";

import { requestClaudeText } from "./anthropic";
import {
  buildColdOutreachPrompt,
  buildContactOutreachPrompt,
  buildFollowUpDraftPrompt,
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

function readString(value: FormDataEntryValue | null) {
  return typeof value === "string" ? value : "";
}

function isUuid(value: string) {
  return uuidPattern.test(value);
}
