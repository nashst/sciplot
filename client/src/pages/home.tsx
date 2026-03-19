import { Suspense, lazy, useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { defaultChartConfig, type ChartConfig, type ChartType, chartTypeLabels } from "@shared/schema";
import { autoDetectAndParse, parseFile, type DataChangeMeta } from "@/lib/dataParser";
import { buildDatasetProfile, type DatasetProfile } from "@/lib/autoInsights";
import { getSampleData, type ParsedData } from "@/lib/chartEngine";
import {
  ArrowDownToLine,
  FlaskConical,
  LayoutGrid,
  Play,
  Upload,
  WandSparkles,
} from "lucide-react";

const DataEditor = lazy(async () => {
  const mod = await import("@/components/DataEditor");
  return { default: mod.DataEditor };
});

const ChartConfigPanel = lazy(async () => {
  const mod = await import("@/components/ChartConfig");
  return { default: mod.ChartConfigPanel };
});

const ChartPreview = lazy(async () => {
  const mod = await import("@/components/ChartPreview");
  return { default: mod.ChartPreview };
});
type AnalysisGoal = "distribution" | "trend" | "relationship" | "comparison";
type AppStage = "entry" | "workspace";

type FieldMapping = {
  xAxisColumn: number;
  selectedColumns: number[];
};

type RecommendationCard = {
  chartType: ChartType;
  title: string;
  reason: string;
  supported: boolean;
  patch: Pick<ChartConfig, "chartType" | "xAxisColumn" | "selectedColumns" | "xAxisLabel" | "yAxisLabel">;
};

const ANALYSIS_GOALS: Record<AnalysisGoal, { label: string; short: string; description: string }> = {
  distribution: {
    label: "分布",
    short: "看单变量分布",
    description: "适合查看数值分布、离群点和整体离散程度。",
  },
  trend: {
    label: "趋势",
    short: "看时间变化",
    description: "适合时间序列、顺序变化和连续过程。",
  },
  relationship: {
    label: "关系",
    short: "看变量相关",
    description: "适合两个数值变量之间的相关关系。",
  },
  comparison: {
    label: "对比",
    short: "看组间差异",
    description: "适合分类分组后比较各组数值差异。",
  },
};

const GOAL_ORDER: AnalysisGoal[] = ["distribution", "trend", "relationship", "comparison"];

const SAMPLE_DATA: Record<AnalysisGoal, ParsedData> = {
  distribution: {
    headers: ["测量值"],
    rows: [[12.1], [12.6], [13.4], [11.9], [12.8], [13.0], [13.6], [14.1], [10.7], [11.6], [12.4], [13.2], [14.6], [15.1], [12.7], [11.8], [13.8], [12.9]],
  },
  trend: getSampleData("line"),
  relationship: getSampleData("scatter"),
  comparison: getSampleData("bar"),
};

type GoalColumns = {
  xAxisColumn: number;
  selectedColumns: number[];
  xAxisLabel: string;
  yAxisLabel: string;
  chartType: ChartType;
  reason: string;
};

function isNumericKind(kind: DatasetProfile["columns"][number]["kind"]) {
  return kind === "numeric";
}

function countKinds(profile: DatasetProfile, kind: DatasetProfile["columns"][number]["kind"]) {
  return profile.columns.filter((column) => column.kind === kind).length;
}

function firstColumnIndex(profile: DatasetProfile, kind: DatasetProfile["columns"][number]["kind"]) {
  return profile.columns.find((column) => column.kind === kind)?.index ?? -1;
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

function buildGoalColumns(profile: DatasetProfile, goal: AnalysisGoal): GoalColumns {
  const numericColumns = profile.columns.filter((column) => isNumericKind(column.kind)).map((column) => column.index);
  const datetimeIndex = firstColumnIndex(profile, "datetime");
  const categoryIndex = firstColumnIndex(profile, "categorical");
  const firstNumeric = numericColumns[0] ?? -1;
  const secondNumeric = numericColumns[1] ?? -1;

  const fallback = (reason: string): GoalColumns => ({
    chartType: firstNumeric >= 0 ? "histogram" : "bar",
    xAxisColumn: Math.max(0, firstNumeric >= 0 ? firstNumeric : categoryIndex >= 0 ? categoryIndex : 0),
    selectedColumns: firstNumeric >= 0 ? [] : secondNumeric >= 0 ? [secondNumeric] : [],
    xAxisLabel: profile.columns[Math.max(0, firstNumeric >= 0 ? firstNumeric : categoryIndex >= 0 ? categoryIndex : 0)]?.name ?? "字段",
    yAxisLabel: firstNumeric >= 0 ? "频数" : "数值",
    reason,
  });

  if (goal === "distribution") {
    if (categoryIndex >= 0 && firstNumeric >= 0) {
      const xColumn = profile.columns[categoryIndex];
      const yColumn = profile.columns[firstNumeric];
      return {
        chartType: "boxplot",
        xAxisColumn: categoryIndex,
        selectedColumns: [firstNumeric],
        xAxisLabel: xColumn?.name ?? "分组",
        yAxisLabel: yColumn?.name ?? "数值",
        reason: `当前数据包含分类与数值字段，箱线图比直方图更适合先比较各组分布。`,
      };
    }
    if (firstNumeric >= 0) {
      const column = profile.columns[firstNumeric];
      return {
        chartType: "histogram",
        xAxisColumn: firstNumeric,
        selectedColumns: [],
        xAxisLabel: column?.name ?? "数值",
        yAxisLabel: "频数",
        reason: `当前数据里 ${column?.name ?? "数值列"} 最适合先看分布，直方图能最快暴露离群值和偏态。`,
      };
    }
    return fallback("当前缺少合适的数值字段，先用最稳妥的默认图。");
  }

  if (goal === "trend") {
    if (datetimeIndex >= 0 && firstNumeric >= 0) {
      return {
        chartType: "line",
        xAxisColumn: datetimeIndex,
        selectedColumns: [firstNumeric],
        xAxisLabel: profile.columns[datetimeIndex]?.name ?? "时间",
        yAxisLabel: profile.columns[firstNumeric]?.name ?? "数值",
        reason: `检测到时间字段和数值字段，折线图最适合看趋势。`,
      };
    }
    if (firstNumeric >= 0 && secondNumeric >= 0) {
      return {
        chartType: "line",
        xAxisColumn: firstNumeric,
        selectedColumns: [secondNumeric],
        xAxisLabel: profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: profile.columns[secondNumeric]?.name ?? "Y",
        reason: `没有显式时间列时，可以先把第一个数值字段当作顺序轴，使用折线图查看变化。`,
      };
    }
    return fallback("当前数据不够像时间序列，先用通用默认图。");
  }

  if (goal === "relationship") {
    if (firstNumeric >= 0 && secondNumeric >= 0) {
      return {
        chartType: "scatter",
        xAxisColumn: firstNumeric,
        selectedColumns: [secondNumeric],
        xAxisLabel: profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: profile.columns[secondNumeric]?.name ?? "Y",
        reason: `两个数值字段最适合先看散点图，能直接判断相关性和异常点。`,
      };
    }
    if (firstNumeric >= 0) {
      return {
        chartType: "histogram",
        xAxisColumn: firstNumeric,
        selectedColumns: [],
        xAxisLabel: profile.columns[firstNumeric]?.name ?? "数值",
        yAxisLabel: "频数",
        reason: `当前只有一个明确数值字段，先看它的分布，再决定下一步关系图。`,
      };
    }
    return fallback("当前还没有足够的数值字段，先用默认图过渡。");
  }

  if (goal === "comparison") {
    if (categoryIndex >= 0 && firstNumeric >= 0) {
      const extraNumeric = secondNumeric >= 0 ? [firstNumeric, secondNumeric] : [firstNumeric];
      return {
        chartType: "bar",
        xAxisColumn: categoryIndex,
        selectedColumns: extraNumeric,
        xAxisLabel: profile.columns[categoryIndex]?.name ?? "分组",
        yAxisLabel: profile.columns[firstNumeric]?.name ?? "数值",
        reason: `分类字段配数值字段，柱状图最适合做组间对比。`,
      };
    }
    if (firstNumeric >= 0) {
      return {
        chartType: "boxplot",
        xAxisColumn: firstNumeric,
        selectedColumns: [],
        xAxisLabel: profile.columns[firstNumeric]?.name ?? "数值",
        yAxisLabel: "频数",
        reason: `如果暂时没有分类列，可以先用箱线图查看数值的整体分布。`,
      };
    }
    return fallback("当前没有适合分组比较的字段，先用默认图继续。");
  }

  return fallback("使用默认配置作为起点。");
}

function dedupeRecommendations(items: RecommendationCard[]): RecommendationCard[] {
  const unique = new Map<ChartType, RecommendationCard>();
  items.forEach((item) => {
    if (!unique.has(item.chartType)) {
      unique.set(item.chartType, item);
    }
  });
  return Array.from(unique.values()).slice(0, 4);
}

function buildRecommendations(profile: DatasetProfile, goal: AnalysisGoal): RecommendationCard[] {
  const numericColumns = profile.columns.filter((column) => column.kind === "numeric").map((column) => column.index);
  const datetimeIndex = firstColumnIndex(profile, "datetime");
  const categoryIndex = firstColumnIndex(profile, "categorical");
  const firstNumeric = numericColumns[0] ?? -1;
  const secondNumeric = numericColumns[1] ?? -1;

  const items: Array<RecommendationCard | null> = [];
  const pushCard = (chartType: ChartType, title: string, reason: string, patch: RecommendationCard["patch"], supported: boolean) => {
    items.push({ chartType, title, reason, patch, supported });
  };

  if (goal === "distribution") {
    pushCard(
      "histogram",
      "直方图",
      firstNumeric >= 0
        ? `先看 ${profile.columns[firstNumeric]?.name ?? "数值列"} 的分布形态。`
        : "需要至少一个数值字段。",
      {
        chartType: "histogram",
        xAxisColumn: firstNumeric >= 0 ? firstNumeric : 0,
        selectedColumns: [],
        xAxisLabel: firstNumeric >= 0 ? profile.columns[firstNumeric]?.name ?? "数值" : "数值",
        yAxisLabel: "频数",
      },
      firstNumeric >= 0,
    );
    pushCard(
      "boxplot",
      "箱线图",
      firstNumeric >= 0 ? "更适合看离群点和四分位范围。" : "需要数值字段。",
      {
        chartType: "boxplot",
        xAxisColumn: categoryIndex >= 0 ? categoryIndex : Math.max(0, firstNumeric),
        selectedColumns: firstNumeric >= 0 ? [firstNumeric] : [],
        xAxisLabel: categoryIndex >= 0 ? profile.columns[categoryIndex]?.name ?? "分组" : profile.columns[firstNumeric]?.name ?? "数值",
        yAxisLabel: firstNumeric >= 0 ? profile.columns[firstNumeric]?.name ?? "数值" : "频数",
      },
      firstNumeric >= 0,
    );
  } else if (goal === "trend") {
    pushCard(
      "line",
      "折线图",
      datetimeIndex >= 0 && firstNumeric >= 0
        ? `时间字段 ${profile.columns[datetimeIndex]?.name ?? "时间"} + 数值字段 ${profile.columns[firstNumeric]?.name ?? "数值"}。`
        : "适合时间或顺序轴。",
      {
        chartType: "line",
        xAxisColumn: datetimeIndex >= 0 ? datetimeIndex : Math.max(0, firstNumeric),
        selectedColumns: firstNumeric >= 0 ? [firstNumeric] : secondNumeric >= 0 ? [secondNumeric] : [],
        xAxisLabel: datetimeIndex >= 0 ? profile.columns[datetimeIndex]?.name ?? "时间" : profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: firstNumeric >= 0 ? profile.columns[firstNumeric]?.name ?? "Y" : profile.columns[secondNumeric]?.name ?? "Y",
      },
      (datetimeIndex >= 0 && firstNumeric >= 0) || firstNumeric >= 0,
    );
    pushCard(
      "scatter",
      "散点图",
      firstNumeric >= 0 && secondNumeric >= 0
        ? "如果想看离散关系，可切到散点图。"
        : "需要两个数值字段。",
      {
        chartType: "scatter",
        xAxisColumn: firstNumeric >= 0 ? firstNumeric : 0,
        selectedColumns: secondNumeric >= 0 ? [secondNumeric] : [],
        xAxisLabel: profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: profile.columns[secondNumeric]?.name ?? "Y",
      },
      firstNumeric >= 0 && secondNumeric >= 0,
    );
  } else if (goal === "relationship") {
    pushCard(
      "scatter",
      "散点图",
      firstNumeric >= 0 && secondNumeric >= 0
        ? "两个数值字段最适合先看相关关系。"
        : "需要至少两个数值字段。",
      {
        chartType: "scatter",
        xAxisColumn: firstNumeric >= 0 ? firstNumeric : 0,
        selectedColumns: secondNumeric >= 0 ? [secondNumeric] : [],
        xAxisLabel: profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: profile.columns[secondNumeric]?.name ?? "Y",
      },
      firstNumeric >= 0 && secondNumeric >= 0,
    );
    pushCard(
      "line",
      "折线图",
      "当你想看同一序列的变化方向时可切换。",
      {
        chartType: "line",
        xAxisColumn: firstNumeric >= 0 ? firstNumeric : 0,
        selectedColumns: secondNumeric >= 0 ? [secondNumeric] : [],
        xAxisLabel: profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: profile.columns[secondNumeric]?.name ?? "Y",
      },
      firstNumeric >= 0 && secondNumeric >= 0,
    );
  } else {
    pushCard(
      "bar",
      "柱状图",
      categoryIndex >= 0 && firstNumeric >= 0
        ? `最适合比较 ${profile.columns[categoryIndex]?.name ?? "分组"} 的差异。`
        : "需要分类字段配合数值字段。",
      {
        chartType: "bar",
        xAxisColumn: categoryIndex >= 0 ? categoryIndex : Math.max(0, firstNumeric),
        selectedColumns: firstNumeric >= 0 ? (secondNumeric >= 0 ? [firstNumeric, secondNumeric] : [firstNumeric]) : [],
        xAxisLabel: categoryIndex >= 0 ? profile.columns[categoryIndex]?.name ?? "分组" : profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: firstNumeric >= 0 ? profile.columns[firstNumeric]?.name ?? "数值" : "频数",
      },
      categoryIndex >= 0 && firstNumeric >= 0,
    );
    pushCard(
      "boxplot",
      "箱线图",
      firstNumeric >= 0 ? "可用于组间分布对比。" : "需要数值字段。",
      {
        chartType: "boxplot",
        xAxisColumn: categoryIndex >= 0 ? categoryIndex : Math.max(0, firstNumeric),
        selectedColumns: firstNumeric >= 0 ? [firstNumeric] : [],
        xAxisLabel: categoryIndex >= 0 ? profile.columns[categoryIndex]?.name ?? "分组" : profile.columns[firstNumeric]?.name ?? "X",
        yAxisLabel: firstNumeric >= 0 ? profile.columns[firstNumeric]?.name ?? "数值" : "频数",
      },
      firstNumeric >= 0,
    );
  }

  if (items.length < 3) {
    pushCard(
      "histogram",
      "直方图",
      firstNumeric >= 0 ? "可以快速看数值的基本分布。" : "没有找到数值字段。",
      {
        chartType: "histogram",
        xAxisColumn: firstNumeric >= 0 ? firstNumeric : 0,
        selectedColumns: [],
        xAxisLabel: firstNumeric >= 0 ? profile.columns[firstNumeric]?.name ?? "数值" : "数值",
        yAxisLabel: "频数",
      },
      firstNumeric >= 0,
    );
  }

  return dedupeRecommendations(items.filter((item): item is RecommendationCard => Boolean(item)));
}

function buildStatusText(profile: DatasetProfile, goal: AnalysisGoal, recommendation: GoalColumns) {
  const goalMeta = ANALYSIS_GOALS[goal];
  const warning = profile.warnings[0];
  const base = `${goalMeta.label}模式已激活，优先推荐 ${chartTypeLabels[recommendation.chartType]}。${recommendation.reason}`;
  return warning ? `${base} 数据提醒：${warning}` : base;
}

function buildSampleData(goal: AnalysisGoal): ParsedData {
  return SAMPLE_DATA[goal];
}

function inferGoalFromData(data: ParsedData) {
  return deriveGoal(buildDatasetProfile(data));
}

function exportWorkspaceSnapshot(data: ParsedData, config: ChartConfig, analysisGoal: AnalysisGoal) {
  const payload = {
    version: 1,
    analysisGoal,
    data,
    config,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `sciplot-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<AppStage>("entry");
  const [analysisGoal, setAnalysisGoal] = useState<AnalysisGoal>("trend");
  const [data, setData] = useState<ParsedData>({ headers: [], rows: [] });
  const [config, setConfig] = useState<ChartConfig>({ ...defaultChartConfig });
  const [pasteText, setPasteText] = useState("");
  const [showPastePanel, setShowPastePanel] = useState(false);
  const [statusText, setStatusText] = useState("上传 CSV/XLSX、使用示例数据，或直接粘贴表格即可开始。");

  const profile = useMemo(() => buildDatasetProfile(data), [data]);
  const defaultGoal = useMemo(() => inferGoalFromData(data), [data]);
  const plan = useMemo(() => buildGoalColumns(profile, analysisGoal), [profile, analysisGoal]);
  const recommendations = useMemo(() => buildRecommendations(profile, analysisGoal), [profile, analysisGoal]);
  const hasData = data.headers.length > 0 && data.rows.length > 0;

  const syncConfigForData = useCallback((nextData: ParsedData) => {
    const maxIndex = Math.max(0, nextData.headers.length - 1);
    setConfig((prev) => {
      const xAxisColumn = Math.min(prev.xAxisColumn, maxIndex);
      const selectedColumns = Array.from(new Set<number>(prev.selectedColumns)).filter(
        (index: number) => index >= 0 && index <= maxIndex && index !== xAxisColumn,
      );

      return {
        ...prev,
        xAxisColumn,
        selectedColumns,
        xAxisLabel: nextData.headers[xAxisColumn] ?? prev.xAxisLabel,
        yAxisLabel: selectedColumns.length > 0 ? nextData.headers[selectedColumns[0]] ?? prev.yAxisLabel : prev.yAxisLabel,
      };
    });
  }, []);

  const applyGoalPlan = useCallback(
    (nextData: ParsedData, goal: AnalysisGoal) => {
      const nextProfile = buildDatasetProfile(nextData);
      const nextPlan = buildGoalColumns(nextProfile, goal);
      setAnalysisGoal(goal);
      setData(nextData);
      setConfig((prev) => ({
        ...prev,
        chartType: nextPlan.chartType,
        xAxisColumn: nextPlan.xAxisColumn,
        selectedColumns: nextPlan.selectedColumns,
        xAxisLabel: nextPlan.xAxisLabel,
        yAxisLabel: nextPlan.yAxisLabel,
        showLegend: nextPlan.chartType !== "histogram",
        showGrid: true,
        backgroundColor: "#ffffff",
      }));
      setStage("workspace");
      setStatusText(buildStatusText(nextProfile, goal, nextPlan));
    },
    [],
  );

  const handleFileImport = useCallback(async (file: File) => {
    try {
      const parsed = await parseFile(file);
      if (!parsed.headers.length || !parsed.rows.length) {
        setStatusText("文件已读取，但没有找到可用的数据表。请检查表头和空行。");
        return;
      }
      const nextGoal = inferGoalFromData(parsed);
      applyGoalPlan(parsed, nextGoal);
      setShowPastePanel(false);
      setPasteText("");
    } catch (error) {
      console.error(error);
      setStatusText("导入失败：文件无法解析。请确认是有效的 CSV / XLSX 文件。");
    }
  }, [applyGoalPlan]);

  const handleEntryPaste = useCallback(() => {
    if (!pasteText.trim()) {
      setStatusText("请先粘贴 CSV 或 TSV 表格内容。");
      return;
    }
    const parsed = autoDetectAndParse(pasteText);
    if (!parsed.headers.length || !parsed.rows.length) {
      setStatusText("粘贴内容没有形成有效表格，请检查分隔符和表头。");
      return;
    }
    const nextGoal = inferGoalFromData(parsed);
    applyGoalPlan(parsed, nextGoal);
    setShowPastePanel(false);
  }, [applyGoalPlan, pasteText]);

  const handleDataChange = useCallback((nextData: ParsedData, meta?: DataChangeMeta) => {
    setData(nextData);

    if (!nextData.headers.length || !nextData.rows.length) {
      setStatusText("当前数据为空，建议重新导入示例或上传文件。");
      return;
    }

    if (meta?.reason === "upload" || meta?.reason === "paste" || meta?.reason === "reset") {
      const goal = meta.reason === "reset" ? deriveGoal(buildDatasetProfile(nextData)) : analysisGoal;
      applyGoalPlan(nextData, goal);
      return;
    }

    syncConfigForData(nextData);
    setStatusText("数据已更新，右侧建议会按当前字段重新计算。");
  }, [analysisGoal, applyGoalPlan, syncConfigForData]);

  const handleGoalChange = useCallback((goal: AnalysisGoal) => {
    setAnalysisGoal(goal);
    if (hasData) {
      applyGoalPlan(data, goal);
    } else {
      setStatusText(`${ANALYSIS_GOALS[goal].label} 已选中，导入数据后会自动套用。`);
    }
  }, [applyGoalPlan, data, hasData]);

  const handleRecommendation = useCallback((patch: RecommendationCard["patch"]) => {
    setConfig((prev) => ({
      ...prev,
      ...patch,
    }));
    setStatusText(`已切换到 ${chartTypeLabels[patch.chartType]}。`);
  }, []);

  const handleReset = useCallback(() => {
    setData({ headers: [], rows: [] });
    setConfig({ ...defaultChartConfig });
    setAnalysisGoal(defaultGoal);
    setStage("entry");
    setPasteText("");
    setShowPastePanel(false);
    setStatusText("已重置视图。你可以重新上传、粘贴或载入示例数据。");
  }, [defaultGoal]);

  const loadSample = useCallback((goal: AnalysisGoal = analysisGoal) => {
    const sample = buildSampleData(goal);
    applyGoalPlan(sample, goal);
    setStatusText(`已载入 ${ANALYSIS_GOALS[goal].label} 示例数据。`);
  }, [analysisGoal, applyGoalPlan]);

  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(89,118,157,0.10),_transparent_34%),linear-gradient(180deg,_#f7f9fc_0%,_#eef3f8_100%)] text-slate-900">
      <header className="z-40 border-b border-slate-200/70 bg-white/78 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between gap-4 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm shadow-slate-950/10">
              <LayoutGrid className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight text-slate-950">SciPlot</div>
              <div className="text-xs text-slate-500">中文优先 · 轻量科研出图</div>
            </div>
          </div>
          <div className="hidden flex-1 items-center justify-center gap-2 text-xs text-slate-500 lg:flex">
            <span className="rounded-full bg-slate-100 px-3 py-1">导入入口层</span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">workspace</span>
            <span>→</span>
            <span className="rounded-full bg-slate-100 px-3 py-1">导出</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setStage("entry")} className="hidden sm:inline-flex">
              返回导入
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportWorkspaceSnapshot(data, config, analysisGoal)} disabled={!hasData}>
              <ArrowDownToLine className="mr-1.5 h-4 w-4" />
              导出配置
            </Button>
            <Button size="sm" onClick={handleReset} className="bg-slate-950 text-white hover:bg-slate-800">
              重置视图
            </Button>
          </div>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.tsv,.txt,.xls,.xlsx"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleFileImport(file);
          }
          event.target.value = "";
        }}
      />

      {stage === "entry" ? (
        <main className="entry-tight mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-col justify-center px-4 py-4 lg:px-6">
          <section className="mx-auto grid w-full max-w-6xl gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-4">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm shadow-slate-950/5 ring-1 ring-slate-200/80">
                  <FlaskConical className="h-3.5 w-3.5 text-slate-700" />
                  轻量 · 中文优先 · 自动首图
                </div>
                <div>
                  <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">
                    上传表格，自动得到适合科研阅读的图。
                  </h1>
                  <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                    先选分析目标，再让系统根据字段类型自动推荐图表；你仍然可以随时改字段、改样式、换推荐。
                  </p>
                </div>
              </div>

              <div className="entry-chip-row grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
                {[
                  "CSV / XLSX 直接导入",
                  "示例数据一键进入工作区",
                  "粘贴小表格，秒级解析",
                ].map((item) => (
                  <div key={item} className="rounded-2xl bg-white/85 px-3 py-2 shadow-sm shadow-slate-950/5 ring-1 ring-slate-200/80">
                    {item}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={openFilePicker}
                className="entry-card group rounded-[1.5rem] bg-white p-4 text-left shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_56px_rgba(15,23,42,0.10)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">导入一</div>
                    <div className="entry-card-title mt-1 text-xl font-semibold tracking-tight text-slate-950">上传 CSV / XLSX</div>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">选择本地表格后自动识别表头、字段类型和分析目标。</p>
                  </div>
                  <div className="rounded-2xl bg-slate-950 p-3 text-white shadow-sm shadow-slate-950/15">
                    <Upload className="h-5 w-5" />
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => loadSample(analysisGoal)}
                className="entry-card group rounded-[1.5rem] bg-slate-950 p-4 text-left text-white shadow-[0_16px_48px_rgba(15,23,42,0.18)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(15,23,42,0.22)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-white/55">导入二</div>
                    <div className="entry-card-title mt-1 text-xl font-semibold tracking-tight">加载示例数据</div>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-white/72">先用示例进入 workspace，再替换成真实数据。</p>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-3 text-white ring-1 ring-white/10">
                    <Play className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/80">
                  {GOAL_ORDER.map((goal) => (
                    <span key={goal} className="rounded-full bg-white/10 px-3 py-1">
                      {ANALYSIS_GOALS[goal].label}
                    </span>
                  ))}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setShowPastePanel((value) => !value)}
                className="entry-card group rounded-[1.5rem] bg-white/90 p-4 text-left shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_56px_rgba(15,23,42,0.10)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">导入三</div>
                    <div className="entry-card-title mt-1 text-xl font-semibold tracking-tight text-slate-950">粘贴数据</div>
                    <p className="mt-1 max-w-sm text-sm leading-6 text-slate-600">直接粘贴 CSV / TSV 内容，适合临时处理小表格。</p>
                  </div>
                  <div className="rounded-2xl bg-slate-100 p-3 text-slate-700 ring-1 ring-slate-200/80">
                    <WandSparkles className="h-5 w-5" />
                  </div>
                </div>
              </button>

              {showPastePanel && (
                <div className="rounded-[1.5rem] bg-white p-3 shadow-[0_16px_48px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80">
                  <div className="text-sm font-medium text-slate-700">粘贴 CSV / TSV 数据</div>
                  <Textarea
                    value={pasteText}
                    onChange={(event) => setPasteText(event.target.value)}
                    placeholder={"Time,ValueA,ValueB\n0,1.2,2.3\n1,1.8,2.9"}
                    className="mt-3 min-h-32 resize-none border-slate-200 bg-slate-50/80 font-mono text-xs text-slate-700 shadow-none focus-visible:ring-slate-300"
                  />
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">支持逗号或制表符分隔，小表格更适合直接粘贴。</p>
                    <Button onClick={handleEntryPaste} className="bg-slate-950 text-white hover:bg-slate-800">
                      解析并进入 workspace
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
        <main className="mx-auto grid h-full min-h-0 w-full max-w-[1680px] grid-cols-1 gap-4 overflow-hidden px-4 py-4 xl:grid-cols-[320px_minmax(0,1fr)_340px] xl:px-6">
          <aside className="min-h-0 overflow-y-auto pr-1">
            <Suspense fallback={<div className="h-full rounded-[1.5rem] bg-white/80 ring-1 ring-slate-200/80" />}>
              <DataEditor
                data={data}
                profile={profile}
                analysisGoal={analysisGoal}
                onAnalysisGoalChange={handleGoalChange}
                mapping={{ xAxisColumn: config.xAxisColumn, selectedColumns: config.selectedColumns }}
                onMappingChange={(mapping) => {
                  setConfig((prev) => ({
                    ...prev,
                    xAxisColumn: mapping.xAxisColumn,
                    selectedColumns: mapping.selectedColumns.filter((index) => index !== mapping.xAxisColumn),
                  }));
                }}
                onDataChange={handleDataChange}
                onRequestImport={openFilePicker}
                onRequestSample={() => loadSample(analysisGoal)}
                statusText={statusText}
                onStatusChange={setStatusText}
              />
            </Suspense>
          </aside>

          <section className="min-h-0">
            <Suspense fallback={<div className="h-full rounded-[1.5rem] bg-white/80 ring-1 ring-slate-200/80" />}>
              <ChartPreview
                data={data}
                config={config}
                recommendations={recommendations}
                onApplyRecommendation={handleRecommendation}
              />
            </Suspense>
          </section>

          <aside className="min-h-0 overflow-y-auto pl-1">
            <Suspense fallback={<div className="h-full rounded-[1.5rem] bg-white/80 ring-1 ring-slate-200/80" />}>
              <ChartConfigPanel
                config={config}
                onConfigChange={setConfig}
                recommendations={recommendations}
                datasetProfile={profile}
                analysisGoal={analysisGoal}
                onAnalysisGoalChange={handleGoalChange}
                onApplyRecommendation={handleRecommendation}
                onRestoreRecommendedDefaults={() =>
                  handleRecommendation({
                    chartType: plan.chartType,
                    xAxisColumn: plan.xAxisColumn,
                    selectedColumns: plan.selectedColumns,
                    xAxisLabel: plan.xAxisLabel,
                    yAxisLabel: plan.yAxisLabel,
                  })
                }
                onExportSnapshot={() => exportWorkspaceSnapshot(data, config, analysisGoal)}
              />
            </Suspense>
          </aside>
        </main>
      )}

      {stage === "workspace" ? (
        <footer className="mx-auto flex w-full max-w-[1680px] items-center justify-between px-4 py-2 text-[11px] text-slate-500 lg:px-6">
          <span className="truncate pr-3">{statusText}</span>
          <span className="shrink-0">自动优先 · 只要导入数据就可以开始</span>
        </footer>
      ) : null}
    </div>
  );
}






