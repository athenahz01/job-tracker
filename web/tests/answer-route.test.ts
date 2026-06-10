import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAnthropic = vi.hoisted(() => ({
  draftScreenerAnswerWithClaude: vi.fn()
}));

const mockSupabase = vi.hoisted(() => {
  const state = {
    profile: {
      resume_text: "Built product analytics dashboards with TypeScript and SQL.",
      full_name: "Ada Lovelace",
      email: "ada@example.com",
      phone: "555-0100",
      location: "New York, NY",
      linkedin_url: "https://linkedin.com/in/ada",
      github_url: "https://github.com/ada",
      portfolio_url: null,
      website_url: "https://ada.example.com",
      work_authorization: "Authorized to work in the United States",
      requires_sponsorship: false,
      years_experience: "7",
      current_title: "Product Engineer"
    }
  };

  return {
    state,
    createClient: () => ({
      from: (table: string) => {
        if (table !== "profile") {
          throw new Error(`Unexpected table ${table}.`);
        }
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: state.profile, error: null })
            })
          })
        };
      }
    })
  };
});

vi.mock("../lib/anthropic", () => mockAnthropic);

vi.mock("../lib/supabase", () => ({
  createSupabaseServerClient: mockSupabase.createClient
}));

vi.mock("server-only", () => ({}));

import { POST } from "../app/api/answer/route";

describe("answer route", () => {
  beforeEach(() => {
    process.env.EXTENSION_API_SECRET = "test-secret";
    mockAnthropic.draftScreenerAnswerWithClaude.mockReset();
  });

  it("returns a drafted answer with Claude mocked", async () => {
    mockAnthropic.draftScreenerAnswerWithClaude.mockResolvedValue(
      "I am excited about Acme because the role matches my dashboard and analytics work."
    );

    const response = await postAnswer(
      {
        question: "Why are you interested in Acme?",
        company: "Acme",
        role: "Product Engineer",
        jobDescription: "Build customer analytics workflows."
      },
      "test-secret"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      answer: "I am excited about Acme because the role matches my dashboard and analytics work."
    });
    expect(mockAnthropic.draftScreenerAnswerWithClaude).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Why are you interested in Acme?",
        company: "Acme",
        role: "Product Engineer",
        jobDescription: "Build customer analytics workflows.",
        resumeText: "Built product analytics dashboards with TypeScript and SQL.",
        profile: expect.objectContaining({
          full_name: "Ada Lovelace",
          requires_sponsorship: false
        })
      })
    );
  });

  it("rejects a bad secret", async () => {
    const response = await postAnswer({ question: "Why Acme?" }, "bad-secret");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, reason: "unauthorized" });
    expect(mockAnthropic.draftScreenerAnswerWithClaude).not.toHaveBeenCalled();
  });
});

function postAnswer(payload: Record<string, unknown>, secret: string) {
  return POST(
    new NextRequest("http://localhost/api/answer", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-extension-api-secret": secret
      },
      body: JSON.stringify(payload)
    })
  );
}
