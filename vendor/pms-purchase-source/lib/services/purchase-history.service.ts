import { prisma } from '../prisma';

export enum PurchaseHistoryActionType {
  CREATED = 'CREATED',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED',
  RETURNED = 'RETURNED',
  SENT_FOR_QUOTE = 'SENT_FOR_QUOTE',
  QUOTE_RECEIVED = 'QUOTE_RECEIVED',
  QUOTE_APPROVED = 'QUOTE_APPROVED',
  COMMENT_ADDED = 'COMMENT_ADDED',
  STATUS_CHANGED = 'STATUS_CHANGED',
  UPDATED = 'UPDATED',
  DELETED = 'DELETED',
}

export interface CreatePurchaseHistoryParams {
  requisitionId: string;
  actionType: PurchaseHistoryActionType;
  performedById: string;
  actionDescription?: string;
  previousStatus?: string;
  newStatus?: string;
  previousValue?: any; // Will be JSON stringified
  newValue?: any; // Will be JSON stringified
  comments?: string;
}

/**
 * Record a purchase history entry
 */
export async function recordPurchaseHistory(params: CreatePurchaseHistoryParams): Promise<void> {
  try {
    await prisma.purchaseHistory.create({
      data: {
        requisitionId: params.requisitionId,
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
    console.error('Error recording purchase history:', error);
    // Don't throw - history recording should not break the main operation
  }
}

/**
 * Get purchase history for a requisition
 */
export async function getPurchaseHistory(requisitionId: string) {
  try {
    return await prisma.purchaseHistory.findMany({
      where: {
        requisitionId,
      },
      include: {
        performedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            designation: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    console.error('Error fetching purchase history:', error);
    throw error;
  }
}

















