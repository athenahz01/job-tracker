import { NextRequest, NextResponse } from "next/server";

import { normalizeCompanyName } from "../../../lib/company";
import { extensionSecretMatches } from "../../../lib/extension-auth";
import { createSupabaseServerClient } from "../../../lib/supabase";

type PostingInput = {
  url?: unknown;
  company?: unknown;
  role?: unknown;
  salary?: unknown;
  location?: unknown;
  tags?: unknown;
};

const maxTags = 20;
const maxTagLength = 40;

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get("x-extension-api-secret");

  if (!extensionSecretMatches(providedSecret, process.env.EXTENSION_API_SECRET)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: PostingInput;
  try {
    body = (await request.json()) as PostingInput;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const url = optionalLimitedString(body.url, 2000);
  const salary = optionalLimitedString(body.salary, 160);
  const location = optionalLimitedString(body.location, 180);
  if (!url || (!salary && !location)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const company = optionalLimitedString(body.company, 180);
  const role = optionalLimitedString(body.role, 220);
  const tags = parseTags(body.tags);

  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("job_postings").upsert(
      {
        url,
        company,
        normalized_company: company ? normalizeCompanyName(company) : null,
        role,
        salary,
        location,
        tags,
        seen_at: new Date().toISOString()
      },
      { onConflict: "url" }
    );

    if (error) {
      throw error;
    }

    return NextResponse.json({ ok: true, ignored: false });
  } catch {
    return NextResponse.json({ message: "Could not cache posting." }, { status: 500 });
  }
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalLimitedString(value: unknown, maxLength: number) {
  const text = optionalString(value);
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
        .map((tag) => tag.trim())
        .filter(Boolean)
        .map((tag) => tag.slice(0, maxTagLength))
    )
  ).slice(0, maxTags);
}
