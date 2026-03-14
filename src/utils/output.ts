import Table from "cli-table3";

import type { OutputFormat } from "../types.js";

export function printOutput(
  format: OutputFormat,
  rows: object[],
  columns?: string[],
): void {
  if (format === "json") {
    printJson(rows);
    return;
  }

  printTable(rows, columns);
}

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function printTable(rows: object[], columns?: string[]): void {
  if (rows.length === 0) {
    process.stdout.write("No results.\n");
    return;
  }

  const firstRow = rows[0];

  if (!firstRow) {
    process.stdout.write("No results.\n");
    return;
  }

  const headings = columns ?? Object.keys(firstRow);
  const table = new Table({
    head: headings,
    wordWrap: true,
  });

  for (const row of rows) {
    table.push(
      headings.map((heading) => formatCell(Reflect.get(row, heading) as unknown)),
    );
  }

  process.stdout.write(`${table.toString()}\n`);
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}
