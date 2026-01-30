/**
 * Excel-grade Viewer Types (명세서 Section 7)
 *
 * Grid-based data model for rendering financial statements
 * with Excel-like formatting and interactivity
 */

import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Cell & Grid Types (명세서 Section 7.3)
// ============================================================================

/**
 * Cell Value Type
 */
export type CellValueType = 'number' | 'text' | 'header' | 'formula' | 'empty';

/**
 * Cell Formatting
 */
export interface CellFormat {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  fontColor?: string;
  backgroundColor?: string;
  numberFormat?: string; // Excel format code: "#,##0", "0.00%", etc.
  align?: 'left' | 'center' | 'right';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  indent?: number;
}

/**
 * Single Cell
 */
export interface ViewerCell {
  row: number;
  col: number;
  value: string | number | null;
  displayValue?: string; // Formatted display (e.g., "1,234.56")
  valueType: CellValueType;
  format?: CellFormat;
  formula?: string; // Excel-style formula: "=B5+B6"
  metadata?: {
    lineId?: string; // IS.REVENUE, BS.CASH, etc.
    periodIndex?: number;
    isHistorical?: boolean;
    provenance?: string; // SOURCE, DERIVED, PLUG
    drilldownPath?: string; // Path to supporting schedule
  };
}

/**
 * Grid Data (Sheet)
 */
export interface ViewerGrid {
  sheetName: string;
  rows: number;
  cols: number;
  cells: ViewerCell[];
  frozenRows?: number; // Number of frozen header rows
  frozenCols?: number; // Number of frozen label columns
  columnWidths?: Record<number, number>; // col index → width in pixels
  rowHeights?: Record<number, number>; // row index → height in pixels
}

/**
 * Chart Data
 */
export interface ChartSeries {
  name: string;
  data: number[];
  color?: string;
  type?: 'line' | 'bar' | 'area';
}

export interface ChartConfig {
  chartType: 'line' | 'bar' | 'combo' | 'waterfall' | 'pie';
  title: string;
  xAxisLabels: string[]; // Period labels: "FY2020", "FY2021", etc.
  series: ChartSeries[];
  yAxisFormat?: string; // "millions", "percent", etc.
  height?: number;
}

// ============================================================================
// Viewer Sheet Output (명세서 Section 7.3)
// ============================================================================

/**
 * Complete Viewer Sheet for a Snapshot
 */
export interface ViewerSheetOutput {
  snapshotId: string;
  sheetName: string;
  grid: ViewerGrid;
  charts?: ChartConfig[];
  generatedAt: Date;
  cacheHash: string;
}

/**
 * Statement Sheet Configuration
 */
export interface StatementSheetConfig {
  statementType: 'IS' | 'BS' | 'CF';
  title: string;
  sections: {
    sectionName: string; // "Revenue", "Operating Expenses", "Current Assets"
    lineIds: string[]; // Line IDs to include in this section
    showSubtotal?: boolean;
    subtotalLabel?: string;
  }[];
}

// ============================================================================
// XLSX Export Types (명세서 Section 7.2)
// ============================================================================

/**
 * XLSX Export Options
 */
export interface XlsxExportOptions {
  snapshotId: string;
  includeSheets: ('IS' | 'BS' | 'CF' | 'Summary' | 'Checks' | 'Assumptions')[];
  includeFormulas?: boolean; // If false, export values only
  includeFormatting?: boolean;
  companyName?: string;
  fileName?: string;
}

/**
 * XLSX Export Result
 */
export interface XlsxExportResult {
  success: boolean;
  fileName: string;
  filePath?: string;
  buffer?: Buffer;
  error?: string;
}

// ============================================================================
// Model Comparison Types
// ============================================================================

/**
 * Scenario Comparison Input
 */
export interface ScenarioComparisonInput {
  snapshotIds: string[]; // Base, Bull, Bear scenarios
  scenarioLabels?: string[];
  compareLineIds: string[]; // Which lines to compare
  comparePeriods?: number[]; // Which period indices to compare
}

/**
 * Variance Analysis
 */
export interface VarianceCell {
  lineId: string;
  lineName: string;
  periodIndex: number;
  periodLabel: string;
  baseValue: number;
  compareValue: number;
  variance: number;
  variancePercent: number;
}

/**
 * Comparison Grid
 */
export interface ComparisonGrid {
  baseSnapshotId: string;
  compareSnapshotIds: string[];
  scenarioLabels: string[];
  variances: VarianceCell[];
  waterfall?: ChartConfig; // Waterfall chart for variance breakdown
}
