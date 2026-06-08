import type { Relationship } from "./tracker";

export type DraftApplicationInput = {
  company: string;
  role: string | null;
  stage: string;
  lastActivity: string | null;
  nextAction?: string | null;
  followUpOn?: string | null;
};

export type DraftContactInput = {
  name: string;
  company: string | null;
  title: string | null;
  relationship: Relationship | null;
  linkedApplication?: {
    company: string;
    role: string | null;
    stage: string;
  } | null;
};

export const DRAFTING_SYSTEM_PROMPT =
  "You write concise, human job-search messages. Be specific to the provided facts, do not invent details, do not include AI boilerplate, and return only the message text.";

export function buildFollowUpDraftPrompt(input: DraftApplicationInput) {
  return [
    "Draft a short follow-up email for this application.",
    "Keep it warm, direct, and under 120 words.",
    "Include a subject line only if it feels useful.",
    "",
    `Company: ${input.company}`,
    `Role: ${input.role || "Not set"}`,
    `Current stage: ${input.stage}`,
    `Last activity: ${input.lastActivity || "Not set"}`,
    `Next action: ${input.nextAction || "Not set"}`,
    `Follow-up date: ${input.followUpOn || "Not set"}`
  ].join("\n");
}

export function buildContactOutreachPrompt(input: DraftContactInput) {
  const linked = input.linkedApplication
    ? `${input.linkedApplication.company}, ${input.linkedApplication.role || "role not set"}, ${input.linkedApplication.stage}`
    : "Not linked";

  return [
    "Draft a short outreach or referral-request message to this contact.",
    "Keep it under 120 words and easy to personalize.",
    "",
    `Contact name: ${input.name}`,
    `Contact company: ${input.company || "Not set"}`,
    `Contact title: ${input.title || "Not set"}`,
    `Relationship: ${input.relationship || "Not set"}`,
    `Linked application: ${linked}`
  ].join("\n");
}

export function buildColdOutreachPrompt(input: DraftApplicationInput) {
  return [
    "Suggest the type of person worth contacting for this application, then draft a short cold outreach message.",
    "Be honest that you are not finding real people and are only suggesting a contact type.",
    "Keep the whole answer under 150 words.",
    "",
    `Company: ${input.company}`,
    `Role: ${input.role || "Not set"}`,
    `Current stage: ${input.stage}`,
    `Last activity: ${input.lastActivity || "Not set"}`
  ].join("\n");
}
