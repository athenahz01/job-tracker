"use client";

import type { ApplicationFlowData, ApplicationFlowNode } from "../lib/dashboard-data";

type ApplicationFlowSankeyProps = {
  data: ApplicationFlowData;
};

type FlowBand = {
  id: string;
  label: string;
  count: number;
  level: number;
  height: number;
  tone: ApplicationFlowNode["tone"];
  conversion: string | null;
};

const toneClasses: Record<ApplicationFlowNode["tone"], string> = {
  base: "flow-tone-base",
  interview: "flow-tone-interview",
  offer: "flow-tone-offer",
  rejected: "flow-tone-rejected",
  "no-response": "flow-tone-no-response",
  progress: "flow-tone-progress"
};

export default function ApplicationFlowSankey({ data }: ApplicationFlowSankeyProps) {
  const bands = buildBands(data);
  const caption = buildCaption(data);

  return (
    <section className="flow-panel" aria-labelledby="application-flow-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Submitted applications</p>
          <h2 id="application-flow-heading">Application flow</h2>
          <p className="muted">A proportional view of where applications keep moving.</p>
        </div>
        <span className="flow-count">{data.total} applied</span>
      </div>

      {bands.length ? (
        <figure className="flow-band-figure">
          <div className="flow-bands" role="img" aria-label="Application conversion bands">
            {bands.map((band, index) => (
              <div className="flow-band-group" key={band.id}>
                {index > 0 ? (
                  <span className="flow-conversion">{band.conversion ?? "0% kept"}</span>
                ) : null}
                <div
                  className={`flow-band ${toneClasses[band.tone]}`}
                  style={{ height: `${band.height}%` }}
                >
                  <strong>{band.count}</strong>
                  <span>{band.label}</span>
                </div>
              </div>
            ))}
          </div>
          <figcaption>{caption}</figcaption>
        </figure>
      ) : (
        <p className="flow-empty">
          Not enough data yet to show conversion, but the flow will appear as applications move.
        </p>
      )}
    </section>
  );
}

function buildBands(data: ApplicationFlowData): FlowBand[] {
  if (!data.total || !data.nodes.length) {
    return [];
  }

  const visibleNodes = data.nodes
    .filter((node) => node.id !== "applied" || node.count > 0)
    .sort((left, right) => left.level - right.level || right.count - left.count);
  const maxCount = Math.max(...visibleNodes.map((node) => node.count), data.total, 1);

  return visibleNodes.map((node) => {
    const incoming = data.links
      .filter((link) => link.target === node.id)
      .reduce((sum, link) => sum + link.value, 0);
    const previous = data.links
      .filter((link) => link.target === node.id)
      .reduce((sum, link) => {
        const source = data.nodes.find((candidate) => candidate.id === link.source);
        return source ? sum + source.count : sum;
      }, 0);
    const conversion =
      previous > 0 ? `${Math.round((incoming / previous) * 100)}% kept` : "0% kept";

    return {
      id: node.id,
      label: node.label.replace(/\s*\(\d+\)$/, ""),
      count: node.count,
      level: node.level,
      height: Math.max(3, Math.round((node.count / maxCount) * 100)),
      tone: node.tone,
      conversion: node.id === "applied" ? null : conversion
    };
  });
}

function buildCaption(data: ApplicationFlowData) {
  if (!data.links.length) {
    return "A few submitted applications will turn this into a conversion story.";
  }

  const biggestDrop = data.links
    .map((link) => {
      const source = data.nodes.find((node) => node.id === link.source);
      const target = data.nodes.find((node) => node.id === link.target);
      const dropped = Math.max(0, (source?.count ?? 0) - link.value);
      return {
        dropped,
        source: source?.label.replace(/\s*\(\d+\)$/, "") ?? "a stage",
        target: target?.label.replace(/\s*\(\d+\)$/, "") ?? "the next stage"
      };
    })
    .sort((left, right) => right.dropped - left.dropped)[0];

  if (!biggestDrop || biggestDrop.dropped === 0) {
    return "So far, every visible path is still moving through the funnel.";
  }

  return `Biggest drop-off: ${biggestDrop.dropped} stop between ${biggestDrop.source} and ${biggestDrop.target}.`;
}
