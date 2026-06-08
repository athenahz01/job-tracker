"use client";

import { useMemo } from "react";

import type {
  ApplicationFlowData,
  ApplicationFlowLink,
  ApplicationFlowNode
} from "../lib/dashboard-data";

type ApplicationFlowSankeyProps = {
  data: ApplicationFlowData;
};

type LayoutNode = ApplicationFlowNode & {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LayoutLink = ApplicationFlowLink & {
  path: string;
  strokeWidth: number;
};

const chartWidth = 960;
const chartHeight = 340;
const nodeWidth = 18;
const topPadding = 32;
const innerHeight = 260;
const levelX = new Map([
  [0, 24],
  [1, 370],
  [2, 716]
]);
const nodeGap = 18;

const toneColors: Record<ApplicationFlowNode["tone"], string> = {
  base: "#49615a",
  interview: "#2f6f91",
  offer: "#2f7d61",
  rejected: "#b26b51",
  "no-response": "#9b7a54",
  progress: "#7c8990"
};

export default function ApplicationFlowSankey({ data }: ApplicationFlowSankeyProps) {
  const layout = useMemo(() => createLayout(data), [data]);
  const shouldDraw = data.total >= 2 && data.links.length > 0;

  return (
    <section className="flow-panel" aria-labelledby="application-flow-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Submitted applications</p>
          <h2 id="application-flow-heading">Application flow</h2>
        </div>
        <span className="flow-count">{data.total} applied</span>
      </div>

      {shouldDraw ? (
        <div className="flow-chart-wrap">
          <svg
            className="flow-chart"
            role="img"
            aria-labelledby="application-flow-title"
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          >
            <title id="application-flow-title">
              Application flow across interviews and outcomes
            </title>
            <g fill="none">
              {layout.links.map((link) => (
                <path
                  d={link.path}
                  key={`${link.source}-${link.target}`}
                  stroke={toneColors[link.tone]}
                  strokeLinecap="round"
                  strokeOpacity="0.28"
                  strokeWidth={link.strokeWidth}
                />
              ))}
            </g>
            <g>
              {layout.nodes.map((node) => (
                <g key={node.id}>
                  <rect
                    fill={toneColors[node.tone]}
                    height={node.height}
                    rx="4"
                    width={node.width}
                    x={node.x}
                    y={node.y}
                  />
                  <text
                    className="flow-node-label"
                    dominantBaseline="middle"
                    x={node.x + node.width + 12}
                    y={node.y + node.height / 2}
                  >
                    {node.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        </div>
      ) : (
        <p className="flow-empty">
          A few submitted applications will turn this into a flow from applied to interviews
          and outcomes.
        </p>
      )}
    </section>
  );
}

function createLayout(data: ApplicationFlowData) {
  const nodes = layoutNodes(data.nodes, data.total);
  const links = layoutLinks(data.links, nodes, data.total);

  return { nodes, links };
}

function layoutNodes(nodes: ApplicationFlowNode[], total: number) {
  const byLevel = new Map<number, ApplicationFlowNode[]>();
  for (const node of nodes) {
    const levelNodes = byLevel.get(node.level) ?? [];
    levelNodes.push(node);
    byLevel.set(node.level, levelNodes);
  }

  const layout: LayoutNode[] = [];
  for (const [level, levelNodes] of byLevel) {
    const availableHeight = innerHeight - nodeGap * Math.max(levelNodes.length - 1, 0);
    const heights = levelNodes.map((node) =>
      Math.max(24, (node.count / Math.max(total, 1)) * availableHeight)
    );
    const usedHeight =
      heights.reduce((sum, height) => sum + height, 0) +
      nodeGap * Math.max(levelNodes.length - 1, 0);
    let y = topPadding + Math.max((innerHeight - usedHeight) / 2, 0);

    for (let index = 0; index < levelNodes.length; index += 1) {
      const node = levelNodes[index];
      layout.push({
        ...node,
        x: levelX.get(level) ?? 24,
        y,
        width: nodeWidth,
        height: heights[index]
      });
      y += heights[index] + nodeGap;
    }
  }

  return layout;
}

function layoutLinks(
  links: ApplicationFlowLink[],
  nodes: LayoutNode[],
  total: number
): LayoutLink[] {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const linkWidths = new Map(
    links.map((link) => [`${link.source}-${link.target}`, Math.max(4, (link.value / total) * 76)])
  );
  const sourceOffsets = initialOffsets(links, linkWidths, nodeById, "source");
  const targetOffsets = initialOffsets(links, linkWidths, nodeById, "target");

  return links.flatMap((link) => {
    const source = nodeById.get(link.source);
    const target = nodeById.get(link.target);
    if (!source || !target) {
      return [];
    }

    const key = `${link.source}-${link.target}`;
    const strokeWidth = linkWidths.get(key) ?? 4;
    const sourceY = nextOffset(sourceOffsets, link.source, strokeWidth);
    const targetY = nextOffset(targetOffsets, link.target, strokeWidth);
    const x1 = source.x + source.width;
    const x2 = target.x;
    const midpoint = x1 + (x2 - x1) / 2;
    const path = `M ${x1} ${sourceY} C ${midpoint} ${sourceY}, ${midpoint} ${targetY}, ${x2} ${targetY}`;

    return [{ ...link, path, strokeWidth }];
  });
}

function initialOffsets(
  links: ApplicationFlowLink[],
  linkWidths: Map<string, number>,
  nodes: Map<string, LayoutNode>,
  side: "source" | "target"
) {
  const grouped = new Map<string, ApplicationFlowLink[]>();
  for (const link of links) {
    const id = link[side];
    const group = grouped.get(id) ?? [];
    group.push(link);
    grouped.set(id, group);
  }

  const offsets = new Map<string, number>();
  for (const [id, group] of grouped) {
    const node = nodes.get(id);
    if (!node) {
      continue;
    }

    const totalWidth = group.reduce(
      (sum, link) => sum + (linkWidths.get(`${link.source}-${link.target}`) ?? 4),
      0
    );
    offsets.set(id, node.y + node.height / 2 - totalWidth / 2);
  }

  return offsets;
}

function nextOffset(offsets: Map<string, number>, id: string, width: number) {
  const current = offsets.get(id) ?? 0;
  offsets.set(id, current + width);
  return current + width / 2;
}
