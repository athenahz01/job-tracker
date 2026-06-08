import { NextRequest, NextResponse } from "next/server";

import { extensionSecretMatches } from "../../../lib/extension-auth";
import { createSupabaseServerClient } from "../../../lib/supabase";
import { resolveForwardStage, stageRank, type Stage } from "../../../lib/stages";

type ApplicationInput = {
  company?: unknown;
  role?: unknown;
  url?: unknown;
  source?: unknown;
  notes?: unknown;
  stage?: unknown;
  salary?: unknown;
  location?: unknown;
  tags?: unknown;
};

const dedupeWindowDays = 5;
const extensionStages = new Set<Stage>(["Saved", "Applied"]);
const maxTags = 20;
const maxTagLength = 40;

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

  if (!extensionSecretMatches(providedSecret, process.env.EXTENSION_API_SECRET)) {
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
  const salary = optionalLimitedString(body.salary, 160);
  const location = optionalLimitedString(body.location, 180);
  const tags = parseTags(body.tags);
  const normalizedCompany = normalizeCompany(company);

  try {
    const supabase = createSupabaseServerClient();
    const existing = await findExistingApplication(supabase, {
      normalizedCompany,
      role,
      url
    });

    if (existing) {
      const application = await updateExistingApplication(supabase, existing, {
        stage,
        salary,
        location,
        tags
      });
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
        stage,
        salary,
        location,
        tags
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

async function updateExistingApplication(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  existing: {
    id: string;
    stage: Stage;
    stage_locked: boolean;
    salary: string | null;
    location: string | null;
    tags: string[] | null;
  },
  incoming: {
    stage: Stage;
    salary: string | null;
    location: string | null;
    tags: string[];
  }
) {
  const update: {
    stage?: Stage;
    salary?: string;
    location?: string;
    tags?: string[];
    last_activity?: string;
  } = {};

  if (!existing.stage_locked) {
    const resolvedStage = resolveForwardStage(existing.stage, incoming.stage);
    const currentRank = stageRank[existing.stage];
    const resolvedRank = stageRank[resolvedStage];

    if (
      resolvedStage !== existing.stage &&
      currentRank !== undefined &&
      resolvedRank !== undefined &&
      resolvedRank > currentRank
    ) {
      update.stage = resolvedStage;
      update.last_activity = new Date().toISOString();
    }
  }

  if (!existing.salary && incoming.salary) {
    update.salary = incoming.salary;
  }

  if (!existing.location && incoming.location) {
    update.location = incoming.location;
  }

  const mergedTags = mergeTags(existing.tags, incoming.tags);
  if (mergedTags.changed) {
    update.tags = mergedTags.tags;
  }

  if (!Object.keys(update).length) {
    return existing;
  }

  const { data, error } = await supabase
    .from("applications")
    .update(update)
    .eq("id", existing.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function mergeTags(existingTags: string[] | null, incomingTags: string[]) {
  const existing = Array.isArray(existingTags) ? existingTags : [];
  const existingKeys = new Set(existing);
  const tags = [...existing];
  let changed = false;

  for (const tag of incomingTags) {
    if (existingKeys.has(tag)) {
      continue;
    }
    existingKeys.add(tag);
    tags.push(tag);
    changed = true;
    if (tags.length >= maxTags) {
      break;
    }
  }

  return { changed, tags };
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
