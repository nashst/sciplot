import { useState, useCallback, useEffect, useMemo } from "react";
import { DataEditor } from "@/components/DataEditor";
import { ChartConfigPanel } from "@/components/ChartConfig";
import { ChartPreview } from "@/components/ChartPreview";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Database, Settings, Sparkles } from "lucide-react";
import { getSampleData, type ParsedData } from "@/lib/chartEngine";
import { defaultChartConfig, type ChartConfig } from "@shared/schema";
import {
  type DataChangeMeta,
} from "@/lib/dataParser";
import {
  buildAutoInsightText,
  buildDatasetProfile,
  recommendVisualization,
} from "@/lib/autoInsights";

function ThemeToggle() {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <button
      data-testid="theme-toggle"
      className="p-1.5 rounded-md hover:bg-accent transition-colors text-muted-foreground"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {dark ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="5" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

export default function Home() {
  const [config, setConfig] = useState<ChartConfig>({
    ...defaultChartConfig,
  });
  const [data, setData] = useState<ParsedData>(() => getSampleData("line"));
  const [isUserModified, setIsUserModified] = useState(false);
  const [autoInsight, setAutoInsight] = useState(
    "Upload CSV/XLSX data to get an automatic chart recommendation.",
  );

  const applySmartConfig = useCallback((nextData: ParsedData) => {
    const profile = buildDatasetProfile(nextData);
    const recommendation = recommendVisualization(profile);
    const safeXAxis = Math.min(
      recommendation.xAxisIndex,
      Math.max(0, nextData.headers.length - 1),
    );
    const safeYColumns = recommendation.yAxisIndices.filter(
      (index) => index >= 0 && index < nextData.headers.length && index !== safeXAxis,
    );
    const xAxisLabel = nextData.headers[safeXAxis] || "X";
    const yAxisLabel = safeYColumns.length
      ? safeYColumns.map((index) => nextData.headers[index]).join(", ")
      : "Value";

    setConfig((prev) => ({
      ...prev,
      chartType: recommendation.chartType,
      xAxisColumn: safeXAxis,
      selectedColumns: safeYColumns,
      xAxisLabel,
      yAxisLabel,
    }));

    setAutoInsight(buildAutoInsightText(profile, recommendation));
  }, []);

  const sanitizeConfigForData = useCallback((nextData: ParsedData) => {
    const maxIndex = Math.max(0, nextData.headers.length - 1);
    setConfig((prev) => ({
      ...prev,
      xAxisColumn: Math.min(prev.xAxisColumn, maxIndex),
      selectedColumns: prev.selectedColumns.filter(
        (index) => index <= maxIndex && index !== Math.min(prev.xAxisColumn, maxIndex),
      ),
    }));
  }, []);

  const handleConfigChange = useCallback((newConfig: ChartConfig) => {
    setConfig((prev) => {
      // If chart type changed, load sample data ONLY if user hasn't modified it
      if (newConfig.chartType !== prev.chartType && !isUserModified) {
        setData(getSampleData(newConfig.chartType));
      }
      return newConfig;
    });
  }, [isUserModified]);

  const handleDataChange = useCallback((newData: ParsedData, meta?: DataChangeMeta) => {
    setData(newData);
    setIsUserModified(true);

    if (meta?.reason === "upload" || meta?.reason === "paste") {
      applySmartConfig(newData);
      return;
    }

    sanitizeConfigForData(newData);

    if (meta?.reason === "reset") {
      setAutoInsight("Upload CSV/XLSX data to get an automatic chart recommendation.");
      return;
    }

    if (
      meta?.reason === "add-row" ||
      meta?.reason === "add-column" ||
      meta?.reason === "delete-row" ||
      meta?.reason === "delete-column" ||
      meta?.reason === "formula"
    ) {
      setAutoInsight("Dataset changed. Import again to refresh smart recommendation.");
    }
  }, [applySmartConfig, sanitizeConfigForData]);

  // Extract data headers for column selector
  const dataHeaders = useMemo(() => data.headers, [data.headers]);

  // Update background color when theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isDark = document.documentElement.classList.contains("dark");
      setConfig((prev) => ({
        ...prev,
        backgroundColor: isDark ? "#1e1e22" : "#ffffff",
      }));
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="h-12 flex items-center px-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <svg
            width="24"
            height="24"
            viewBox="0 0 32 32"
            fill="none"
            aria-label="SciPlot logo"
          >
            <rect x="2" y="2" width="28" height="28" rx="6" fill="currentColor" className="text-primary" />
            <path
              d="M8 24 L12 14 L16 18 L20 8 L24 12"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
            />
            <circle cx="12" cy="14" r="2" fill="white" />
            <circle cx="20" cy="8" r="2" fill="white" />
          </svg>
          <span className="font-semibold text-sm tracking-tight">SciPlot</span>
          <span className="text-xs text-muted-foreground hidden sm:inline">科研绘图工具</span>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2 mr-2">
          <button
            onClick={() => {
              const projectData = JSON.stringify({ config, data }, null, 2);
              const blob = new Blob([projectData], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `sciplot_project_${new Date().toISOString().split("T")[0]}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
            title="导出项目配置与数据"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            导出
          </button>
          <label className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-md hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer" title="导入项目配置与数据">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            导入
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (event) => {
                  try {
                    const imported = JSON.parse(event.target?.result as string);
                    if (imported.config && imported.data) {
                      setConfig(imported.config);
                      setData(imported.data);
                      setIsUserModified(true);
                    }
                  } catch (err) {
                    alert("导入失败：无效的 JSON 文件");
                  }
                };
                reader.readAsText(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <ThemeToggle />
      </header>

      <div className="px-4 pt-3">
        <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="font-medium text-foreground/90">Auto insight</span>
          <span className="truncate">{autoInsight}</span>
        </div>
      </div>

      {/* Main Layout: Resizable Panels */}
      <div className="flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          {/* Left Panel: Data + Config */}
          <ResizablePanel
            defaultSize={28}
            minSize={20}
            maxSize={50}
            className="flex flex-col"
          >
            <Tabs defaultValue="data" className="flex flex-col flex-1 overflow-hidden">
              <TabsList className="w-full rounded-none border-b border-border bg-transparent h-10 shrink-0">
                <TabsTrigger
                  value="data"
                  data-testid="tab-data"
                  className="flex-1 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
                >
                  <Database className="w-3.5 h-3.5 mr-1.5" />
                  数据
                </TabsTrigger>
                <TabsTrigger
                  value="config"
                  data-testid="tab-config"
                  className="flex-1 rounded-none text-xs data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none"
                >
                  <Settings className="w-3.5 h-3.5 mr-1.5" />
                  参数
                </TabsTrigger>
              </TabsList>
              <TabsContent value="data" className="flex-1 overflow-hidden mt-0 p-3">
                <DataEditor data={data} onDataChange={handleDataChange} />
              </TabsContent>
              <TabsContent value="config" className="flex-1 overflow-hidden mt-0">
                <ScrollArea className="h-full">
                  <div className="p-3">
                    <ChartConfigPanel
                      config={config}
                      onConfigChange={handleConfigChange}
                      dataHeaders={dataHeaders}
                      rawData={data}
                    />
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </ResizablePanel>

          {/* Drag Handle */}
          <ResizableHandle withHandle />

          {/* Right: Chart Preview */}
          <ResizablePanel defaultSize={72} minSize={40}>
            <div className="flex flex-col h-full overflow-hidden">
              <div className="flex-1 p-4 overflow-auto">
                <ChartPreview data={data} config={config} />
              </div>
              {/* Footer: Attribution */}
              <div className="px-4 pb-2 flex items-center justify-end">
                <span className="text-[10px] text-muted-foreground/60 select-none">
                  Group Zhang, SICAU
                </span>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
