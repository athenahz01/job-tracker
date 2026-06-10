import { normalizeCompanyName } from "./company";

export type OutreachStage = "to_reach" | "reached" | "replied" | "referred";

export const outreachStages: OutreachStage[] = [
  "to_reach",
  "reached",
  "replied",
  "referred"
];

export type WarmPathContact = {
  id: string;
  name: string;
  company: string | null;
  title: string | null;
  email: string | null;
  school: string | null;
  past_companies: string[];
  outreach_stage: OutreachStage | null;
  relationship?: string | null;
  application_id?: string | null;
  notes?: string | null;
  last_contacted?: string | null;
  next_follow_up?: string | null;
};

export type WarmPathMatch = {
  contact: WarmPathContact;
  matchType: "company" | "school";
  reasons: string[];
};

export function buildWarmPathMatches({
  applicationCompany,
  contacts,
  userSchools
}: {
  applicationCompany: string;
  contacts: WarmPathContact[];
  userSchools: string[];
}): WarmPathMatch[] {
  const targetCompany = normalizeCompanyName(applicationCompany);
  const schoolKeys = new Set(userSchools.map(normalizeSchool).filter(Boolean));
  const matches: WarmPathMatch[] = [];

  for (const contact of contacts) {
    const reasons: string[] = [];
    const companyNames = [contact.company, ...contact.past_companies].filter(
      (company): company is string => Boolean(company)
    );
    const companyMatched = companyNames.some(
      (company) => normalizeCompanyName(company) === targetCompany
    );
    if (companyMatched) {
      reasons.push("Company match");
    }

    const schoolMatched =
      Boolean(contact.school) && schoolKeys.has(normalizeSchool(contact.school));
    if (schoolMatched && contact.school) {
      reasons.push(`Shared school: ${contact.school}`);
    }

    if (!reasons.length) {
      continue;
    }

    matches.push({
      contact,
      matchType: companyMatched ? "company" : "school",
      reasons
    });
  }

  return matches.sort((left, right) => {
    const rankDiff = warmPathRank(left) - warmPathRank(right);
    if (rankDiff !== 0) {
      return rankDiff;
    }
    return left.contact.name.localeCompare(right.contact.name);
  });
}

export function outreachStageLabel(value: OutreachStage | null) {
  if (!value) {
    return "Not set";
  }
  const labels: Record<OutreachStage, string> = {
    to_reach: "To reach",
    reached: "Reached",
    replied: "Replied",
    referred: "Referred"
  };
  return labels[value];
}

export function isOutreachStage(value: unknown): value is OutreachStage {
  return outreachStages.includes(value as OutreachStage);
}

function warmPathRank(match: WarmPathMatch) {
  return match.matchType === "company" ? 0 : 1;
}

function normalizeSchool(value: string | null) {
  return (value ?? "")
    .toLowerCase()
    .replace(/[.,]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
