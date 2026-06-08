import type { InsightsData, RateMetric, TimingMetric } from "../lib/insights-calc";

type InsightsViewProps = {
  data: InsightsData;
};

const weeklyChartWidth = 760;
const weeklyChartHeight = 220;
const weeklyChartPadding = {
  top: 18,
  right: 16,
  bottom: 42,
  left: 28
};

export default function InsightsView({ data }: InsightsViewProps) {
  const hasApplied = data.totalApplied > 0;

  return (
    <section className="insights-section" aria-labelledby="insights-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Personal analytics</p>
          <h2 id="insights-heading">Insights</h2>
        </div>
        <span className="flow-count">{data.totalApplied} applied</span>
      </div>

      {!hasApplied ? (
        <p className="empty-state">
          Apply to a few roles and this page will start showing response rates, drop-off, and
          timing.
        </p>
      ) : null}

      <div className="insight-stat-grid" aria-label="Pipeline totals">
        {data.headlines.map((metric) => (
          <article className="insight-stat" key={metric.label}>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </div>

      <div className="insight-rate-grid" aria-label="Headline rates">
        <RateCard label="Response rate" metric={data.rates.response} />
        <RateCard label="Interview rate" metric={data.rates.interview} />
        <RateCard label="Offer rate" metric={data.rates.offer} />
      </div>

      <section className="insight-panel" aria-labelledby="insights-funnel-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Drop-off</p>
            <h3 id="insights-funnel-heading">Conversion funnel</h3>
          </div>
        </div>
        <div className="funnel-list">
          {data.funnel.map((step) => (
            <div className="funnel-step" key={step.key}>
              <div className="funnel-step-top">
                <strong>{step.label}</strong>
                <span>{step.count}</span>
              </div>
              <div className="funnel-bar-track" aria-hidden="true">
                <span
                  className="funnel-bar-fill"
                  style={{ width: `${barWidth(step.count, data.totalApplied)}%` }}
                />
              </div>
              <p className="muted">
                {step.conversion ? `${step.conversion.display} from previous step` : "Starting pool"}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="insight-panel" aria-labelledby="weekly-applications-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Momentum</p>
            <h3 id="weekly-applications-heading">Applications over time</h3>
          </div>
        </div>
        {data.weeklyApplications.length ? (
          <WeeklyApplicationsChart data={data.weeklyApplications} />
        ) : (
          <p className="empty-state">Dates are not available yet for a weekly trend.</p>
        )}
      </section>

      <section className="insight-panel" aria-labelledby="source-breakdown-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Channels</p>
            <h3 id="source-breakdown-heading">By source</h3>
          </div>
        </div>
        {data.bySource.length ? (
          <div className="table-scroll">
            <table className="insights-table">
              <thead>
                <tr>
                  <th scope="col">Source</th>
                  <th scope="col">Count</th>
                  <th scope="col">Response rate</th>
                  <th scope="col">Interview rate</th>
                </tr>
              </thead>
              <tbody>
                {data.bySource.map((source) => (
                  <tr key={source.source}>
                    <td>{source.source}</td>
                    <td>{source.count}</td>
                    <td>{rateWithCounts(source.responseRate)}</td>
                    <td>{rateWithCounts(source.interviewRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">Sources will appear once applications are captured.</p>
        )}
      </section>

      <div className="insight-two-column">
        <section className="insight-panel" aria-labelledby="timing-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Timing</p>
              <h3 id="timing-heading">Response speed</h3>
            </div>
          </div>
          <TimingRow label="Median days to first response" metric={data.timing.firstResponse} />
          {data.timing.interview ? (
            <TimingRow label="Median days to phone screen" metric={data.timing.interview} />
          ) : null}
        </section>

        <section className="insight-panel" aria-labelledby="top-lists-heading">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Patterns</p>
              <h3 id="top-lists-heading">Top tags and companies</h3>
            </div>
          </div>
          <div className="top-list-grid">
            <RankedList title="Tags" rows={data.topTags} emptyText="No tags yet." />
            <RankedList title="Companies" rows={data.topCompanies} emptyText="No companies yet." />
          </div>
        </section>
      </div>
    </section>
  );
}

function RateCard({ label, metric }: { label: string; metric: RateMetric }) {
  return (
    <article className="insight-rate-card">
      <p>{label}</p>
      <strong>{metric.display}</strong>
      <span className="muted">
        {metric.denominator ? `${metric.numerator} of ${metric.denominator}` : "No denominator"}
      </span>
    </article>
  );
}

function WeeklyApplicationsChart({ data }: { data: InsightsData["weeklyApplications"] }) {
  const maxCount = Math.max(...data.map((item) => item.count), 1);
  const chartInnerWidth = weeklyChartWidth - weeklyChartPadding.left - weeklyChartPadding.right;
  const chartInnerHeight = weeklyChartHeight - weeklyChartPadding.top - weeklyChartPadding.bottom;
  const slotWidth = chartInnerWidth / data.length;
  const barWidthValue = Math.max(14, slotWidth * 0.58);

  return (
    <div className="weekly-chart-wrap">
      <svg
        className="weekly-chart"
        role="img"
        aria-labelledby="weekly-applications-title"
        viewBox={`0 0 ${weeklyChartWidth} ${weeklyChartHeight}`}
      >
        <title id="weekly-applications-title">Weekly applications over the last twelve weeks</title>
        <line
          className="weekly-axis"
          x1={weeklyChartPadding.left}
          x2={weeklyChartWidth - weeklyChartPadding.right}
          y1={weeklyChartHeight - weeklyChartPadding.bottom}
          y2={weeklyChartHeight - weeklyChartPadding.bottom}
        />
        {data.map((item, index) => {
          const barHeight = (item.count / maxCount) * chartInnerHeight;
          const x = weeklyChartPadding.left + index * slotWidth + (slotWidth - barWidthValue) / 2;
          const y = weeklyChartPadding.top + chartInnerHeight - barHeight;
          return (
            <g key={item.weekStart}>
              <rect
                className="weekly-bar"
                height={barHeight}
                rx="4"
                width={barWidthValue}
                x={x}
                y={y}
              />
              <text className="weekly-count" textAnchor="middle" x={x + barWidthValue / 2} y={y - 6}>
                {item.count || ""}
              </text>
              {index % 2 === 0 ? (
                <text
                  className="weekly-label"
                  textAnchor="middle"
                  x={x + barWidthValue / 2}
                  y={weeklyChartHeight - 16}
                >
                  {item.label}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function TimingRow({ label, metric }: { label: string; metric: TimingMetric }) {
  return (
    <div className="timing-row">
      <span>{label}</span>
      <strong>{metric.display}</strong>
      <span className="muted">{metric.count ? `${metric.count} applications` : "No events yet"}</span>
    </div>
  );
}

function RankedList({
  title,
  rows,
  emptyText
}: {
  title: string;
  rows: InsightsData["topTags"];
  emptyText: string;
}) {
  return (
    <div className="ranked-list">
      <h4>{title}</h4>
      {rows.length ? (
        <ol>
          {rows.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="empty-state">{emptyText}</p>
      )}
    </div>
  );
}

function rateWithCounts(metric: RateMetric) {
  return metric.denominator
    ? `${metric.display} (${metric.numerator} of ${metric.denominator})`
    : "-";
}

function barWidth(count: number, total: number) {
  if (!total) {
    return 0;
  }
  return Math.max(4, Math.round((count / total) * 100));
}
