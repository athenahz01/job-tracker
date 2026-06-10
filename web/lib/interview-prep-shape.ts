export type InterviewPrepQuestion = {
  question: string;
  category: string;
  talking_points: string[];
};

export type InterviewPrep = {
  likely_questions: InterviewPrepQuestion[];
  company_insights: string[];
  focus_areas: string[];
};

export function normalizeInterviewPrep(value: unknown): InterviewPrep | null {
  if (!isRecord(value) || !Array.isArray(value.likely_questions)) {
    return null;
  }

  const likelyQuestions: InterviewPrepQuestion[] = [];
  const seenQuestions = new Set<string>();
  for (const item of value.likely_questions) {
    if (!isRecord(item) || !Array.isArray(item.talking_points)) {
      continue;
    }
    const question = typeof item.question === "string"
      ? cleanInlineText(item.question, 500)
      : null;
    const category = typeof item.category === "string"
      ? cleanInlineText(item.category, 80)
      : null;
    const talkingPoints = cleanTextArray(item.talking_points, 5, 260);
    if (!question || !category || !talkingPoints.length) {
      continue;
    }
    const key = question.toLowerCase();
    if (seenQuestions.has(key)) {
      continue;
    }
    seenQuestions.add(key);
    likelyQuestions.push({
      question,
      category,
      talking_points: talkingPoints
    });
    if (likelyQuestions.length >= 10) {
      break;
    }
  }

  if (!likelyQuestions.length) {
    return null;
  }

  return {
    likely_questions: likelyQuestions,
    company_insights: cleanTextArray(
      Array.isArray(value.company_insights) ? value.company_insights : [],
      6,
      320
    ),
    focus_areas: cleanTextArray(
      Array.isArray(value.focus_areas) ? value.focus_areas : [],
      8,
      220
    )
  };
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

function cleanInlineText(value: string, maxLength: number) {
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
