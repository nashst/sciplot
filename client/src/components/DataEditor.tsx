import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { autoDetectAndParse, dataToCSVString, type DataChangeMeta } from "@/lib/dataParser";
import type { DatasetProfile } from "@/lib/autoInsights";
import type { ParsedData } from "@/lib/chartEngine";
import { ClipboardList, Database, Grid2x2Plus, PencilLine, Plus, Upload, Wand2 } from "lucide-react";

type AnalysisGoal = "distribution" | "trend" | "relationship" | "comparison";

type FieldMapping = {
  xAxisColumn: number;
  selectedColumns: number[];
};

interface DataEditorProps {
  data: ParsedData;
  profile: DatasetProfile;
  analysisGoal: AnalysisGoal;
  onAnalysisGoalChange: (goal: AnalysisGoal) => void;
  mapping: FieldMapping;
  onMappingChange: (mapping: FieldMapping) => void;
  onDataChange: (data: ParsedData, meta?: DataChangeMeta) => void;
  onRequestImport?: () => void;
  onRequestSample?: () => void;
  statusText?: string;
  onStatusChange?: (value: string) => void;
}

const GOAL_META: Record<AnalysisGoal, { label: string; hint: string }> = {
  distribution: { label: "分布", hint: "先看单变量分布和离群点" },
  trend: { label: "趋势", hint: "先看时间或顺序变化" },
  relationship: { label: "关系", hint: "先看两个数值变量的相关关系" },
  comparison: { label: "对比", hint: "先看组间差异" },
};

function columnTypeLabel(kind: DatasetProfile["columns"][number]["kind"]) {
  if (kind === "numeric") return "数值";
  if (kind === "datetime") return "时间";
  if (kind === "categorical") return "分类";
  return "未知";
}

function columnBadgeClass(kind: DatasetProfile["columns"][number]["kind"]) {
  if (kind === "numeric") return "bg-sky-50 text-sky-700 ring-sky-200/80";
  if (kind === "datetime") return "bg-violet-50 text-violet-700 ring-violet-200/80";
  if (kind === "categorical") return "bg-emerald-50 text-emerald-700 ring-emerald-200/80";
  return "bg-slate-50 text-slate-600 ring-slate-200/80";
}

export const DataEditor = memo(function DataEditor({
  data,
  profile,
  analysisGoal,
  onAnalysisGoalChange,
  mapping,
  onMappingChange,
  onDataChange,
  onRequestImport,
  onRequestSample,
  statusText,
  onStatusChange,
}: DataEditorProps) {
  const [page, setPage] = useState(1);
  const [showPastePanel, setShowPastePanel] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const rowsPerPage = 12;
  const pasteInputRef = useRef<HTMLTextAreaElement>(null);

  const totalPages = Math.max(1, Math.ceil(Math.max(1, data.rows.length) / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const visibleRows = data.rows.slice(startIndex, startIndex + rowsPerPage);

  useEffect(() => {
    setPage((value) => Math.min(Math.max(1, value), totalPages));
  }, [totalPages]);

  useEffect(() => {
    if (showPastePanel) {
      setPasteText(dataToCSVString(data));
    }
  }, [data, showPastePanel]);

  const emit = useCallback(
    (nextData: ParsedData, meta: DataChangeMeta) => {
      onDataChange(nextData, meta);
      if (meta.reason === "upload") {
        onStatusChange?.("文件已导入，系统正在自动匹配最佳图表。");
      } else if (meta.reason === "paste") {
        onStatusChange?.("粘贴数据已解析，已切换到 workspace。");
      } else if (meta.reason === "reset") {
        onStatusChange?.("数据已重置。");
      }
    },
    [onDataChange, onStatusChange],
  );

  const setMapping = useCallback(
    (patch: Partial<FieldMapping>) => {
      const nextMapping = {
        xAxisColumn: mapping.xAxisColumn,
        selectedColumns: mapping.selectedColumns,
        ...patch,
      };
      const selectedColumns = Array.from(new Set(nextMapping.selectedColumns)).filter(
        (index) => index !== nextMapping.xAxisColumn,
      );
      onMappingChange({
        xAxisColumn: Math.max(0, nextMapping.xAxisColumn),
        selectedColumns,
      });
    },
    [mapping.selectedColumns, mapping.xAxisColumn, onMappingChange],
  );

  const handlePaste = useCallback(() => {
    if (!pasteText.trim()) {
      onStatusChange?.("请先粘贴 CSV / TSV 内容。");
      return;
    }
    const parsed = autoDetectAndParse(pasteText);
    if (!parsed.headers.length || !parsed.rows.length) {
      onStatusChange?.("粘贴内容没有形成有效表格，请检查分隔符和表头。");
      return;
    }
    emit(parsed, { reason: "paste" });
    setShowPastePanel(false);
    setPage(1);
  }, [emit, onStatusChange, pasteText]);

  const updateCell = useCallback(
    (rowIndex: number, columnIndex: number, value: string) => {
      const nextRows = data.rows.map((row) => [...row]);
      const trimmed = value.trim();
      const numeric = Number(trimmed);
      if (rowIndex === -1) {
        const nextHeaders = [...data.headers];
        nextHeaders[columnIndex] = trimmed || `Column ${columnIndex + 1}`;
        emit({ headers: nextHeaders, rows: nextRows }, { reason: "header-edit" });
        return;
      }
      nextRows[rowIndex] = [...nextRows[rowIndex]];
      nextRows[rowIndex][columnIndex] = trimmed === "" ? "" : Number.isNaN(numeric) ? trimmed : numeric;
      emit({ headers: [...data.headers], rows: nextRows }, { reason: "cell-edit" });
    },
    [data.headers, data.rows, emit],
  );

  const addRow = useCallback(() => {
    const nextRows = [...data.rows, data.headers.map(() => "")];
    emit({ headers: [...data.headers], rows: nextRows }, { reason: "add-row" });
    setPage(Math.ceil(nextRows.length / rowsPerPage));
  }, [data.headers, data.rows, emit]);

  const addColumn = useCallback(() => {
    const nextHeaders = [...data.headers, `列 ${data.headers.length + 1}`];
    const nextRows = data.rows.map((row) => [...row, ""]);
    emit({ headers: nextHeaders, rows: nextRows }, { reason: "add-column" });
  }, [data.headers, data.rows, emit]);

  const deleteRow = useCallback(
    (index: number) => {
      const globalIndex = startIndex + index;
      const nextRows = data.rows.filter((_, rowIndex) => rowIndex !== globalIndex);
      emit({ headers: [...data.headers], rows: nextRows }, { reason: "delete-row" });
      setPage((value) => Math.min(value, Math.max(1, Math.ceil(nextRows.length / rowsPerPage))));
    },
    [data.headers, data.rows, emit, startIndex],
  );

  const deleteColumn = useCallback(
    (columnIndex: number) => {
      if (data.headers.length <= 1) return;
      const nextHeaders = data.headers.filter((_, index) => index !== columnIndex);
      const nextRows = data.rows.map((row) => row.filter((_, index) => index !== columnIndex));
      emit({ headers: nextHeaders, rows: nextRows }, { reason: "delete-column" });
      if (mapping.xAxisColumn === columnIndex) {
        onMappingChange({
          xAxisColumn: 0,
          selectedColumns: mapping.selectedColumns.filter((index) => index !== columnIndex),
        });
      } else {
        onMappingChange({
          xAxisColumn: mapping.xAxisColumn > columnIndex ? mapping.xAxisColumn - 1 : mapping.xAxisColumn,
          selectedColumns: mapping.selectedColumns
            .filter((index) => index !== columnIndex)
            .map((index) => (index > columnIndex ? index - 1 : index)),
        });
      }
    },
    [data.headers, data.rows, emit, mapping.selectedColumns, mapping.xAxisColumn, onMappingChange],
  );

  const hasData = data.headers.length > 0 && data.rows.length > 0;
  const selectedSet = useMemo(() => new Set(mapping.selectedColumns), [mapping.selectedColumns]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
            <Database className="h-3.5 w-3.5 text-slate-700" />
            数据与字段
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">左侧编辑区</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">先定分析目标，再微调字段映射和原始数据。</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onRequestImport} className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
              <Upload className="mr-1.5 h-4 w-4" />
              上传
            </Button>
            <Button size="sm" onClick={onRequestSample} className="h-8 bg-slate-950 text-white hover:bg-slate-800">
              <Wand2 className="mr-1.5 h-4 w-4" />
              示例
            </Button>
          </div>
          {statusText ? <p className="max-w-[220px] text-right text-[11px] leading-5 text-slate-500">{statusText}</p> : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">数据量</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{profile.rowCount} 行</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">字段</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{profile.columnCount} 列</div>
        </div>
        <div className="rounded-2xl bg-slate-50 px-3 py-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">当前目标</div>
          <div className="mt-2 text-lg font-semibold text-slate-950">{GOAL_META[analysisGoal].label}</div>
        </div>
      </div>

      <section className="mt-4 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">分析目标</h3>
          <span className="text-[11px] text-slate-500">点击后自动更新默认图</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(GOAL_META).map(([goal, meta]) => {
            const active = analysisGoal === goal;
            return (
              <button
                key={goal}
                type="button"
                onClick={() => onAnalysisGoalChange(goal as AnalysisGoal)}
                className={`rounded-2xl px-3 py-3 text-left ring-1 transition-all ${
                  active
                    ? "bg-slate-950 text-white ring-slate-950"
                    : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                }`}
              >
                <div className="text-sm font-semibold">{meta.label}</div>
                <div className={`mt-1 text-xs leading-5 ${active ? "text-white/75" : "text-slate-500"}`}>{meta.hint}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section className="mt-4 space-y-2 min-h-0">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">变量概览</h3>
          <span className="text-[11px] text-slate-500">数值 / 时间 / 分类</span>
        </div>
        <ScrollArea className="h-[130px] rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
          <div className="flex flex-col gap-2 pr-2">
            {profile.columns.map((column) => (
              <div key={column.index} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium text-slate-900">{column.name}</div>
                  <div className="mt-0.5 text-[11px] text-slate-500">
                    缺失 {column.missingCount} · 唯一值 {column.nonMissingCount ? Math.max(1, column.nonMissingCount) : 0}
                  </div>
                </div>
                <Badge variant="outline" className={`border-transparent ${columnBadgeClass(column.kind)}`}>
                  {columnTypeLabel(column.kind)}
                </Badge>
              </div>
            ))}
            {!profile.columns.length && (
              <div className="rounded-xl bg-white px-3 py-4 text-sm text-slate-500 ring-1 ring-slate-200/70">
                暂无字段，先上传 CSV / XLSX、使用示例数据或粘贴表格。
              </div>
            )}
          </div>
        </ScrollArea>
      </section>

      <section className="mt-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">字段映射</h3>
          <span className="text-[11px] text-slate-500">X 轴 + Y 轴</span>
        </div>
        <div className="grid gap-3 rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
          <div className="space-y-1.5">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">X 轴字段</div>
            <Select
              value={String(mapping.xAxisColumn)}
              onValueChange={(value) => setMapping({ xAxisColumn: Number(value) })}
              disabled={!data.headers.length}
            >
              <SelectTrigger className="h-9 border-slate-200 bg-white text-xs text-slate-700">
                <SelectValue placeholder="请选择 X 轴字段" />
              </SelectTrigger>
              <SelectContent>
                {data.headers.map((header, index) => {
                  const column = profile.columns[index];
                  return (
                    <SelectItem key={index} value={String(index)} className="text-xs">
                      {header} {column ? `(${columnTypeLabel(column.kind)})` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400">Y 轴字段</div>
              <button type="button" className="text-[11px] text-slate-500 hover:text-slate-900" onClick={() => setMapping({ selectedColumns: data.headers.map((_, index) => index).filter((index) => index !== mapping.xAxisColumn) })}>
                全选
              </button>
            </div>
            <ScrollArea className="h-[128px] rounded-2xl bg-white px-2 py-2 ring-1 ring-slate-200/70">
              <div className="flex flex-col gap-2 pr-2">
                {data.headers.map((header, index) => {
                  if (index === mapping.xAxisColumn) return null;
                  const column = profile.columns[index];
                  const checked = selectedSet.has(index);
                  return (
                    <label key={index} className="flex items-center justify-between gap-3 rounded-xl px-2 py-1.5 hover:bg-slate-50">
                      <span className="flex min-w-0 items-center gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(next) => {
                            const selected = new Set(mapping.selectedColumns);
                            if (next) selected.add(index);
                            else selected.delete(index);
                            setMapping({ selectedColumns: Array.from(selected) });
                          }}
                        />
                        <span className="truncate text-xs text-slate-700">{header}</span>
                      </span>
                      <Badge variant="outline" className={`h-5 border-transparent px-2 text-[10px] ${column ? columnBadgeClass(column.kind) : "bg-slate-50 text-slate-600 ring-slate-200/80"}`}>
                        {columnTypeLabel(column?.kind ?? "unknown")}
                      </Badge>
                    </label>
                  );
                })}
                {!data.headers.length && <div className="px-2 py-3 text-xs text-slate-500">暂无可映射字段。</div>}
              </div>
            </ScrollArea>
          </div>
        </div>
      </section>

      <section className="mt-4 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">数据预览</h3>
          <div className="flex items-center gap-2 text-[11px] text-slate-500">
            <ClipboardList className="h-3.5 w-3.5" />
            前 {Math.min(rowsPerPage, data.rows.length)} 行
          </div>
        </div>

        {!hasData ? (
          <div className="mt-3 flex flex-1 items-center justify-center rounded-2xl bg-slate-50/80 p-6 text-center ring-1 ring-slate-200/70">
            <div>
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-600 ring-1 ring-slate-200/70">
                <Grid2x2Plus className="h-5 w-5" />
              </div>
              <p className="mt-3 text-sm font-medium text-slate-900">当前没有可预览的数据</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">可以上传文件、载入示例数据，或者粘贴一个小表格。</p>
            </div>
          </div>
        ) : (
          <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200/70">
            <div className="overflow-auto">
              <table className="w-full border-separate border-spacing-0 text-xs">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
                  <tr>
                    <th className="sticky left-0 z-20 w-12 bg-slate-50/95 px-2 py-2 text-center font-medium text-slate-500">#</th>
                    {data.headers.map((header, index) => (
                      <th key={index} className="relative min-w-[110px] border-b border-slate-200/70 px-2 py-2 text-left align-top text-slate-700">
                        <div className="flex items-center gap-2">
                          <Input
                            value={header}
                            onChange={(event) => updateCell(-1, index, event.target.value)}
                            className="h-7 border-slate-200 bg-white text-xs font-medium text-slate-900 shadow-none focus-visible:ring-slate-300"
                          />
                          <button
                            type="button"
                            onClick={() => deleteColumn(index)}
                            className="rounded-full p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-900"
                            title="删除列"
                          >
                            ×
                          </button>
                        </div>
                        <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-400">{profile.columns[index] ? columnTypeLabel(profile.columns[index].kind) : ""}</div>
                      </th>
                    ))}
                    <th className="border-b border-slate-200/70 px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={addColumn}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-white transition-transform hover:scale-105"
                        title="新增列"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRows.map((row, rowOffset) => {
                    const rowIndex = startIndex + rowOffset;
                    return (
                      <tr key={rowIndex} className="group hover:bg-slate-50/80">
                        <td className="sticky left-0 z-10 border-b border-slate-100 bg-white px-2 py-1.5 text-center font-mono text-[11px] tabular-nums text-slate-500 group-hover:bg-slate-50/80">
                          <div className="flex items-center justify-between gap-1">
                            <span>{rowIndex + 1}</span>
                            <button
                              type="button"
                              onClick={() => deleteRow(rowOffset)}
                              className="rounded-full p-1 text-slate-300 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="删除行"
                            >
                              ×
                            </button>
                          </div>
                        </td>
                        {row.map((cell, columnIndex) => (
                          <td key={columnIndex} className="border-b border-slate-100 px-1 py-1.5 align-top">
                            <Input
                              value={String(cell ?? "")}
                              onChange={(event) => updateCell(rowIndex, columnIndex, event.target.value)}
                              className="h-7 border-slate-200 bg-transparent text-xs text-slate-700 shadow-none focus-visible:ring-slate-300"
                            />
                          </td>
                        ))}
                        <td className="border-b border-slate-100 px-2 py-1.5 text-center">
                          <button type="button" onClick={addRow} className="text-slate-400 hover:text-slate-950" title="在末尾新增行">
                            <Plus className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-3 border-t border-slate-200/70 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={currentPage <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  上一页
                </Button>
                <span>
                  第 {currentPage} / {totalPages} 页 · 共 {data.rows.length} 行
                </span>
                <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" disabled={currentPage >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  下一页
                </Button>
              </div>
              <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-950" onClick={() => setShowPastePanel((value) => !value)}>
                <PencilLine className="h-3.5 w-3.5" />
                {showPastePanel ? "关闭粘贴" : "粘贴数据"}
              </button>
            </div>
          </div>
        )}
      </section>

      {showPastePanel && (
        <section className="mt-4 rounded-2xl bg-slate-50/80 p-3 ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">粘贴表格</div>
              <div className="mt-1 text-sm text-slate-600">支持 CSV / TSV 文本，粘贴后会直接更新 workspace。</div>
            </div>
            <Button size="sm" onClick={handlePaste} className="bg-slate-950 text-white hover:bg-slate-800">
              解析并应用
            </Button>
          </div>
          <Textarea
            ref={pasteInputRef}
            value={pasteText}
            onChange={(event) => setPasteText(event.target.value)}
            placeholder={"Time,ValueA,ValueB\n0,1.2,2.4\n1,1.6,2.9"}
            className="mt-3 min-h-40 resize-none border-slate-200 bg-white font-mono text-xs shadow-none focus-visible:ring-slate-300"
          />
        </section>
      )}
    </div>
  );
});
