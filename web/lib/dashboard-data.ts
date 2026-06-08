import "server-only";

import { createSupabaseServerClient } from "./supabase";
import { stageRank, type Stage, stages } from "./stages";

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

export type ApplicationFlowNode = {
  id: string;
  label: string;
  count: number;
  level: number;
  tone: "base" | "interview" | "offer" | "rejected" | "no-response" | "progress";
};

export type ApplicationFlowLink = {
  source: string;
  target: string;
  value: number;
  tone: ApplicationFlowNode["tone"];
};

export type InterviewedOutcomeApplication = {
  id: string;
  company: string;
  role: string | null;
  outcome: "Rejected" | "Ghosted";
};

export type ApplicationFlowData = {
  total: number;
  nodes: ApplicationFlowNode[];
  links: ApplicationFlowLink[];
  interviewedBeforeOutcome: InterviewedOutcomeApplication[];
};

const activeFlowStages = [
  "Applied",
  "Assessment",
  "Phone Screen",
  "Interview",
  "Final",
  "Offer"
] as const satisfies readonly Stage[];

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

export async function getApplicationFlowData(): Promise<ApplicationFlowData> {
  const supabase = createSupabaseServerClient();

  const applicationsResponse = await supabase
    .from("applications")
    .select("id, company, role, stage, kind, merged_into_id")
    .eq("kind", "application")
    .is("merged_into_id", null);

  if (applicationsResponse.error) {
    throw new Error("Could not load application flow data.");
  }

  const applications = ((applicationsResponse.data ?? []) as ApplicationRow[]).filter(
    (application) => application.stage !== "Saved"
  );

  if (!applications.length) {
    return buildApplicationFlow([], new Map());
  }

  const eventsResponse = await supabase
    .from("email_events")
    .select("application_id, detected_stage")
    .in(
      "application_id",
      applications.map((application) => application.id)
    );

  if (eventsResponse.error) {
    throw new Error("Could not load application flow events.");
  }

  const eventsByApplication = new Map<string, Stage[]>();
  for (const event of (eventsResponse.data ?? []) as EmailEventRow[]) {
    if (!event.application_id || !event.detected_stage) {
      continue;
    }
    const events = eventsByApplication.get(event.application_id) ?? [];
    events.push(event.detected_stage);
    eventsByApplication.set(event.application_id, events);
  }

  return buildApplicationFlow(applications, eventsByApplication);
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

function buildApplicationFlow(
  applications: ApplicationRow[],
  eventsByApplication: Map<string, Stage[]>
): ApplicationFlowData {
  const counts = {
    interviewed: 0,
    rejected: 0,
    noResponse: 0,
    inProgress: 0,
    offer: 0,
    noOffer: 0,
    noResponseAfterInterview: 0,
    stillInterviewing: 0
  };
  const interviewedBeforeOutcome: InterviewedOutcomeApplication[] = [];

  for (const application of applications) {
    const furthestActiveStage = getFurthestActiveStage(
      application.stage,
      eventsByApplication.get(application.id) ?? []
    );
    const reachedInterview =
      (stageRank[furthestActiveStage] ?? 0) >= stageRank["Phone Screen"]!;

    if (!reachedInterview) {
      if (application.stage === "Rejected") {
        counts.rejected += 1;
      } else if (application.stage === "Ghosted") {
        counts.noResponse += 1;
      } else {
        counts.inProgress += 1;
      }
      continue;
    }

    counts.interviewed += 1;
    if (furthestActiveStage === "Offer") {
      counts.offer += 1;
    } else if (application.stage === "Rejected") {
      counts.noOffer += 1;
      interviewedBeforeOutcome.push({
        id: application.id,
        company: application.company,
        role: application.role,
        outcome: "Rejected"
      });
    } else if (application.stage === "Ghosted") {
      counts.noResponseAfterInterview += 1;
      interviewedBeforeOutcome.push({
        id: application.id,
        company: application.company,
        role: application.role,
        outcome: "Ghosted"
      });
    } else {
      counts.stillInterviewing += 1;
    }
  }

  const total = applications.length;
  const nodeCandidates: ApplicationFlowNode[] = [
    node("applied", "Applied", total, 0, "base"),
    node("interviewed", "Interviewed", counts.interviewed, 1, "interview"),
    node("rejected", "Rejected", counts.rejected, 1, "rejected"),
    node("no-response", "No response", counts.noResponse, 1, "no-response"),
    node("in-progress", "In progress", counts.inProgress, 1, "progress"),
    node("offer", "Offer", counts.offer, 2, "offer"),
    node("no-offer", "No offer", counts.noOffer, 2, "rejected"),
    node(
      "no-response-after-interview",
      "No response after interview",
      counts.noResponseAfterInterview,
      2,
      "no-response"
    ),
    node("still-interviewing", "Still interviewing", counts.stillInterviewing, 2, "interview")
  ];

  // Offer can split to accepted and declined once the app tracks that outcome.
  const linkCandidates: ApplicationFlowLink[] = [
    link("applied", "interviewed", counts.interviewed, "interview"),
    link("applied", "rejected", counts.rejected, "rejected"),
    link("applied", "no-response", counts.noResponse, "no-response"),
    link("applied", "in-progress", counts.inProgress, "progress"),
    link("interviewed", "offer", counts.offer, "offer"),
    link("interviewed", "no-offer", counts.noOffer, "rejected"),
    link(
      "interviewed",
      "no-response-after-interview",
      counts.noResponseAfterInterview,
      "no-response"
    ),
    link("interviewed", "still-interviewing", counts.stillInterviewing, "interview")
  ];

  const links = linkCandidates.filter((item) => item.value > 0);
  const visibleNodeIds = new Set<string>(["applied"]);
  for (const item of links) {
    visibleNodeIds.add(item.source);
    visibleNodeIds.add(item.target);
  }

  return {
    total,
    nodes: nodeCandidates.filter((item) => visibleNodeIds.has(item.id) && item.count > 0),
    links,
    interviewedBeforeOutcome
  };
}

function getFurthestActiveStage(currentStage: Stage, detectedStages: Stage[]) {
  const touched = new Set<Stage>(["Applied"]);
  for (const stage of detectedStages) {
    if (isActiveFlowStage(stage)) {
      touched.add(stage);
    }
  }
  if (isActiveFlowStage(currentStage)) {
    touched.add(currentStage);
  }

  return [...touched].reduce<Stage>(
    (furthest, stage) =>
      (stageRank[stage] ?? 0) > (stageRank[furthest] ?? 0) ? stage : furthest,
    "Applied"
  );
}

function isActiveFlowStage(stage: Stage): stage is (typeof activeFlowStages)[number] {
  return activeFlowStages.includes(stage as (typeof activeFlowStages)[number]);
}

function node(
  id: string,
  name: string,
  count: number,
  level: ApplicationFlowNode["level"],
  tone: ApplicationFlowNode["tone"]
): ApplicationFlowNode {
  return {
    id,
    label: `${name} (${count})`,
    count,
    level,
    tone
  };
}

function link(
  source: string,
  target: string,
  value: number,
  tone: ApplicationFlowLink["tone"]
): ApplicationFlowLink {
  return {
    source,
    target,
    value,
    tone
  };
}
