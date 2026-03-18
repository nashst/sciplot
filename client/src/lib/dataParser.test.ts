import test from "node:test";
import assert from "node:assert/strict";
import { utils, write } from "xlsx";

import { parseCSVText, parseFile } from "./dataParser";

test("parseCSVText parses header and rows", () => {
  const parsed = parseCSVText("time,value\n0,1\n1,2");
  assert.deepEqual(parsed.headers, ["time", "value"]);
  assert.deepEqual(parsed.rows, [
    [0, 1],
    [1, 2],
  ]);
});

test("parseFile parses xlsx first worksheet", async () => {
  const wb = utils.book_new();
  const ws = utils.aoa_to_sheet([
    ["time", "signal"],
    ["2026-01-01", 10],
    ["2026-01-02", 12],
  ]);
  utils.book_append_sheet(wb, ws, "Sheet1");

  const buffer = write(wb, { type: "buffer", bookType: "xlsx" });
  const file = new File([buffer], "sample.xlsx");
  const parsed = await parseFile(file);

  assert.deepEqual(parsed.headers, ["time", "signal"]);
  assert.equal(parsed.rows.length, 2);
  assert.deepEqual(parsed.rows[0], ["2026-01-01", 10]);
});
