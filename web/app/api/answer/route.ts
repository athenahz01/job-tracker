import { NextRequest, NextResponse } from "next/server";

import {
  draftScreenerAnswerWithClaude,
  type ScreenerAnswerProfile
} from "../../../lib/anthropic";
import { extensionSecretMatches } from "../../../lib/extension-auth";
import { createSupabaseServerClient } from "../../../lib/supabase";

type AnswerInput = {
  mode?: unknown;
  question?: unknown;
  answer?: unknown;
  company?: unknown;
  role?: unknown;
  jobDescription?: unknown;
  tags?: unknown;
};

type AnswerProfileRow = ScreenerAnswerProfile & {
  resume_text: string | null;
};

const profileSelect = [
  "resume_text",
  "full_name",
  "email",
  "phone",
  "location",
  "linkedin_url",
  "github_url",
  "portfolio_url",
  "website_url",
  "work_authorization",
  "requires_sponsorship",
  "years_experience",
  "current_title"
].join(", ");

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get("x-extension-api-secret");

  if (!extensionSecretMatches(providedSecret, process.env.EXTENSION_API_SECRET)) {
    return NextResponse.json({ ok: false, reason: "unauthorized" }, { status: 401 });
  }

  let body: AnswerInput;
  try {
    body = (await request.json()) as AnswerInput;
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 400 });
  }

  const question = cleanText(body.question, 1000);
  if (!question) {
    return NextResponse.json({ ok: false, reason: "question_required" }, { status: 400 });
  }

  if (body.mode === "save") {
    return saveAnswer(question, body);
  }

  try {
    const supabase = createSupabaseServerClient();
    const profileResponse = await supabase
      .from("profile")
      .select(profileSelect)
      .eq("id", 1)
      .maybeSingle();

    if (profileResponse.error) {
      throw profileResponse.error;
    }

    const row = (profileResponse.data as AnswerProfileRow | null) ?? null;
    const answer = await draftScreenerAnswerWithClaude({
      question,
      company: cleanText(body.company, 180),
      role: cleanText(body.role, 220),
      jobDescription: cleanLongText(body.jobDescription, 12000),
      resumeText: cleanLongText(row?.resume_text ?? null, 200000),
      profile: row
        ? {
            full_name: row.full_name,
            email: row.email,
            phone: row.phone,
            location: row.location,
            linkedin_url: row.linkedin_url,
            github_url: row.github_url,
            portfolio_url: row.portfolio_url,
            website_url: row.website_url,
            work_authorization: row.work_authorization,
            requires_sponsorship: row.requires_sponsorship,
            years_experience: row.years_experience,
            current_title: row.current_title
          }
        : null
    });

    return NextResponse.json({ ok: true, answer: cleanLongText(answer, 4000) ?? answer });
  } catch {
    console.error("Could not draft screener answer.");
    return NextResponse.json({ ok: false, reason: "answer_error" }, { status: 502 });
  }
}

async function saveAnswer(question: string, body: AnswerInput) {
  const answer = cleanLongText(body.answer, 8000);
  if (!answer) {
    return NextResponse.json({ ok: false, reason: "answer_required" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("screener_answers").insert({
      question,
      answer,
      tags: parseTags(body.tags)
    });

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: "answer_error" }, { status: 500 });
  }
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

function cleanLongText(value: unknown, maxLength: number) {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  return text ? text.slice(0, maxLength) : null;
}

function parseTags(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, 40))
    )
  ).slice(0, 20);
}
