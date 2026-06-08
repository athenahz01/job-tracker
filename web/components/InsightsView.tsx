import type { InsightsData, RateMetric } from "../lib/insights-calc";

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
          weekly activity.
        </p>
      ) : null}

      <section className="insight-panel" aria-labelledby="headline-numbers-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Overview</p>
            <h3 id="headline-numbers-heading">Headline numbers and rates</h3>
          </div>
        </div>
        <div className="insight-headline-grid" aria-label="Headline numbers and rates">
          {data.headlines.map((metric) => (
            <article className="insight-stat" key={metric.label}>
              <p>{metric.label}</p>
              <strong>{metric.value}</strong>
            </article>
          ))}
          <RateCard label="Response rate" metric={data.rates.response} />
          <RateCard label="Interview rate" metric={data.rates.interview} />
          <RateCard label="Offer rate" metric={data.rates.offer} />
        </div>
      </section>

      <section className="insight-panel" aria-labelledby="insights-funnel-heading">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Drop-off</p>
            <h3 id="insights-funnel-heading">Conversion funnel</h3>
          </div>
        </div>
        <div className="funnel-list">
          {data.funnel.map((step, index) => {
            const previousCount = index > 0 ? data.funnel[index - 1].count : null;
            const dropped =
              previousCount === null ? null : Math.max(0, previousCount - step.count);
            return (
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
                  {step.conversion
                    ? `${step.conversion.display} kept, ${dropped} dropped from previous step`
                    : "Starting pool"}
                </p>
              </div>
            );
          })}
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

function barWidth(count: number, total: number) {
  if (!total) {
    return 0;
  }
  return Math.max(4, Math.round((count / total) * 100));
}
