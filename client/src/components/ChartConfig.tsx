import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { colorThemes, type ChartConfig, type ChartType, chartTypeLabels } from "@shared/schema";
import type { DatasetProfile } from "@/lib/autoInsights";
import { ArrowRight, BarChart3, Brush, CheckCircle2, Gauge, Layers3, Sigma } from "lucide-react";

type AnalysisGoal = "distribution" | "trend" | "relationship" | "comparison";

type RecommendationCard = {
  chartType: ChartType;
  title: string;
  reason: string;
  supported: boolean;
  patch: Pick<ChartConfig, "chartType" | "xAxisColumn" | "selectedColumns" | "xAxisLabel" | "yAxisLabel">;
};

interface ChartConfigPanelProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  recommendations: RecommendationCard[];
  datasetProfile: DatasetProfile;
  analysisGoal: AnalysisGoal;
  onAnalysisGoalChange: (goal: AnalysisGoal) => void;
  onApplyRecommendation: (patch: RecommendationCard["patch"]) => void;
  onRestoreRecommendedDefaults: () => void;
  onExportSnapshot: () => void;
}

const GOAL_TEXT: Record<AnalysisGoal, { label: string; hint: string }> = {
  distribution: { label: "分布", hint: "先看单变量分布、离群值和偏态" },
  trend: { label: "趋势", hint: "先看时间序列或顺序变化" },
  relationship: { label: "关系", hint: "先看变量间相关性" },
  comparison: { label: "对比", hint: "先看不同组之间的差异" },
};

function updateConfig(
  config: ChartConfig,
  onConfigChange: (config: ChartConfig) => void,
  patch: Partial<ChartConfig>,
) {
  onConfigChange({ ...config, ...patch });
}

function columnTypeSummary(profile: DatasetProfile) {
  const numeric = profile.columns.filter((column) => column.kind === "numeric").length;
  const datetime = profile.columns.filter((column) => column.kind === "datetime").length;
  const categorical = profile.columns.filter((column) => column.kind === "categorical").length;
  return { numeric, datetime, categorical };
}

export const ChartConfigPanel = memo(function ChartConfigPanel({
  config,
  onConfigChange,
  recommendations,
  datasetProfile,
  analysisGoal,
  onAnalysisGoalChange,
  onApplyRecommendation,
  onRestoreRecommendedDefaults,
  onExportSnapshot,
}: ChartConfigPanelProps) {
  const summary = useMemo(() => columnTypeSummary(datasetProfile), [datasetProfile]);
  const setPartial = (patch: Partial<ChartConfig>) => updateConfig(config, onConfigChange, patch);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
            <Gauge className="h-3.5 w-3.5 text-slate-700" />
            右侧控制区
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">建议 / 样式 / 统计</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">右侧面板尽量收敛，优先放推荐、样式修订和数据统计。</p>
        </div>
        <Button variant="outline" size="sm" onClick={onExportSnapshot} className="h-8 border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
          导出配置
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
        <span className="rounded-full bg-slate-100 px-3 py-1">{datasetProfile.rowCount} 行</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">{datasetProfile.columnCount} 列</span>
        <span className="rounded-full bg-slate-100 px-3 py-1">{GOAL_TEXT[analysisGoal].label} 模式</span>
      </div>

      <Tabs defaultValue="suggestions" className="mt-4 flex min-h-0 flex-1 flex-col">
        <TabsList className="grid grid-cols-3 bg-slate-100/80 p-1 text-slate-500">
          <TabsTrigger value="suggestions" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950">
            建议
          </TabsTrigger>
          <TabsTrigger value="style" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950">
            样式
          </TabsTrigger>
          <TabsTrigger value="statistics" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950">
            统计
          </TabsTrigger>
        </TabsList>

        <TabsContent value="suggestions" className="mt-4 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">当前分析目标</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{GOAL_TEXT[analysisGoal].label}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{GOAL_TEXT[analysisGoal].hint}</p>
                  </div>
                  <Badge variant="outline" className="border-transparent bg-white text-slate-700 ring-1 ring-slate-200/70">
                    {chartTypeLabels[config.chartType]}
                  </Badge>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(Object.keys(GOAL_TEXT) as AnalysisGoal[]).map((goal) => {
                    const active = goal === analysisGoal;
                    return (
                      <button
                        key={goal}
                        type="button"
                        onClick={() => onAnalysisGoalChange(goal)}
                        className={`rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-all ${
                          active
                            ? "bg-slate-950 text-white ring-slate-950"
                            : "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {GOAL_TEXT[goal].label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">推荐图表</div>
                  <button type="button" className="text-[11px] text-slate-500 hover:text-slate-950" onClick={onRestoreRecommendedDefaults}>
                    恢复推荐默认
                  </button>
                </div>
                <div className="space-y-2">
                  {recommendations.map((item) => {
                    const active = item.chartType === config.chartType;
                    return (
                      <button
                        key={item.chartType}
                        type="button"
                        onClick={() => onApplyRecommendation(item.patch)}
                        className={`w-full rounded-2xl p-3 text-left ring-1 transition-all ${
                          active
                            ? "bg-slate-950 text-white ring-slate-950"
                            : item.supported
                              ? "bg-white text-slate-700 ring-slate-200 hover:bg-slate-50"
                              : "bg-slate-100 text-slate-400 ring-slate-200"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold">{item.title}</div>
                            <div className={`mt-1 text-xs leading-5 ${active ? "text-white/75" : "text-slate-500"}`}>{item.reason}</div>
                          </div>
                          <ArrowRight className="h-4 w-4 shrink-0 opacity-70" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="style" className="mt-4 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <BarChart3 className="h-3.5 w-3.5" />
                  标题与坐标
                </div>
                <div className="mt-3 space-y-3">
                  <Input
                    value={config.title}
                    onChange={(event) => setPartial({ title: event.target.value })}
                    placeholder="图表标题"
                    className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                  />
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Input
                      value={config.xAxisLabel}
                      onChange={(event) => setPartial({ xAxisLabel: event.target.value })}
                      placeholder="X 轴标题"
                      className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                    />
                    <Input
                      value={config.yAxisLabel}
                      onChange={(event) => setPartial({ yAxisLabel: event.target.value })}
                      placeholder="Y 轴标题"
                      className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <Brush className="h-3.5 w-3.5" />
                  视觉风格
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <Select value={config.stylePreset} onValueChange={(value) => setPartial({ stylePreset: value })}>
                    <SelectTrigger className="h-9 border-slate-200 bg-white text-xs text-slate-700 shadow-none">
                      <SelectValue placeholder="风格预设" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">默认</SelectItem>
                      <SelectItem value="academic">学术</SelectItem>
                      <SelectItem value="clear">清爽</SelectItem>
                      <SelectItem value="nature">Nature</SelectItem>
                      <SelectItem value="science">Science</SelectItem>
                      <SelectItem value="cell">Cell</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={config.colorTheme} onValueChange={(value) => {
                    const theme = colorThemes[value];
                    setPartial({ colorTheme: value, colors: theme?.colors ?? config.colors });
                  }}>
                    <SelectTrigger className="h-9 border-slate-200 bg-white text-xs text-slate-700 shadow-none">
                      <SelectValue placeholder="配色方案" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(colorThemes).map(([key, theme]) => {
                        const themeInfo = theme as { label: string };
                        return (
                          <SelectItem key={key} value={key} className="text-xs">
                            {themeInfo.label}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <span className="text-xs text-slate-600">显示图例</span>
                    <Switch checked={config.showLegend} onCheckedChange={(checked) => setPartial({ showLegend: checked })} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <span className="text-xs text-slate-600">显示网格</span>
                    <Switch checked={config.showGrid} onCheckedChange={(checked) => setPartial({ showGrid: checked })} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <span className="text-xs text-slate-600">显示点标记</span>
                    <Switch checked={config.showSymbol} onCheckedChange={(checked) => setPartial({ showSymbol: checked })} />
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <span className="text-xs text-slate-600">平滑曲线</span>
                    <Switch checked={config.smooth} onCheckedChange={(checked) => setPartial({ smooth: checked })} />
                  </div>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <Layers3 className="h-3.5 w-3.5" />
                  绘图参数
                </div>
                <div className="mt-3 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>点大小</span>
                      <span>{config.symbolSize}</span>
                    </div>
                    <Slider value={[config.symbolSize]} min={2} max={16} step={1} onValueChange={([value]) => setPartial({ symbolSize: value })} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>线宽</span>
                      <span>{config.lineWidth}</span>
                    </div>
                    <Slider value={[config.lineWidth]} min={0.5} max={5} step={0.5} onValueChange={([value]) => setPartial({ lineWidth: value })} />
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>字体大小</span>
                      <span>{config.fontSize}px</span>
                    </div>
                    <Slider value={[config.fontSize]} min={10} max={20} step={1} onValueChange={([value]) => setPartial({ fontSize: value })} />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4 min-h-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-3">
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <Sigma className="h-3.5 w-3.5" />
                  数据统计
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">数值列</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{summary.numeric}</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">时间列</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{summary.datetime}</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">分类列</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{summary.categorical}</div>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-slate-400">缺失提示</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{datasetProfile.warnings.length}</div>
                  </div>
                </div>
                {datasetProfile.warnings.length > 0 && (
                  <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm leading-6 text-amber-900 ring-1 ring-amber-200/70">
                    {datasetProfile.warnings[0]}
                  </div>
                )}
              </div>

              <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  当前映射
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    X 轴：{datasetProfile.columns.find((column) => column.index === config.xAxisColumn)?.name ?? "未选择"}
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    Y 轴：{config.selectedColumns.length > 0 ? config.selectedColumns.map((index) => datasetProfile.columns.find((column) => column.index === index)?.name).filter(Boolean).join("、") : "未选择"}
                  </div>
                  <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                    当前图：{chartTypeLabels[config.chartType]} · {GOAL_TEXT[analysisGoal].label} 模式
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>
    </div>
  );
});


