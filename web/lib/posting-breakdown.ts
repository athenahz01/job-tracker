export type PostingBreakdownSectionKey =
  | "responsibilities"
  | "requirements"
  | "niceToHaves"
  | "compensation"
  | "location";

export type PostingBreakdownSection = {
  key: PostingBreakdownSectionKey;
  label: string;
  items: string[];
};

export type PostingBreakdown = {
  sections: PostingBreakdownSection[];
  rawNotes: string | null;
};

type PostingBreakdownInput = {
  notes: string | null;
  salary?: string | null;
  location?: string | null;
};

const sectionLabels: Record<PostingBreakdownSectionKey, string> = {
  responsibilities: "Responsibilities",
  requirements: "Requirements",
  niceToHaves: "Nice-to-haves",
  compensation: "Compensation",
  location: "Location"
};

const maxItemsPerSection = 8;

export function buildPostingBreakdown(input: PostingBreakdownInput): PostingBreakdown {
  const rawNotes = cleanPostingText(input.notes, 12000);
  const buckets: Record<PostingBreakdownSectionKey, string[]> = {
    responsibilities: [],
    requirements: [],
    niceToHaves: [],
    compensation: [],
    location: []
  };

  addItem(buckets.compensation, cleanText(input.salary ?? null, 220));
  addItem(buckets.location, cleanText(input.location ?? null, 220));

  let currentSection: PostingBreakdownSectionKey | null = null;
  for (const line of splitPostingLines(rawNotes)) {
    const parsed = parseSectionLine(line);
    if (parsed) {
      currentSection = parsed.section;
      addItem(buckets[parsed.section], parsed.content);
      continue;
    }

    const heading = headingSection(line);
    if (heading) {
      currentSection = heading;
      continue;
    }

    const item = cleanText(stripBullet(line), 260);
    if (!item) {
      continue;
    }

    const inferred = currentSection ?? inferSection(item);
    if (inferred) {
      addItem(buckets[inferred], item);
    }
  }

  return {
    sections: (Object.keys(sectionLabels) as PostingBreakdownSectionKey[])
      .map((key) => ({
        key,
        label: sectionLabels[key],
        items: buckets[key].slice(0, maxItemsPerSection)
      }))
      .filter((section) => section.items.length > 0),
    rawNotes
  };
}

function splitPostingLines(value: string | null) {
  if (!value) {
    return [];
  }

  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseSectionLine(line: string) {
  const match = line.match(
    /^(responsibilities|what you(?:'|\u2019)ll do|what you will do|requirements|qualifications|required qualifications|preferred qualifications|nice[-\s]?to[-\s]?haves?|bonus|compensation|salary|pay|location|work location)\s*[:\-]\s*(.+)$/i
  );
  if (!match) {
    return null;
  }

  const section = sectionFromHeading(match[1]);
  const content = cleanText(stripBullet(match[2]), 260);
  return section ? { section, content } : null;
}

function headingSection(line: string) {
  const normalized = stripBullet(line).replace(/[:\-]+$/, "").trim();
  if (normalized.length > 42) {
    return null;
  }
  return sectionFromHeading(normalized);
}

function sectionFromHeading(value: string): PostingBreakdownSectionKey | null {
  const normalized = value.toLowerCase().replace(/\s+/g, " ").trim();
  if (
    [
      "responsibilities",
      "key responsibilities",
      "what you'll do",
      "what you will do",
      "what you do",
      "duties",
      "the work"
    ].includes(normalized)
  ) {
    return "responsibilities";
  }
  if (
    [
      "requirements",
      "qualifications",
      "required qualifications",
      "minimum qualifications",
      "what you bring"
    ].includes(normalized)
  ) {
    return "requirements";
  }
  if (
    [
      "nice to haves",
      "nice-to-haves",
      "preferred",
      "preferred qualifications",
      "bonus",
      "bonus points"
    ].includes(normalized)
  ) {
    return "niceToHaves";
  }
  if (["compensation", "salary", "pay", "pay range"].includes(normalized)) {
    return "compensation";
  }
  if (["location", "work location", "workplace"].includes(normalized)) {
    return "location";
  }
  return null;
}

function inferSection(line: string): PostingBreakdownSectionKey | null {
  if (/\b(nice to have|nice-to-have|preferred|bonus|plus)\b/i.test(line)) {
    return "niceToHaves";
  }
  if (/\b(compensation|salary|pay range|benefits?)\b|\$\d/i.test(line)) {
    return "compensation";
  }
  if (/\b(location|remote|hybrid|onsite|office)\b/i.test(line)) {
    return "location";
  }
  if (/\b(required|requirement|qualification|must have|experience with|\d\+ years|proficient|familiar with)\b/i.test(line)) {
    return "requirements";
  }
  if (/\b(you will|responsible for|build|lead|own|partner with|design|analyze|develop|manage)\b/i.test(line)) {
    return "responsibilities";
  }
  return null;
}

function stripBullet(value: string) {
  return value.replace(/^\s*(?:[-*]|\u2022)\s*/, "").replace(/^\s*\d+[.)]\s*/, "");
}

function addItem(items: string[], value: string | null) {
  if (!value) {
    return;
  }
  const normalized = value.toLowerCase();
  if (items.some((item) => item.toLowerCase() === normalized)) {
    return;
  }
  items.push(value);
}

function cleanText(value: string | null, limit: number) {
  if (!value) {
    return null;
  }
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }
  return cleaned.slice(0, limit);
}

function cleanPostingText(value: string | null, limit: number) {
  if (!value) {
    return null;
  }
  const cleaned = value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .trim();
  if (!cleaned) {
    return null;
  }
  return cleaned.slice(0, limit);
}
