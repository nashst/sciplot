import { memo } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chartTypes, chartTypeLabels, colorThemes, type ChartConfig, type ChartType } from "@shared/schema";
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
} from "lucide-react";

interface ChartConfigPanelProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
  dataHeaders: string[];
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

export const ChartConfigPanel = memo(function ChartConfigPanel({
  config,
  onConfigChange,
  dataHeaders,
}: ChartConfigPanelProps) {
  const update = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  const toggleColumn = (colIdx: number, checked: boolean) => {
    const current = config.selectedColumns || [];
    const next = checked
      ? [...current, colIdx]
      : current.filter((i) => i !== colIdx);
    update("selectedColumns", next);
  };

  // Value columns (index 1+)
  const valueHeaders = dataHeaders.slice(1);
  const noColumnFilter = !config.selectedColumns || config.selectedColumns.length === 0;

  return (
    <div className="flex flex-col gap-5 text-sm">
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
              <span className="leading-none">{chartTypeLabels[t]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Column Selector */}
      {valueHeaders.length > 1 && (
        <div>
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
            绘图字段
          </Label>
          <div className="flex flex-wrap gap-x-3 gap-y-1.5">
            {valueHeaders.map((h, i) => {
              const colIdx = i + 1;
              const isChecked = noColumnFilter || config.selectedColumns.includes(colIdx);
              return (
                <label key={colIdx} className="flex items-center gap-1.5 cursor-pointer">
                  <Checkbox
                    data-testid={`col-toggle-${colIdx}`}
                    checked={isChecked}
                    onCheckedChange={(checked) => {
                      if (noColumnFilter) {
                        // First click: select only this one (deselect means select all others)
                        const allCols = valueHeaders.map((_, j) => j + 1);
                        if (!checked) {
                          update("selectedColumns", allCols.filter((c) => c !== colIdx));
                        }
                      } else {
                        toggleColumn(colIdx, !!checked);
                      }
                    }}
                  />
                  <span className="text-xs truncate max-w-[100px]">{h}</span>
                </label>
              );
            })}
          </div>
          {!noColumnFilter && (
            <button
              className="text-xs text-primary mt-1.5 hover:underline"
              onClick={() => update("selectedColumns", [])}
            >
              全部显示
            </button>
          )}
        </div>
      )}

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

      {/* Dimensions */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          尺寸 (px)
        </Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <span className="text-xs text-muted-foreground">宽度</span>
            <Input
              data-testid="input-width"
              type="number"
              value={config.width}
              onChange={(e) => update("width", Number(e.target.value) || 800)}
              className="h-8 text-xs tabular-nums mt-1"
            />
          </div>
          <div>
            <span className="text-xs text-muted-foreground">高度</span>
            <Input
              data-testid="input-height"
              type="number"
              value={config.height}
              onChange={(e) => update("height", Number(e.target.value) || 600)}
              className="h-8 text-xs tabular-nums mt-1"
            />
          </div>
        </div>
      </div>

      {/* Color Theme */}
      <div className="space-y-2">
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          配色方案
        </Label>
        <div className="grid grid-cols-3 gap-1.5">
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
                update("colorTheme", key);
                update("colors", theme.colors);
              }}
            >
              <div className="flex gap-0.5">
                {theme.colors.slice(0, 4).map((c, i) => (
                  <div key={i} className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="leading-none">{theme.label}</span>
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
