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

export type ScreenerAnswerProfile = {
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  website_url: string | null;
  work_authorization: string | null;
  requires_sponsorship: boolean | null;
  years_experience: string | null;
  current_title: string | null;
};

type ScreenerAnswerPromptInput = {
  question: string;
  company: string | null;
  role: string | null;
  jobDescription: string | null;
  resumeText: string | null;
  profile: ScreenerAnswerProfile | null;
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

export const SCREENER_ANSWER_SYSTEM_PROMPT =
  "You draft concise job application screener answers. Write in first person. Be specific, honest, and grounded only in the supplied profile and resume.";

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

export async function draftScreenerAnswerWithClaude(
  input: ScreenerAnswerPromptInput
): Promise<string> {
  return requestClaudeText({
    system: SCREENER_ANSWER_SYSTEM_PROMPT,
    prompt: buildScreenerAnswerPrompt(input),
    maxTokens: 500,
    temperature: 0.3
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

export function buildScreenerAnswerPrompt(input: ScreenerAnswerPromptInput) {
  return [
    "Draft a polished answer to the application screener question below.",
    "Use first person and answer directly.",
    "Keep the response concise, roughly 80 to 140 words unless the question clearly asks for something shorter.",
    "Do not invent employment history, credentials, work authorization, sponsorship status, salary needs, or relocation flexibility.",
    "If the available facts do not support a direct answer, say so plainly and offer a careful truthful framing.",
    "",
    `Question: ${input.question}`,
    "",
    `Company: ${input.company || "Not set"}`,
    `Role: ${input.role || "Not set"}`,
    "",
    "Application profile:",
    formatScreenerProfile(input.profile),
    "",
    "Job posting notes:",
    input.jobDescription || "Not set",
    "",
    "Master resume:",
    input.resumeText || "Not set"
  ].join("\n");
}

function formatScreenerProfile(profile: ScreenerAnswerProfile | null) {
  if (!profile) {
    return "Not set";
  }

  return [
    `Name: ${profile.full_name || "Not set"}`,
    `Location: ${profile.location || "Not set"}`,
    `Current title: ${profile.current_title || "Not set"}`,
    `Years of experience: ${profile.years_experience || "Not set"}`,
    `Work authorization: ${profile.work_authorization || "Not set"}`,
    `Requires sponsorship: ${
      profile.requires_sponsorship === null
        ? "Not set"
        : profile.requires_sponsorship
          ? "Yes"
          : "No"
    }`,
    `LinkedIn: ${profile.linkedin_url || "Not set"}`,
    `GitHub: ${profile.github_url || "Not set"}`,
    `Portfolio: ${profile.portfolio_url || "Not set"}`,
    `Website: ${profile.website_url || "Not set"}`
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
