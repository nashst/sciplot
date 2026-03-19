import { memo, useMemo, useRef } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import {
  BarChart,
  BoxplotChart,
  CustomChart,
  HeatmapChart,
  LineChart,
  PieChart,
  RadarChart,
  ScatterChart,
} from "echarts/charts";
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkLineComponent,
  RadarComponent,
  TitleComponent,
  TooltipComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buildChart, type ParsedData } from "@/lib/chartEngine";
import { type ChartConfig, type ChartType } from "@shared/schema";
import { ArrowRight, Download } from "lucide-react";
import type { EChartsOption } from "echarts";

echarts.use([
  LineChart,
  ScatterChart,
  BarChart,
  HeatmapChart,
  BoxplotChart,
  PieChart,
  RadarChart,
  CustomChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  DataZoomComponent,
  RadarComponent,
  MarkLineComponent,
  CanvasRenderer,
  SVGRenderer,
]);

type AnalysisGoal = "distribution" | "trend" | "relationship" | "comparison";

export interface GalleryCandidateItem {
  id: string;
  chartType: ChartType;
  title: string;
  reason: string;
  config: ChartConfig;
  supported?: boolean;
}

export interface GalleryCandidateGroup {
  goal: AnalysisGoal;
  label: string;
  items: GalleryCandidateItem[];
}

export interface ProfilingPanelData {
  missingCells: number;
  missingRate: number;
  duplicateRows: number;
  duplicateRate: number;
  constantColumns: number;
  numericHighlights: Array<{
    name: string;
    mean: number;
    std: number;
    min: number;
    max: number;
    missingRate: number;
  }>;
  categoryHighlights: Array<{
    name: string;
    uniqueCount: number;
    missingRate: number;
    topValues: string[];
  }>;
  correlationHighlights: Array<{
    pair: string;
    value: number;
  }>;
}

interface AutoChartGalleryProps {
  data: ParsedData;
  datasetSummary: {
    rowCount: number;
    columnCount: number;
    numericCount: number;
    datetimeCount: number;
    categoryCount: number;
  };
  profilingPanel: ProfilingPanelData;
  groupedCandidates: GalleryCandidateGroup[];
  onEditChart: (id: string) => void;
  onQuickExport: (id: string) => void;
  quickExportingId?: string | null;
}

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function buildHistogramOption(data: ParsedData, config: ChartConfig): EChartsOption {
  const columnIndex = Math.min(config.xAxisColumn, Math.max(0, data.headers.length - 1));
  const values = data.rows
    .map((row) => parseNumeric(row[columnIndex]))
    .filter((value): value is number => value !== null);

  if (!values.length) {
    return {
      title: { text: "无可用数值列", left: "center", top: "middle", textStyle: { color: "#64748b", fontSize: 12 } },
      backgroundColor: "#ffffff",
    };
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const bins = Math.max(6, Math.min(14, Math.round(Math.sqrt(values.length)) || 6));
  const width = (max - min || 1) / bins;
  const bucket = Array.from({ length: bins }, () => 0);

  values.forEach((value) => {
    const idx = Math.max(0, Math.min(bins - 1, Math.floor((value - min) / width)));
    bucket[idx] += 1;
  });

  const labels = bucket.map((_, i) => {
    const left = min + i * width;
    const right = i === bins - 1 ? max : min + (i + 1) * width;
    const precision = Math.abs(width) < 1 ? 2 : 1;
    return `${left.toFixed(precision)}-${right.toFixed(precision)}`;
  });

  return {
    backgroundColor: "#ffffff",
    animation: false,
    grid: { top: 16, left: 30, right: 12, bottom: 28, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#64748b", fontSize: 10, interval: 0, rotate: 20 },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#64748b", fontSize: 10 },
      splitLine: { lineStyle: { color: "rgba(148,163,184,0.2)" } },
    },
    series: [
      {
        type: "bar",
        data: bucket,
        barMaxWidth: 22,
        itemStyle: { color: config.colors[0], borderRadius: [4, 4, 0, 0] },
      },
    ],
  };
}

const GOAL_DESCRIPTIONS: Record<AnalysisGoal, string> = {
  distribution: "查看单变量分布、离群点与偏态",
  trend: "查看随时间或顺序的变化轨迹",
  relationship: "查看变量之间相关关系与结构",
  comparison: "查看分组差异与组间对比",
};

const CHART_TYPE_NAME: Partial<Record<ChartType, string>> = {
  line: "折线图",
  scatter: "散点图",
  bar: "柱状图",
  barH: "条形图",
  histogram: "直方图",
  boxplot: "箱线图",
  violin: "小提琴图",
  pie: "饼图",
  area: "面积图",
  heatmap: "热力图",
  radar: "雷达图",
};

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

const GalleryCard = memo(function GalleryCard({
  data,
  item,
  goalLabel,
  onEdit,
  onQuickExport,
  exporting,
}: {
  data: ParsedData;
  item: GalleryCandidateItem;
  goalLabel?: string;
  onEdit: () => void;
  onQuickExport: () => void;
  exporting: boolean;
}) {
  const chartRef = useRef<ReactEChartsCore>(null);
  const available = item.supported !== false;

  const option = useMemo<EChartsOption>(() => {
    if (item.chartType === "histogram") return buildHistogramOption(data, item.config);
    return buildChart(item.chartType, data, item.config);
  }, [data, item.chartType, item.config]);

  const quickExport = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    onQuickExport();
    const url = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${item.title || "自动图表"}.png`;
    anchor.click();
  };

  return (
    <article className={["rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 shadow-[0_12px_34px_rgba(15,23,42,0.06)]", available ? "" : "opacity-55"].join(" ")}>
      <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-2">
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={option}
          notMerge
          lazyUpdate
          opts={{ renderer: "canvas" }}
          style={{ width: "100%", height: 180 }}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {goalLabel ? <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600">{goalLabel}</span> : null}
          <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">{CHART_TYPE_NAME[item.chartType] ?? "图表"}</Badge>
        </div>
        {available ? null : <span className="text-[10px] font-medium text-slate-400">当前映射不完全匹配</span>}
      </div>

      <h3 className="mt-2 text-sm font-semibold leading-5 text-slate-900">{item.title}</h3>
      <p className="mt-1 text-xs leading-5 text-slate-600 line-clamp-2">{item.reason}</p>

      <div className="mt-3 flex items-center gap-2">
        <Button
          size="sm"
          onClick={onEdit}
          disabled={!available}
          className="h-8 bg-slate-950 text-white hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500"
        >
          编辑此图
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={quickExport} disabled={exporting} className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {exporting ? "导出中" : "快速导出"}
        </Button>
      </div>
    </article>
  );
});

export const AutoChartGallery = memo(function AutoChartGallery({
  data,
  datasetSummary,
  profilingPanel,
  groupedCandidates,
  onEditChart,
  onQuickExport,
  quickExportingId,
}: AutoChartGalleryProps) {
  const numericRows = profilingPanel.numericHighlights.slice(0, 3);
  const categoryRows = profilingPanel.categoryHighlights.slice(0, 3);
  const corrRows = profilingPanel.correlationHighlights.slice(0, 3);

  return (
    <section className="rounded-[1.6rem] bg-white/92 p-4 ring-1 ring-slate-200/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium tracking-[0.18em] text-slate-400">自动生成图表画廊</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">自动探索与数据画像</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">参考 pandas profiling / ydata-profiling 思路，先给出数据质量和变量画像，再提供多目标图表候选。</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">{datasetSummary.rowCount} 行</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{datasetSummary.columnCount} 列</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">数值 {datasetSummary.numericCount}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">时间 {datasetSummary.datetimeCount}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">分类 {datasetSummary.categoryCount}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] text-slate-500">缺失值</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{profilingPanel.missingCells}</div>
          <div className="text-xs text-slate-500">占比 {formatPercent(profilingPanel.missingRate)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] text-slate-500">重复行</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{profilingPanel.duplicateRows}</div>
          <div className="text-xs text-slate-500">占比 {formatPercent(profilingPanel.duplicateRate)}</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] text-slate-500">常量列</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">{profilingPanel.constantColumns}</div>
          <div className="text-xs text-slate-500">推荐检查是否需要剔除</div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] text-slate-500">最强相关</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">
            {corrRows[0] ? `${corrRows[0].pair}` : "暂无"}
          </div>
          <div className="text-xs text-slate-500">
            {corrRows[0] ? `|r|=${Math.abs(corrRows[0].value).toFixed(3)}` : "需要至少两列数值"}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50 p-3 ring-1 ring-slate-200/70">
          <div className="text-[11px] text-slate-500">候选图数量</div>
          <div className="mt-1 text-lg font-semibold text-slate-900">
            {groupedCandidates.reduce((sum, group) => sum + group.items.length, 0)}
          </div>
          <div className="text-xs text-slate-500">按分析目标分组</div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        <div className="rounded-2xl bg-slate-50/85 p-3 ring-1 ring-slate-200/70">
          <div className="text-xs font-semibold text-slate-700">数值变量画像</div>
          <div className="mt-2 space-y-2">
            {numericRows.length ? numericRows.map((item) => (
              <div key={item.name} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                <div className="text-xs font-medium text-slate-800">{item.name}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  mean {item.mean.toFixed(3)} · std {item.std.toFixed(3)} · [{item.min.toFixed(3)}, {item.max.toFixed(3)}]
                </div>
              </div>
            )) : <div className="text-xs text-slate-500">暂无数值变量</div>}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50/85 p-3 ring-1 ring-slate-200/70">
          <div className="text-xs font-semibold text-slate-700">分类变量画像</div>
          <div className="mt-2 space-y-2">
            {categoryRows.length ? categoryRows.map((item) => (
              <div key={item.name} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                <div className="text-xs font-medium text-slate-800">{item.name}</div>
                <div className="mt-1 text-[11px] text-slate-500">
                  唯一值 {item.uniqueCount} · 缺失 {formatPercent(item.missingRate)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 truncate">{item.topValues.join(" | ") || "无频次信息"}</div>
              </div>
            )) : <div className="text-xs text-slate-500">暂无分类变量</div>}
          </div>
        </div>
        <div className="rounded-2xl bg-slate-50/85 p-3 ring-1 ring-slate-200/70">
          <div className="text-xs font-semibold text-slate-700">相关性速览</div>
          <div className="mt-2 space-y-2">
            {corrRows.length ? corrRows.map((item) => (
              <div key={item.pair} className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                <div className="text-xs font-medium text-slate-800">{item.pair}</div>
                <div className="mt-1 text-[11px] text-slate-500">Pearson r = {item.value.toFixed(3)}</div>
              </div>
            )) : <div className="text-xs text-slate-500">暂无可计算相关性</div>}
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {groupedCandidates.map((group) => (
          <section key={group.goal} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
              <p className="text-xs text-slate-500">{GOAL_DESCRIPTIONS[group.goal]}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <GalleryCard
                  key={item.id}
                  data={data}
                  item={item}
                  goalLabel={group.label}
                  onEdit={() => onEditChart(item.id)}
                  onQuickExport={() => onQuickExport(item.id)}
                  exporting={quickExportingId === item.id}
                />
              ))}
            </div>
          </section>
        ))}
        {groupedCandidates.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-6 text-sm text-slate-500">
            当前数据暂时无法生成可用基础图，请先检查字段类型或补充数据。
          </div>
        ) : null}
      </div>
    </section>
  );
});
