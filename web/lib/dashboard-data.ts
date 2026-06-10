import "server-only";

import { getFurthestActiveStage } from "./application-stages";
import { buildFollowUpItems } from "./followups";
import { buildInsightsData, type InsightsData } from "./insights-calc";
import { buildPerformanceData, type PerformanceData } from "./performance-calc";
import { createSupabaseServerClient } from "./supabase";
import { stageRank, type Stage } from "./stages";
import { type Priority, type Relationship } from "./tracker";

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
  next_action: string | null;
  follow_up_on: string | null;
  salary: string | null;
  location: string | null;
  deadline: string | null;
  priority: Priority | null;
  tags: string[];
  resume_version: string | null;
  fit_score: number | null;
  fit_summary: string | null;
  missing_keywords: string[];
  scored_at: string | null;
  ai_tailored_bullets: string[];
  ai_cover_letter: string | null;
  tailored_at: string | null;
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

export type ContactRow = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  linkedin_url: string | null;
  relationship: Relationship | null;
  application_id: string | null;
  notes: string | null;
  last_contacted: string | null;
  next_follow_up: string | null;
  created_at: string;
  updated_at: string;
};

export type ContactWithApplication = ContactRow & {
  application: ApplicationSummary | null;
};

export type ApplicationSummary = {
  id: string;
  company: string;
  role: string | null;
  stage: Stage;
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

export type FollowUpItem = {
  id: string;
  kind: "application_due" | "quiet_application" | "contact_due";
  title: string;
  subtitle: string;
  dueOn: string;
  overdueDays: number;
  href: string;
  stage?: Stage;
};

export type ProfileRow = {
  id: number;
  resume_text: string | null;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postal_code: string | null;
  linkedin_url: string | null;
  github_url: string | null;
  portfolio_url: string | null;
  website_url: string | null;
  work_authorization: string | null;
  work_authorized: string | null;
  requires_sponsorship: boolean | null;
  years_experience: string | null;
  current_title: string | null;
  gender: string | null;
  race_ethnicity: string | null;
  hispanic_latino: string | null;
  veteran_status: string | null;
  disability_status: string | null;
  lgbtq_status: string | null;
  skills: string[];
  updated_at: string;
};

export type EducationRow = {
  id: string;
  school: string | null;
  degree: string | null;
  field_of_study: string | null;
  start_date: string | null;
  end_date: string | null;
  gpa: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type WorkExperienceRow = {
  id: string;
  company: string | null;
  title: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type ScreenerAnswerRow = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ProfileData = {
  profile: ProfileRow | null;
  education: EducationRow[];
  workExperience: WorkExperienceRow[];
  answers: ScreenerAnswerRow[];
};

export async function getDashboardData() {
  const supabase = createSupabaseServerClient();

  const [applicationsResponse, recruiterResponse] = await Promise.all([
    supabase
      .from("applications")
      .select("*")
      .eq("kind", "application")
      .is("merged_into_id", null)
      .order("last_activity", { ascending: false }),
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
    applications: normalizeApplications(applicationsResponse.data),
    recruiterOutreach: normalizeApplications(recruiterResponse.data)
  };
}

export async function getInsightsData(): Promise<InsightsData> {
  const supabase = createSupabaseServerClient();
  const applicationsResponse = await supabase
    .from("applications")
    .select("*")
    .eq("kind", "application")
    .is("merged_into_id", null);

  if (applicationsResponse.error) {
    throw new Error("Could not load insights applications.");
  }

  const applications = normalizeApplications(applicationsResponse.data);
  if (!applications.length) {
    return buildInsightsData([], []);
  }

  const eventsResponse = await supabase
    .from("email_events")
    .select("application_id, detected_stage, received_at")
    .in(
      "application_id",
      applications.map((application) => application.id)
    );

  if (eventsResponse.error) {
    throw new Error("Could not load insights events.");
  }

  return buildInsightsData(applications, (eventsResponse.data ?? []) as EmailEventRow[]);
}

export async function getPerformanceData(): Promise<PerformanceData> {
  const supabase = createSupabaseServerClient();
  const applicationsResponse = await supabase
    .from("applications")
    .select(
      "id, source, stage, kind, merged_into_id, first_seen, resume_version, tags"
    )
    .eq("kind", "application")
    .is("merged_into_id", null);

  if (applicationsResponse.error) {
    throw new Error("Could not load performance applications.");
  }

  const applications = normalizeApplications(applicationsResponse.data);
  if (!applications.length) {
    return buildPerformanceData([], []);
  }

  const eventsResponse = await supabase
    .from("email_events")
    .select("application_id, detected_stage, received_at")
    .in(
      "application_id",
      applications.map((application) => application.id)
    );

  if (eventsResponse.error) {
    throw new Error("Could not load performance events.");
  }

  return buildPerformanceData(applications, (eventsResponse.data ?? []) as EmailEventRow[]);
}

export async function getProfileData(): Promise<ProfileData> {
  const supabase = createSupabaseServerClient();
  const [profileResponse, educationResponse, workResponse, answersResponse] = await Promise.all([
    supabase
      .from("profile")
      .select(
        [
          "id",
          "resume_text",
          "first_name",
          "last_name",
          "full_name",
          "email",
          "phone",
          "location",
          "city",
          "state",
          "country",
          "postal_code",
          "linkedin_url",
          "github_url",
          "portfolio_url",
          "website_url",
          "work_authorization",
          "work_authorized",
          "requires_sponsorship",
          "years_experience",
          "current_title",
          "gender",
          "race_ethnicity",
          "hispanic_latino",
          "veteran_status",
          "disability_status",
          "lgbtq_status",
          "skills",
          "updated_at"
        ].join(", ")
      )
      .eq("id", 1)
      .maybeSingle(),
    supabase
      .from("education")
      .select("id, school, degree, field_of_study, start_date, end_date, gpa, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false }),
    supabase
      .from("work_experience")
      .select("id, company, title, location, start_date, end_date, is_current, description, sort_order, created_at, updated_at")
      .order("sort_order", { ascending: true })
      .order("updated_at", { ascending: false }),
    supabase
      .from("screener_answers")
      .select("id, question, answer, tags, created_at, updated_at")
      .order("updated_at", { ascending: false })
  ]);

  if (profileResponse.error || educationResponse.error || workResponse.error || answersResponse.error) {
    throw new Error("Could not load profile.");
  }

  return {
    profile: normalizeProfile(profileResponse.data),
    education: normalizeEducation(educationResponse.data),
    workExperience: normalizeWorkExperience(workResponse.data),
    answers: normalizeScreenerAnswers(answersResponse.data)
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

  const applications = normalizeApplications(applicationsResponse.data).filter(
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

export async function getFollowUpsData(quietDays = 14) {
  const supabase = createSupabaseServerClient();
  const [applicationsResponse, contactsResponse] = await Promise.all([
    supabase
      .from("applications")
      .select("*")
      .eq("kind", "application")
      .is("merged_into_id", null),
    supabase.from("contacts").select("*")
  ]);

  if (applicationsResponse.error || contactsResponse.error) {
    throw new Error("Could not load follow-ups.");
  }

  return buildFollowUpItems(
    normalizeApplications(applicationsResponse.data),
    (contactsResponse.data ?? []) as ContactRow[],
    new Date(),
    quietDays
  );
}

export async function getNetworkData() {
  const supabase = createSupabaseServerClient();

  const [contactsResponse, applicationsResponse] = await Promise.all([
    supabase.from("contacts").select("*").order("next_follow_up", {
      ascending: true,
      nullsFirst: false
    }),
    supabase
      .from("applications")
      .select("id, company, role, stage, kind, merged_into_id")
      .eq("kind", "application")
      .is("merged_into_id", null)
      .order("company", { ascending: true })
  ]);

  if (contactsResponse.error || applicationsResponse.error) {
    throw new Error("Could not load network data.");
  }

  const applications = normalizeApplications(applicationsResponse.data);
  return {
    contacts: linkContactsToApplications((contactsResponse.data ?? []) as ContactRow[], applications),
    applications: applications.map((application) => ({
      id: application.id,
      company: application.company,
      role: application.role,
      stage: application.stage
    }))
  };
}

export async function getApplicationDetail(id: string) {
  const supabase = createSupabaseServerClient();

  const [applicationResponse, eventsResponse, mergeTargetsResponse, contactsResponse] =
    await Promise.all([
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
        .order("company", { ascending: true }),
      supabase
        .from("contacts")
        .select("*")
        .eq("application_id", id)
        .order("next_follow_up", { ascending: true, nullsFirst: false })
    ]);

  if (
    applicationResponse.error ||
    eventsResponse.error ||
    mergeTargetsResponse.error ||
    contactsResponse.error
  ) {
    throw new Error("Could not load application detail.");
  }

  return {
    application: applicationResponse.data
      ? normalizeApplications([applicationResponse.data])[0]
      : null,
    events: (eventsResponse.data ?? []) as EmailEventRow[],
    mergeTargets: normalizeApplications(mergeTargetsResponse.data).filter(
      (application) => application.id !== id
    ),
    contacts: (contactsResponse.data ?? []) as ContactRow[]
  };
}

function normalizeApplications(rows: unknown): ApplicationRow[] {
  return ((rows ?? []) as ApplicationRow[]).map((row) => ({
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : [],
    priority: row.priority ?? null,
    next_action: row.next_action ?? null,
    follow_up_on: row.follow_up_on ?? null,
    salary: row.salary ?? null,
    location: row.location ?? null,
    deadline: row.deadline ?? null,
    resume_version: row.resume_version ?? null,
    fit_score: typeof row.fit_score === "number" ? row.fit_score : null,
    fit_summary: row.fit_summary ?? null,
    missing_keywords: Array.isArray(row.missing_keywords) ? row.missing_keywords : [],
    scored_at: row.scored_at ?? null,
    ai_tailored_bullets: Array.isArray(row.ai_tailored_bullets)
      ? row.ai_tailored_bullets
      : [],
    ai_cover_letter: row.ai_cover_letter ?? null,
    tailored_at: row.tailored_at ?? null
  }));
}

function normalizeScreenerAnswers(rows: unknown): ScreenerAnswerRow[] {
  return ((rows ?? []) as ScreenerAnswerRow[]).map((row) => ({
    ...row,
    tags: Array.isArray(row.tags) ? row.tags : []
  }));
}

function normalizeProfile(row: unknown): ProfileRow | null {
  if (!row || typeof row !== "object") {
    return null;
  }

  const profile = row as ProfileRow;
  return {
    ...profile,
    skills: Array.isArray(profile.skills) ? profile.skills : []
  };
}

function normalizeEducation(rows: unknown): EducationRow[] {
  return ((rows ?? []) as EducationRow[]).map((row) => ({
    ...row,
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0
  }));
}

function normalizeWorkExperience(rows: unknown): WorkExperienceRow[] {
  return ((rows ?? []) as WorkExperienceRow[]).map((row) => ({
    ...row,
    is_current: Boolean(row.is_current),
    sort_order: Number.isFinite(Number(row.sort_order)) ? Number(row.sort_order) : 0
  }));
}

function linkContactsToApplications(
  contacts: ContactRow[],
  applications: ApplicationRow[]
): ContactWithApplication[] {
  const applicationsById = new Map(applications.map((application) => [application.id, application]));
  return contacts.map((contact) => ({
    ...contact,
    application: contact.application_id
      ? toApplicationSummary(applicationsById.get(contact.application_id))
      : null
  }));
}

function toApplicationSummary(application: ApplicationRow | undefined): ApplicationSummary | null {
  if (!application) {
    return null;
  }
  return {
    id: application.id,
    company: application.company,
    role: application.role,
    stage: application.stage
  };
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
