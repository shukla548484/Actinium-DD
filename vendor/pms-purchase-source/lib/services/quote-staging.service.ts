import { prisma, getDirectPrismaClient } from '@/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { loadRequisitionLineIdentities, resolveQuoteLineLinks } from '@/lib/procurement/link-quote-items-to-requisition';

/** Rows per DB write batch — keeps serverless imports under timeout. */
export const QUOTE_STAGING_CHUNK_SIZE = 10;

export type QuoteImportSnapshotVerify = {
  lineCount: number;
  pricedLineCount: number;
};

export type QuoteStagingLineItem = {
  itemName: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
  deliveryTime: string | null;
  remarks?: string;
  lineNumber?: number;
  partNumber?: string | null;
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function lineHasPrice(item: { unitPrice?: unknown; totalPrice?: unknown }): boolean {
  const u = item.unitPrice != null ? Number(item.unitPrice) : 0;
  const t = item.totalPrice != null ? Number(item.totalPrice) : 0;
  return (Number.isFinite(u) && u > 0) || (Number.isFinite(t) && t > 0);
}

/**
 * Log processing steps to a text file for error tracing
 * Exported for use in quote-parser.ts
 */
export async function logToFile(quoteId: string, step: string, data: any, error?: any) {
  try {
    const logDir = join(process.cwd(), 'logs', 'quote-processing');
    
    // Create logs directory if it doesn't exist
    if (!existsSync(logDir)) {
      await mkdir(logDir, { recursive: true });
    }
    
    const logFile = join(logDir, `quote-${quoteId}-${new Date().toISOString().split('T')[0]}.log`);
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${step}\n${JSON.stringify(data, null, 2)}${error ? `\nERROR: ${error.message}\n${error.stack}` : ''}\n\n`;
    
    // Append to log file
    await writeFile(logFile, logEntry, { flag: 'a' });
    console.log(`📝 Logged to file: ${logFile}`);
  } catch (logError) {
    console.error('Failed to write to log file:', logError);
    // Don't throw - logging failure shouldn't break processing
  }
}

/**
 * Write Excel parsed data to staging table in chunks of 10 rows.
 */
export async function writeToStagingTable(
  quoteId: string,
  emailId: string | null,
  attachmentId: string | null,
  items: QuoteStagingLineItem[]
): Promise<{ success: boolean; stagingItemIds: string[]; error?: string }> {
  const logData: any = {
    quoteId,
    emailId,
    attachmentId,
    itemsCount: items.length,
    chunkSize: QUOTE_STAGING_CHUNK_SIZE,
    timestamp: new Date().toISOString(),
  };

  try {
    await logToFile(quoteId, 'STEP 1: Starting staging write', logData);

    await logToFile(quoteId, 'STEP 1.1: Clearing old staging data', { quoteId });
    const deletedStaging = await prisma.quoteItemStaging.deleteMany({
      where: { quoteId, processed: false },
    });
    await logToFile(quoteId, 'STEP 1.1: Cleared old staging data', { deletedCount: deletedStaging.count });

    await logToFile(quoteId, 'STEP 2: Writing items to staging table (chunked)', {
      itemsCount: items.length,
      chunks: Math.ceil(items.length / QUOTE_STAGING_CHUNK_SIZE),
    });

    const stagingItemIds: string[] = [];
    const chunks = chunkArray(items, QUOTE_STAGING_CHUNK_SIZE);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      const baseOffset = chunkIndex * QUOTE_STAGING_CHUNK_SIZE;

      const created = await Promise.all(
        chunk.map((item, indexInChunk) => {
          const globalIndex = baseOffset + indexInChunk;
          return prisma.quoteItemStaging.create({
            data: {
              quoteId,
              emailId,
              attachmentId,
              itemName: item.itemName.trim(),
              description: item.description || null,
              quantity: item.quantity || 0,
              unit: item.unit || '',
              unitPrice: item.unitPrice,
              totalPrice: item.totalPrice,
              deliveryTime: item.deliveryTime,
              remarks: item.remarks || null,
              rowIndex:
                item.lineNumber && item.lineNumber > 0
                  ? item.lineNumber
                  : globalIndex + 1,
              processed: false,
            },
          });
        })
      );

      stagingItemIds.push(...created.map((row) => row.id));
      await logToFile(quoteId, `STEP 2: Staging chunk ${chunkIndex + 1}/${chunks.length} written`, {
        chunkRows: created.length,
        totalWritten: stagingItemIds.length,
      });
    }

    await logToFile(quoteId, 'STEP 2: Staging write complete', {
      stagingItemIds: stagingItemIds.length,
      itemsWritten: stagingItemIds.length,
    });

    return {
      success: true,
      stagingItemIds,
    };
  } catch (error: any) {
    await logToFile(quoteId, 'STEP 2: Staging write failed', logData, error);
    return {
      success: false,
      stagingItemIds: [],
      error: error.message || 'Unknown error writing to staging table',
    };
  }
}

export type StagingVerifyOptions = {
  strictCount?: boolean;
  expectedPricedLines?: number;
};

/**
 * Verify staging rows match the JSON snapshot expectations.
 */
export async function verifyStagingData(
  quoteId: string,
  expectedCount: number,
  options: StagingVerifyOptions = {}
): Promise<{ success: boolean; actualCount: number; items: any[]; error?: string }> {
  const { strictCount = true, expectedPricedLines } = options;

  try {
    await logToFile(quoteId, 'STEP 3: Verifying staging data', {
      quoteId,
      expectedCount,
      strictCount,
      expectedPricedLines,
    });

    const stagingItems = await prisma.quoteItemStaging.findMany({
      where: {
        quoteId,
        processed: false,
      },
      orderBy: {
        rowIndex: 'asc',
      },
    });

    const actualCount = stagingItems.length;
    const actualPriced = stagingItems.filter(lineHasPrice).length;

    await logToFile(quoteId, 'STEP 3: Verification complete', {
      expectedCount,
      actualCount,
      actualPriced,
      items: stagingItems.map((item) => ({
        id: item.id,
        itemName: item.itemName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
    });

    if (actualCount === 0) {
      return {
        success: false,
        actualCount: 0,
        items: [],
        error: 'No items found in staging table',
      };
    }

    if (strictCount && actualCount !== expectedCount) {
      return {
        success: false,
        actualCount,
        items: stagingItems,
        error: `Staging row count mismatch: expected ${expectedCount}, found ${actualCount}`,
      };
    }

    if (
      expectedPricedLines != null &&
      expectedPricedLines > 0 &&
      actualPriced !== expectedPricedLines
    ) {
      return {
        success: false,
        actualCount,
        items: stagingItems,
        error: `Staging priced-line count mismatch: expected ${expectedPricedLines}, found ${actualPriced}`,
      };
    }

    return {
      success: true,
      actualCount,
      items: stagingItems,
    };
  } catch (error: any) {
    await logToFile(quoteId, 'STEP 3: Verification failed', { quoteId, expectedCount }, error);
    return {
      success: false,
      actualCount: 0,
      items: [],
      error: error.message || 'Unknown error verifying staging data',
    };
  }
}

async function createProductionRowsInChunks(
  quoteItemRows: Array<{
    quoteId: string;
    requisitionItemId: string | null;
    itemName: string;
    description: string;
    quantity: unknown;
    unit: string;
    unitPrice: unknown;
    totalPrice: unknown;
    deliveryTime: string | null;
    remarks: string;
    partNumber: string | null;
  }>
): Promise<number> {
  if (quoteItemRows.length === 0) return 0;

  const chunks = chunkArray(quoteItemRows, QUOTE_STAGING_CHUNK_SIZE);
  let created = 0;

  for (let i = 0; i < chunks.length; i++) {
    const result = await prisma.vendorQuoteItem.createMany({
      data: chunks[i],
    });
    created += result.count;
    await logToFile(quoteItemRows[0].quoteId, `STEP 4: Production chunk ${i + 1}/${chunks.length} written`, {
      chunkRows: result.count,
      totalCreated: created,
    });
  }

  return created;
}

/**
 * Move data from staging table to vendor quote items in chunks of 10 rows.
 */
export async function moveStagingToProduction(
  quoteId: string
): Promise<{ success: boolean; itemsCreated: number; error?: string }> {
  try {
    await logToFile(quoteId, 'STEP 4: Starting move from staging to production', { quoteId });

    const stagingItems = await prisma.quoteItemStaging.findMany({
      where: {
        quoteId,
        processed: false,
      },
      orderBy: {
        rowIndex: 'asc',
      },
    });

    if (stagingItems.length === 0) {
      await logToFile(quoteId, 'STEP 4: No staging items found', { quoteId });
      return {
        success: false,
        itemsCreated: 0,
        error: 'No staging items found to move',
      };
    }

    await logToFile(quoteId, 'STEP 4.1: Found staging items', { count: stagingItems.length });

    const quote = await prisma.vendorQuote.findUnique({
      where: { id: quoteId },
      select: { requisitionId: true },
    });

    const requisitionLines = quote?.requisitionId
      ? await loadRequisitionLineIdentities(prisma, quote.requisitionId)
      : [];

    const quoteItemRows = stagingItems.map((stagingItem) => {
      const { requisitionItemId, partNumber } = resolveQuoteLineLinks(
        {
          lineNumber: stagingItem.rowIndex,
          itemName: stagingItem.itemName,
          description: stagingItem.description,
        },
        requisitionLines
      );

      return {
        quoteId,
        requisitionItemId,
        itemName: stagingItem.itemName,
        description: stagingItem.description || "",
        quantity: stagingItem.quantity,
        unit: stagingItem.unit,
        unitPrice: stagingItem.unitPrice,
        totalPrice: stagingItem.totalPrice,
        deliveryTime: stagingItem.deliveryTime,
        remarks: stagingItem.remarks || "",
        partNumber,
      };
    });

    const directClient = getDirectPrismaClient();
    let itemsCreated = 0;

    if (directClient) {
      itemsCreated = await directClient.$transaction(
        async (tx) => {
          await tx.vendorQuoteItem.deleteMany({ where: { quoteId } });

          const chunks = chunkArray(quoteItemRows, QUOTE_STAGING_CHUNK_SIZE);
          let created = 0;
          for (let i = 0; i < chunks.length; i++) {
            const result = await tx.vendorQuoteItem.createMany({ data: chunks[i] });
            created += result.count;
          }

          await tx.quoteItemStaging.updateMany({
            where: { quoteId, processed: false },
            data: { processed: true },
          });

          return created;
        },
        { timeout: 120_000, maxWait: 15_000 }
      );
    } else {
      await prisma.vendorQuoteItem.deleteMany({ where: { quoteId } });
      itemsCreated = await createProductionRowsInChunks(quoteItemRows);
      await prisma.quoteItemStaging.updateMany({
        where: { quoteId, processed: false },
        data: { processed: true },
      });
    }

    await logToFile(quoteId, 'STEP 4: Move to production complete', { itemsCreated });

    return {
      success: true,
      itemsCreated,
    };
  } catch (error: any) {
    await logToFile(quoteId, 'STEP 4: Move to production failed', { quoteId }, error);
    return {
      success: false,
      itemsCreated: 0,
      error: error.message || 'Unknown error moving staging to production',
    };
  }
}

/**
 * Compare production quote lines against the JSON snapshot (count + priced lines).
 */
export async function verifyProductionAgainstSnapshot(
  quoteId: string,
  snapshot: QuoteImportSnapshotVerify
): Promise<{ success: boolean; error?: string; productionCount?: number; pricedCount?: number }> {
  const productionItems = await prisma.vendorQuoteItem.findMany({
    where: { quoteId },
    select: {
      itemName: true,
      unitPrice: true,
      totalPrice: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const productionCount = productionItems.length;
  const pricedCount = productionItems.filter(lineHasPrice).length;

  await logToFile(quoteId, 'STEP 5: Production verification', {
    expectedLines: snapshot.lineCount,
    productionCount,
    expectedPriced: snapshot.pricedLineCount,
    pricedCount,
  });

  if (productionCount !== snapshot.lineCount) {
    return {
      success: false,
      productionCount,
      pricedCount,
      error: `Production line count mismatch: JSON has ${snapshot.lineCount}, DB has ${productionCount}`,
    };
  }

  if (snapshot.pricedLineCount > 0 && pricedCount !== snapshot.pricedLineCount) {
    return {
      success: false,
      productionCount,
      pricedCount,
      error: `Production priced-line mismatch: JSON has ${snapshot.pricedLineCount}, DB has ${pricedCount}`,
    };
  }

  if (snapshot.pricedLineCount > 0 && pricedCount === 0) {
    return {
      success: false,
      productionCount,
      pricedCount,
      error: 'Production rows exist but none have vendor prices',
    };
  }

  return { success: true, productionCount, pricedCount };
}

/**
 * Clean up processed staging items (optional - can be run periodically)
 */
export async function cleanupStagingItems(olderThanDays: number = 7) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const deleted = await prisma.quoteItemStaging.deleteMany({
      where: {
        processed: true,
        updatedAt: {
          lt: cutoffDate,
        },
      },
    });

    console.log(`🧹 Cleaned up ${deleted.count} old staging items`);
    return deleted.count;
  } catch (error: any) {
    console.error('Error cleaning up staging items:', error);
    return 0;
  }
}
