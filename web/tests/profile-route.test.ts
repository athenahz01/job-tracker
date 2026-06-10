import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => {
  const state = {
    profile: {
      id: 1,
      resume_text: "This must not be returned.",
      first_name: "Ada",
      last_name: "Lovelace",
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0100",
      location: "New York, NY",
      city: "New York",
      state: "NY",
      country: "United States",
      postal_code: "10001",
      linkedin_url: "https://linkedin.com/in/ada",
      github_url: "https://github.com/ada",
      portfolio_url: "https://ada.example.com/work",
      website_url: "https://ada.example.com",
      work_authorization: "Authorized to work in the United States",
      work_authorized: "Yes",
      requires_sponsorship: false,
      years_experience: "7",
      current_title: "Product Engineer",
      gender: "Decline to state",
      race_ethnicity: "Decline to state",
      hispanic_latino: "Decline to state",
      veteran_status: "Not a veteran",
      disability_status: "No",
      lgbtq_status: "Decline to state",
      skills: ["TypeScript", "SQL"],
      updated_at: "2026-06-01T00:00:00.000Z"
    },
    education: [
      {
        id: "00000000-0000-4000-8000-000000000003",
        school: "Analytical University",
        degree: "BS",
        field_of_study: "Computer Science",
        start_date: "2018",
        end_date: "2022",
        gpa: "3.8",
        sort_order: 0,
        updated_at: "2026-06-03T00:00:00.000Z"
      }
    ],
    workExperience: [
      {
        id: "00000000-0000-4000-8000-000000000004",
        company: "Acme",
        title: "Product Engineer",
        location: "New York, NY",
        start_date: "2022",
        end_date: "",
        is_current: true,
        description: "Built analytics workflows.",
        sort_order: 0,
        updated_at: "2026-06-04T00:00:00.000Z"
      }
    ],
    answers: [
      {
        id: "00000000-0000-4000-8000-000000000002",
        question: "Why this company?",
        answer: "I am interested because the product solves a real workflow problem.",
        tags: ["motivation"],
        updated_at: "2026-06-02T00:00:00.000Z"
      }
    ]
  };

  return {
    state,
    createClient: () => ({
      from: (table: string) => {
        if (table === "profile") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: state.profile, error: null })
              })
            })
          };
        }
        if (table === "screener_answers") {
          return {
            select: () => ({
              order: async () => ({ data: state.answers, error: null })
            })
          };
        }
        if (table === "education") {
          return {
            select: () => orderable(state.education)
          };
        }
        if (table === "work_experience") {
          return {
            select: () => orderable(state.workExperience)
          };
        }
        throw new Error(`Unexpected table ${table}.`);
      }
    })
  };

  function orderable(data: unknown[]) {
    return {
      order: () => orderable(data),
      then: (
        resolve: (value: { data: unknown[]; error: null }) => void,
        _reject: (reason?: unknown) => void
      ) => resolve({ data, error: null })
    };
  }
});

vi.mock("../lib/supabase", () => ({
  createSupabaseServerClient: mockSupabase.createClient
}));

vi.mock("server-only", () => ({}));

import { GET } from "../app/api/profile/route";

describe("profile route", () => {
  beforeEach(() => {
    process.env.EXTENSION_API_SECRET = "test-secret";
  });

  it("returns application profile fields and answer bank without resume text", async () => {
    const response = await getProfile("test-secret");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.profile).toEqual(
      expect.objectContaining({
        full_name: "Ada Lovelace",
        first_name: "Ada",
        last_name: "Lovelace",
        city: "New York",
        country: "United States",
        email: "ada@example.com",
        requires_sponsorship: false,
        skills: ["TypeScript", "SQL"]
      })
    );
    expect(body.profile.resume_text).toBeUndefined();
    expect(body.education).toEqual([
      expect.objectContaining({
        school: "Analytical University",
        field_of_study: "Computer Science"
      })
    ]);
    expect(body.workExperience).toEqual([
      expect.objectContaining({
        company: "Acme",
        title: "Product Engineer",
        is_current: true
      })
    ]);
    expect(body.answers).toEqual([
      expect.objectContaining({
        question: "Why this company?",
        tags: ["motivation"]
      })
    ]);
  });

  it("rejects a bad secret", async () => {
    const response = await getProfile("bad-secret");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, reason: "unauthorized" });
  });
});

function getProfile(secret: string) {
  return GET(
    new NextRequest("http://localhost/api/profile", {
      method: "GET",
      headers: {
        "x-extension-api-secret": secret
      }
    })
  );
}
