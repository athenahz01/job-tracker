import { getFurthestActiveStage } from "./application-stages";
import { stageRank, type Stage } from "./stages";

export type InsightsApplication = {
  id: string;
  company: string;
  source: string | null;
  stage: Stage;
  kind?: string;
  merged_into_id?: string | null;
  first_seen: string | null;
  location?: string | null;
  tags?: string[] | null;
};

export type InsightsEvent = {
  application_id: string | null;
  detected_stage: Stage | null;
  received_at: string | null;
};

export type RateMetric = {
  numerator: number;
  denominator: number;
  percentage: number | null;
  display: string;
};

export type HeadlineMetric = {
  label: string;
  value: number;
};

export type FunnelStep = {
  key: string;
  label: string;
  count: number;
  conversion: RateMetric | null;
};

export type DailyApplicationCount = {
  day: string;
  label: string;
  count: number;
};

export type LocationApplicationCount = {
  location: string;
  count: number;
};

export type InsightsData = {
  totalApplied: number;
  savedBacklog: number;
  headlines: HeadlineMetric[];
  rates: {
    response: RateMetric;
    interview: RateMetric;
    offer: RateMetric;
  };
  funnel: FunnelStep[];
  dailyApplications: DailyApplicationCount[];
  locationApplications: LocationApplicationCount[];
};

type ApplicationSummary = InsightsApplication & {
  furthestStage: Stage;
  responded: boolean;
  reachedAssessment: boolean;
  reachedPhoneScreen: boolean;
  reachedInterview: boolean;
  reachedFinal: boolean;
  reachedOffer: boolean;
};

const activeCurrentStages = new Set<Stage>([
  "Applied",
  "Assessment",
  "Phone Screen",
  "Interview",
  "Final"
]);

export function buildInsightsData(
  applications: InsightsApplication[],
  events: InsightsEvent[]
): InsightsData {
  const eligibleApplications = applications.filter(
    (application) =>
      (application.kind ?? "application") === "application" && !application.merged_into_id
  );
  const savedBacklog = eligibleApplications.filter((application) => application.stage === "Saved")
    .length;
  const appliedApplications = eligibleApplications.filter(
    (application) => application.stage !== "Saved"
  );
  const eventsByApplication = groupEventsByApplication(events);
  const summaries = appliedApplications.map((application) =>
    summarizeApplication(application, eventsByApplication.get(application.id) ?? [])
  );

  const totalApplied = summaries.length;
  const respondedCount = summaries.filter((application) => application.responded).length;
  const interviewCount = summaries.filter((application) => application.reachedPhoneScreen).length;
  const offerCount = summaries.filter((application) => application.reachedOffer).length;

  return {
    totalApplied,
    savedBacklog,
    headlines: [
      { label: "Applied", value: totalApplied },
      {
        label: "Active",
        value: summaries.filter((application) => activeCurrentStages.has(application.stage)).length
      },
      { label: "Offers", value: summaries.filter((application) => application.stage === "Offer").length },
      {
        label: "Rejected",
        value: summaries.filter((application) => application.stage === "Rejected").length
      }
    ],
    rates: {
      response: rate(respondedCount, totalApplied),
      interview: rate(interviewCount, totalApplied),
      offer: rate(offerCount, totalApplied)
    },
    funnel: buildFunnel(summaries),
    dailyApplications: buildDailyApplications(summaries),
    locationApplications: buildLocationApplications(summaries)
  };
}

function summarizeApplication(
  application: InsightsApplication,
  events: InsightsEvent[]
): ApplicationSummary {
  const detectedStages = events
    .map((event) => event.detected_stage)
    .filter((stage): stage is Stage => Boolean(stage));
  const furthestStage = getFurthestActiveStage(application.stage, detectedStages);
  const furthestRank = stageRank[furthestStage] ?? 0;
  const responded = furthestRank > (stageRank.Applied ?? 0) || application.stage === "Rejected";

  return {
    ...application,
    furthestStage,
    responded,
    reachedAssessment: furthestRank >= (stageRank.Assessment ?? Number.POSITIVE_INFINITY),
    reachedPhoneScreen: furthestRank >= (stageRank["Phone Screen"] ?? Number.POSITIVE_INFINITY),
    reachedInterview: furthestRank >= (stageRank.Interview ?? Number.POSITIVE_INFINITY),
    reachedFinal: furthestRank >= (stageRank.Final ?? Number.POSITIVE_INFINITY),
    reachedOffer: furthestRank >= (stageRank.Offer ?? Number.POSITIVE_INFINITY)
  };
}

function buildFunnel(summaries: ApplicationSummary[]): FunnelStep[] {
  const totalApplied = summaries.length;
  const counts = [
    ["applied", "Applied", totalApplied],
    ["responded", "Responded", summaries.filter((application) => application.responded).length],
    ["assessment", "Assessment+", summaries.filter((application) => application.reachedAssessment).length],
    ["phone", "Phone screen+", summaries.filter((application) => application.reachedPhoneScreen).length],
    ["interview", "Interview+", summaries.filter((application) => application.reachedInterview).length],
    ["final", "Final+", summaries.filter((application) => application.reachedFinal).length],
    ["offer", "Offer", summaries.filter((application) => application.reachedOffer).length]
  ] as const;

  return counts.map(([key, label, count], index) => ({
    key,
    label,
    count,
    conversion: index === 0 ? null : rate(count, counts[index - 1][2])
  }));
}

function buildDailyApplications(summaries: ApplicationSummary[]): DailyApplicationCount[] {
  const dated = summaries
    .map((application) => parseDate(application.first_seen))
    .filter((date): date is Date => Boolean(date));

  if (!dated.length) {
    return [];
  }

  const latest = dated.reduce(
    (latestDate, date) => (date.getTime() > latestDate.getTime() ? date : latestDate),
    dated[0]
  );
  const monthStart = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(latest.getUTCFullYear(), latest.getUTCMonth() + 1, 0));
  const dayCount = monthEnd.getUTCDate();
  const counts = new Map<string, number>();

  for (const date of dated) {
    if (
      date.getUTCFullYear() !== latest.getUTCFullYear() ||
      date.getUTCMonth() !== latest.getUTCMonth()
    ) {
      continue;
    }
    const key = isoDay(date);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return Array.from({ length: dayCount }, (_, index) => {
    const day = addUtcDays(monthStart, index);
    const key = isoDay(day);
    return {
      day: key,
      label: formatDayLabel(day),
      count: counts.get(key) ?? 0
    };
  });
}

function buildLocationApplications(summaries: ApplicationSummary[]): LocationApplicationCount[] {
  const counts = new Map<string, number>();
  for (const application of summaries) {
    const location = normalizeLocation(application.location);
    if (!location) {
      continue;
    }
    counts.set(location, (counts.get(location) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([location, count]) => ({ location, count }))
    .sort((left, right) => right.count - left.count || left.location.localeCompare(right.location))
    .slice(0, 8);
}

function groupEventsByApplication(events: InsightsEvent[]) {
  const grouped = new Map<string, InsightsEvent[]>();
  for (const event of events) {
    if (!event.application_id) {
      continue;
    }
    const rows = grouped.get(event.application_id) ?? [];
    rows.push(event);
    grouped.set(event.application_id, rows);
  }
  return grouped;
}

function rate(numerator: number, denominator: number): RateMetric {
  if (denominator === 0) {
    return {
      numerator,
      denominator,
      percentage: null,
      display: "-"
    };
  }

  const percentage = Math.round((numerator / denominator) * 100);
  return {
    numerator,
    denominator,
    percentage,
    display: `${percentage}%`
  };
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    timeZone: "UTC"
  }).format(date);
}

function normalizeLocation(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  if (/remote/i.test(cleaned)) {
    return "Remote";
  }

  return cleaned.replace(/\s+\((hybrid|onsite|remote)\)$/i, "");
}
