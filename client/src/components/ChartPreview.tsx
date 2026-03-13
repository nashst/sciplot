import { useRef, useCallback, useMemo, memo } from "react";
import ReactEChartsCore from "echarts-for-react/lib/core";
import * as echarts from "echarts/core";
import {
  LineChart,
  ScatterChart,
  BarChart,
  HeatmapChart,
  BoxplotChart,
  PieChart,
  RadarChart,
  CustomChart,
} from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  VisualMapComponent,
  DataZoomComponent,
  RadarComponent,
  MarkLineComponent,
} from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";
import { Button } from "@/components/ui/button";
import { Download, Image, FileType } from "lucide-react";
import { buildChart, type ParsedData } from "@/lib/chartEngine";
import type { ChartConfig } from "@shared/schema";

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

interface ChartPreviewProps {
  data: ParsedData;
  config: ChartConfig;
}

export const ChartPreview = memo(function ChartPreview({ data, config }: ChartPreviewProps) {
  const chartRef = useRef<ReactEChartsCore>(null);

  const option = useMemo(
    () => buildChart(config.chartType, data, config),
    [data, config],
  );

  const exportSVG = useCallback(() => {
    // Create a temporary chart instance with SVG renderer
    const container = document.createElement("div");
    container.style.width = `${config.width}px`;
    container.style.height = `${config.height}px`;
    container.style.position = "absolute";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    const svgChart = echarts.init(container, undefined, {
      renderer: "svg",
      width: config.width,
      height: config.height,
    });

    const svgOption = {
      ...option,
      backgroundColor: config.backgroundColor,
      animation: false,
    };
    svgChart.setOption(svgOption);

    // Wait for render then extract SVG
    setTimeout(() => {
      const svgEl = container.querySelector("svg");
      if (svgEl) {
        // Add xmlns if not present
        if (!svgEl.getAttribute("xmlns")) {
          svgEl.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        }
        const svgData = new XMLSerializer().serializeToString(svgEl);
        const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${config.title || "sciplot-chart"}.svg`;
        a.click();
        URL.revokeObjectURL(url);
      }
      svgChart.dispose();
      document.body.removeChild(container);
    }, 200);
  }, [option, config]);

  const exportPNG = useCallback(() => {
    const instance = chartRef.current?.getEchartsInstance();
    if (!instance) return;

    // Use devicePixelRatio of 3 for high DPI
    const url = instance.getDataURL({
      type: "png",
      pixelRatio: 3,
      backgroundColor: config.backgroundColor,
    });

    const a = document.createElement("a");
    a.href = url;
    a.download = `${config.title || "sciplot-chart"}.png`;
    a.click();
  }, [config]);

  const hasData = data.headers.length > 0 && data.rows.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">预览</h2>
        <div className="flex gap-1.5">
          <Button
            data-testid="btn-export-svg"
            variant="outline"
            size="sm"
            onClick={exportSVG}
            disabled={!hasData}
            className="h-7 text-xs"
          >
            <FileType className="w-3.5 h-3.5 mr-1" />
            SVG
          </Button>
          <Button
            data-testid="btn-export-png"
            variant="outline"
            size="sm"
            onClick={exportPNG}
            disabled={!hasData}
            className="h-7 text-xs"
          >
            <Image className="w-3.5 h-3.5 mr-1" />
            PNG
          </Button>
        </div>
      </div>
      <div
        className="flex-1 flex items-center justify-center rounded-lg border border-border bg-white dark:bg-[#1e1e22] overflow-hidden"
        style={{ minHeight: 400 }}
      >
        {hasData ? (
          <ReactEChartsCore
            ref={chartRef}
            echarts={echarts}
            option={option}
            style={{
              width: Math.min(config.width, 900),
              height: Math.min(config.height, 660),
            }}
            opts={{ renderer: "canvas" }}
            notMerge
            lazyUpdate
          />
        ) : (
          <div className="text-muted-foreground text-sm text-center p-8">
            <Download className="w-8 h-8 mx-auto mb-3 opacity-30" />
            <p>请输入数据或上传文件</p>
            <p className="text-xs mt-1 opacity-60">支持 CSV / TSV 格式</p>
          </div>
        )}
      </div>
    </div>
  );
});
