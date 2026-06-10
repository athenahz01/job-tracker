export type ResumeDiffLine = {
  type: "same" | "added" | "removed";
  text: string;
  key: string;
};

export function buildResumeDiff(
  masterResume: string | null | undefined,
  tailoredResume: string | null | undefined
): ResumeDiffLine[] {
  const masterLines = splitLines(masterResume);
  const tailoredLines = splitLines(tailoredResume);
  const table = buildLcsTable(masterLines, tailoredLines);
  const rows: ResumeDiffLine[] = [];

  let masterIndex = 0;
  let tailoredIndex = 0;
  while (masterIndex < masterLines.length && tailoredIndex < tailoredLines.length) {
    if (masterLines[masterIndex] === tailoredLines[tailoredIndex]) {
      rows.push(diffLine("same", masterLines[masterIndex], rows.length));
      masterIndex += 1;
      tailoredIndex += 1;
    } else if (
      table[masterIndex + 1]?.[tailoredIndex] >=
      table[masterIndex]?.[tailoredIndex + 1]
    ) {
      rows.push(diffLine("removed", masterLines[masterIndex], rows.length));
      masterIndex += 1;
    } else {
      rows.push(diffLine("added", tailoredLines[tailoredIndex], rows.length));
      tailoredIndex += 1;
    }
  }

  while (masterIndex < masterLines.length) {
    rows.push(diffLine("removed", masterLines[masterIndex], rows.length));
    masterIndex += 1;
  }

  while (tailoredIndex < tailoredLines.length) {
    rows.push(diffLine("added", tailoredLines[tailoredIndex], rows.length));
    tailoredIndex += 1;
  }

  return rows;
}

function splitLines(value: string | null | undefined) {
  if (!value) {
    return [];
  }
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function buildLcsTable(left: string[], right: string[]) {
  const table = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0)
  );

  for (let leftIndex = left.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = right.length - 1; rightIndex >= 0; rightIndex -= 1) {
      table[leftIndex][rightIndex] =
        left[leftIndex] === right[rightIndex]
          ? table[leftIndex + 1][rightIndex + 1] + 1
          : Math.max(table[leftIndex + 1][rightIndex], table[leftIndex][rightIndex + 1]);
    }
  }

  return table;
}

function diffLine(type: ResumeDiffLine["type"], text: string, index: number): ResumeDiffLine {
  return {
    type,
    text,
    key: `${type}-${index}-${text.slice(0, 24)}`
  };
}
