import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSupabase = vi.hoisted(() => {
  type UpsertWrite = {
    table: string;
    value: Record<string, unknown>;
    options?: Record<string, unknown>;
  };

  const state = {
    upserts: [] as UpsertWrite[]
  };

  return {
    state,
    createClient: () => ({
      from: (table: string) => {
        if (table !== "job_postings") {
          throw new Error(`Unexpected table ${table}.`);
        }
        return {
          upsert: async (value: Record<string, unknown>, options?: Record<string, unknown>) => {
            state.upserts.push({ table, value, options });
            return { data: value, error: null };
          }
        };
      }
    })
  };
});

vi.mock("../lib/supabase", () => ({
  createSupabaseServerClient: mockSupabase.createClient
}));

vi.mock("server-only", () => ({}));

import { POST } from "../app/api/posting/route";

describe("posting route", () => {
  beforeEach(() => {
    process.env.EXTENSION_API_SECRET = "test-secret";
    mockSupabase.state.upserts = [];
  });

  it("stores a posting with salary and location", async () => {
    const response = await postPosting(
      {
        url: "https://jobs.example.com/acme/backend-engineer",
        company: "Acme Corp",
        role: "Backend Engineer",
        salary: "$120k to $150k",
        location: "Remote US",
        tags: [" remote ", "Full-time", "remote", ""]
      },
      "test-secret"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: false });
    expect(mockSupabase.state.upserts).toEqual([
      {
        table: "job_postings",
        value: expect.objectContaining({
          url: "https://jobs.example.com/acme/backend-engineer",
          company: "Acme Corp",
          normalized_company: "acme",
          role: "Backend Engineer",
          salary: "$120k to $150k",
          location: "Remote US",
          tags: ["remote", "Full-time"]
        }),
        options: { onConflict: "url" }
      }
    ]);
  });

  it("stores a posting with location and no salary", async () => {
    const response = await postPosting(
      {
        url: "https://jobs.example.com/acme/backend-engineer",
        company: "Acme",
        role: "Backend Engineer",
        location: "Remote US"
      },
      "test-secret"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: false });
    expect(mockSupabase.state.upserts[0].value).toEqual(
      expect.objectContaining({
        salary: null,
        location: "Remote US"
      })
    );
  });

  it("rejects a bad secret", async () => {
    const response = await postPosting({ url: "https://jobs.example.com/acme" }, "bad-secret");
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ message: "Unauthorized." });
    expect(mockSupabase.state.upserts).toEqual([]);
  });

  it("ignores postings without salary or location", async () => {
    const response = await postPosting(
      {
        url: "https://jobs.example.com/acme/backend-engineer",
        company: "Acme",
        role: "Backend Engineer"
      },
      "test-secret"
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true, ignored: true });
    expect(mockSupabase.state.upserts).toEqual([]);
  });
});

function postPosting(payload: Record<string, unknown>, secret: string) {
  return POST(
    new NextRequest("http://localhost/api/posting", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-extension-api-secret": secret
      },
      body: JSON.stringify(payload)
    })
  );
}
