import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createSupabaseServerClient } from "../../../lib/supabase";

type ApplicationInput = {
  company?: unknown;
  role?: unknown;
  url?: unknown;
  source?: unknown;
};

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

  try {
    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
      .from("applications")
      .insert({
        company,
        normalized_company: normalizeCompany(company),
        role,
        url,
        source,
        stage: "Applied"
      })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch {
    return NextResponse.json(
      { message: "Could not create application." },
      { status: 500 }
    );
  }
}
