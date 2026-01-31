/**
 * API: Export Snapshot to XLSX
 * GET /api/export/[snapshotId]
 */

import { NextRequest, NextResponse } from 'next/server';
import { exportToXlsx } from '@/lib/viewer';
import prisma from '@/lib/db';

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ snapshotId: string }> }
) {
  try {
    const { snapshotId } = await context.params;

    // Get snapshot metadata for company name
    const snapshot = await prisma.modelSnapshot.findUnique({
      where: { id: snapshotId },
      include: {
        entity: {
          select: { displayName: true },
        },
      },
    });

    if (!snapshot) {
      return NextResponse.json(
        { error: 'Snapshot not found' },
        { status: 404 }
      );
    }

    // Export to XLSX
    const result = await exportToXlsx({
      snapshotId,
      includeSheets: ['IS', 'BS', 'CF', 'Summary', 'Checks'],
      includeFormulas: false,
      includeFormatting: true,
      companyName: snapshot.entity?.displayName || 'Financial Model',
    });

    if (!result.success || !result.buffer) {
      return NextResponse.json(
        { error: result.error || 'Export failed' },
        { status: 500 }
      );
    }

    // Return file
    // Convert Buffer to Uint8Array for NextResponse
    const uint8Array = new Uint8Array(result.buffer);

    return new NextResponse(uint8Array, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${result.fileName}"`,
      },
    });
  } catch (error: any) {
    console.error('[API] XLSX export error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
