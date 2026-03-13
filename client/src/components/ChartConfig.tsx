import { memo, useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chartTypes, chartTypeLabels, colorThemes, journalPresets, type ChartConfig, type ChartType } from "@shared/schema";
import {
  LineChart,
  ScatterChart,
  BarChart3,
  BarChartHorizontal,
  Grid3x3,
  BoxSelect,
  AreaChart,
  PieChart,
  Radar,
  AudioWaveform,
  Sparkles,
  Send,
} from "lucide-react";
import { detectColumnTypes, recommendChartType, type ParsedData } from "@/lib/chartEngine";

interface ChartConfigPanelProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  dataHeaders: string[];
  rawData: ParsedData;
}

const chartIcons: Record<ChartType, React.ReactNode> = {
  line: <LineChart className="w-4 h-4" />,
  scatter: <ScatterChart className="w-4 h-4" />,
  bar: <BarChart3 className="w-4 h-4" />,
  barH: <BarChartHorizontal className="w-4 h-4" />,
  area: <AreaChart className="w-4 h-4" />,
  pie: <PieChart className="w-4 h-4" />,
  radar: <Radar className="w-4 h-4" />,
  heatmap: <Grid3x3 className="w-4 h-4" />,
  boxplot: <BoxSelect className="w-4 h-4" />,
  violin: <AudioWaveform className="w-4 h-4" />,
};

const hasAxis = (t: ChartType) => !["pie", "radar", "heatmap", "boxplot", "violin"].includes(t);
const hasStack = (t: ChartType) => ["bar", "barH", "line", "area"].includes(t);
const hasSort = (t: ChartType) => ["bar", "barH"].includes(t);
const hasRefLine = (t: ChartType) => ["line", "bar", "barH", "area", "scatter"].includes(t);

// AI command processor
function processAICommand(cmd: string, config: ChartConfig): Partial<ChartConfig> | null {
  const lower = cmd.toLowerCase().trim();
  
  // Color commands
  if (lower.includes("nature") && (lower.includes("色") || lower.includes("配色") || lower.includes("color") || lower.includes("theme"))) {
    return { colorTheme: "nature", colors: colorThemes.nature.colors };
  }
  if (lower.includes("science") && (lower.includes("色") || lower.includes("配色") || lower.includes("color") || lower.includes("theme"))) {
    return { colorTheme: "science", colors: colorThemes.science.colors };
  }
  if (lower.includes("lancet") && (lower.includes("色") || lower.includes("配色") || lower.includes("color") || lower.includes("theme"))) {
    return { colorTheme: "lancet", colors: colorThemes.lancet.colors };
  }
  if (lower.includes("cell") && (lower.includes("色") || lower.includes("配色") || lower.includes("color") || lower.includes("theme"))) {
    return { colorTheme: "cell", colors: colorThemes.cell.colors };
  }
  
  // Style presets
  if (lower.includes("学术") || lower === "academic") return { stylePreset: "academic" };
  if (lower.includes("简洁") || lower === "clear" || lower === "minimal") return { stylePreset: "clear" };
  if (lower.includes("默认") || lower === "default") return { stylePreset: "default" };
  
  // Chart type
  if (lower.includes("折线") || lower === "line") return { chartType: "line" as ChartType };
  if (lower.includes("散点") || lower === "scatter") return { chartType: "scatter" as ChartType };
  if (lower.includes("柱状") || lower === "bar") return { chartType: "bar" as ChartType };
  if (lower.includes("条形") || lower === "barh") return { chartType: "barH" as ChartType };
  if (lower.includes("饼") || lower === "pie") return { chartType: "pie" as ChartType };
  if (lower.includes("箱线") || lower === "boxplot") return { chartType: "boxplot" as ChartType };
  if (lower.includes("小提琴") || lower === "violin") return { chartType: "violin" as ChartType };
  if (lower.includes("面积") || lower === "area") return { chartType: "area" as ChartType };
  if (lower.includes("雷达") || lower === "radar") return { chartType: "radar" as ChartType };
  if (lower.includes("热力") || lower === "heatmap") return { chartType: "heatmap" as ChartType };
  
  // Toggles
  if (lower.includes("趋势线") || lower.includes("trend")) return { showTrendLine: !config.showTrendLine };
  if (lower.includes("网格") || lower.includes("grid")) return { showGrid: !config.showGrid };
  if (lower.includes("图例") || lower.includes("legend")) return { showLegend: !config.showLegend };
  if (lower.includes("标签") || lower.includes("label")) return { showDataLabels: !config.showDataLabels };
  if (lower.includes("平滑") || lower.includes("smooth")) return { smooth: !config.smooth };
  if (lower.includes("堆叠") || lower.includes("stack")) return { stacked: !config.stacked };
  
  // Title
  const titleMatch = lower.match(/(?:标题|title)[：:\s]+(.+)/);
  if (titleMatch) return { title: titleMatch[1].trim() };
  
  // Font size
  const fontMatch = lower.match(/(?:字号|fontsize|font size)[：:\s]*(\d+)/);
  if (fontMatch) return { fontSize: parseInt(fontMatch[1]) };
  
  // Axis labels
  const xLabelMatch = lower.match(/x[轴axis]*[标签label]*[：:\s]+(.+)/);
  if (xLabelMatch) return { xAxisLabel: xLabelMatch[1].trim() };
  const yLabelMatch = lower.match(/y[轴axis]*[标签label]*[：:\s]+(.+)/);
  if (yLabelMatch) return { yAxisLabel: yLabelMatch[1].trim() };
  
  return null;
}

export const ChartConfigPanel = memo(function ChartConfigPanel({
  config,
  onConfigChange,
  dataHeaders,
  rawData,
}: ChartConfigPanelProps) {
  const update = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  const colTypes = useMemo(() => detectColumnTypes(rawData), [rawData]);
  const recommendations = useMemo(() => recommendChartType(colTypes, config), [colTypes, config]);

  const [aiCmd, setAiCmd] = useState("");
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  const handleAICommand = () => {
    if (!aiCmd.trim()) return;
    const changes = processAICommand(aiCmd, config);
    if (changes) {
      onConfigChange({ ...config, ...changes });
      setAiMsg(`✅ 已应用: ${aiCmd}`);
    } else {
      setAiMsg(`⚠️ 无法识别: "${aiCmd}"，试试 "标题: xxx" 或 "切换趋势线"`);
    }
    setAiCmd("");
    setTimeout(() => setAiMsg(null), 3000);
  };

  const toggleColumn = (colIdx: number, checked: boolean) => {
    const current = config.selectedColumns || [];
    const next = checked
      ? Array.from(new Set([...current, colIdx]))
      : current.filter((i) => i !== colIdx);
    update("selectedColumns", next);
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* AI Quick Command */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          快捷指令
        </Label>
        <div className="flex gap-1.5">
          <Input
            placeholder="如: 标题: 实验结果, 切换趋势线, science配色..."
            value={aiCmd}
            onChange={(e) => setAiCmd(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAICommand(); }}
            className="h-8 text-xs flex-1"
          />
          <button
            onClick={handleAICommand}
            className="h-8 w-8 flex items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        {aiMsg && (
          <p className={`text-[10px] mt-1 ${aiMsg.startsWith("✅") ? "text-green-500" : "text-amber-500"}`}>{aiMsg}</p>
        )}
      </div>

      {/* Style Presets - Journal Specific */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          专业风格预设
        </Label>
        <div className="grid grid-cols-3 gap-1.5">
          {Object.entries(journalPresets).map(([id, preset]) => (
            <button
              key={id}
              onClick={() => {
                const changes: Partial<ChartConfig> = { stylePreset: id };
                // Auto-apply matching color theme if available
                if (id === "nature") { changes.colorTheme = "nature"; changes.colors = colorThemes.nature.colors; }
                if (id === "science") { changes.colorTheme = "science"; changes.colors = colorThemes.science.colors; }
                if (id === "cell") { changes.colorTheme = "cell"; changes.colors = colorThemes.cell.colors; }
                onConfigChange({ ...config, ...changes });
              }}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs transition-all border ${
                config.stylePreset === id
                  ? "bg-primary/10 text-primary border-primary"
                  : "bg-accent/20 text-muted-foreground border-transparent hover:border-border"
              }`}
              title={preset.description}
            >
              <span className="text-sm">{preset.icon}</span>
              <span className="text-[10px]">{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="bg-primary/5 rounded-xl p-3 border border-primary/10 -mb-2">
          <div className="flex items-center gap-1.5 mb-2 text-primary">
            <Sparkles className="w-3.5 h-3.5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">智能推荐</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {recommendations.map(t => (
              <button
                key={t}
                onClick={() => update("chartType", t)}
                className={`px-2 py-1 rounded-md text-[10px] border transition-all ${
                  config.chartType === t 
                  ? "bg-primary text-white border-primary" 
                  : "bg-white text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {chartTypeLabels[t]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chart Type */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          图表类型
        </Label>
        <div className="grid grid-cols-5 gap-1">
          {chartTypes.map((t) => (
            <button
              key={t}
              data-testid={`charttype-${t}`}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-xs transition-all ${
                config.chartType === t
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-accent/40 text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => update("chartType", t)}
            >
              {chartIcons[t]}
              <span className="leading-none text-[10px]">{chartTypeLabels[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* X-Axis Selector */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          X 轴解析字段 (维度)
        </Label>
        <Select 
          value={String(config.xAxisColumn)} 
          onValueChange={(v) => {
            const idx = Number(v);
            onConfigChange({
              ...config,
              xAxisColumn: idx,
              selectedColumns: config.selectedColumns.filter(i => i !== idx)
            });
          }}
        >
          <SelectTrigger className="h-8 text-xs bg-accent/20">
            <SelectValue placeholder="选择 X 轴字段" />
          </SelectTrigger>
          <SelectContent>
            {dataHeaders.map((h, i) => (
              <SelectItem key={i} value={String(i)} className="text-xs">
                {h} <span className="text-[10px] opacity-50 ml-1">({colTypes[i] === "numeric" ? "Num" : "Cat"})</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Column Selector - Y-Axis / Series */}
      <div>
        <div className="flex items-center justify-between mb-2">
           <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            绘图数据字段 (指标/系列)
          </Label>
          <div className="flex gap-2">
            <button 
              onClick={() => update("selectedColumns", dataHeaders.map((_, i) => i).filter(i => i !== config.xAxisColumn))}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              全选
            </button>
            <button 
              onClick={() => update("selectedColumns", dataHeaders.map((_, i) => i).filter(i => i !== config.xAxisColumn && colTypes[i] === "numeric"))}
              className="text-[10px] text-primary hover:underline font-medium"
            >
              仅数值
            </button>
            <button 
              onClick={() => update("selectedColumns", [])}
              className="text-[10px] text-muted-foreground hover:underline font-medium"
            >
              清空
            </button>
          </div>
        </div>
        
        <ScrollArea className="h-[140px] rounded-md border border-border p-2 bg-accent/20">
          <div className="flex flex-col gap-1.5">
            {dataHeaders.map((h, i) => {
              if (i === config.xAxisColumn) return null;
              const isChecked = config.selectedColumns.includes(i);
              const type = colTypes[i];
              return (
                <div key={i} className="flex items-center justify-between group">
                  <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                    <Checkbox
                      checked={isChecked}
                      onCheckedChange={(checked) => toggleColumn(i, !!checked)}
                    />
                    <span className={`text-xs truncate ${isChecked ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                      {h}
                    </span>
                  </label>
                  <Badge variant="outline" className={`text-[9px] h-4 px-1 leading-none ${type === "numeric" ? "text-blue-500 border-blue-500/30" : "text-orange-500 border-orange-500/30"}`}>
                    {type === "numeric" ? "Num" : "Cat"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Labels */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          标题和标签
        </Label>
        <Input
          data-testid="input-title"
          placeholder="图表标题"
          value={config.title}
          onChange={(e) => update("title", e.target.value)}
          className="h-8 text-xs"
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            data-testid="input-xlabel"
            placeholder="X 轴标签"
            value={config.xAxisLabel}
            onChange={(e) => update("xAxisLabel", e.target.value)}
            className="h-8 text-xs"
          />
          <Input
            data-testid="input-ylabel"
            placeholder="Y 轴标签"
            value={config.yAxisLabel}
            onChange={(e) => update("yAxisLabel", e.target.value)}
            className="h-8 text-xs"
          />
        </div>
      </div>

      {/* Axis Interval Controls */}
      {hasAxis(config.chartType) && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            坐标轴间隔
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">X 轴间隔 (每N显示)</span>
              <Input
                type="number"
                placeholder="自动"
                min={1}
                value={config.xAxisInterval ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update("xAxisInterval", v === "" ? undefined : Math.max(1, Number(v)));
                }}
                className="h-7 text-xs tabular-nums"
              />
            </div>
            <div>
              <span className="text-[10px] text-muted-foreground block mb-1">Y 轴间隔 (每N显示)</span>
              <Input
                type="number"
                placeholder="自动"
                min={1}
                value={config.yAxisInterval ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  update("yAxisInterval", v === "" ? undefined : Math.max(1, Number(v)));
                }}
                className="h-7 text-xs tabular-nums"
              />
            </div>
          </div>
        </div>
      )}

      {/* Toggles */}
      <div className="space-y-3">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          显示选项
        </Label>
        <div className="flex items-center justify-between">
          <span className="text-xs">图例</span>
          <Switch
            data-testid="toggle-legend"
            checked={config.showLegend}
            onCheckedChange={(v) => update("showLegend", v)}
          />
        </div>
        {config.chartType !== "pie" && config.chartType !== "radar" && (
          <div className="flex items-center justify-between">
            <span className="text-xs">网格线</span>
            <Switch
              data-testid="toggle-grid"
              checked={config.showGrid}
              onCheckedChange={(v) => update("showGrid", v)}
            />
          </div>
        )}
        <div className="flex items-center justify-between">
          <span className="text-xs">数值标签</span>
          <Switch
            data-testid="toggle-datalabels"
            checked={config.showDataLabels}
            onCheckedChange={(v) => update("showDataLabels", v)}
          />
        </div>
        {(config.chartType === "line" || config.chartType === "scatter" || config.chartType === "area") && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs">数据点</span>
              <Switch
                data-testid="toggle-symbol"
                checked={config.showSymbol}
                onCheckedChange={(v) => update("showSymbol", v)}
              />
            </div>
            {(config.chartType === "line" || config.chartType === "area") && (
              <div className="flex items-center justify-between">
                <span className="text-xs">平滑曲线</span>
                <Switch
                  data-testid="toggle-smooth"
                  checked={config.smooth}
                  onCheckedChange={(v) => update("smooth", v)}
                />
              </div>
            )}
          </>
        )}
        {config.chartType === "pie" && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs">环形图</span>
              <Switch
                data-testid="toggle-donut"
                checked={config.pieDonut}
                onCheckedChange={(v) => update("pieDonut", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">南丁格尔玫瑰</span>
              <Switch
                data-testid="toggle-rose"
                checked={config.pieRoseType}
                onCheckedChange={(v) => update("pieRoseType", v)}
              />
            </div>
          </>
        )}
        {(config.chartType === "line" || config.chartType === "scatter" || config.chartType === "area") && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs flex items-center gap-1.5">
                趋势线 <Badge variant="outline" className="text-[8px] h-3 px-1 leading-none py-0">Beta</Badge>
              </span>
              <Switch
                checked={config.showTrendLine}
                onCheckedChange={(v) => update("showTrendLine", v)}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs">置信区间</span>
              <Switch
                checked={config.showConfidenceInterval}
                onCheckedChange={(v) => update("showConfidenceInterval", v)}
              />
            </div>
          </>
        )}
        {(config.chartType === "bar" || config.chartType === "line") && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs">误差棒 (Global)</span>
              <Select value={config.errorBarType} onValueChange={(v) => update("errorBarType", v as any)}>
                <SelectTrigger className="h-7 text-[10px] w-[80px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">无</SelectItem>
                  <SelectItem value="sd">±SD</SelectItem>
                  <SelectItem value="se">±SE</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
        {/* Significance markers */}
        {(config.chartType === "bar" || config.chartType === "boxplot") && (
          <div className="flex items-center justify-between">
            <span className="text-xs flex items-center gap-1.5">
              显著性标注 <Badge variant="outline" className="text-[8px] h-3 px-1 leading-none py-0">p值</Badge>
            </span>
            <Switch
              checked={config.showSignificance}
              onCheckedChange={(v) => update("showSignificance", v)}
            />
          </div>
        )}
        {hasStack(config.chartType) && (
          <div className="flex items-center justify-between">
            <span className="text-xs">堆叠</span>
            <Switch
              data-testid="toggle-stack"
              checked={config.stacked}
              onCheckedChange={(v) => update("stacked", v)}
            />
          </div>
        )}
        {hasAxis(config.chartType) && (
          <div className="flex items-center justify-between">
            <span className="text-xs">数据缩放</span>
            <Switch
              data-testid="toggle-datazoom"
              checked={config.showDataZoom}
              onCheckedChange={(v) => update("showDataZoom", v)}
            />
          </div>
        )}
      </div>

      {/* Sort */}
      {hasSort(config.chartType) && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            数据排序
          </Label>
          <Select value={config.sortData} onValueChange={(v) => update("sortData", v as "none" | "asc" | "desc")}>
            <SelectTrigger data-testid="select-sort" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">默认</SelectItem>
              <SelectItem value="asc">升序</SelectItem>
              <SelectItem value="desc">降序</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Reference Line */}
      {hasRefLine(config.chartType) && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            参考线
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              data-testid="input-refline"
              type="number"
              placeholder="数值"
              value={config.referenceLine ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                update("referenceLine", v === "" ? undefined : Number(v));
              }}
              className="h-8 text-xs tabular-nums"
            />
            <Input
              data-testid="input-refline-label"
              placeholder="标签"
              value={config.referenceLineLabel}
              onChange={(e) => update("referenceLineLabel", e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
      )}

      {/* Size Controls */}
      {(config.chartType === "line" || config.chartType === "scatter" || config.chartType === "area" || config.chartType === "radar") && (
        <div className="space-y-3">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            样式参数
          </Label>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs">符号大小</span>
              <span className="text-xs tabular-nums text-muted-foreground">{config.symbolSize}</span>
            </div>
            <Slider
              data-testid="slider-symbol"
              min={2}
              max={16}
              step={1}
              value={[config.symbolSize]}
              onValueChange={([v]) => update("symbolSize", v)}
            />
          </div>
          {(config.chartType === "line" || config.chartType === "area" || config.chartType === "radar") && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">线宽</span>
                <span className="text-xs tabular-nums text-muted-foreground">{config.lineWidth}</span>
              </div>
              <Slider
                data-testid="slider-linewidth"
                min={0.5}
                max={5}
                step={0.5}
                value={[config.lineWidth]}
                onValueChange={([v]) => update("lineWidth", v)}
              />
            </div>
          )}
          {config.chartType === "area" && (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs">填充透明度</span>
                <span className="text-xs tabular-nums text-muted-foreground">{(config.areaOpacity * 100).toFixed(0)}%</span>
              </div>
              <Slider
                data-testid="slider-area-opacity"
                min={0.05}
                max={0.8}
                step={0.05}
                value={[config.areaOpacity]}
                onValueChange={([v]) => update("areaOpacity", v)}
              />
            </div>
          )}
        </div>
      )}

      {/* Dimensions & Ratio */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          布局比例与尺寸
        </Label>
        <Select value={config.aspectRatio} onValueChange={(v) => update("aspectRatio", v)}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder="选择宽高比" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">自由比例 (根据容器)</SelectItem>
            <SelectItem value="1:1">1:1 正方形</SelectItem>
            <SelectItem value="4:3">4:3 标准</SelectItem>
            <SelectItem value="3:2">3:2 学术</SelectItem>
            <SelectItem value="16:9">16:9 宽屏</SelectItem>
          </SelectContent>
        </Select>
        <div className="grid grid-cols-2 gap-2">
          <Input
            data-testid="input-width"
            type="number"
            value={config.width}
            onChange={(e) => update("width", Number(e.target.value) || 800)}
            className="h-8 text-xs tabular-nums"
          />
          <Input
            data-testid="input-height"
            type="number"
            value={config.height}
            onChange={(e) => update("height", Number(e.target.value) || 600)}
            className="h-8 text-xs tabular-nums"
          />
        </div>
      </div>

      {/* Color Theme */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          配色方案
        </Label>
        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(colorThemes).map(([key, theme]) => (
            <button
              key={key}
              data-testid={`theme-${key}`}
              className={`flex flex-col items-center gap-1 py-1.5 px-1 rounded-lg text-xs transition-all ${
                config.colorTheme === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-accent/40 text-muted-foreground hover:bg-accent"
              }`}
              onClick={() => {
                onConfigChange({ ...config, colorTheme: key, colors: theme.colors });
              }}
            >
              <div className="flex gap-0.5">
                {theme.colors.slice(0, 4).map((c, i) => (
                  <div key={i} className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="leading-none text-[10px]">{theme.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Font */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          字体设置
        </Label>
        <Select
          value={config.fontFamily.split(",")[0].replace(/'/g, "").trim()}
          onValueChange={(v) => update("fontFamily", `${v}, Helvetica Neue, Arial, sans-serif`)}
        >
          <SelectTrigger data-testid="select-font" className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Inter">Inter (推荐)</SelectItem>
            <SelectItem value="Helvetica Neue">Helvetica Neue</SelectItem>
            <SelectItem value="Arial">Arial</SelectItem>
            <SelectItem value="Times New Roman">Times New Roman</SelectItem>
          </SelectContent>
        </Select>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs">字号</span>
            <span className="text-xs tabular-nums text-muted-foreground">{config.fontSize}px</span>
          </div>
          <Slider
            data-testid="slider-fontsize"
            min={10}
            max={20}
            step={1}
            value={[config.fontSize]}
            onValueChange={([v]) => update("fontSize", v)}
          />
        </div>
      </div>
    </div>
  );
});
