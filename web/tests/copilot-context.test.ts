import { describe, expect, it } from "vitest";

import { buildPipelineCopilotContext } from "../lib/copilot-context";
import type { ApplicationRow, ContactRow } from "../lib/dashboard-data";

describe("copilot context", () => {
  it("summarizes stages, due follow-ups, stale applications, contacts, and fit outliers", () => {
    const context = buildPipelineCopilotContext({
      today: new Date("2026-06-08T12:00:00.000Z"),
      applications: [
        application({
          id: "app-1",
          company: "Acme",
          role: "Analyst",
          stage: "Applied",
          follow_up_on: "2026-06-07",
          next_action: "Send a polite note",
          fit_score: 84
        }),
        application({
          id: "app-2",
          company: "Bravo",
          role: "Designer",
          stage: "Interview",
          last_activity: "2026-05-20T00:00:00.000Z",
          fit_score: 32
        })
      ],
      contacts: [
        contact({
          id: "contact-1",
          name: "Riley",
          company: "Bravo",
          relationship: "recruiter",
          next_follow_up: "2026-06-08"
        })
      ],
      resumeText: "Built SQL dashboards and analytics workflows."
    });

    expect(context).toContain("Applied: 1");
    expect(context).toContain("Interview: 1");
    expect(context).toContain("Acme: Send a polite note");
    expect(context).toContain("Bravo, Designer: Interview");
    expect(context).toContain("Riley at Bravo");
    expect(context).toContain("Acme, Analyst: 84");
    expect(context).toContain("Bravo, Designer: 32");
    expect(context).toContain("Interview prep references:");
    expect(context).toContain("Built SQL dashboards");
  });
});

function application(overrides: Partial<ApplicationRow>): ApplicationRow {
  const now = "2026-06-01T00:00:00.000Z";
  return {
    id: "app",
    company: "Company",
    normalized_company: "company",
    company_domain: null,
    role: null,
    source: "manual",
    url: null,
    stage: "Applied",
    is_orphan: false,
    merged_into_id: null,
    stage_locked: false,
    kind: "application",
    notes: null,
    next_action: null,
    follow_up_on: null,
    salary: null,
    location: null,
    deadline: null,
    priority: null,
    tags: [],
    resume_version: null,
    fit_score: null,
    fit_summary: null,
    missing_keywords: [],
    scored_at: null,
    requirement_matches: [],
    requirements_scored_at: null,
    ai_tailored_bullets: [],
    ai_cover_letter: null,
    tailored_at: null,
    ai_tailored_resume: null,
    tailored_resume_at: null,
    ai_interview_prep: null,
    interview_prep_at: null,
    first_seen: now,
    last_activity: now,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

function contact(overrides: Partial<ContactRow>): ContactRow {
  const now = "2026-06-01T00:00:00.000Z";
  return {
    id: "contact",
    name: "Contact",
    company: null,
    title: null,
    email: null,
    linkedin_url: null,
    relationship: null,
    school: null,
    past_companies: [],
    outreach_stage: null,
    application_id: null,
    notes: null,
    last_contacted: null,
    next_follow_up: null,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}
