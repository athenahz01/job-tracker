import { getFurthestActiveStage } from "./application-stages";
import { stageRank, type Stage } from "./stages";

export type PerformanceApplication = {
  id: string;
  source: string | null;
  stage: Stage;
  kind?: string;
  merged_into_id?: string | null;
  first_seen: string | null;
  resume_version?: string | null;
  tags?: string[] | null;
};

export type PerformanceEvent = {
  application_id: string | null;
  detected_stage: Stage | null;
  received_at: string | null;
};

export type PerformanceRate = {
  numerator: number;
  denominator: number;
  percentage: number | null;
  display: string;
};

export type PerformanceGroup = {
  key: string;
  label: string;
  count: number;
  response: PerformanceRate;
  interview: PerformanceRate;
  offer: PerformanceRate;
  medianDaysToFirstResponse: number | null;
  medianDaysDisplay: string;
};

export type PerformanceBreakdown = {
  key: "resumeVersion" | "source" | "tag";
  label: string;
  groups: PerformanceGroup[];
};

export type PerformanceSummary = {
  resumeVersion: string;
  source: string;
  tag: string;
};

export type PerformanceData = {
  totalApplied: number;
  summary: PerformanceSummary;
  breakdowns: PerformanceBreakdown[];
};

type ApplicationSummary = PerformanceApplication & {
  events: PerformanceEvent[];
  firstResponseDays: number | null;
  furthestStage: Stage;
  responded: boolean;
  reachedPhoneScreen: boolean;
  reachedOffer: boolean;
};

const minimumLeaderSample = 5;

export function buildPerformanceData(
  applications: PerformanceApplication[],
  events: PerformanceEvent[]
): PerformanceData {
  const eventsByApplication = groupEventsByApplication(events);
  const summaries = applications
    .filter(
      (application) =>
        (application.kind ?? "application") === "application" &&
        !application.merged_into_id &&
        application.stage !== "Saved"
    )
    .map((application) =>
      summarizeApplication(application, eventsByApplication.get(application.id) ?? [])
    );

  const breakdowns: PerformanceBreakdown[] = [
    {
      key: "resumeVersion",
      label: "By Resume Version",
      groups: buildGroups(summaries, (application) => [
        cleanGroupValue(application.resume_version, "Not set")
      ])
    },
    {
      key: "source",
      label: "By Source",
      groups: buildGroups(summaries, (application) => [
        cleanGroupValue(application.source, "Not set")
      ])
    },
    {
      key: "tag",
      label: "By Tag",
      groups: buildGroups(summaries, (application) => normalizeTags(application.tags))
    }
  ];

  return {
    totalApplied: summaries.length,
    summary: buildSummary(breakdowns),
    breakdowns
  };
}

function summarizeApplication(
  application: PerformanceApplication,
  events: PerformanceEvent[]
): ApplicationSummary {
  const detectedStages = events
    .map((event) => event.detected_stage)
    .filter((stage): stage is Stage => Boolean(stage));
  const furthestStage = getFurthestActiveStage(application.stage, detectedStages);
  const furthestRank = stageRank[furthestStage] ?? 0;
  const responded = furthestRank > (stageRank.Applied ?? 0) || application.stage === "Rejected";

  return {
    ...application,
    events,
    firstResponseDays: firstResponseDays(application.first_seen, events),
    furthestStage,
    responded,
    reachedPhoneScreen:
      furthestRank >= (stageRank["Phone Screen"] ?? Number.POSITIVE_INFINITY),
    reachedOffer: furthestRank >= (stageRank.Offer ?? Number.POSITIVE_INFINITY)
  };
}

function buildGroups(
  applications: ApplicationSummary[],
  keysForApplication: (application: ApplicationSummary) => string[]
) {
  const groups = new Map<string, ApplicationSummary[]>();
  for (const application of applications) {
    const keys = keysForApplication(application);
    for (const key of keys) {
      const rows = groups.get(key) ?? [];
      rows.push(application);
      groups.set(key, rows);
    }
  }

  return Array.from(groups.entries())
    .map(([label, rows]) => buildGroup(label, rows))
    .sort(compareGroups);
}

function buildGroup(label: string, applications: ApplicationSummary[]): PerformanceGroup {
  const count = applications.length;
  const responded = applications.filter((application) => application.responded).length;
  const interviews = applications.filter((application) => application.reachedPhoneScreen).length;
  const offers = applications.filter((application) => application.reachedOffer).length;
  const medianDays = median(
    applications
      .map((application) => application.firstResponseDays)
      .filter((value): value is number => value !== null)
  );

  return {
    key: label.toLowerCase(),
    label,
    count,
    response: rate(responded, count),
    interview: rate(interviews, count),
    offer: rate(offers, count),
    medianDaysToFirstResponse: medianDays,
    medianDaysDisplay: formatDays(medianDays)
  };
}

function compareGroups(left: PerformanceGroup, right: PerformanceGroup) {
  const leftRate = left.response.percentage ?? -1;
  const rightRate = right.response.percentage ?? -1;
  if (leftRate !== rightRate) {
    return rightRate - leftRate;
  }
  if (left.count !== right.count) {
    return right.count - left.count;
  }
  return left.label.localeCompare(right.label);
}

function buildSummary(breakdowns: PerformanceBreakdown[]): PerformanceSummary {
  const resume = findBreakdown(breakdowns, "resumeVersion");
  const source = findBreakdown(breakdowns, "source");
  const tag = findBreakdown(breakdowns, "tag");

  return {
    resumeVersion: leaderSentence(
      resume,
      "resume version",
      "No resume version has enough applied roles yet to call a winner."
    ),
    source: leaderSentence(
      source,
      "source",
      "No source has enough applied roles yet to call a winner."
    ),
    tag: leaderSentence(tag, "tag", "No tag has enough applied roles yet to call a winner.")
  };
}

function leaderSentence(
  breakdown: PerformanceBreakdown | undefined,
  label: string,
  emptyText: string
) {
  const leader = breakdown?.groups.find(
    (group) => group.count >= minimumLeaderSample && group.response.percentage !== null
  );
  if (!leader) {
    return emptyText;
  }

  return `${leader.label} leads ${label} performance with ${leader.response.display} responses (${leader.response.numerator} of ${leader.response.denominator}).`;
}

function findBreakdown(
  breakdowns: PerformanceBreakdown[],
  key: PerformanceBreakdown["key"]
) {
  return breakdowns.find((breakdown) => breakdown.key === key);
}

export function rate(numerator: number, denominator: number): PerformanceRate {
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

function firstResponseDays(firstSeen: string | null, events: PerformanceEvent[]) {
  const firstSeenDate = parseDate(firstSeen);
  if (!firstSeenDate) {
    return null;
  }

  const eventDates = events
    .map((event) => parseDate(event.received_at))
    .filter((date): date is Date => Boolean(date))
    .sort((left, right) => left.getTime() - right.getTime());

  if (!eventDates.length) {
    return null;
  }

  const diffMs = eventDates[0].getTime() - firstSeenDate.getTime();
  return Math.max(0, diffMs / (24 * 60 * 60 * 1000));
}

function median(values: number[]) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function formatDays(value: number | null) {
  if (value === null) {
    return "-";
  }
  const rounded = Math.round(value * 10) / 10;
  const display = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${display}d`;
}

function cleanGroupValue(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeTags(tags: string[] | null | undefined) {
  if (!Array.isArray(tags)) {
    return [];
  }

  return Array.from(new Set(tags.map((tag) => tag.trim()).filter(Boolean)));
}

function groupEventsByApplication(events: PerformanceEvent[]) {
  const grouped = new Map<string, PerformanceEvent[]>();
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

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
