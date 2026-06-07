import "server-only";

import { createSupabaseServerClient } from "./supabase";
import { Stage, stages } from "./stages";

export type ApplicationKind = "application" | "recruiter_outreach";

export type ApplicationRow = {
  id: string;
  company: string;
  normalized_company: string;
  company_domain: string | null;
  role: string | null;
  source: string | null;
  url: string | null;
  stage: Stage;
  is_orphan: boolean;
  merged_into_id: string | null;
  stage_locked: boolean;
  kind: ApplicationKind;
  notes: string | null;
  first_seen: string;
  last_activity: string;
  created_at: string;
  updated_at: string;
};

export type EmailEventRow = {
  id: string;
  gmail_message_id: string;
  gmail_thread_id: string | null;
  application_id: string | null;
  category: string | null;
  is_job_related: boolean | null;
  detected_stage: Stage | null;
  confidence: number | null;
  company: string | null;
  role: string | null;
  from_address: string | null;
  subject: string | null;
  summary: string | null;
  raw_snippet: string | null;
  received_at: string | null;
  processed_at: string;
};

export type BoardFilters = {
  stage?: Stage;
  orphanOnly: boolean;
  query?: string;
};

export async function getDashboardData(filters: BoardFilters) {
  const supabase = createSupabaseServerClient();

  let applicationsQuery = supabase
    .from("applications")
    .select("*")
    .eq("kind", "application")
    .is("merged_into_id", null)
    .order("last_activity", { ascending: false });

  if (filters.stage) {
    applicationsQuery = applicationsQuery.eq("stage", filters.stage);
  }

  if (filters.orphanOnly) {
    applicationsQuery = applicationsQuery.eq("is_orphan", true);
  }

  if (filters.query) {
    applicationsQuery = applicationsQuery.ilike("company", `%${filters.query}%`);
  }

  const [applicationsResponse, recruiterResponse] = await Promise.all([
    applicationsQuery,
    supabase
      .from("applications")
      .select("*")
      .eq("kind", "recruiter_outreach")
      .is("merged_into_id", null)
      .order("last_activity", { ascending: false })
  ]);

  if (applicationsResponse.error || recruiterResponse.error) {
    throw new Error("Could not load dashboard data.");
  }

  return {
    applications: (applicationsResponse.data ?? []) as ApplicationRow[],
    recruiterOutreach: (recruiterResponse.data ?? []) as ApplicationRow[]
  };
}

export async function getApplicationDetail(id: string) {
  const supabase = createSupabaseServerClient();

  const [applicationResponse, eventsResponse, mergeTargetsResponse] = await Promise.all([
    supabase
      .from("applications")
      .select("*")
      .eq("id", id)
      .is("merged_into_id", null)
      .maybeSingle(),
    supabase
      .from("email_events")
      .select("*")
      .eq("application_id", id)
      .order("received_at", { ascending: false, nullsFirst: false }),
    supabase
      .from("applications")
      .select("id, company, role, stage, last_activity, is_orphan, kind")
      .eq("kind", "application")
      .is("merged_into_id", null)
      .order("company", { ascending: true })
  ]);

  if (applicationResponse.error || eventsResponse.error || mergeTargetsResponse.error) {
    throw new Error("Could not load application detail.");
  }

  return {
    application: applicationResponse.data as ApplicationRow | null,
    events: (eventsResponse.data ?? []) as EmailEventRow[],
    mergeTargets: ((mergeTargetsResponse.data ?? []) as ApplicationRow[]).filter(
      (application) => application.id !== id
    )
  };
}

export function parseFilters(params: Record<string, string | string[] | undefined>) {
  const requestedStage = readSingle(params.stage);
  const stage = stages.includes(requestedStage as Stage)
    ? (requestedStage as Stage)
    : undefined;
  const orphanOnly = readSingle(params.orphan) === "1";
  const query = readSingle(params.q)?.trim() || undefined;

  return { stage, orphanOnly, query };
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
