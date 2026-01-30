'use client';

/**
 * Excel-grade Grid Renderer
 * Renders ViewerGrid with formatting
 */

import { ViewerSheetOutput, ViewerCell } from '@/lib/viewer/types';

interface ViewerGridProps {
  sheet: ViewerSheetOutput;
}

export default function ViewerGrid({ sheet }: ViewerGridProps) {
  const { grid, charts } = sheet;

  // Build a 2D matrix for rendering
  const matrix: (ViewerCell | null)[][] = Array(grid.rows)
    .fill(null)
    .map(() => Array(grid.cols).fill(null));

  // Populate matrix with cells
  for (const cell of grid.cells) {
    if (cell.row < grid.rows && cell.col < grid.cols) {
      matrix[cell.row][cell.col] = cell;
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {matrix.map((row, rowIdx) => (
              <tr key={rowIdx} className="border-b border-gray-200 last:border-b-0">
                {row.map((cell, colIdx) => {
                  if (!cell) {
                    return <td key={colIdx} className="p-2 border-r border-gray-100"></td>;
                  }

                  const format = cell.format || {};
                  const isHeader = cell.valueType === 'header';
                  const isHistorical = cell.metadata?.isHistorical;

                  // Build cell styles
                  const cellStyle: React.CSSProperties = {
                    fontWeight: format.bold ? 'bold' : 'normal',
                    fontStyle: format.italic ? 'italic' : 'normal',
                    textDecoration: format.underline ? 'underline' : 'none',
                    fontSize: format.fontSize ? `${format.fontSize}px` : undefined,
                    color: format.fontColor || (isHistorical === false ? '#0066CC' : '#000000'),
                    backgroundColor: format.backgroundColor,
                    textAlign: format.align || (cell.valueType === 'number' ? 'right' : 'left'),
                    verticalAlign: format.verticalAlign || 'middle',
                    paddingLeft: format.indent ? `${format.indent * 16}px` : undefined,
                    borderTop: format.borderTop ? '2px solid #000' : undefined,
                    borderBottom: format.borderBottom ? '2px solid #000' : undefined,
                    borderLeft: format.borderLeft ? '1px solid #000' : undefined,
                    borderRight: format.borderRight ? '1px solid #000' : undefined,
                  };

                  const cellClasses = [
                    'p-2 border-r border-gray-100',
                    isHeader && 'bg-gray-50 font-semibold',
                    cell.valueType === 'number' && 'font-mono tabular-nums',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  const displayValue = cell.displayValue || cell.value?.toString() || '';

                  return (
                    <td
                      key={colIdx}
                      className={cellClasses}
                      style={cellStyle}
                      title={cell.metadata?.lineId}
                    >
                      {displayValue}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Charts */}
      {charts && charts.length > 0 && (
        <div className="p-6 bg-gray-50 border-t border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Charts</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {charts.map((chart, idx) => (
              <div key={idx} className="bg-white p-4 rounded border border-gray-200">
                <h4 className="font-medium text-sm text-gray-700 mb-2">{chart.title}</h4>
                <div className="text-sm text-gray-500">
                  Chart: {chart.chartType} ({chart.series.length} series)
                </div>
                {/* TODO: Integrate with charting library (Chart.js, Recharts, etc.) */}
                <div className="mt-2 h-48 bg-gray-50 rounded flex items-center justify-center text-gray-400 text-xs">
                  Chart visualization coming soon
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
