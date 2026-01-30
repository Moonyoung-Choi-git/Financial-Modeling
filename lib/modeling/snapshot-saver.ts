/**
 * Model Snapshot Persistence
 * Saves ModelSnapshotOutput to database
 */

import { ModelSnapshotOutput, Statement } from './model-types';
import prisma from '../db';
import { Decimal } from '@prisma/client/runtime/library';

export interface SaveSnapshotParams {
  entityId: string;
  snapshot: ModelSnapshotOutput;
}

export interface SaveSnapshotResult {
  snapshotId: string;
  linesCreated: number;
  success: boolean;
  error?: string;
}

/**
 * Save model snapshot to database
 */
export async function saveModelSnapshot(
  params: SaveSnapshotParams
): Promise<SaveSnapshotResult> {
  const { entityId, snapshot } = params;
  const startTime = Date.now();

  try {
    console.log(`[SnapshotSaver] Saving snapshot for entity ${entityId}`);

    // Create ModelSnapshot record
    const snapshotRecord = await prisma.modelSnapshot.create({
      data: {
        id: snapshot.snapshotId,
        entityId,
        assumptionSetId: null, // MVP: No assumptions yet
        sourceDataCutoff: snapshot.metadata.createdAt,
        usedRceptNoList: snapshot.metadata.usedRceptNoList,
        usedCuratedVersionHash: null,
        usedMappingVersion: null,
        calcEngineVersion: snapshot.metadata.calcEngineVersion,
        snapshotHash: snapshot.metadata.snapshotHash,
        createdAt: snapshot.metadata.createdAt,
      },
    });

    console.log(`[SnapshotSaver] Created snapshot record: ${snapshotRecord.id}`);

    // Save all statement lines
    let totalLinesCreated = 0;

    // IS lines
    const isLines = await saveStatementLines(
      snapshot.snapshotId,
      snapshot.incomeStatement
    );
    totalLinesCreated += isLines;
    console.log(`[SnapshotSaver] Saved ${isLines} IS lines`);

    // BS lines
    const bsLines = await saveStatementLines(
      snapshot.snapshotId,
      snapshot.balanceSheet
    );
    totalLinesCreated += bsLines;
    console.log(`[SnapshotSaver] Saved ${bsLines} BS lines`);

    // CF lines
    const cfLines = await saveStatementLines(
      snapshot.snapshotId,
      snapshot.cashFlowStatement
    );
    totalLinesCreated += cfLines;
    console.log(`[SnapshotSaver] Saved ${cfLines} CF lines`);

    const duration = Date.now() - startTime;
    console.log(`[SnapshotSaver] Total lines created: ${totalLinesCreated} (${duration}ms)`);

    return {
      snapshotId: snapshot.snapshotId,
      linesCreated: totalLinesCreated,
      success: true,
    };
  } catch (error: any) {
    console.error('[SnapshotSaver] Error saving snapshot:', error);
    return {
      snapshotId: snapshot.snapshotId,
      linesCreated: 0,
      success: false,
      error: error.message,
    };
  }
}

/**
 * Save all lines from a single statement
 */
async function saveStatementLines(
  snapshotId: string,
  statement: Statement
): Promise<number> {
  const { statementType, lines, timeline } = statement;

  const outputLines = [];

  for (const line of lines) {
    // For each period in this line
    for (const [periodIndex, value] of line.values.entries()) {
      const period = timeline.periods.find((p) => p.index === periodIndex);

      if (!period) {
        console.warn(
          `[SnapshotSaver] Period not found for index ${periodIndex}, skipping`
        );
        continue;
      }

      outputLines.push({
        snapshotId,
        statementType,
        standardLineId: line.lineId,
        periodIndex,
        fiscalYear: period.fiscalYear,
        fiscalQuarter: period.fiscalQuarter,
        periodType: period.periodType,
        value,
        unitScale: line.unit,
        displayOrder: line.displayOrder,
        isHistorical: period.isHistorical,
        provenance: line.provenance,
      });
    }
  }

  // Batch insert
  if (outputLines.length > 0) {
    await prisma.modelOutputLine.createMany({
      data: outputLines,
    });
  }

  return outputLines.length;
}

/**
 * Retrieve a saved snapshot from database
 */
export async function retrieveModelSnapshot(
  snapshotId: string
): Promise<ModelSnapshotOutput | null> {
  const snapshot = await prisma.modelSnapshot.findUnique({
    where: { id: snapshotId },
    include: {
      outputLines: {
        orderBy: [{ statementType: 'asc' }, { displayOrder: 'asc' }, { periodIndex: 'asc' }],
      },
    },
  });

  if (!snapshot) {
    return null;
  }

  // TODO: Reconstruct ModelSnapshotOutput from database records
  // For now, just return null as we mainly focus on saving
  return null;
}
