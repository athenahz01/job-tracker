"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Fragment, useMemo } from "react";

import FitScoreBadge from "./FitScoreBadge";
import type { ApplicationRow } from "../lib/dashboard-data";
import { stageClass, priorityClass } from "../lib/style-utils";
import {
  filterAndSortApplications,
  quickFilterHref,
  type SortDirection,
  type SortKey,
  type TableState
} from "../lib/table-utils";
import { priorities } from "../lib/tracker";
import { stages } from "../lib/stages";

type ApplicationTableViewProps = {
  applications: ApplicationRow[];
  state: TableState;
};

const columns: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "stage", label: "Stage" },
  { key: "fit_score", label: "Fit" },
  { key: "priority", label: "Priority" },
  { key: "salary", label: "Salary" },
  { key: "location", label: "Location" },
  { key: "next_action", label: "Next action" },
  { key: "follow_up_on", label: "Follow-up date" },
  { key: "last_activity", label: "Last activity" },
  { key: "source", label: "Source" }
];

const exportHeaders = [
  "Company",
  "Role",
  "Stage",
  "Fit score",
  "Fit summary",
  "Missing keywords",
  "Priority",
  "Tags",
  "Salary",
  "Location",
  "Next action",
  "Follow-up date",
  "Deadline",
  "Resume version",
  "Last activity",
  "Source",
  "Notes"
];

export default function ApplicationTableView({ applications, state }: ApplicationTableViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sortedRows = useMemo(
    () =>
      filterAndSortApplications(
        [...applications],
        state.filters,
        state.sortKey,
        state.sortDirection
      ),
    [applications, state.filters, state.sortDirection, state.sortKey]
  );
  const tags = useMemo(
    () => Array.from(new Set(applications.flatMap((application) => application.tags))).sort(),
    [applications]
  );

  return (
    <section className="table-view" aria-labelledby="applications-table-heading">
      <div className="table-view-header">
        <div>
          <p className="eyebrow">Tracker</p>
          <h2 id="applications-table-heading">Applications</h2>
        </div>
        <div className="export-actions">
          <button className="secondary-button" type="button" onClick={() => downloadCsv(sortedRows)}>
            Export CSV
          </button>
          <button className="secondary-button" type="button" onClick={() => downloadExcel(sortedRows)}>
            Export Excel
          </button>
        </div>
      </div>

      <form className="filters table-filters" action="/" method="get">
        <input type="hidden" name="view" value="table" />
        <label className="field">
          <span>Stage</span>
          <select name="stage" defaultValue={state.filters.stage ?? ""}>
            <option value="">All stages</option>
            {stages.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Company</span>
          <input name="q" defaultValue={state.filters.query ?? ""} placeholder="Search company" />
        </label>
        <label className="field">
          <span>Tag</span>
          <select name="tag" defaultValue={state.filters.tag ?? ""}>
            <option value="">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Priority</span>
          <select name="priority" defaultValue={state.filters.priority ?? ""}>
            <option value="">All priorities</option>
            {priorities.map((priority) => (
              <option key={priority} value={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label className="checkbox-field">
          <input
            type="checkbox"
            name="orphan"
            value="1"
            defaultChecked={state.filters.orphanOnly}
          />
          <span>Orphans only</span>
        </label>
        <button className="primary-button" type="submit">
          Apply
        </button>
        <Link className="secondary-link" href="/">
          Clear
        </Link>
      </form>

      <div className="quick-filters" aria-label="Quick filters">
        <Link href={quickFilterHref("active")}>Active</Link>
        <Link href={quickFilterHref("high-fit")}>High fit</Link>
        <Link href={quickFilterHref("follow-up")}>Needs follow-up</Link>
        <Link href={quickFilterHref("offers")}>Offers</Link>
        <Link href={quickFilterHref("rejected")}>Rejected</Link>
      </div>

      <p className="table-count">
        {sortedRows.length} of {applications.length} applications
      </p>

      <div className="table-scroll">
        {/* Pagination can be added here if this personal dataset grows very large. */}
        <table className="applications-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <Fragment key={column.key}>
                  <th scope="col">
                    <Link href={sortHref(searchParams, column.key, state)}>
                      {column.label}
                      {state.sortKey === column.key ? (
                        <span aria-hidden="true">
                          {state.sortDirection === "asc" ? " ↑" : " ↓"}
                        </span>
                      ) : null}
                    </Link>
                  </th>
                  {column.key === "priority" ? <th scope="col">Tags</th> : null}
                </Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length ? (
              sortedRows.map((application) => (
                <tr
                  key={application.id}
                  role="link"
                  tabIndex={0}
                  onClick={() => router.push(`/applications/${application.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      router.push(`/applications/${application.id}`);
                    }
                  }}
                >
                  <td>
                    <strong>{application.company}</strong>
                  </td>
                  <td>{application.role || "Not set"}</td>
                  <td>
                    <span className={`stage-pill ${stageClass(application.stage)}`}>
                      {application.stage}
                    </span>
                  </td>
                  <td>
                    <FitScoreBadge score={application.fit_score} />
                  </td>
                  <td>
                    {application.priority ? (
                      <span className={`priority-pill ${priorityClass(application.priority)}`}>
                        {application.priority}
                      </span>
                    ) : (
                      <span className="muted">None</span>
                    )}
                  </td>
                  <td>
                    <span className="chip-row">
                      {application.tags.length ? (
                        application.tags.map((tag) => (
                          <span className="tag-chip" key={tag}>
                            {tag}
                          </span>
                        ))
                      ) : (
                        <span className="muted">No tags</span>
                      )}
                    </span>
                  </td>
                  <td>{application.salary || "Not set"}</td>
                  <td>{application.location || "Not set"}</td>
                  <td>{application.next_action || "Not set"}</td>
                  <td>{displayDate(application.follow_up_on)}</td>
                  <td>{displayDate(application.last_activity)}</td>
                  <td>{application.source || "Not set"}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length + 1}>
                  <p className="empty-state">No applications match these filters.</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function sortHref(searchParams: { toString(): string }, key: SortKey, state: TableState) {
  const params = new URLSearchParams(searchParams.toString());
  params.set("view", "table");
  params.set("sort", key);
  params.set("dir", nextDirection(key, state));
  return `/?${params.toString()}`;
}

function nextDirection(key: SortKey, state: TableState): SortDirection {
  if (state.sortKey !== key) {
    return "asc";
  }
  return state.sortDirection === "asc" ? "desc" : "asc";
}

function exportRows(rows: ApplicationRow[]) {
  return rows.map((row) => [
    row.company,
    row.role || "",
    row.stage,
    row.fit_score === null ? "" : String(row.fit_score),
    row.fit_summary || "",
    row.missing_keywords.join(", "),
    row.priority || "",
    row.tags.join(", "),
    row.salary || "",
    row.location || "",
    row.next_action || "",
    row.follow_up_on || "",
    row.deadline || "",
    row.resume_version || "",
    row.last_activity || "",
    row.source || "",
    row.notes || ""
  ]);
}

function downloadCsv(rows: ApplicationRow[]) {
  const csv = [exportHeaders, ...exportRows(rows)]
    .map((row) => row.map(csvCell).join(","))
    .join("\n");
  downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), "job-applications.csv");
}

async function downloadExcel(rows: ApplicationRow[]) {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  await writeXlsxFile([exportHeaders, ...exportRows(rows)]).toFile("job-applications.xlsx");
}

function csvCell(value: string) {
  // Guard against spreadsheet formula injection from scraped or emailed text.
  const guarded = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${guarded.replace(/"/g, '""')}"`;
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function displayDate(value: string | null) {
  if (!value) {
    return "Not set";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}
