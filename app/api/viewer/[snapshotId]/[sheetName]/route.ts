/**
 * API: Get Single Viewer Sheet
 * GET /api/viewer/[snapshotId]/[sheetName]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getViewerSheet } from '@/lib/viewer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ snapshotId: string; sheetName: string }> }
) {
  try {
    const { snapshotId, sheetName } = await context.params;

    const sheet = await getViewerSheet(snapshotId, sheetName);

    if (!sheet) {
      return NextResponse.json(
        { error: 'Viewer sheet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(sheet);
  } catch (error: any) {
    console.error('[API] Error fetching viewer sheet:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
