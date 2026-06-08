import type { ApplicationRow } from "./dashboard-data";
import { type Stage, stages } from "./stages";
import { activeApplicationStages, isPriority, Priority } from "./tracker";

export type DashboardView = "table" | "board" | "flow" | "follow-ups" | "network" | "profile";

export type TableFilters = {
  stage?: Stage;
  query?: string;
  tag?: string;
  priority?: Priority;
  orphanOnly: boolean;
  activeOnly: boolean;
  highFitOnly: boolean;
};

export type SortKey =
  | "company"
  | "role"
  | "stage"
  | "fit_score"
  | "priority"
  | "salary"
  | "location"
  | "next_action"
  | "follow_up_on"
  | "last_activity"
  | "source";

export type SortDirection = "asc" | "desc";

export type TableState = {
  view: DashboardView;
  filters: TableFilters;
  sortKey: SortKey;
  sortDirection: SortDirection;
  quietDays: number;
};

const views: DashboardView[] = ["table", "board", "flow", "follow-ups", "network", "profile"];
const sortKeys: SortKey[] = [
  "company",
  "role",
  "stage",
  "fit_score",
  "priority",
  "salary",
  "location",
  "next_action",
  "follow_up_on",
  "last_activity",
  "source"
];

export function parseTableState(
  params: Record<string, string | string[] | undefined>
): TableState {
  const viewValue = readSingle(params.view);
  const sortValue = readSingle(params.sort);
  const directionValue = readSingle(params.dir);
  const priorityValue = readSingle(params.priority);
  const stageValue = readSingle(params.stage);
  const quietDaysValue = Number(readSingle(params.quietDays));

  return {
    view: views.includes(viewValue as DashboardView) ? (viewValue as DashboardView) : "table",
    filters: {
      stage: stages.includes(stageValue as Stage) ? (stageValue as Stage) : undefined,
      query: readSingle(params.q)?.trim() || undefined,
      tag: readSingle(params.tag)?.trim() || undefined,
      priority:
        typeof priorityValue === "string" && isPriority(priorityValue)
          ? priorityValue
          : undefined,
      orphanOnly: readSingle(params.orphan) === "1",
      activeOnly: readSingle(params.active) === "1",
      highFitOnly: readSingle(params.fit) === "high"
    },
    sortKey: sortKeys.includes(sortValue as SortKey) ? (sortValue as SortKey) : "last_activity",
    sortDirection: directionValue === "asc" ? "asc" : "desc",
    quietDays: Number.isFinite(quietDaysValue) && quietDaysValue > 0 ? quietDaysValue : 14
  };
}

export function filterAndSortApplications(
  rows: ApplicationRow[],
  filters: TableFilters,
  sortKey: SortKey,
  sortDirection: SortDirection
) {
  const query = filters.query?.toLowerCase();
  const tag = filters.tag?.toLowerCase();

  const filtered = rows.filter((row) => {
    if (filters.stage && row.stage !== filters.stage) {
      return false;
    }
    if (filters.priority && row.priority !== filters.priority) {
      return false;
    }
    if (filters.orphanOnly && !row.is_orphan) {
      return false;
    }
    if (filters.activeOnly && !activeApplicationStages.includes(row.stage)) {
      return false;
    }
    if (filters.highFitOnly && (row.fit_score ?? -1) < 70) {
      return false;
    }
    if (tag && !row.tags.some((value) => value.toLowerCase() === tag)) {
      return false;
    }
    if (query) {
      const haystack = [row.company, row.role, row.location, row.next_action, row.source]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) {
        return false;
      }
    }
    return true;
  });

  return filtered.sort((left, right) => compareRows(left, right, sortKey, sortDirection));
}

export function quickFilterHref(
  filter: "active" | "follow-up" | "offers" | "rejected" | "high-fit"
) {
  const params = new URLSearchParams({ view: "table" });
  if (filter === "offers") {
    params.set("stage", "Offer");
  }
  if (filter === "rejected") {
    params.set("stage", "Rejected");
  }
  if (filter === "follow-up") {
    params.set("view", "follow-ups");
  }
  if (filter === "active") {
    params.set("active", "1");
  }
  if (filter === "high-fit") {
    params.set("fit", "high");
    params.set("sort", "fit_score");
    params.set("dir", "desc");
  }

  const value = params.toString();
  return value ? `/?${value}` : "/";
}

function compareRows(
  left: ApplicationRow,
  right: ApplicationRow,
  sortKey: SortKey,
  sortDirection: SortDirection
) {
  const leftValue = valueForSort(left, sortKey);
  const rightValue = valueForSort(right, sortKey);
  const direction = sortDirection === "asc" ? 1 : -1;

  if (leftValue < rightValue) {
    return -1 * direction;
  }
  if (leftValue > rightValue) {
    return 1 * direction;
  }
  return left.company.localeCompare(right.company);
}

function valueForSort(row: ApplicationRow, sortKey: SortKey) {
  if (sortKey === "follow_up_on" || sortKey === "last_activity") {
    return row[sortKey] ? Date.parse(row[sortKey] as string) || 0 : 0;
  }
  if (sortKey === "fit_score") {
    return row.fit_score ?? -1;
  }
  return String(row[sortKey] ?? "").toLowerCase();
}

function readSingle(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
