import { useState, useCallback, useEffect } from "react";
import { DataEditor } from "@/components/DataEditor";
import { ChartConfigPanel } from "@/components/ChartConfig";
import { ChartPreview } from "@/components/ChartPreview";
import { PerplexityAttribution } from "@/components/PerplexityAttribution";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Settings } from "lucide-react";
import { getSampleData, type ParsedData } from "@/lib/chartEngine";
import { defaultChartConfig, type ChartConfig, type ChartType } from "@shared/schema";

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

  const handleConfigChange = useCallback((newConfig: ChartConfig) => {
    setConfig((prev) => {
      // If chart type changed, load sample data
      if (newConfig.chartType !== prev.chartType) {
        setData(getSampleData(newConfig.chartType));
      }
      return newConfig;
    });
  }, []);

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
        <ThemeToggle />
      </header>

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Data + Config */}
        <div className="w-[340px] border-r border-border flex flex-col shrink-0">
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
              <DataEditor data={data} onDataChange={setData} />
            </TabsContent>
            <TabsContent value="config" className="flex-1 overflow-hidden mt-0">
              <ScrollArea className="h-full">
                <div className="p-3">
                  <ChartConfigPanel
                    config={config}
                    onConfigChange={handleConfigChange}
                  />
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Chart Preview */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 p-4 overflow-auto">
            <ChartPreview data={data} config={config} />
          </div>
          <div className="px-4 pb-2">
            <PerplexityAttribution />
          </div>
        </div>
      </div>
    </div>
  );
}
