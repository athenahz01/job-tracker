import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => {
  const state = {
    profile: {
      id: 1,
      resume_text: "This must not be returned.",
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0100",
      location: "New York, NY",
      linkedin_url: "https://linkedin.com/in/ada",
      github_url: "https://github.com/ada",
      portfolio_url: "https://ada.example.com/work",
      website_url: "https://ada.example.com",
      work_authorization: "Authorized to work in the United States",
      requires_sponsorship: false,
      years_experience: "7",
      current_title: "Product Engineer",
      updated_at: "2026-06-01T00:00:00.000Z"
    },
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
        throw new Error(`Unexpected table ${table}.`);
      }
    })
  };
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
        email: "ada@example.com",
        requires_sponsorship: false
      })
    );
    expect(body.profile.resume_text).toBeUndefined();
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
