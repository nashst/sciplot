import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { autoDetectAndParse, parseFile } from "@/lib/dataParser";
import { buildDatasetProfile, type DatasetProfile } from "@/lib/autoInsights";
import { getSampleData, type ParsedData } from "@/lib/chartEngine";
import {
  inferColumns,
  recommendCharts,
  suggestDefaultMapping,
  type FieldMapping as EngineFieldMapping,
  type InferredColumn,
} from "@/lib/analysisEngine";
import { defaultChartConfig, type ChartConfig, type ChartType, chartTypeLabels } from "@shared/schema";
import { ArrowDownToLine, LayoutGrid, Play, Sparkles, Upload, WandSparkles } from "lucide-react";

const AutoChartGallery = lazy(async () => {
  const mod = await import("@/components/AutoChartGallery");
  return { default: mod.AutoChartGallery };
});

const ChartPreview = lazy(async () => {
  const mod = await import("@/components/ChartPreview");
  return { default: mod.ChartPreview };
});

const ChartEditorPanel = lazy(async () => {
  const mod = await import("@/components/ChartEditorPanel");
  return { default: mod.ChartEditorPanel };
});

type AnalysisGoal = "distribution" | "trend" | "relationship" | "comparison";
type AppStage = "entry" | "workspace";
type RecommendationPatch = Pick<ChartConfig, "chartType" | "xAxisColumn" | "selectedColumns" | "xAxisLabel" | "yAxisLabel">;

type RecommendationCard = {
  chartType: ChartType;
  title: string;
  reason: string;
  supported: boolean;
  patch: RecommendationPatch;
};

type GalleryCandidate = {
  id: string;
  goal: AnalysisGoal;
  chartType: ChartType;
  title: string;
  reason: string;
  supported: boolean;
  config: ChartConfig;
};

const GOAL_ORDER: AnalysisGoal[] = ["distribution", "trend", "relationship", "comparison"];

const ANALYSIS_GOALS: Record<AnalysisGoal, { label: string }> = {
  distribution: { label: "分布" },
  trend: { label: "趋势" },
  relationship: { label: "关系" },
  comparison: { label: "对比" },
};

const SAMPLE_DATA: Record<AnalysisGoal, ParsedData> = {
  distribution: { headers: ["测量值"], rows: [[12.1], [12.6], [13.4], [11.9], [12.8], [13.0], [13.6], [14.1]] },
  trend: getSampleData("line"),
  relationship: getSampleData("scatter"),
  comparison: getSampleData("bar"),
};

function indexList(columns: InferredColumn[], type: InferredColumn["type"]) {
  return columns.filter((column) => column.type === type).map((column) => column.index);
}

function toEngineMapping(config: ChartConfig): EngineFieldMapping {
  return {
    xAxisColumn: Number.isFinite(config.xAxisColumn) ? config.xAxisColumn : null,
    yAxisColumn: config.selectedColumns[0] ?? null,
    groupColumn: config.selectedColumns[1] ?? null,
  };
}

function enforceMappingByChartType(
  chartType: ChartType,
  mapping: Pick<ChartConfig, "xAxisColumn" | "selectedColumns">,
  inferredColumns: InferredColumn[],
): Pick<ChartConfig, "xAxisColumn" | "selectedColumns"> {
  const numeric = indexList(inferredColumns, "number");
  const category = indexList(inferredColumns, "category");
  const datetime = indexList(inferredColumns, "datetime");
  const all = inferredColumns.map((column) => column.index);
  let xAxisColumn = all.includes(mapping.xAxisColumn) ? mapping.xAxisColumn : (all[0] ?? 0);
  let selectedColumns = Array.from(new Set(mapping.selectedColumns)).filter((index) => all.includes(index) && index !== xAxisColumn);

  if (chartType === "histogram") {
    if (!numeric.includes(xAxisColumn)) xAxisColumn = numeric[0] ?? xAxisColumn;
    selectedColumns = [];
  } else if (chartType === "line") {
    if (![...datetime, ...numeric].includes(xAxisColumn)) xAxisColumn = datetime[0] ?? numeric[0] ?? xAxisColumn;
    selectedColumns = selectedColumns.filter((index) => numeric.includes(index) && index !== xAxisColumn);
    if (!selectedColumns.length) {
      const fallback = numeric.find((index) => index !== xAxisColumn);
      if (fallback != null) selectedColumns = [fallback];
    }
  } else if (chartType === "scatter") {
    if (!numeric.includes(xAxisColumn)) xAxisColumn = numeric[0] ?? xAxisColumn;
    const y = selectedColumns.find((index) => numeric.includes(index) && index !== xAxisColumn) ?? numeric.find((index) => index !== xAxisColumn);
    selectedColumns = y == null ? [] : [y];
  } else if (chartType === "boxplot" || chartType === "bar") {
    if (!category.includes(xAxisColumn)) xAxisColumn = category[0] ?? xAxisColumn;
    const y = selectedColumns.find((index) => numeric.includes(index) && index !== xAxisColumn) ?? numeric.find((index) => index !== xAxisColumn);
    selectedColumns = y == null ? [] : [y];
  }

  return { xAxisColumn, selectedColumns };
}

function recommendationToPatch(chartType: ChartType, mapping: EngineFieldMapping, headers: string[], inferredColumns: InferredColumn[]): RecommendationPatch {
  const rawX = mapping.xAxisColumn ?? 0;
  const rawSelected = [mapping.yAxisColumn, mapping.groupColumn].filter((index): index is number => index != null);
  const constrained = enforceMappingByChartType(chartType, { xAxisColumn: rawX, selectedColumns: rawSelected }, inferredColumns);
  return {
    chartType,
    xAxisColumn: constrained.xAxisColumn,
    selectedColumns: constrained.selectedColumns,
    xAxisLabel: headers[constrained.xAxisColumn] ?? "字段",
    yAxisLabel: constrained.selectedColumns.length > 0 ? headers[constrained.selectedColumns[0]] ?? "数值" : "频数",
  };
}

function buildGeneratedTitle(chartType: ChartType, headers: string[], xAxisColumn: number, selectedColumns: number[]) {
  const xLabel = headers[xAxisColumn] ?? "X";
  const yLabels = selectedColumns.map((index) => headers[index]).filter(Boolean);
  const chartName = chartTypeLabels[chartType] ?? chartType;
  if (chartType === "histogram") return `${xLabel} 的分布（${chartName}）`;
  if (yLabels.length > 1) return `${xLabel} 与 ${yLabels.join(" / ")}（${chartName}）`;
  if (yLabels.length === 1) return `${xLabel} 与 ${yLabels[0]}（${chartName}）`;
  return `${xLabel}（${chartName}）`;
}

function countKinds(profile: DatasetProfile, kind: DatasetProfile["columns"][number]["kind"]) {
  return profile.columns.filter((column) => column.kind === kind).length;
}

function deriveGoal(profile: DatasetProfile): AnalysisGoal {
  const hasDatetime = profile.columns.some((column) => column.kind === "datetime");
  const numericCount = countKinds(profile, "numeric");
  const categoryCount = countKinds(profile, "categorical");
  if (hasDatetime && numericCount >= 1) return "trend";
  if (numericCount >= 2) return "relationship";
  if (categoryCount >= 1 && numericCount >= 1) return "comparison";
  return "distribution";
}

function inferGoalFromData(data: ParsedData) {
  return deriveGoal(buildDatasetProfile(data));
}

function exportWorkspaceSnapshot(data: ParsedData, config: ChartConfig, analysisGoal: AnalysisGoal) {
  const blob = new Blob([
    JSON.stringify({
      exportedAt: new Date().toISOString(),
      analysisGoal,
      config,
      dataset: { headers: data.headers, rowCount: data.rows.length },
    }, null, 2),
  ], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sciplot-workspace-${analysisGoal}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorSectionRef = useRef<HTMLElement>(null);
  const [stage, setStage] = useState<AppStage>("entry");
  const [analysisGoal, setAnalysisGoal] = useState<AnalysisGoal>("trend");
  const [data, setData] = useState<ParsedData>({ headers: [], rows: [] });
  const [config, setConfig] = useState<ChartConfig>({ ...defaultChartConfig });
  const [pasteText, setPasteText] = useState("");
  const [showPastePanel, setShowPastePanel] = useState(false);
  const [statusText, setStatusText] = useState("上传 CSV/XLSX、使用示例数据，或直接粘贴表格即可开始。");
  const [selectedChartId, setSelectedChartId] = useState<string | null>(null);
  const [quickExportingId, setQuickExportingId] = useState<string | null>(null);
  const [editorExportRequest, setEditorExportRequest] = useState<{ type: "png" | "svg"; token: number } | null>(null);

  const hasData = data.headers.length > 0 && data.rows.length > 0;
  const profile = useMemo(() => buildDatasetProfile(data), [data]);
  const inferredColumns = useMemo(() => inferColumns(data), [data]);
  const defaultGoal = useMemo(() => inferGoalFromData(data), [data]);
  const numericCount = inferredColumns.filter((column) => column.type === "number").length;
  const datetimeCount = inferredColumns.filter((column) => column.type === "datetime").length;
  const categoryCount = inferredColumns.filter((column) => column.type === "category").length;

  const recommendations = useMemo<RecommendationCard[]>(
    () =>
      recommendCharts(analysisGoal, inferredColumns, toEngineMapping(config)).map((item) => ({
        chartType: item.chartType,
        title: chartTypeLabels[item.chartType],
        reason: item.reason,
        supported: item.available,
        patch: recommendationToPatch(item.chartType, item.mapping, data.headers, inferredColumns),
      })),
    [analysisGoal, config, data.headers, inferredColumns],
  );

  const bestRecommendation = useMemo(() => recommendations.find((item) => item.supported) ?? recommendations[0], [recommendations]);
  const insight = bestRecommendation?.reason ?? "未检测到可用推荐，已保留当前图表配置。";
  const generatedTitle = useMemo(
    () => buildGeneratedTitle(config.chartType, data.headers, config.xAxisColumn, config.selectedColumns),
    [config.chartType, config.selectedColumns, config.xAxisColumn, data.headers],
  );
  const previewConfig = useMemo(() => ({ ...config, title: config.title.trim() ? config.title : generatedTitle }), [config, generatedTitle]);

  const visualSeed = useMemo(
    () => ({
      stylePreset: config.stylePreset,
      colorTheme: config.colorTheme,
      colors: [...config.colors],
      showLegend: config.showLegend,
      showGrid: config.showGrid,
      showSymbol: config.showSymbol,
      smooth: config.smooth,
      symbolSize: config.symbolSize,
      lineWidth: config.lineWidth,
      fontSize: config.fontSize,
      fontFamily: config.fontFamily,
      backgroundColor: config.backgroundColor,
    }),
    [config],
  );

  const galleryCandidates = useMemo<GalleryCandidate[]>(() => {
    if (!hasData) return [];
    const all: GalleryCandidate[] = [];

    GOAL_ORDER.forEach((goal) => {
      const mapping = suggestDefaultMapping(goal, inferredColumns);
      recommendCharts(goal, inferredColumns, mapping).forEach((item, index) => {
        const patch = recommendationToPatch(item.chartType, item.mapping, data.headers, inferredColumns);
        const title = buildGeneratedTitle(patch.chartType, data.headers, patch.xAxisColumn, patch.selectedColumns);
        all.push({
          id: `${goal}-${item.chartType}-${index}`,
          goal,
          chartType: item.chartType,
          title,
          reason: item.reason,
          supported: item.available,
          config: {
            ...defaultChartConfig,
            ...visualSeed,
            chartType: patch.chartType,
            xAxisColumn: patch.xAxisColumn,
            selectedColumns: patch.selectedColumns,
            xAxisLabel: patch.xAxisLabel,
            yAxisLabel: patch.yAxisLabel,
            title,
            showLegend: patch.chartType !== "histogram",
          },
        });
      });
    });

    const available = all.filter((item) => item.supported);
    const fallback = all.filter((item) => !item.supported);
    const target = Math.min(8, Math.max(4, available.length || 1));
    return [...available, ...fallback].slice(0, target);
  }, [data.headers, hasData, inferredColumns, visualSeed]);

  const candidateMap = useMemo(() => {
    const map = new Map<string, GalleryCandidate>();
    galleryCandidates.forEach((item) => map.set(item.id, item));
    return map;
  }, [galleryCandidates]);

  const groupedCandidates = useMemo(
    () =>
      GOAL_ORDER.map((goal) => ({
        goal,
        label: ANALYSIS_GOALS[goal].label,
        items: galleryCandidates.filter((item) => item.goal === goal).map((item) => ({
          id: item.id,
          chartType: item.chartType,
          title: item.title,
          reason: item.reason,
          config: item.config,
          supported: item.supported,
        })),
      })).filter((group) => group.items.length > 0),
    [galleryCandidates],
  );

  useEffect(() => {
    if (stage !== "workspace") return;
    if (!galleryCandidates.length) return setSelectedChartId(null);
    if (!selectedChartId) return;
    if (!galleryCandidates.some((item) => item.id === selectedChartId)) setSelectedChartId(null);
  }, [galleryCandidates, selectedChartId, stage]);

  const applyGoalPlan = useCallback((nextData: ParsedData, goal: AnalysisGoal) => {
    const nextInferred = inferColumns(nextData);
    const defaultMapping = suggestDefaultMapping(goal, nextInferred);
    const nextRecommendations = recommendCharts(goal, nextInferred, defaultMapping);
    const nextBest = nextRecommendations.find((item) => item.available) ?? nextRecommendations[0];
    const nextPlan = recommendationToPatch(nextBest?.chartType ?? "line", nextBest?.mapping ?? defaultMapping, nextData.headers, nextInferred);
    setAnalysisGoal(goal);
    setData(nextData);
    setConfig((prev) => ({ ...prev, chartType: nextPlan.chartType, xAxisColumn: nextPlan.xAxisColumn, selectedColumns: nextPlan.selectedColumns, xAxisLabel: nextPlan.xAxisLabel, yAxisLabel: nextPlan.yAxisLabel, title: "" }));
    setSelectedChartId(null);
    setEditorExportRequest(null);
    setStage("workspace");
    setStatusText(nextBest?.reason ?? `${ANALYSIS_GOALS[goal].label} 模式已激活。`);
  }, []);

  const handleFileImport = useCallback(async (file: File) => {
    try {
      const parsed = await parseFile(file);
      if (!parsed.headers.length || !parsed.rows.length) return setStatusText("文件已读取，但没有找到可用的数据表。");
      applyGoalPlan(parsed, inferGoalFromData(parsed));
      setShowPastePanel(false);
      setPasteText("");
    } catch (error) {
      console.error(error);
      setStatusText("导入失败：文件无法解析。");
    }
  }, [applyGoalPlan]);

  const handleEntryPaste = useCallback(() => {
    if (!pasteText.trim()) return setStatusText("请先粘贴 CSV 或 TSV 表格内容。");
    const parsed = autoDetectAndParse(pasteText);
    if (!parsed.headers.length || !parsed.rows.length) return setStatusText("粘贴内容没有形成有效表格。");
    applyGoalPlan(parsed, inferGoalFromData(parsed));
    setShowPastePanel(false);
  }, [applyGoalPlan, pasteText]);

  const handleRecommendation = useCallback((patch: RecommendationPatch) => {
    const constrained = enforceMappingByChartType(patch.chartType, { xAxisColumn: patch.xAxisColumn, selectedColumns: patch.selectedColumns }, inferredColumns);
    setConfig((prev) => ({
      ...prev,
      ...patch,
      xAxisColumn: constrained.xAxisColumn,
      selectedColumns: constrained.selectedColumns,
      xAxisLabel: data.headers[constrained.xAxisColumn] ?? patch.xAxisLabel,
      yAxisLabel: constrained.selectedColumns.length > 0 ? data.headers[constrained.selectedColumns[0]] ?? patch.yAxisLabel : (patch.chartType === "histogram" ? "频数" : patch.yAxisLabel),
    }));
  }, [data.headers, inferredColumns]);

  const handleEditChart = useCallback((candidateId: string) => {
    const candidate = candidateMap.get(candidateId);
    if (!candidate) return;
    if (!candidate.supported) return setStatusText(`当前数据下不建议直接使用 ${chartTypeLabels[candidate.chartType]}。`);
    setSelectedChartId(candidateId);
    setAnalysisGoal(candidate.goal);
    setConfig((prev) => ({ ...prev, ...candidate.config, title: candidate.config.title }));
    setStatusText(`已选中 ${candidate.title}，请在下方编辑区精修。`);
    window.setTimeout(() => editorSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, [candidateMap]);

  const handleQuickExport = useCallback((candidateId: string) => {
    setQuickExportingId(candidateId);
    window.setTimeout(() => setQuickExportingId((current) => (current === candidateId ? null : current)), 900);
  }, []);

  const handleResetStyle = useCallback(() => {
    setConfig((prev) => ({ ...prev, stylePreset: defaultChartConfig.stylePreset, colorTheme: defaultChartConfig.colorTheme, colors: [...defaultChartConfig.colors], showLegend: defaultChartConfig.showLegend, showGrid: defaultChartConfig.showGrid, showSymbol: defaultChartConfig.showSymbol, smooth: defaultChartConfig.smooth, symbolSize: defaultChartConfig.symbolSize, lineWidth: defaultChartConfig.lineWidth, fontSize: defaultChartConfig.fontSize, backgroundColor: defaultChartConfig.backgroundColor }));
  }, []);

  const handleResetStatistics = useCallback(() => {
    setConfig((prev) => ({ ...prev, showTrendLine: defaultChartConfig.showTrendLine, showConfidenceInterval: defaultChartConfig.showConfidenceInterval, errorBarType: defaultChartConfig.errorBarType, showSignificance: defaultChartConfig.showSignificance, referenceLine: undefined, referenceLineLabel: defaultChartConfig.referenceLineLabel }));
  }, []);

  const handleReset = useCallback(() => {
    setData({ headers: [], rows: [] });
    setConfig({ ...defaultChartConfig });
    setAnalysisGoal(defaultGoal);
    setStage("entry");
    setPasteText("");
    setShowPastePanel(false);
    setSelectedChartId(null);
    setQuickExportingId(null);
    setEditorExportRequest(null);
  }, [defaultGoal]);

  const loadSample = useCallback((goal: AnalysisGoal = analysisGoal) => {
    applyGoalPlan(SAMPLE_DATA[goal], goal);
  }, [analysisGoal, applyGoalPlan]);

  const selectedCandidate = selectedChartId ? candidateMap.get(selectedChartId) ?? null : null;

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(89,118,157,0.10),_transparent_34%),linear-gradient(180deg,_#f7f9fc_0%,_#eef3f8_100%)] text-slate-900">
      <header className="z-40 border-b border-slate-200/70 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white"><LayoutGrid className="h-5 w-5" /></div>
            <div><div className="text-sm font-semibold">SciPlot</div><div className="text-xs text-slate-500">中文优先 · 轻量科研出图</div></div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStage("entry")} className="hidden sm:inline-flex">返回导入</Button>
            <Button variant="outline" size="sm" onClick={() => exportWorkspaceSnapshot(data, config, analysisGoal)} disabled={!hasData}><ArrowDownToLine className="mr-1.5 h-4 w-4" />导出配置</Button>
            <Button size="sm" onClick={handleReset} className="bg-slate-950 text-white hover:bg-slate-800">重置视图</Button>
          </div>
        </div>
      </header>

      <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt,.xls,.xlsx" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFileImport(file); event.target.value = ""; }} />

      {stage === "entry" ? (
        <main className="mx-auto flex h-full w-full max-w-[1200px] flex-col justify-center gap-4 px-4">
          <section className="rounded-3xl bg-white/90 p-6 ring-1 ring-slate-200/80">
            <h1 className="text-3xl font-semibold">上传表格，自动生成可读图表</h1>
            <p className="mt-2 text-sm text-slate-600">先浏览自动探索，再进入下方单图编辑区精修。</p>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <Button onClick={() => fileInputRef.current?.click()} className="h-12 bg-slate-950 text-white hover:bg-slate-800"><Upload className="mr-2 h-4 w-4" />上传 CSV/XLSX</Button>
              <Button variant="outline" onClick={() => loadSample(analysisGoal)} className="h-12"><Play className="mr-2 h-4 w-4" />加载示例数据</Button>
              <Button variant="outline" onClick={() => setShowPastePanel((v) => !v)} className="h-12"><WandSparkles className="mr-2 h-4 w-4" />粘贴数据</Button>
            </div>
            {showPastePanel ? (
              <div className="mt-4 rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
                <Textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder={"Time,ValueA,ValueB\n0,1.2,2.3\n1,1.8,2.9"} className="min-h-32 resize-none border-slate-200 bg-white font-mono text-xs" />
                <div className="mt-3 flex justify-end"><Button onClick={handleEntryPaste} className="bg-slate-950 text-white hover:bg-slate-800">解析并进入 workspace</Button></div>
              </div>
            ) : null}
          </section>
        </main>
      ) : (
        <main className="mx-auto h-full w-full max-w-[1680px] overflow-y-auto px-4 py-4 xl:px-6">
          <div className="space-y-6 pb-10">
            <section className="rounded-2xl bg-white/92 p-4 ring-1 ring-slate-200/80">
              <div className="flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500"><Sparkles className="h-3.5 w-3.5 text-slate-700" />数据摘要</div>
                <div className="text-xs text-slate-500">{statusText}</div>
              </div>
              <div className="mt-3 grid gap-2 text-xs text-slate-600 sm:grid-cols-5">
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">{data.rows.length} 行</div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">{data.headers.length} 列</div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">数值 {numericCount}</div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">时间 {datetimeCount}</div>
                <div className="rounded-xl bg-slate-50 px-3 py-2 ring-1 ring-slate-200/70">分类 {categoryCount}</div>
              </div>
            </section>

            <Suspense fallback={<div className="rounded-2xl bg-white/90 p-8 ring-1 ring-slate-200/80">正在生成自动探索图表...</div>}>
              <AutoChartGallery
                data={data}
                datasetSummary={{ rowCount: data.rows.length, columnCount: data.headers.length, numericCount, datetimeCount, categoryCount }}
                groupedCandidates={groupedCandidates}
                onEditChart={handleEditChart}
                onQuickExport={handleQuickExport}
                quickExportingId={quickExportingId}
              />
            </Suspense>

            <section ref={editorSectionRef} className="space-y-3">
              <div className="rounded-2xl bg-white/92 p-4 ring-1 ring-slate-200/80"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">编辑区</div><h2 className="mt-1 text-2xl font-semibold">单图精修</h2></div>
              {selectedCandidate ? (
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_360px]">
                  <div className="min-h-[560px]">
                    <Suspense fallback={<div className="rounded-2xl bg-white/90 p-8 ring-1 ring-slate-200/80">正在加载图表预览...</div>}>
                      <ChartPreview
                        data={data}
                        config={previewConfig}
                        recommendations={recommendations}
                        insight={selectedCandidate.reason}
                        autoGeneratedTitle={!config.title.trim()}
                        onApplyRecommendation={handleRecommendation}
                        mode="editor"
                        externalExportRequest={editorExportRequest}
                      />
                    </Suspense>
                  </div>
                  <div className="min-h-[560px]">
                    <Suspense fallback={<div className="rounded-2xl bg-white/90 p-8 ring-1 ring-slate-200/80">正在加载编辑控件...</div>}>
                      <ChartEditorPanel
                        config={config}
                        onConfigChange={setConfig}
                        onResetStyle={handleResetStyle}
                        onResetStatistics={handleResetStatistics}
                        onExportPNG={() => setEditorExportRequest((prev) => ({ type: "png", token: (prev?.token ?? 0) + 1 }))}
                        onExportSVG={() => setEditorExportRequest((prev) => ({ type: "svg", token: (prev?.token ?? 0) + 1 }))}
                        onExportSnapshot={() => exportWorkspaceSnapshot(data, config, analysisGoal)}
                        datasetMeta={{ rowCount: data.rows.length, columnCount: data.headers.length }}
                      />
                    </Suspense>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl bg-white/92 p-8 text-center ring-1 ring-slate-200/80">请先在上方选择一张图再进入编辑。</div>
              )}
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
