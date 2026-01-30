/**
 * Viewer Sheet Persistence
 * Saves generated viewer sheets to database
 */

import { ViewerSheetOutput } from './types';
import prisma from '../db';

export interface SaveViewerSheetsParams {
  snapshotId: string;
  sheets: ViewerSheetOutput[];
}

export interface SaveViewerSheetsResult {
  success: boolean;
  sheetsCreated: number;
  error?: string;
}

/**
 * Save viewer sheets to database
 */
export async function saveViewerSheets(
  params: SaveViewerSheetsParams
): Promise<SaveViewerSheetsResult> {
  const { snapshotId, sheets } = params;

  try {
    console.log(`[ViewerSheetSaver] Saving ${sheets.length} sheets for snapshot ${snapshotId}`);

    // Delete existing sheets for this snapshot (if regenerating)
    await prisma.modelViewerSheet.deleteMany({
      where: { snapshotId },
    });

    // Create new sheets
    for (const sheet of sheets) {
      await prisma.modelViewerSheet.create({
        data: {
          snapshotId,
          sheetName: sheet.sheetName,
          gridJson: sheet.grid as any, // Prisma Json type
          chartJson: sheet.charts as any,
          lastGeneratedAt: sheet.generatedAt,
          cacheHash: sheet.cacheHash,
        },
      });
    }

    console.log(`[ViewerSheetSaver] Saved ${sheets.length} viewer sheets`);

    return {
      success: true,
      sheetsCreated: sheets.length,
    };
  } catch (error: any) {
    console.error('[ViewerSheetSaver] Error saving sheets:', error);
    return {
      success: false,
      sheetsCreated: 0,
      error: error.message,
    };
  }
}

/**
 * Retrieve viewer sheets from database
 */
export async function getViewerSheets(snapshotId: string): Promise<ViewerSheetOutput[]> {
  const sheets = await prisma.modelViewerSheet.findMany({
    where: { snapshotId },
    orderBy: { sheetName: 'asc' },
  });

  return sheets.map((sheet) => ({
    snapshotId: sheet.snapshotId,
    sheetName: sheet.sheetName,
    grid: sheet.gridJson as any,
    charts: (sheet.chartJson as any) || [],
    generatedAt: sheet.lastGeneratedAt,
    cacheHash: sheet.cacheHash || '',
  }));
}

/**
 * Get a single viewer sheet
 */
export async function getViewerSheet(
  snapshotId: string,
  sheetName: string
): Promise<ViewerSheetOutput | null> {
  const sheet = await prisma.modelViewerSheet.findUnique({
    where: {
      snapshotId_sheetName: {
        snapshotId,
        sheetName,
      },
    },
  });

  if (!sheet) {
    return null;
  }

  return {
    snapshotId: sheet.snapshotId,
    sheetName: sheet.sheetName,
    grid: sheet.gridJson as any,
    charts: (sheet.chartJson as any) || [],
    generatedAt: sheet.lastGeneratedAt,
    cacheHash: sheet.cacheHash || '',
  };
}
