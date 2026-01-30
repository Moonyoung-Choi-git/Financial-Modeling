/**
 * XLSX Export (명세서 Section 7.2)
 *
 * Exports model snapshot to Excel format with formatting
 */

import * as XLSX from 'xlsx';
import { ViewerSheetOutput, XlsxExportOptions, XlsxExportResult } from './types';
import { getViewerSheets } from './sheet-saver';

/**
 * Export viewer sheets to XLSX
 */
export async function exportToXlsx(
  options: XlsxExportOptions
): Promise<XlsxExportResult> {
  try {
    const {
      snapshotId,
      includeSheets = ['IS', 'BS', 'CF', 'Summary', 'Checks'],
      includeFormulas = false,
      includeFormatting = true,
      companyName = 'Financial Model',
      fileName,
    } = options;

    console.log(`[XlsxExporter] Exporting snapshot ${snapshotId} to XLSX`);

    // Get viewer sheets from database
    const viewerSheets = await getViewerSheets(snapshotId);

    if (viewerSheets.length === 0) {
      return {
        success: false,
        fileName: '',
        error: 'No viewer sheets found for this snapshot',
      };
    }

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Filter sheets based on includeSheets
    const filteredSheets = viewerSheets.filter((sheet) =>
      includeSheets.some((name) => sheet.sheetName.includes(name))
    );

    for (const viewerSheet of filteredSheets) {
      const worksheet = createWorksheet(viewerSheet, includeFormatting);
      XLSX.utils.book_append_sheet(workbook, worksheet, viewerSheet.sheetName);
    }

    // Generate filename
    const timestamp = new Date().toISOString().split('T')[0];
    const finalFileName = fileName || `${companyName}_Model_${timestamp}.xlsx`;

    // Generate buffer
    const buffer = XLSX.write(workbook, {
      type: 'buffer',
      bookType: 'xlsx',
      cellStyles: includeFormatting,
    });

    console.log(`[XlsxExporter] Generated ${finalFileName} with ${filteredSheets.length} sheets`);

    return {
      success: true,
      fileName: finalFileName,
      buffer: buffer as Buffer,
    };
  } catch (error: any) {
    console.error('[XlsxExporter] Export failed:', error);
    return {
      success: false,
      fileName: '',
      error: error.message,
    };
  }
}

/**
 * Create Excel worksheet from ViewerSheetOutput
 */
function createWorksheet(
  viewerSheet: ViewerSheetOutput,
  includeFormatting: boolean
): XLSX.WorkSheet {
  const { grid } = viewerSheet;

  // Create a sparse array for the worksheet
  const wsData: any[][] = [];

  // Initialize all rows
  for (let r = 0; r < grid.rows; r++) {
    wsData[r] = Array(grid.cols).fill(null);
  }

  // Populate cells
  for (const cell of grid.cells) {
    if (cell.row < grid.rows && cell.col < grid.cols) {
      // Use displayValue if available, otherwise raw value
      wsData[cell.row][cell.col] = cell.displayValue || cell.value || '';
    }
  }

  // Create worksheet from array
  const worksheet = XLSX.utils.aoa_to_sheet(wsData);

  // Apply formatting if requested
  if (includeFormatting) {
    // Set column widths
    const cols: XLSX.ColInfo[] = [];
    if (grid.columnWidths) {
      for (let col = 0; col < grid.cols; col++) {
        const width = grid.columnWidths[col];
        cols[col] = { wch: width ? width / 8 : 12 }; // Convert pixels to Excel width
      }
    }
    worksheet['!cols'] = cols;

    // Set row heights
    if (grid.rowHeights) {
      const rows: XLSX.RowInfo[] = [];
      for (let row = 0; row < grid.rows; row++) {
        const height = grid.rowHeights[row];
        rows[row] = { hpt: height ? height * 0.75 : 15 }; // Convert pixels to Excel height
      }
      worksheet['!rows'] = rows;
    }

    // Set freeze panes
    if (grid.frozenRows || grid.frozenCols) {
      worksheet['!freeze'] = {
        xSplit: grid.frozenCols || 0,
        ySplit: grid.frozenRows || 0,
        topLeftCell: XLSX.utils.encode_cell({
          r: grid.frozenRows || 0,
          c: grid.frozenCols || 0,
        }),
        activePane: 'bottomRight',
        state: 'frozen',
      };
    }

    // Apply cell styles (basic - xlsx library has limited styling support)
    for (const cell of grid.cells) {
      const cellRef = XLSX.utils.encode_cell({ r: cell.row, c: cell.col });
      const wsCell = worksheet[cellRef];

      if (wsCell && cell.format) {
        wsCell.s = {
          font: {
            bold: cell.format.bold,
            italic: cell.format.italic,
            underline: cell.format.underline,
            sz: cell.format.fontSize,
            color: cell.format.fontColor
              ? { rgb: cell.format.fontColor.replace('#', '') }
              : undefined,
          },
          fill: cell.format.backgroundColor
            ? {
                fgColor: { rgb: cell.format.backgroundColor.replace('#', '') },
                patternType: 'solid',
              }
            : undefined,
          alignment: {
            horizontal: cell.format.align,
            vertical: cell.format.verticalAlign,
            indent: cell.format.indent,
          },
          border: {
            top: cell.format.borderTop ? { style: 'medium' } : undefined,
            bottom: cell.format.borderBottom ? { style: 'medium' } : undefined,
            left: cell.format.borderLeft ? { style: 'thin' } : undefined,
            right: cell.format.borderRight ? { style: 'thin' } : undefined,
          },
        };

        // Number format
        if (cell.valueType === 'number' && cell.format.numberFormat) {
          wsCell.z = cell.format.numberFormat;
        }
      }
    }
  }

  return worksheet;
}
