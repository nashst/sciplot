import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { chartTypes, chartTypeLabels, NATURE_COLORS, type ChartConfig, type ChartType } from "@shared/schema";
import {
  LineChart,
  ScatterChart,
  BarChart3,
  BarChartHorizontal,
  Grid3x3,
  BoxSelect,
} from "lucide-react";

interface ChartConfigPanelProps {
  config: ChartConfig;
  onConfigChange: (config: ChartConfig) => void;
}

const chartIcons: Record<ChartType, React.ReactNode> = {
  line: <LineChart className="w-4 h-4" />,
  scatter: <ScatterChart className="w-4 h-4" />,
  bar: <BarChart3 className="w-4 h-4" />,
  barH: <BarChartHorizontal className="w-4 h-4" />,
  heatmap: <Grid3x3 className="w-4 h-4" />,
  boxplot: <BoxSelect className="w-4 h-4" />,
};

export function ChartConfigPanel({ config, onConfigChange }: ChartConfigPanelProps) {
  const update = <K extends keyof ChartConfig>(key: K, value: ChartConfig[K]) => {
    onConfigChange({ ...config, [key]: value });
  };

  return (
    <div className="flex flex-col gap-5 text-sm">
      {/* Chart Type */}
      <div>
        <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 block">
          图表类型
        </Label>
        <div className="grid grid-cols-3 gap-1.5">
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
        <div className="flex items-center justify-between">
          <span className="text-xs">网格线</span>
          <Switch
            data-testid="toggle-grid"
            checked={config.showGrid}
            onCheckedChange={(v) => update("showGrid", v)}
          />
        </div>
        {(config.chartType === "line" || config.chartType === "scatter") && (
          <>
            <div className="flex items-center justify-between">
              <span className="text-xs">数据点</span>
              <Switch
                data-testid="toggle-symbol"
                checked={config.showSymbol}
                onCheckedChange={(v) => update("showSymbol", v)}
              />
            </div>
            {config.chartType === "line" && (
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
      </div>

      {/* Size Controls */}
      {(config.chartType === "line" || config.chartType === "scatter") && (
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
          {config.chartType === "line" && (
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
}
