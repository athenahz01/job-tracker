"use server";

import { requestClaudeText } from "./anthropic";
import { buildPipelineCopilotContext } from "./copilot-context";
import {
  buildPipelineCopilotPrompt,
  PIPELINE_COPILOT_SYSTEM_PROMPT
} from "./copilot-prompt";
import { requireDashboardAccess } from "./dashboard-auth";
import type { ApplicationRow, ContactRow } from "./dashboard-data";
import { createSupabaseServerClient } from "./supabase";

export type AssistantActionResult = {
  ok: boolean;
  answer: string;
  error: string | null;
};

export async function askPipelineAssistantAction(
  question: string
): Promise<AssistantActionResult> {
  await requireDashboardAccess();

  const cleanedQuestion = cleanQuestion(question);
  if (!cleanedQuestion) {
    return {
      ok: false,
      answer: "",
      error: "Ask a question first."
    };
  }

  try {
    const supabase = createSupabaseServerClient();
    const [applicationsResponse, contactsResponse, profileResponse] = await Promise.all([
      supabase
        .from("applications")
        .select("*")
        .eq("kind", "application")
        .is("merged_into_id", null),
      supabase.from("contacts").select("*"),
      supabase
        .from("profile")
        .select("resume_text")
        .eq("id", 1)
        .maybeSingle()
    ]);

    if (applicationsResponse.error || contactsResponse.error || profileResponse.error) {
      throw new Error("Could not load tracker context.");
    }

    const context = buildPipelineCopilotContext({
      applications: (applicationsResponse.data ?? []) as ApplicationRow[],
      contacts: (contactsResponse.data ?? []) as ContactRow[],
      today: new Date(),
      resumeText:
        typeof profileResponse.data?.resume_text === "string"
          ? profileResponse.data.resume_text
          : null
    });
    const answer = await requestClaudeText({
      system: PIPELINE_COPILOT_SYSTEM_PROMPT,
      prompt: buildPipelineCopilotPrompt(context, cleanedQuestion),
      maxTokens: 700,
      temperature: 0.1
    });

    return {
      ok: true,
      answer: cleanAnswer(answer),
      error: null
    };
  } catch {
    console.error("Could not answer pipeline assistant question.");
    return {
      ok: false,
      answer: "",
      error: "The assistant could not answer right now."
    };
  }
}

function cleanQuestion(value: string) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, 1000) : "";
}

function cleanAnswer(value: string) {
  return value.trim().slice(0, 4000);
}
