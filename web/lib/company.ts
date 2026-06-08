export function normalizeCompanyName(company: string) {
  return company
    .toLowerCase()
    .trim()
    .replace(/[.,]/g, "")
    .replace(/\b(incorporated|inc|limited|ltd|llc|corporation|corp)\b$/i, "")
    .trim()
    .replace(/\s+/g, " ");
}
