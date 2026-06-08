import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { parseClaudeJson } from "../lib/anthropic";

describe("Anthropic helpers", () => {
  it("parses JSON wrapped in a markdown code fence", () => {
    const parsed = parseClaudeJson([
      "```json",
      '{"fit_score":82,"fit_summary":"Strong match.","missing_keywords":["Python"]}',
      "```"
    ].join("\n"));

    expect(parsed).toEqual({
      fit_score: 82,
      fit_summary: "Strong match.",
      missing_keywords: ["Python"]
    });
  });
});
