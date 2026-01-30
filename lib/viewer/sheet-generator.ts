/**
 * Viewer Sheet Generator (명세서 Section 7.3)
 *
 * Converts ModelSnapshotOutput to Excel-grade ViewerGrid
 */

import {
  ViewerGrid,
  ViewerCell,
  CellFormat,
  ViewerSheetOutput,
  ChartConfig,
  StatementSheetConfig,
} from './types';
import { ModelSnapshotOutput, Statement, Period } from '../modeling/model-types';
import { Decimal } from '@prisma/client/runtime/library';
import { createHash } from 'crypto';

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate viewer sheets for a model snapshot
 */
export async function generateViewerSheets(
  snapshot: ModelSnapshotOutput
): Promise<ViewerSheetOutput[]> {
  const sheets: ViewerSheetOutput[] = [];

  // 1. Income Statement Sheet
  sheets.push(
    generateStatementSheet(
      snapshot,
      'IS',
      'Income Statement',
      getIncomeStatementConfig()
    )
  );

  // 2. Balance Sheet
  sheets.push(
    generateStatementSheet(
      snapshot,
      'BS',
      'Balance Sheet',
      getBalanceSheetConfig()
    )
  );

  // 3. Cash Flow Sheet
  sheets.push(
    generateStatementSheet(
      snapshot,
      'CF',
      'Cash Flow Statement',
      getCashFlowConfig()
    )
  );

  // 4. Summary Sheet (Key Metrics)
  sheets.push(generateSummarySheet(snapshot));

  // 5. Checks Sheet
  sheets.push(generateChecksSheet(snapshot));

  return sheets;
}

// ============================================================================
// Statement Sheet Generator
// ============================================================================

function generateStatementSheet(
  snapshot: ModelSnapshotOutput,
  statementType: 'IS' | 'BS' | 'CF',
  title: string,
  config: StatementSheetConfig
): ViewerSheetOutput {
  const statement =
    statementType === 'IS'
      ? snapshot.incomeStatement
      : statementType === 'BS'
        ? snapshot.balanceSheet
        : snapshot.cashFlowStatement;

  const timeline = statement.timeline;
  const cells: ViewerCell[] = [];

  let currentRow = 0;

  // Title row
  cells.push({
    row: currentRow,
    col: 0,
    value: title,
    valueType: 'header',
    format: {
      bold: true,
      fontSize: 16,
      align: 'left',
    },
  });
  currentRow += 2; // Skip a row

  // Header row with periods
  cells.push({
    row: currentRow,
    col: 0,
    value: 'Line Item',
    valueType: 'header',
    format: {
      bold: true,
      backgroundColor: '#E7E6E6',
      borderBottom: true,
    },
  });

  timeline.periods.forEach((period, idx) => {
    cells.push({
      row: currentRow,
      col: idx + 1,
      value: period.label,
      valueType: 'header',
      format: {
        bold: true,
        backgroundColor: period.isHistorical ? '#F2F2F2' : '#FFF2CC', // Different color for forecast
        borderBottom: true,
        align: 'center',
      },
      metadata: {
        periodIndex: period.index,
        isHistorical: period.isHistorical,
      },
    });
  });

  currentRow++;

  // Data rows organized by sections
  for (const section of config.sections) {
    // Section header
    if (section.sectionName) {
      cells.push({
        row: currentRow,
        col: 0,
        value: section.sectionName,
        valueType: 'header',
        format: {
          bold: true,
          fontSize: 12,
          backgroundColor: '#D9D9D9',
        },
      });
      currentRow++;
    }

    // Lines in this section
    for (const lineId of section.lineIds) {
      const line = statement.lines.find((l) => l.lineId === lineId);
      if (!line) continue;

      // Line label
      cells.push({
        row: currentRow,
        col: 0,
        value: line.displayName,
        valueType: 'text',
        format: {
          indent: section.sectionName ? 1 : 0,
        },
        metadata: {
          lineId: line.lineId,
          provenance: line.provenance,
        },
      });

      // Values for each period
      timeline.periods.forEach((period, idx) => {
        const value = line.values.get(period.index);

        if (value !== undefined) {
          cells.push({
            row: currentRow,
            col: idx + 1,
            value: value.toNumber(),
            displayValue: formatNumber(value.toNumber()),
            valueType: 'number',
            format: {
              numberFormat: '#,##0',
              align: 'right',
              fontColor: period.isHistorical ? '#000000' : '#0066CC', // Blue for forecast
            },
            metadata: {
              lineId: line.lineId,
              periodIndex: period.index,
              isHistorical: period.isHistorical,
              provenance: line.provenance,
            },
          });
        }
      });

      currentRow++;
    }

    // Subtotal row if configured
    if (section.showSubtotal && section.subtotalLabel) {
      cells.push({
        row: currentRow,
        col: 0,
        value: section.subtotalLabel,
        valueType: 'header',
        format: {
          bold: true,
          borderTop: true,
          borderBottom: true,
        },
      });

      // Calculate subtotals (simplified - would need formula logic in production)
      currentRow++;
    }

    currentRow++; // Blank row between sections
  }

  const grid: ViewerGrid = {
    sheetName: statementType,
    rows: currentRow,
    cols: timeline.periods.length + 1,
    cells,
    frozenRows: 3, // Freeze title + header rows
    frozenCols: 1, // Freeze line item column
    columnWidths: {
      0: 250, // Line item column wider
      ...Object.fromEntries(
        timeline.periods.map((_, idx) => [idx + 1, 120])
      ),
    },
  };

  // Generate charts for this statement
  const charts = generateStatementCharts(statement, statementType);

  return {
    snapshotId: snapshot.snapshotId,
    sheetName: title,
    grid,
    charts,
    generatedAt: new Date(),
    cacheHash: generateGridHash(grid),
  };
}

// ============================================================================
// Summary Sheet Generator
// ============================================================================

function generateSummarySheet(
  snapshot: ModelSnapshotOutput
): ViewerSheetOutput {
  const timeline = snapshot.incomeStatement.timeline;
  const cells: ViewerCell[] = [];
  let currentRow = 0;

  // Title
  cells.push({
    row: currentRow,
    col: 0,
    value: 'Financial Summary & Key Metrics',
    valueType: 'header',
    format: {
      bold: true,
      fontSize: 16,
    },
  });
  currentRow += 2;

  // Header row
  cells.push({
    row: currentRow,
    col: 0,
    value: 'Metric',
    valueType: 'header',
    format: { bold: true, backgroundColor: '#E7E6E6', borderBottom: true },
  });

  timeline.periods.forEach((period, idx) => {
    cells.push({
      row: currentRow,
      col: idx + 1,
      value: period.label,
      valueType: 'header',
      format: {
        bold: true,
        backgroundColor: period.isHistorical ? '#F2F2F2' : '#FFF2CC',
        borderBottom: true,
        align: 'center',
      },
    });
  });
  currentRow++;

  // Key metrics
  const keyMetrics = [
    { label: 'Revenue', lineId: 'IS.REVENUE', statement: snapshot.incomeStatement },
    { label: 'Gross Profit', lineId: 'IS.GROSS_PROFIT', statement: snapshot.incomeStatement },
    { label: 'EBIT', lineId: 'IS.EBIT', statement: snapshot.incomeStatement },
    { label: 'Net Income', lineId: 'IS.NET_INCOME', statement: snapshot.incomeStatement },
    { label: 'Total Assets', lineId: 'BS.TOTAL_ASSETS', statement: snapshot.balanceSheet },
    { label: 'Total Equity', lineId: 'BS.TOTAL_EQUITY', statement: snapshot.balanceSheet },
    { label: 'Cash Flow from Operations', lineId: 'CF.CFO', statement: snapshot.cashFlowStatement },
    { label: 'Ending Cash', lineId: 'CF.END_CASH', statement: snapshot.cashFlowStatement },
  ];

  for (const metric of keyMetrics) {
    cells.push({
      row: currentRow,
      col: 0,
      value: metric.label,
      valueType: 'text',
      format: { bold: true },
    });

    const line = metric.statement.lines.find((l) => l.lineId === metric.lineId);
    if (line) {
      timeline.periods.forEach((period, idx) => {
        const value = line.values.get(period.index);
        if (value !== undefined) {
          cells.push({
            row: currentRow,
            col: idx + 1,
            value: value.toNumber(),
            displayValue: formatNumber(value.toNumber()),
            valueType: 'number',
            format: {
              numberFormat: '#,##0',
              align: 'right',
            },
          });
        }
      });
    }

    currentRow++;
  }

  const grid: ViewerGrid = {
    sheetName: 'Summary',
    rows: currentRow,
    cols: timeline.periods.length + 1,
    cells,
    frozenRows: 3,
    frozenCols: 1,
  };

  // Summary charts
  const charts = generateSummaryCharts(snapshot);

  return {
    snapshotId: snapshot.snapshotId,
    sheetName: 'Summary',
    grid,
    charts,
    generatedAt: new Date(),
    cacheHash: generateGridHash(grid),
  };
}

// ============================================================================
// Checks Sheet Generator
// ============================================================================

function generateChecksSheet(snapshot: ModelSnapshotOutput): ViewerSheetOutput {
  const cells: ViewerCell[] = [];
  let currentRow = 0;

  // Title
  cells.push({
    row: currentRow,
    col: 0,
    value: 'Model Integrity Checks',
    valueType: 'header',
    format: { bold: true, fontSize: 16 },
  });
  currentRow += 2;

  // BS Balance Check
  cells.push({
    row: currentRow,
    col: 0,
    value: 'BS Balance Check',
    valueType: 'header',
    format: { bold: true },
  });
  cells.push({
    row: currentRow,
    col: 1,
    value: snapshot.checks.bsBalanceCheck.passed ? '✅ PASS' : '❌ FAIL',
    valueType: 'text',
    format: {
      fontColor: snapshot.checks.bsBalanceCheck.passed ? '#006100' : '#C00000',
      bold: true,
    },
  });
  currentRow++;

  cells.push({
    row: currentRow,
    col: 0,
    value: 'Max Error',
    valueType: 'text',
  });
  cells.push({
    row: currentRow,
    col: 1,
    value: snapshot.checks.bsBalanceCheck.error.toNumber(),
    displayValue: formatNumber(snapshot.checks.bsBalanceCheck.error.toNumber()),
    valueType: 'number',
    format: { numberFormat: '#,##0.00' },
  });
  currentRow += 2;

  // CF Tie-out Check
  cells.push({
    row: currentRow,
    col: 0,
    value: 'CF Tie-out Check',
    valueType: 'header',
    format: { bold: true },
  });
  cells.push({
    row: currentRow,
    col: 1,
    value: snapshot.checks.cfTieOut.passed ? '✅ PASS' : '❌ FAIL',
    valueType: 'text',
    format: {
      fontColor: snapshot.checks.cfTieOut.passed ? '#006100' : '#C00000',
      bold: true,
    },
  });
  currentRow++;

  cells.push({
    row: currentRow,
    col: 0,
    value: 'Max Error',
    valueType: 'text',
  });
  cells.push({
    row: currentRow,
    col: 1,
    value: snapshot.checks.cfTieOut.error.toNumber(),
    displayValue: formatNumber(snapshot.checks.cfTieOut.error.toNumber()),
    valueType: 'number',
    format: { numberFormat: '#,##0.00' },
  });
  currentRow++;

  const grid: ViewerGrid = {
    sheetName: 'Checks',
    rows: currentRow,
    cols: 3,
    cells,
  };

  return {
    snapshotId: snapshot.snapshotId,
    sheetName: 'Checks',
    grid,
    charts: [],
    generatedAt: new Date(),
    cacheHash: generateGridHash(grid),
  };
}

// ============================================================================
// Chart Generators
// ============================================================================

function generateStatementCharts(
  statement: Statement,
  statementType: string
): ChartConfig[] {
  const charts: ChartConfig[] = [];

  if (statementType === 'IS') {
    // Revenue trend chart
    const revenueLine = statement.lines.find((l) => l.lineId === 'IS.REVENUE');
    if (revenueLine) {
      charts.push({
        chartType: 'line',
        title: 'Revenue Trend',
        xAxisLabels: statement.timeline.periods.map((p) => p.label),
        series: [
          {
            name: 'Revenue',
            data: statement.timeline.periods.map(
              (p) => revenueLine.values.get(p.index)?.toNumber() || 0
            ),
            color: '#4472C4',
            type: 'line',
          },
        ],
        yAxisFormat: 'millions',
      });
    }
  }

  return charts;
}

function generateSummaryCharts(snapshot: ModelSnapshotOutput): ChartConfig[] {
  const charts: ChartConfig[] = [];
  const timeline = snapshot.incomeStatement.timeline;

  // Revenue trend
  const revenueLine = snapshot.incomeStatement.lines.find(
    (l) => l.lineId === 'IS.REVENUE'
  );
  const netIncomeLine = snapshot.incomeStatement.lines.find(
    (l) => l.lineId === 'IS.NET_INCOME'
  );

  if (revenueLine && netIncomeLine) {
    charts.push({
      chartType: 'combo',
      title: 'Revenue & Profitability',
      xAxisLabels: timeline.periods.map((p) => p.label),
      series: [
        {
          name: 'Revenue',
          data: timeline.periods.map(
            (p) => revenueLine.values.get(p.index)?.toNumber() || 0
          ),
          color: '#4472C4',
          type: 'bar',
        },
        {
          name: 'Net Income',
          data: timeline.periods.map(
            (p) => netIncomeLine.values.get(p.index)?.toNumber() || 0
          ),
          color: '#70AD47',
          type: 'line',
        },
      ],
    });
  }

  return charts;
}

// ============================================================================
// Statement Configurations
// ============================================================================

function getIncomeStatementConfig(): StatementSheetConfig {
  return {
    statementType: 'IS',
    title: 'Income Statement',
    sections: [
      {
        sectionName: 'Revenue & Gross Profit',
        lineIds: ['IS.REVENUE', 'IS.COGS', 'IS.GROSS_PROFIT'],
      },
      {
        sectionName: 'Operating Expenses',
        lineIds: ['IS.SGA', 'IS.DA'],
      },
      {
        sectionName: 'Operating Income',
        lineIds: ['IS.EBIT'],
      },
      {
        sectionName: 'Net Income',
        lineIds: ['IS.INTEREST_EXPENSE', 'IS.EBT', 'IS.TAXES', 'IS.NET_INCOME'],
      },
    ],
  };
}

function getBalanceSheetConfig(): StatementSheetConfig {
  return {
    statementType: 'BS',
    title: 'Balance Sheet',
    sections: [
      {
        sectionName: 'Current Assets',
        lineIds: ['BS.CASH', 'BS.AR', 'BS.INVENTORY', 'BS.OTHER_CA', 'BS.TOTAL_CA'],
      },
      {
        sectionName: 'Non-Current Assets',
        lineIds: ['BS.PPE_NET', 'BS.INTANGIBLES', 'BS.OTHER_NCA'],
      },
      {
        sectionName: 'Total Assets',
        lineIds: ['BS.TOTAL_ASSETS'],
      },
      {
        sectionName: 'Current Liabilities',
        lineIds: ['BS.AP', 'BS.OTHER_CL', 'BS.SHORT_DEBT', 'BS.TOTAL_CL'],
      },
      {
        sectionName: 'Non-Current Liabilities',
        lineIds: ['BS.LONG_DEBT', 'BS.OTHER_NCL'],
      },
      {
        sectionName: 'Total Liabilities',
        lineIds: ['BS.TOTAL_LIABILITIES'],
      },
      {
        sectionName: 'Equity',
        lineIds: ['BS.COMMON_STOCK', 'BS.RETAINED_EARNINGS', 'BS.TOTAL_EQUITY'],
      },
    ],
  };
}

function getCashFlowConfig(): StatementSheetConfig {
  return {
    statementType: 'CF',
    title: 'Cash Flow Statement',
    sections: [
      {
        sectionName: 'Cash Flows',
        lineIds: [
          'CF.CFO',
          'CF.CFI',
          'CF.CFF',
          'CF.NET_CHANGE',
          'CF.BEGIN_CASH',
          'CF.END_CASH',
        ],
      },
    ],
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function generateGridHash(grid: ViewerGrid): string {
  const hash = createHash('sha256');
  hash.update(JSON.stringify({ cells: grid.cells.length, rows: grid.rows, cols: grid.cols }));
  return hash.digest('hex').slice(0, 16);
}
