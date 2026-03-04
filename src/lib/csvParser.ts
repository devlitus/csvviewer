import type { CSVParseResult, SupportedDelimiter } from "./types";
import { SUPPORTED_DELIMITERS } from "./types";

/**
 * Counts delimiter occurrences outside of quoted fields.
 * Note: does not handle escaped quotes ("") as it's only used
 * for delimiter detection (column counting), not value parsing.
 */
function countDelimiterOutsideQuotes(line: string, delimiter: string): number {
  let count = 0;
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (!inQuotes && char === delimiter) {
      count++;
    }
  }
  return count;
}

export function detectDelimiter(content: string): SupportedDelimiter {
  const firstLine = content.split(/\r?\n/)[0] ?? "";

  let bestDelimiter: SupportedDelimiter = ",";
  let bestCount = 0;

  for (const delimiter of SUPPORTED_DELIMITERS) {
    const count = countDelimiterOutsideQuotes(firstLine, delimiter);
    if (count > bestCount) {
      bestCount = count;
      bestDelimiter = delimiter;
    }
  }

  if (bestCount === 0) {
    console.warn("[csvParser] No delimiter detected in first line, defaulting to ','");
  }

  return bestDelimiter;
}

export function parseCSVString(
  content: string,
  delimiter?: SupportedDelimiter
): CSVParseResult {
  try {
    // Remove BOM if present (must be done before checking if empty)
    const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;

    if (!cleanContent.trim()) {
      return { data: [], rowCount: 0, error: "File is empty" };
    }

    const resolvedDelimiter = delimiter ?? detectDelimiter(cleanContent);
    const lines = parseCSVLines(cleanContent.trim(), resolvedDelimiter);
    if (lines.length < 2) {
      return { data: [], rowCount: 0, error: "No data rows found" };
    }

    const headers = lines[0];
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i];
      const row: Record<string, string> = {};
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] ?? "";
      }
      data.push(row);
    }

    return { data, rowCount: data.length, delimiter: resolvedDelimiter };
  } catch (err) {
    return {
      data: [],
      rowCount: 0,
      error: err instanceof Error ? err.message : "Unknown error parsing CSV",
    };
  }
}

function parseCSVLines(text: string, delimiter: string): string[][] {
  const results: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(current.trim());
        current = "";
      } else if (char === "\r" && next === "\n") {
        row.push(current.trim());
        results.push(row);
        row = [];
        current = "";
        i++;
      } else if (char === "\n") {
        row.push(current.trim());
        results.push(row);
        row = [];
        current = "";
      } else {
        current += char;
      }
    }
  }

  if (current || row.length > 0) {
    row.push(current.trim());
    results.push(row);
  }

  return results;
}
