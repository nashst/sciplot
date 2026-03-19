import { create } from "zustand";

import type { ChartConfig, ChartType } from "@shared/schema";
import { defaultChartConfig } from "@shared/schema";
import type { ParsedData } from "@/lib/chartEngine";
import {
  inferColumns,
  recommendCharts,
  suggestDefaultMapping,
  type AnalysisGoal,
  type ChartRecommendation,
  type FieldMapping,
  type InferredColumn,
} from "@/lib/analysisEngine";

interface StatisticsConfig {
  showMeanLine: boolean;
  showMedianLine: boolean;
  showRegressionLine: boolean;
  logX: boolean;
  logY: boolean;
  highlightOutliers: boolean;
}

interface WorkspaceState {
  rawData: ParsedData;
  inferredColumns: InferredColumn[];
  analysisGoal: AnalysisGoal;
  fieldMapping: FieldMapping;
  recommendedCharts: ChartRecommendation[];
  selectedChart: ChartType;
  styleConfig: ChartConfig;
  statisticsConfig: StatisticsConfig;
  setData: (data: ParsedData, goalOverride?: AnalysisGoal) => void;
  setGoal: (goal: AnalysisGoal) => void;
  setFieldMapping: (patch: Partial<FieldMapping>) => void;
  applyRecommendation: (chartType?: ChartType) => void;
  setSelectedChart: (chartType: ChartType) => void;
  updateStyleConfig: (patch: Partial<ChartConfig>) => void;
  updateStatisticsConfig: (patch: Partial<StatisticsConfig>) => void;
  resetWorkspace: () => void;
}

const initialData: ParsedData = { headers: [], rows: [] };

function recompute(goal: AnalysisGoal, data: ParsedData, mapping?: FieldMapping) {
  const inferredColumns = inferColumns(data);
  const resolvedMapping = mapping ?? suggestDefaultMapping(goal, inferredColumns);
  const recommendedCharts = recommendCharts(goal, inferredColumns, resolvedMapping).sort(
    (a, b) => a.priority - b.priority,
  );
  const firstAvailable = recommendedCharts.find((item) => item.available);

  return {
    inferredColumns,
    fieldMapping: resolvedMapping,
    recommendedCharts,
    selectedChart: (firstAvailable?.chartType ?? "line") as ChartType,
  };
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  rawData: initialData,
  inferredColumns: [],
  analysisGoal: "distribution",
  fieldMapping: { xAxisColumn: null, yAxisColumn: null, groupColumn: null },
  recommendedCharts: [],
  selectedChart: "line",
  styleConfig: { ...defaultChartConfig, title: "SciPlot 工作台" },
  statisticsConfig: {
    showMeanLine: false,
    showMedianLine: false,
    showRegressionLine: false,
    logX: false,
    logY: false,
    highlightOutliers: false,
  },

  setData: (data, goalOverride) => {
    const goal = goalOverride ?? get().analysisGoal;
    const result = recompute(goal, data);
    set((state) => ({
      ...state,
      rawData: data,
      analysisGoal: goal,
      ...result,
      styleConfig: {
        ...state.styleConfig,
        chartType: result.selectedChart,
        xAxisColumn: result.fieldMapping.xAxisColumn ?? 0,
        selectedColumns:
          result.fieldMapping.yAxisColumn == null
            ? []
            : [result.fieldMapping.yAxisColumn].filter((idx) => idx !== result.fieldMapping.xAxisColumn),
      },
    }));
  },

  setGoal: (goal) => {
    const data = get().rawData;
    const result = recompute(goal, data);
    set((state) => ({
      ...state,
      analysisGoal: goal,
      ...result,
      styleConfig: {
        ...state.styleConfig,
        chartType: result.selectedChart,
      },
    }));
  },

  setFieldMapping: (patch) => {
    set((state) => {
      const mapping = { ...state.fieldMapping, ...patch };
      const recommendedCharts = recommendCharts(state.analysisGoal, state.inferredColumns, mapping);
      return {
        ...state,
        fieldMapping: mapping,
        recommendedCharts,
        styleConfig: {
          ...state.styleConfig,
          xAxisColumn: mapping.xAxisColumn ?? 0,
          selectedColumns:
            mapping.yAxisColumn == null ? [] : [mapping.yAxisColumn].filter((idx) => idx !== mapping.xAxisColumn),
        },
      };
    });
  },

  applyRecommendation: (chartType) => {
    set((state) => {
      const target = chartType
        ? state.recommendedCharts.find((item) => item.chartType === chartType)
        : state.recommendedCharts.find((item) => item.available);
      if (!target) return state;
      return {
        ...state,
        selectedChart: target.chartType,
        fieldMapping: target.mapping,
        styleConfig: {
          ...state.styleConfig,
          chartType: target.chartType,
          xAxisColumn: target.mapping.xAxisColumn ?? 0,
          selectedColumns:
            target.mapping.yAxisColumn == null
              ? []
              : [target.mapping.yAxisColumn].filter((idx) => idx !== target.mapping.xAxisColumn),
        },
      };
    });
  },

  setSelectedChart: (chartType) => {
    set((state) => ({
      ...state,
      selectedChart: chartType,
      styleConfig: {
        ...state.styleConfig,
        chartType,
      },
    }));
  },

  updateStyleConfig: (patch) => {
    set((state) => ({
      ...state,
      styleConfig: {
        ...state.styleConfig,
        ...patch,
      },
    }));
  },

  updateStatisticsConfig: (patch) => {
    set((state) => ({
      ...state,
      statisticsConfig: {
        ...state.statisticsConfig,
        ...patch,
      },
    }));
  },

  resetWorkspace: () => {
    set({
      rawData: initialData,
      inferredColumns: [],
      analysisGoal: "distribution",
      fieldMapping: { xAxisColumn: null, yAxisColumn: null, groupColumn: null },
      recommendedCharts: [],
      selectedChart: "line",
      styleConfig: { ...defaultChartConfig, title: "SciPlot 工作台" },
      statisticsConfig: {
        showMeanLine: false,
        showMedianLine: false,
        showRegressionLine: false,
        logX: false,
        logY: false,
        highlightOutliers: false,
      },
    });
  },
}));
