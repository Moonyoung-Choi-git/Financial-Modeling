/**
 * API: Get Viewer Sheets for a Snapshot
 * GET /api/viewer/[snapshotId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { getViewerSheets } from '@/lib/viewer';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ snapshotId: string }> }
) {
  try {
    const { snapshotId } = await context.params;

    const sheets = await getViewerSheets(snapshotId);

    if (sheets.length === 0) {
      return NextResponse.json(
        { error: 'No viewer sheets found for this snapshot' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      snapshotId,
      sheets,
      count: sheets.length,
    });
  } catch (error: any) {
    console.error('[API] Error fetching viewer sheets:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
