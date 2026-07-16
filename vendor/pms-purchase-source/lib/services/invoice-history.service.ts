import { prisma } from '../prisma';

export enum InvoiceHistoryActionType {
  CREATED = 'CREATED',
  UPDATED = 'UPDATED',
  LEVEL_ONE_APPROVED = 'LEVEL_ONE_APPROVED',
  LEVEL_TWO_APPROVED = 'LEVEL_TWO_APPROVED',
  LEVEL_THREE_APPROVED = 'LEVEL_THREE_APPROVED',
  LEVEL_FOUR_APPROVED = 'LEVEL_FOUR_APPROVED',
  RETURNED = 'RETURNED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  COMMENT_ADDED = 'COMMENT_ADDED',
}

export interface CreateInvoiceHistoryParams {
  invoiceId: string;
  actionType: InvoiceHistoryActionType;
  performedById: string;
  actionDescription?: string;
  previousStatus?: string;
  newStatus?: string;
  previousValue?: any;
  newValue?: any;
  comments?: string;
}

/**
 * Record invoice history entry
 */
export async function recordInvoiceHistory(params: CreateInvoiceHistoryParams): Promise<void> {
  try {
    await prisma.invoiceHistory.create({
      data: {
        invoiceId: params.invoiceId,
        actionType: params.actionType as any,
        performedById: params.performedById,
        actionDescription: params.actionDescription || null,
        previousStatus: params.previousStatus || null,
        newStatus: params.newStatus || null,
        previousValue: params.previousValue ? JSON.stringify(params.previousValue) : null,
        newValue: params.newValue ? JSON.stringify(params.newValue) : null,
        comments: params.comments || null,
      },
    });
  } catch (error) {
    console.error('Error recording invoice history:', error);
    // Don't throw - history recording should not break the main operation
  }
}

/**
 * Get invoice history
 */
export async function getInvoiceHistory(invoiceId: string) {
  try {
    return await prisma.invoiceHistory.findMany({
      where: { invoiceId },
      include: {
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  } catch (error) {
    console.error('Error fetching invoice history:', error);
    return [];
  }
}
















