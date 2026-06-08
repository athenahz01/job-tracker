import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFit = vi.hoisted(() => ({
  scoreJobFit: vi.fn()
}));

const mockSupabase = vi.hoisted(() => {
  const state = {
    resumeText: "Built dashboards with React, SQL, and lifecycle analytics."
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
              maybeSingle: async () => ({
                data: { resume_text: state.resumeText },
                error: null
              })
            })
          })
        };
      }
    })
  };
});

vi.mock("../lib/resume-fit", () => mockFit);

vi.mock("../lib/supabase", () => ({
  createSupabaseServerClient: mockSupabase.createClient
}));

vi.mock("server-only", () => ({}));

import { POST } from "../app/api/score/route";

describe("score route", () => {
  beforeEach(() => {
    process.env.EXTENSION_API_SECRET = "test-secret";
    mockSupabase.state.resumeText = "Built dashboards with React, SQL, and lifecycle analytics.";
    mockFit.scoreJobFit.mockReset();
  });

  it("returns a fit result for a valid request", async () => {
    mockFit.scoreJobFit.mockResolvedValue({
      fit_score: 82,
      fit_summary: "Strong dashboard match. The biggest gap is direct fintech domain depth.",
      missing_keywords: ["fintech", "risk"]
    });

    const response = await postScore(
      {
        company: "Acme",
        role: "Product Analyst",
        jobDescription: "React dashboards for fintech risk."
      },
      "test-secret"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      fit_score: 82,
      fit_summary: "Strong dashboard match. The biggest gap is direct fintech domain depth.",
      missing_keywords: ["fintech", "risk"]
    });
    expect(mockFit.scoreJobFit).toHaveBeenCalledWith({
      company: "Acme",
      role: "Product Analyst",
      jobDescription: "React dashboards for fintech risk.",
      resumeText: mockSupabase.state.resumeText
    });
  });

  it("returns no_resume when the profile resume is empty", async () => {
    mockSupabase.state.resumeText = " ";

    const response = await postScore({ company: "Acme" }, "test-secret");
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: false, reason: "no_resume" });
    expect(mockFit.scoreJobFit).not.toHaveBeenCalled();
  });

  it("rejects a bad secret", async () => {
    const response = await postScore({ company: "Acme" }, "bad-secret");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, reason: "unauthorized" });
  });
});

function postScore(payload: Record<string, unknown>, secret: string) {
  return POST(
    new NextRequest("http://localhost/api/score", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-extension-api-secret": secret
      },
      body: JSON.stringify(payload)
    })
  );
}
