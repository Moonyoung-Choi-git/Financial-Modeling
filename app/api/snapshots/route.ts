/**
 * API: List Model Snapshots
 * GET /api/snapshots
 */

import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityId = searchParams.get('entityId');

    const where = entityId ? { entityId } : {};

    const snapshots = await prisma.modelSnapshot.findMany({
      where,
      include: {
        entity: {
          select: {
            displayName: true,
            corpCode: true,
            stockCode: true,
          },
        },
        _count: {
          select: {
            outputLines: true,
            viewerSheets: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return NextResponse.json({
      snapshots: snapshots.map((s) => ({
        id: s.id,
        entityId: s.entityId,
        entity: s.entity,
        calcEngineVersion: s.calcEngineVersion,
        createdAt: s.createdAt,
        outputLines: s._count.outputLines,
        viewerSheets: s._count.viewerSheets,
      })),
      count: snapshots.length,
    });
  } catch (error: any) {
    console.error('[API] Error fetching snapshots:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}
