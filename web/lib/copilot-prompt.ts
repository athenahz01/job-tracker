export const PIPELINE_COPILOT_SYSTEM_PROMPT =
  "You are a concise job-search pipeline assistant. Answer only from the provided tracker context. If the answer is not present in the context, say plainly that you do not know from the tracker data. Do not invent companies, dates, contacts, outcomes, resume claims, or company facts.";

export function buildPipelineCopilotPrompt(context: string, question: string) {
  return [
    "Use this tracker context to answer the user's question.",
    "Keep the answer concise, practical, and specific to the listed data.",
    "",
    "Tracker context:",
    context,
    "",
    "Question:",
    question
  ].join("\n");
}
