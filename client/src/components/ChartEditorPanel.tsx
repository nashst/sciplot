import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { colorThemes, type ChartConfig, chartTypeLabels } from "@shared/schema";
import { BarChart3, Brush, Download, Hash, Sigma, Sparkles, Type } from "lucide-react";

interface ChartEditorPanelProps {
  config: ChartConfig;
  onConfigChange: (next: ChartConfig) => void;
  onResetStyle: () => void;
  onResetStatistics: () => void;
  onExportPNG: () => void;
  onExportSVG: () => void;
  onExportSnapshot: () => void;
  datasetMeta: {
    rowCount: number;
    columnCount: number;
  };
}

function updateConfig(
  config: ChartConfig,
  onConfigChange: (next: ChartConfig) => void,
  patch: Partial<ChartConfig>,
) {
  onConfigChange({ ...config, ...patch });
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export const ChartEditorPanel = memo(function ChartEditorPanel({
  config,
  onConfigChange,
  onResetStyle,
  onResetStatistics,
  onExportPNG,
  onExportSVG,
  onExportSnapshot,
  datasetMeta,
}: ChartEditorPanelProps) {
  const activeTheme = useMemo(() => colorThemes[config.colorTheme], [config.colorTheme]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-[1.5rem] bg-white/92 p-4 shadow-[0_18px_60px_rgba(15,23,42,0.08)] ring-1 ring-slate-200/80 backdrop-blur-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">
            <Sparkles className="h-3.5 w-3.5 text-slate-700" />
            编辑区
          </div>
          <h2 className="mt-2 text-lg font-semibold tracking-tight text-slate-950">Chart Editor</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500">聚焦单个图表的样式、统计、注释和导出。</p>
        </div>
        <Badge variant="outline" className="border-transparent bg-slate-100 text-slate-700 ring-1 ring-slate-200/70">
          {datasetMeta.rowCount} 行 · {datasetMeta.columnCount} 列
        </Badge>
      </div>

      <Tabs defaultValue="style" className="mt-4 flex min-h-0 flex-1 flex-col">
        <TabsList className="grid grid-cols-4 bg-slate-100/80 p-1 text-slate-500">
          <TabsTrigger value="style" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950">
            Style
          </TabsTrigger>
          <TabsTrigger value="statistics" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950">
            Statistics
          </TabsTrigger>
          <TabsTrigger value="annotations" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950">
            Annotations
          </TabsTrigger>
          <TabsTrigger value="export" className="text-xs data-[state=active]:bg-white data-[state=active]:text-slate-950">
            Export
          </TabsTrigger>
        </TabsList>

        <TabsContent value="style" className="mt-4 min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <BarChart3 className="h-3.5 w-3.5" />
                标题与坐标
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  value={config.title}
                  onChange={(event) => updateConfig(config, onConfigChange, { title: event.target.value })}
                  placeholder="图表标题"
                  className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={config.xAxisLabel}
                    onChange={(event) => updateConfig(config, onConfigChange, { xAxisLabel: event.target.value })}
                    placeholder="X 轴标题"
                    className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                  />
                  <Input
                    value={config.yAxisLabel}
                    onChange={(event) => updateConfig(config, onConfigChange, { yAxisLabel: event.target.value })}
                    placeholder="Y 轴标题"
                    className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <Brush className="h-3.5 w-3.5" />
                主题 / 图例 / 网格
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <Select value={config.stylePreset} onValueChange={(value) => updateConfig(config, onConfigChange, { stylePreset: value })}>
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
                <Select
                  value={config.colorTheme}
                  onValueChange={(value) => {
                    const theme = colorThemes[value];
                    updateConfig(config, onConfigChange, { colorTheme: value, colors: theme?.colors ?? config.colors });
                  }}
                >
                  <SelectTrigger className="h-9 border-slate-200 bg-white text-xs text-slate-700 shadow-none">
                    <SelectValue placeholder="配色方案" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(colorThemes).map(([key, theme]) => (
                      <SelectItem key={key} value={key} className="text-xs">
                        {theme.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span className="text-xs text-slate-600">显示图例</span>
                  <Switch checked={config.showLegend} onCheckedChange={(checked) => updateConfig(config, onConfigChange, { showLegend: checked })} />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span className="text-xs text-slate-600">显示网格</span>
                  <Switch checked={config.showGrid} onCheckedChange={(checked) => updateConfig(config, onConfigChange, { showGrid: checked })} />
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <Type className="h-3.5 w-3.5" />
                点大小 / 线宽 / 字体
              </div>
              <div className="mt-3 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>点大小</span>
                    <span>{config.symbolSize}</span>
                  </div>
                  <Slider value={[config.symbolSize]} min={2} max={16} step={1} onValueChange={([value]) => updateConfig(config, onConfigChange, { symbolSize: value })} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>线宽</span>
                    <span>{config.lineWidth}</span>
                  </div>
                  <Slider value={[config.lineWidth]} min={0.5} max={5} step={0.5} onValueChange={([value]) => updateConfig(config, onConfigChange, { lineWidth: value })} />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>字体大小</span>
                    <span>{config.fontSize}px</span>
                  </div>
                  <Slider value={[config.fontSize]} min={10} max={20} step={1} onValueChange={([value]) => updateConfig(config, onConfigChange, { fontSize: clampNumber(value, 10, 20) })} />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="statistics" className="mt-4 min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                  <Sigma className="h-3.5 w-3.5" />
                  统计开关
                </div>
                <Button variant="ghost" size="sm" type="button" onClick={onResetStatistics} className="h-7 px-2 text-[11px] text-slate-500 hover:text-slate-950">
                  重置统计
                </Button>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span className="text-xs text-slate-600">回归线</span>
                  <Switch checked={config.showTrendLine} onCheckedChange={(checked) => updateConfig(config, onConfigChange, { showTrendLine: checked })} />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span className="text-xs text-slate-600">平滑线</span>
                  <Switch checked={config.smooth} onCheckedChange={(checked) => updateConfig(config, onConfigChange, { smooth: checked })} />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span className="text-xs text-slate-600">显著性</span>
                  <Switch checked={config.showSignificance} onCheckedChange={(checked) => updateConfig(config, onConfigChange, { showSignificance: checked })} />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                  <span className="text-xs text-slate-600">误差线</span>
                  <Select value={config.errorBarType} onValueChange={(value) => updateConfig(config, onConfigChange, { errorBarType: value as ChartConfig["errorBarType"] })}>
                    <SelectTrigger className="h-8 w-[110px] border-slate-200 bg-white text-xs text-slate-700 shadow-none">
                      <SelectValue placeholder="none" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">none</SelectItem>
                      <SelectItem value="sd">sd</SelectItem>
                      <SelectItem value="se">se</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="mt-3 rounded-xl bg-white px-3 py-2 ring-1 ring-slate-200/70">
                <div className="text-xs font-medium text-slate-600">参考线</div>
                <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr]">
                  <Input
                    value={config.referenceLine?.toString() ?? ""}
                    onChange={(event) => {
                      const next = event.target.value.trim();
                      updateConfig(config, onConfigChange, { referenceLine: next ? Number(next) : undefined });
                    }}
                    placeholder="参考线数值"
                    className="h-8 border-slate-200 bg-white text-xs shadow-none"
                  />
                  <Input
                    value={config.referenceLineLabel}
                    onChange={(event) => updateConfig(config, onConfigChange, { referenceLineLabel: event.target.value })}
                    placeholder="参考线标签"
                    className="h-8 border-slate-200 bg-white text-xs shadow-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="annotations" className="mt-4 min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <Hash className="h-3.5 w-3.5" />
                标题补充 / 注释文本
              </div>
              <div className="mt-3 space-y-3">
                <Input
                  value={config.title}
                  onChange={(event) => updateConfig(config, onConfigChange, { title: event.target.value })}
                  placeholder="标题补充"
                  className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                />
                <Textarea
                  value={config.referenceLineLabel}
                  onChange={(event) => updateConfig(config, onConfigChange, { referenceLineLabel: event.target.value })}
                  placeholder="注释文本或说明"
                  className="min-h-28 resize-none border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                />
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    value={config.xAxisLabel}
                    onChange={(event) => updateConfig(config, onConfigChange, { xAxisLabel: event.target.value })}
                    placeholder="X 轴标签"
                    className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                  />
                  <Input
                    value={config.yAxisLabel}
                    onChange={(event) => updateConfig(config, onConfigChange, { yAxisLabel: event.target.value })}
                    placeholder="Y 轴标签"
                    className="h-9 border-slate-200 bg-white text-xs shadow-none focus-visible:ring-slate-300"
                  />
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="export" className="mt-4 min-h-0 flex-1 overflow-hidden">
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50/80 p-4 ring-1 ring-slate-200/70">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                <Download className="h-3.5 w-3.5" />
                导出
              </div>
              <div className="mt-3 grid gap-2">
                <Button onClick={onExportPNG} className="justify-start bg-slate-950 text-white hover:bg-slate-800">
                  导出 PNG
                </Button>
                <Button variant="outline" onClick={onExportSVG} className="justify-start border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  导出 SVG
                </Button>
                <Button variant="outline" onClick={onExportSnapshot} className="justify-start border-slate-200 bg-white text-slate-700 hover:bg-slate-50">
                  导出快照
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
});
