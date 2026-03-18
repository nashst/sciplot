import { useState, useRef, useCallback, memo } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Upload, ClipboardPaste, Table, Trash2 } from "lucide-react";
import {
  autoDetectAndParse,
  parseFile,
  dataToCSVString,
  type DataChangeMeta,
} from "@/lib/dataParser";
import type { ParsedData } from "@/lib/chartEngine";

interface DataEditorProps {
  data: ParsedData;
  onDataChange: (data: ParsedData, meta?: DataChangeMeta) => void;
}

export const DataEditor = memo(function DataEditor({ data, onDataChange }: DataEditorProps) {
  const [mode, setMode] = useState<"paste" | "table">("table");
  const [pasteText, setPasteText] = useState("");
  const [page, setPage] = useState(1);
  const [showFormula, setShowFormula] = useState(false);
  const [formula, setFormula] = useState("");
  const rowsPerPage = 50;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const emitChange = useCallback(
    (nextData: ParsedData, meta: DataChangeMeta) => {
      onDataChange(nextData, meta);
    },
    [onDataChange],
  );

  const totalPages = Math.max(1, Math.ceil(data.rows.length / rowsPerPage));
  const currentPageRows = data.rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  const handlePageChange = (newPage: number) => {
    setPage(Math.min(Math.max(1, newPage), totalPages));
  };

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    const parsed = autoDetectAndParse(pasteText);
    if (parsed.headers.length > 0) {
      emitChange(parsed, { reason: "paste" });
      setMode("table");
      setPage(1);
    }
  }, [emitChange, pasteText]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const parsed = await parseFile(file);
        if (parsed.headers.length > 0) {
          emitChange(parsed, { reason: "upload", fileName: file.name });
          setMode("table");
          setPage(1);
        }
      } catch (err) {
        console.error(err);
      }
      e.target.value = "";
    },
    [emitChange],
  );

  const handleCellEdit = useCallback(
    (ri: number, ci: number, value: string) => {
      const globalRi = ri === 0 ? 0 : (page - 1) * rowsPerPage + (ri - 1);

      if (ri === 0) {
        const newHeaders = [...data.headers];
        newHeaders[ci] = value;
        emitChange({ ...data, headers: newHeaders }, { reason: "header-edit" });
      } else {
        const newRows = [...data.rows];
        const trimmed = value.trim();
        const num = Number(trimmed);
        newRows[globalRi] = [...newRows[globalRi]];
        newRows[globalRi][ci] = trimmed === "" ? "" : Number.isNaN(num) ? trimmed : num;
        emitChange({ ...data, rows: newRows }, { reason: "cell-edit" });
      }
    },
    [data, emitChange, page],
  );

  const addRow = useCallback(() => {
    const newRow = data.headers.map(() => "" as string | number);
    emitChange({ ...data, rows: [...data.rows, newRow] }, { reason: "add-row" });
    setPage(Math.ceil((data.rows.length + 1) / rowsPerPage));
  }, [data, emitChange]);

  const addColumn = useCallback(() => {
    const newHeaders = [...data.headers, `Col ${data.headers.length + 1}`];
    const newRows = data.rows.map((r) => [...r, ""]);
    emitChange({ headers: newHeaders, rows: newRows }, { reason: "add-column" });
  }, [data, emitChange]);

  const deleteRow = useCallback(
    (localRi: number) => {
      const globalRi = (page - 1) * rowsPerPage + localRi;
      const newRows = data.rows.filter((_, i) => i !== globalRi);
      emitChange({ ...data, rows: newRows }, { reason: "delete-row" });
      if (page > Math.ceil(newRows.length / rowsPerPage)) {
        setPage(Math.max(1, page - 1));
      }
    },
    [data, emitChange, page],
  );

  const deleteColumn = useCallback(
    (ci: number) => {
      if (data.headers.length <= 1) return;
      const newHeaders = data.headers.filter((_, i) => i !== ci);
      const newRows = data.rows.map((r) => r.filter((_, i) => i !== ci));
      emitChange({ headers: newHeaders, rows: newRows }, { reason: "delete-column" });
    },
    [data, emitChange],
  );

  const applyFormula = useCallback(() => {
    if (!formula.trim()) return;
    try {
      const newHeaders = [...data.headers, `New Col ${data.headers.length + 1}`];
      const newRows = data.rows.map((row) => {
        let expr = formula.replace(/\$(\d+)/g, (_, n) => `(row[${parseInt(n, 10) - 1}] || 0)`);

        data.headers.forEach((h, i) => {
          const safeH = h.replace(/[^a-zA-Z0-9]/g, "");
          if (safeH) {
            expr = expr.replace(new RegExp(`\\$${safeH}`, "g"), `(row[${i}] || 0)`);
          }
        });

        ["log", "exp", "sin", "cos", "abs", "sqrt"].forEach((f) => {
          expr = expr.replace(new RegExp(`\\b${f}\\(`, "g"), `Math.${f}(`);
        });

        try {
          const val = eval(expr);
          return [...row, isFinite(val) ? Math.round(val * 1000000) / 1000000 : ""];
        } catch {
          return [...row, ""];
        }
      });
      emitChange({ headers: newHeaders, rows: newRows }, { reason: "formula" });
      setShowFormula(false);
      setFormula("");
    } catch {
      alert("公式语法错误");
    }
  }, [data, emitChange, formula]);

  const clearData = useCallback(() => {
    emitChange({ headers: ["X", "Y"], rows: [["", ""]] }, { reason: "reset" });
    setPage(1);
  }, [emitChange]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            data-testid="mode-table"
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              mode === "table"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => setMode("table")}
          >
            <Table className="w-3.5 h-3.5 shrink-0" />
            <span>表格</span>
          </button>
          <button
            data-testid="mode-paste"
            className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
              mode === "paste"
                ? "bg-primary text-primary-foreground"
                : "bg-transparent text-muted-foreground hover:bg-accent"
            }`}
            onClick={() => {
              setMode("paste");
              setPasteText(dataToCSVString(data));
            }}
          >
            <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
            <span>粘贴</span>
          </button>
        </div>
        <div className="flex-1" />
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFormula(!showFormula)}
          className={`text-xs h-7 ${showFormula ? "bg-primary/10 border-primary text-primary" : ""}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1">
            <path d="m18 3-3 3-3-3" />
            <path d="M3 21h18" />
            <path d="M3 7h3.5L10 16.5 13.5 7H17" />
            <path d="M12 21v-4" />
          </svg>
          公式
        </Button>
        <Button
          variant="outline"
          size="sm"
          data-testid="btn-upload"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs h-7"
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
          上传
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid="btn-clear"
          onClick={clearData}
          className="text-xs h-7 text-muted-foreground"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt,.xls,.xlsx"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {showFormula && (
        <div className="bg-primary/5 p-2 rounded-md border border-primary/20 animate-in slide-in-from-top-1 duration-200">
          <div className="flex gap-2">
            <Input
              value={formula}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormula(e.target.value)}
              placeholder="公式，例如: $1 + $2 或 log($1)"
              className="h-8 text-xs bg-white"
            />
            <Button onClick={applyFormula} size="sm" className="h-8 px-3 text-xs">
              执行
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1 flex gap-2">
            <span>支持: $1, $2 (列序号)</span>
            <span>函数: log, exp, sin, sqrt</span>
          </p>
        </div>
      )}

      {mode === "paste" ? (
        <div className="flex flex-col gap-2 flex-1">
          <Textarea
            data-testid="paste-input"
            placeholder={"粘贴 CSV 或 TSV 数据\n例如:\nTime,Value A,Value B\n0,1.0,2.0\n1,2.5,3.1"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="flex-1 font-mono text-xs resize-none min-h-[200px]"
          />
          <Button data-testid="btn-parse" onClick={handlePaste} size="sm" className="self-end">
            解析数据
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden border rounded-lg">
          <div className="flex-1 overflow-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="w-8 p-1 bg-muted text-muted-foreground text-center font-medium sticky top-0 z-10">
                    #
                  </th>
                  {data.headers.map((h, ci) => (
                    <th key={ci} className="relative bg-muted sticky top-0 z-10">
                      <input
                        data-testid={`header-${ci}`}
                        className="w-full px-2 py-1.5 bg-transparent text-center font-semibold text-foreground outline-none focus:ring-1 focus:ring-primary/40 min-w-[90px]"
                        value={h}
                        onChange={(e) => handleCellEdit(0, ci, e.target.value)}
                      />
                      {data.headers.length > 1 && (
                        <button
                          className="absolute top-0 right-0 p-0.5 text-muted-foreground/50 hover:text-destructive opacity-0 hover:opacity-100 transition-opacity"
                          onClick={() => deleteColumn(ci)}
                        >
                          ×
                        </button>
                      )}
                    </th>
                  ))}
                  <th className="w-8 bg-muted sticky top-0 z-10">
                    <button
                      data-testid="btn-add-col"
                      className="w-full h-full text-muted-foreground hover:text-primary transition-colors font-bold"
                      onClick={addColumn}
                    >
                      +
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentPageRows.map((row, ri) => {
                  const globalIdx = (page - 1) * rowsPerPage + ri;
                  return (
                    <tr key={globalIdx} className="border-t border-border/50 hover:bg-accent/30">
                      <td className="p-1 text-center text-muted-foreground font-mono tabular-nums">
                        {globalIdx + 1}
                      </td>
                      {row.map((cell, ci) => (
                        <td key={ci} className="p-0">
                          <input
                            data-testid={`cell-${globalIdx}-${ci}`}
                            className="w-full px-2 py-1 bg-transparent text-center outline-none focus:ring-1 focus:ring-primary/40 tabular-nums min-w-[90px]"
                            value={String(cell ?? "")}
                            onChange={(e) => handleCellEdit(ri + 1, ci, e.target.value)}
                          />
                        </td>
                      ))}
                      <td className="p-0 w-8">
                        <button
                          className="w-full py-1 text-muted-foreground/40 hover:text-destructive text-xs"
                          onClick={() => deleteRow(ri)}
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/30 shrink-0">
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page === 1}
                onClick={() => handlePageChange(page - 1)}
              >
                &lt;
              </Button>
              <span className="flex items-center px-2 text-[10px] text-muted-foreground whitespace-nowrap">
                第 {page} / {totalPages} 页（共 {data.rows.length} 行）
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={page === totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                &gt;
              </Button>
            </div>
            <button
              data-testid="btn-add-row"
              className="text-xs text-primary font-medium hover:underline flex items-center gap-1"
              onClick={addRow}
            >
              + 添加行
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
