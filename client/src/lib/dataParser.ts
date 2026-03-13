import Papa from "papaparse";
import type { ParsedData } from "./chartEngine";

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
  const headers = allRows[0].map((h) => String(h));
  const rows = allRows.slice(1);

  return { headers, rows };
}

export function parseTSVText(text: string): ParsedData {
  return parseCSVText(text, "\t");
}

export function autoDetectAndParse(text: string): ParsedData {
  return parseCSVText(text);
}

export function parseFile(file: File): Promise<ParsedData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        reject(new Error("文件读取失败"));
        return;
      }

      const ext = file.name.toLowerCase().split(".").pop();
      if (ext === "tsv" || ext === "txt") {
        resolve(parseTSVText(text));
      } else {
        resolve(autoDetectAndParse(text));
      }
    };
    reader.onerror = () => reject(new Error("文件读取错误"));
    reader.readAsText(file);
  });
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
      return isNaN(num) ? trimmed : num;
    }),
  );
  return { headers, rows };
}
