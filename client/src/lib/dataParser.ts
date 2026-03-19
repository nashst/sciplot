import Papa from "papaparse";
import type { ParsedData } from "./chartEngine";

export type DataChangeReason =
  | "upload"
  | "paste"
  | "reset"
  | "cell-edit"
  | "header-edit"
  | "add-row"
  | "add-column"
  | "delete-row"
  | "delete-column";

export interface DataChangeMeta {
  reason: DataChangeReason;
  fileName?: string;
}

function normalizeCellValue(value: unknown): string | number {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "string") return value;
  return String(value);
}

function normalizeHeaderName(rawHeader: unknown, index: number): string {
  const name = String(rawHeader ?? "").trim();
  return name || `Column ${index + 1}`;
}

function normalizeTableRows(table: unknown[][]): ParsedData {
  if (!table.length) return { headers: [], rows: [] };

  const headers = table[0].map((cell, index) => normalizeHeaderName(cell, index));
  const rows = table
    .slice(1)
    .map((row) => row.map((cell) => normalizeCellValue(cell)))
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));

  if (!headers.length || rows.length === 0) {
    return { headers: [], rows: [] };
  }

  return { headers, rows };
}

export function parseCSVText(text: string, delimiter?: string): ParsedData {
  const result = Papa.parse(text.trim(), {
    header: false,
    skipEmptyLines: true,
    dynamicTyping: true,
    delimiter: delimiter || "",
  });

  if (!result.data || result.data.length < 2) {
    return { headers: [], rows: [] };
  }

  const allRows = result.data as (string | number)[][];
  return normalizeTableRows(allRows);
}

export function parseTSVText(text: string): ParsedData {
  return parseCSVText(text, "\t");
}

export function autoDetectAndParse(text: string): ParsedData {
  return parseCSVText(text);
}

async function parseXlsxFile(file: File): Promise<ParsedData> {
  const { read, utils } = await import("xlsx");
  const buffer = await file.arrayBuffer();
  const workbook = read(buffer, {
    type: "array",
    cellDates: true,
    cellNF: false,
    cellText: false,
  });

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return { headers: [], rows: [] };

  const worksheet = workbook.Sheets[firstSheetName];
  if (!worksheet) return { headers: [], rows: [] };

  const table = utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: true,
  }) as unknown[][];

  return normalizeTableRows(table);
}

export async function parseFile(file: File): Promise<ParsedData> {
  const ext = file.name.toLowerCase().split(".").pop();
  if (ext === "xlsx" || ext === "xls") {
    return parseXlsxFile(file);
  }

  const text = await file.text();
  if (!text) {
    throw new Error("File read failed");
  }

  if (ext === "tsv" || ext === "txt") {
    return parseTSVText(text);
  }

  return autoDetectAndParse(text);
}

export function dataToCSVString(data: ParsedData): string {
  const lines = [data.headers.join(",")];
  data.rows.forEach((row) => {
    lines.push(row.map((v) => String(v)).join(","));
  });
  return lines.join("\n");
}

export function dataToGrid(data: ParsedData): string[][] {
  const grid: string[][] = [data.headers.map(String)];
  data.rows.forEach((row) => {
    grid.push(row.map((v) => String(v ?? "")));
  });
  return grid;
}

export function gridToData(grid: string[][]): ParsedData {
  if (grid.length < 2) return { headers: [], rows: [] };
  const headers = grid[0];
  const rows = grid.slice(1).map((row) =>
    row.map((cell) => {
      const trimmed = cell.trim();
      if (trimmed === "") return "";
      const num = Number(trimmed);
      return Number.isNaN(num) ? trimmed : num;
    }),
  );
  return { headers, rows };
}

