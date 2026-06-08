import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase";
import { resolveForwardStage, stageRank, type Stage } from "../../../lib/stages";

type ApplicationInput = {
  company?: unknown;
  role?: unknown;
  url?: unknown;
  source?: unknown;
  notes?: unknown;
  stage?: unknown;
};

const dedupeWindowDays = 5;
const extensionStages = new Set<Stage>(["Saved", "Applied"]);

function secretsMatch(provided: string | null, expected: string | undefined) {
  if (!provided || !expected) {
    return false;
  }

  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);

  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeCompany(company: string) {
  return company
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(
      /\b(incorporated|inc|limited|ltd|llc|corporation|corp)\b$/i,
      ""
    )
    .trim()
    .replace(/\s+/g, " ");
}

function parseExtensionStage(stage: unknown): Stage {
  return typeof stage === "string" && extensionStages.has(stage as Stage)
    ? (stage as Stage)
    : "Saved";
}

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get("x-extension-api-secret");

  if (!secretsMatch(providedSecret, process.env.EXTENSION_API_SECRET)) {
    return NextResponse.json({ message: "Unauthorized." }, { status: 401 });
  }

  let body: ApplicationInput;

  try {
    body = (await request.json()) as ApplicationInput;
  } catch {
    return NextResponse.json({ message: "Invalid JSON body." }, { status: 400 });
  }

  const company = optionalString(body.company);

  if (!company) {
    return NextResponse.json({ message: "Company is required." }, { status: 400 });
  }

  const role = optionalString(body.role);
  const url = optionalString(body.url);
  const source = optionalString(body.source) ?? "extension";
  const notes = optionalString(body.notes);
  const stage = parseExtensionStage(body.stage);
  const normalizedCompany = normalizeCompany(company);

  try {
    const supabase = createSupabaseServerClient();
    const existing = await findExistingApplication(supabase, {
      normalizedCompany,
      role,
      url
    });

    if (existing) {
      const application = await advanceExistingApplication(supabase, existing, stage);
      return NextResponse.json({ ...application, deduped: true });
    }

    const { data, error } = await supabase
      .from("applications")
      .insert({
        company,
        normalized_company: normalizedCompany,
        role,
        url,
        source,
        notes,
        stage
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ ...data, deduped: false }, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Could not create application." },
      { status: 500 }
    );
  }
}

async function advanceExistingApplication(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  existing: { id: string; stage: Stage; stage_locked: boolean },
  postedStage: Stage
) {
  if (existing.stage_locked) {
    return existing;
  }

  const resolvedStage = resolveForwardStage(existing.stage, postedStage);
  const currentRank = stageRank[existing.stage];
  const resolvedRank = stageRank[resolvedStage];

  if (
    resolvedStage === existing.stage ||
    currentRank === undefined ||
    resolvedRank === undefined ||
    resolvedRank <= currentRank
  ) {
    return existing;
  }

  const { data, error } = await supabase
    .from("applications")
    .update({
      stage: resolvedStage,
      last_activity: new Date().toISOString()
    })
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function findExistingApplication(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  input: {
    normalizedCompany: string;
    role: string | null;
    url: string | null;
  }
) {
  if (input.url) {
    const { data, error } = await supabase
      .from("applications")
      .select("*")
      .eq("url", input.url)
      .is("merged_into_id", null)
      .limit(1)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  const cutoff = new Date(
    Date.now() - dedupeWindowDays * 24 * 60 * 60 * 1000
  ).toISOString();
  let query = supabase
    .from("applications")
    .select("*")
    .eq("normalized_company", input.normalizedCompany)
    .is("merged_into_id", null)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1);

  query = input.role ? query.eq("role", input.role) : query.is("role", null);

  const { data, error } = await query.maybeSingle();
  if (error) {
    throw error;
  }

  return data;
}
