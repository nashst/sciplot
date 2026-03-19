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
import { chartTypeLabels, type ChartConfig, type ChartType } from "@shared/schema";
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
}

export interface GalleryCandidateGroup {
  goal: AnalysisGoal;
  label: string;
  items: GalleryCandidateItem[];
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
    const p = Math.abs(width) < 1 ? 2 : 1;
    return `${left.toFixed(p)}-${right.toFixed(p)}`;
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
    series: [{ type: "bar", data: bucket, barMaxWidth: 22, itemStyle: { color: config.colors[0], borderRadius: [4, 4, 0, 0] } }],
  };
}

const GoalDescriptions: Record<AnalysisGoal, string> = {
  distribution: "查看单变量分布与离群点",
  trend: "查看随时间或顺序的变化",
  relationship: "查看数值变量之间关系",
  comparison: "查看分组之间差异",
};

const GalleryCard = memo(function GalleryCard({
  data,
  item,
  onEdit,
  onQuickExport,
  exporting,
}: {
  data: ParsedData;
  item: GalleryCandidateItem;
  onEdit: () => void;
  onQuickExport: () => void;
  exporting: boolean;
}) {
  const chartRef = useRef<ReactEChartsCore>(null);

  const option = useMemo<EChartsOption>(() => {
    if (item.chartType === "histogram") {
      return buildHistogramOption(data, item.config);
    }
    return buildChart(item.chartType, data, item.config);
  }, [data, item.chartType, item.config]);

  const quickExport = () => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;
    onQuickExport();
    const url = instance.getDataURL({ type: "png", pixelRatio: 2, backgroundColor: "#ffffff" });
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title || "sciplot-chart"}.png`;
    a.click();
  };

  return (
    <article className="rounded-2xl bg-white p-3 ring-1 ring-slate-200/80 shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
      <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-2">
        <ReactEChartsCore
          ref={chartRef}
          echarts={echarts}
          option={option}
          notMerge
          lazyUpdate
          opts={{ renderer: "canvas" }}
          style={{ width: "100%", height: 190 }}
        />
      </div>

      <div className="mt-3 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-900 leading-5">{item.title}</h3>
        <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
          {chartTypeLabels[item.chartType]}
        </Badge>
      </div>

      <p className="mt-2 text-xs leading-5 text-slate-600 line-clamp-2">{item.reason}</p>

      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" onClick={onEdit} className="h-8 bg-slate-950 text-white hover:bg-slate-800">
          Edit this chart
          <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
        </Button>
        <Button variant="outline" size="sm" onClick={quickExport} disabled={exporting} className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {exporting ? "Exporting" : "Quick export"}
        </Button>
      </div>
    </article>
  );
});

export const AutoChartGallery = memo(function AutoChartGallery({
  data,
  datasetSummary,
  groupedCandidates,
  onEditChart,
  onQuickExport,
  quickExportingId,
}: AutoChartGalleryProps) {
  return (
    <section className="rounded-[1.6rem] bg-white/92 p-4 ring-1 ring-slate-200/80 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Auto-Generated Charts</div>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">自动探索图表画廊</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">系统按分析目标自动生成多张基础图。可直接导出，或进入下方精修。</p>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-600">
          <span className="rounded-full bg-slate-100 px-3 py-1">{datasetSummary.rowCount} 行</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">{datasetSummary.columnCount} 列</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">数值 {datasetSummary.numericCount}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">时间 {datasetSummary.datetimeCount}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1">分类 {datasetSummary.categoryCount}</span>
        </div>
      </div>

      <div className="mt-4 space-y-6">
        {groupedCandidates.map((group) => (
          <section key={group.goal} className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">{group.label}</h3>
              <p className="text-xs text-slate-500">{GoalDescriptions[group.goal]}</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {group.items.map((item) => (
                <GalleryCard
                  key={item.id}
                  data={data}
                  item={item}
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
