import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Upload, ClipboardPaste, Table, Trash2 } from "lucide-react";
import { autoDetectAndParse, parseFile, dataToCSVString } from "@/lib/dataParser";
import type { ParsedData } from "@/lib/chartEngine";

interface DataEditorProps {
  data: ParsedData;
  onDataChange: (data: ParsedData) => void;
}

export function DataEditor({ data, onDataChange }: DataEditorProps) {
  const [mode, setMode] = useState<"paste" | "table">("table");
  const [pasteText, setPasteText] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) return;
    const parsed = autoDetectAndParse(pasteText);
    if (parsed.headers.length > 0) {
      onDataChange(parsed);
      setMode("table");
    }
  }, [pasteText, onDataChange]);

  const handleFileUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const parsed = await parseFile(file);
        if (parsed.headers.length > 0) {
          onDataChange(parsed);
          setMode("table");
        }
      } catch (err) {
        console.error(err);
      }
      e.target.value = "";
    },
    [onDataChange],
  );

  const handleCellEdit = useCallback(
    (ri: number, ci: number, value: string) => {
      if (ri === 0) {
        // Header edit
        const newHeaders = [...data.headers];
        newHeaders[ci] = value;
        onDataChange({ ...data, headers: newHeaders });
      } else {
        const newRows = data.rows.map((r) => [...r]);
        const trimmed = value.trim();
        const num = Number(trimmed);
        newRows[ri - 1][ci] = trimmed === "" ? "" : isNaN(num) ? trimmed : num;
        onDataChange({ ...data, rows: newRows });
      }
    },
    [data, onDataChange],
  );

  const addRow = useCallback(() => {
    const newRow = data.headers.map(() => "" as string | number);
    onDataChange({ ...data, rows: [...data.rows, newRow] });
  }, [data, onDataChange]);

  const addColumn = useCallback(() => {
    const newHeaders = [...data.headers, `Col ${data.headers.length + 1}`];
    const newRows = data.rows.map((r) => [...r, ""]);
    onDataChange({ headers: newHeaders, rows: newRows });
  }, [data, onDataChange]);

  const deleteRow = useCallback(
    (ri: number) => {
      const newRows = data.rows.filter((_, i) => i !== ri);
      onDataChange({ ...data, rows: newRows });
    },
    [data, onDataChange],
  );

  const deleteColumn = useCallback(
    (ci: number) => {
      if (data.headers.length <= 1) return;
      const newHeaders = data.headers.filter((_, i) => i !== ci);
      const newRows = data.rows.map((r) => r.filter((_, i) => i !== ci));
      onDataChange({ headers: newHeaders, rows: newRows });
    },
    [data, onDataChange],
  );

  const clearData = useCallback(() => {
    onDataChange({ headers: ["X", "Y"], rows: [["", ""]] });
  }, [onDataChange]);

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex items-center gap-2">
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
          data-testid="btn-upload"
          onClick={() => fileInputRef.current?.click()}
          className="text-xs h-7"
        >
          <Upload className="w-3.5 h-3.5 mr-1" />
          上传文件
        </Button>
        <Button
          variant="ghost"
          size="sm"
          data-testid="btn-clear"
          onClick={clearData}
          className="text-xs h-7 text-muted-foreground"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          清空
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,.tsv,.txt"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {mode === "paste" ? (
        <div className="flex flex-col gap-2 flex-1">
          <Textarea
            data-testid="paste-input"
            placeholder={"粘贴 CSV 或 TSV 数据\n例如：\nTime,Value A,Value B\n0,1.0,2.0\n1,2.5,3.1"}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="flex-1 font-mono text-xs resize-none min-h-[200px]"
          />
          <Button
            data-testid="btn-parse"
            onClick={handlePaste}
            size="sm"
            className="self-end"
          >
            解析数据
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-auto border rounded-lg">
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
              {data.rows.map((row, ri) => (
                <tr key={ri} className="border-t border-border/50 hover:bg-accent/30">
                  <td className="p-1 text-center text-muted-foreground font-mono tabular-nums">
                    {ri + 1}
                  </td>
                  {row.map((cell, ci) => (
                    <td key={ci} className="p-0">
                      <input
                        data-testid={`cell-${ri}-${ci}`}
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
              ))}
            </tbody>
          </table>
          <button
            data-testid="btn-add-row"
            className="w-full py-1.5 text-xs text-muted-foreground hover:text-primary hover:bg-accent/40 transition-colors border-t border-border/50"
            onClick={addRow}
          >
            + 添加行
          </button>
        </div>
      )}
    </div>
  );
}
