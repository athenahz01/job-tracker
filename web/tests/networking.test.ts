import { describe, expect, it } from "vitest";

import { buildWarmPathMatches, type WarmPathContact } from "../lib/networking";

describe("warm-path matching", () => {
  it("surfaces company and same-school contacts with company matches ranked first", () => {
    const matches = buildWarmPathMatches({
      applicationCompany: "Acme Inc.",
      userSchools: ["Rutgers University"],
      contacts: [
        contact({
          id: "school",
          name: "Sam School",
          company: "Other Co",
          school: "Rutgers University"
        }),
        contact({
          id: "past-company",
          name: "Parker Past",
          company: "Other Co",
          past_companies: ["Acme"]
        }),
        contact({
          id: "current-company",
          name: "Casey Current",
          company: "Acme LLC"
        }),
        contact({
          id: "miss",
          name: "Morgan Miss",
          company: "Delta",
          school: "Different School"
        })
      ]
    });

    expect(matches.map((match) => match.contact.id)).toEqual([
      "current-company",
      "past-company",
      "school"
    ]);
    expect(matches[0].matchType).toBe("company");
    expect(matches[1].reasons).toContain("Company match");
    expect(matches[2].reasons).toContain("Shared school: Rutgers University");
  });
});

function contact(overrides: Partial<WarmPathContact>): WarmPathContact {
  return {
    id: "contact",
    name: "Contact",
    company: null,
    title: null,
    email: null,
    school: null,
    past_companies: [],
    outreach_stage: null,
    ...overrides
  };
}
