import "server-only";

type ClaudeTextBlock = {
  type?: string;
  text?: string;
};

type ClaudeMessageResponse = {
  content?: ClaudeTextBlock[];
};

type ClaudeJsonRequest = {
  system: string;
  prompt: string;
  maxTokens: number;
};

type ClaudeTextRequest = ClaudeJsonRequest & {
  temperature?: number;
};

type FitPromptInput = {
  company: string;
  role: string | null;
  jobDescription: string | null;
  resumeText: string;
};

export const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-4-5";

export const FIT_SCORING_SYSTEM_PROMPT =
  "You are a calibrated job application reviewer. Return only strict JSON. Do not flatter. Score honestly against the supplied resume and job posting.";

export const FIT_SCORING_OUTPUT_SHAPE =
  '{"fit_score":0,"fit_summary":"","missing_keywords":[]}';

export const TAILORING_SYSTEM_PROMPT =
  "You are a careful resume and cover letter editor. Return only strict JSON. Suggestions must be truthful to the supplied resume and targeted to the supplied job.";

export const TAILORING_OUTPUT_SHAPE =
  '{"ai_tailored_bullets":[],"ai_cover_letter":""}';

export async function scoreFitWithClaude(input: FitPromptInput): Promise<unknown> {
  return requestClaudeJson({
    system: FIT_SCORING_SYSTEM_PROMPT,
    prompt: buildFitScoringPrompt(input),
    maxTokens: 900
  });
}

export async function tailorApplicationWithClaude(input: FitPromptInput): Promise<unknown> {
  return requestClaudeJson({
    system: TAILORING_SYSTEM_PROMPT,
    prompt: buildTailoringPrompt(input),
    maxTokens: 1600
  });
}

export function buildFitScoringPrompt(input: FitPromptInput) {
  return [
    "Evaluate this application fit using the resume and job posting.",
    "Return exactly one JSON object and nothing else.",
    `The JSON shape must be exactly: ${FIT_SCORING_OUTPUT_SHAPE}`,
    "fit_score must be an integer from 0 to 100.",
    "fit_summary must be a short verdict of two to three sentences, roughly 50 to 60 words, naming the biggest strength and the biggest gap.",
    "missing_keywords must be important terms from the job posting that are absent from the resume.",
    "Use calibrated scoring. Do not inflate the score to be encouraging.",
    "",
    `Company: ${input.company}`,
    `Role: ${input.role || "Not set"}`,
    "",
    "Job posting notes:",
    input.jobDescription || "Not set",
    "",
    "Master resume:",
    input.resumeText
  ].join("\n");
}

export function buildTailoringPrompt(input: FitPromptInput) {
  return [
    "Create role-specific tailoring suggestions using the resume and job posting.",
    "Return exactly one JSON object and nothing else.",
    `The JSON shape must be exactly: ${TAILORING_OUTPUT_SHAPE}`,
    "ai_tailored_bullets must be an array of rewritten or suggested resume bullet points.",
    "ai_cover_letter must be a short, human, non-boilerplate cover letter draft.",
    "Keep every suggestion truthful to the resume. Do not invent experience.",
    "",
    `Company: ${input.company}`,
    `Role: ${input.role || "Not set"}`,
    "",
    "Job posting notes:",
    input.jobDescription || "Not set",
    "",
    "Master resume:",
    input.resumeText
  ].join("\n");
}

async function requestClaudeJson({ system, prompt, maxTokens }: ClaudeJsonRequest) {
  const text = await requestClaudeText({ system, prompt, maxTokens, temperature: 0 });
  return parseClaudeJson(text);
}

export async function requestClaudeText({
  system,
  prompt,
  maxTokens,
  temperature = 0.2
}: ClaudeTextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("Anthropic API key is not configured.");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
      "x-api-key": apiKey
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    })
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Claude request failed: ${response.status} ${detail.slice(0, 300)}`);
  }

  const payload = (await response.json()) as ClaudeMessageResponse;
  const text = (payload.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("Claude returned an empty response.");
  }

  return text;
}

export function parseClaudeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // Models sometimes wrap JSON in markdown fences or add stray prose.
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      // fall through to brace extraction
    }
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    return JSON.parse(text.slice(start, end + 1));
  }

  throw new Error("Claude did not return valid JSON.");
}
