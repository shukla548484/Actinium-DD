import { prisma } from '../prisma';

/**
 * Generate Purchase Order number in format: XXXX.YY.STR.0001
 * Where:
 * - XXXX = Vessel 4 letter code
 * - YY = Running year (2 digits)
 * - STR = Store type shorthand (from requisition type)
 * - 0001 = Auto-incrementing unique number (resets every year)
 * 
 * PO number is unique per vessel per year
 */
export async function generatePONumber(
  vesselId: string,
  requisitionType: string
): Promise<string> {
  try {
    console.log(`🔵 [PO-NUMBER] Generating PO number for vessel: ${vesselId}, type: ${requisitionType}`);
    
    // Get vessel to get code
    const vessel = await prisma.vessel.findUnique({
      where: { id: vesselId },
      select: { code: true },
    });

    if (!vessel || !vessel.code) {
      console.error(`❌ [PO-NUMBER] Vessel not found or missing code: ${vesselId}`);
      throw new Error(`Vessel not found or missing code for vessel ID: ${vesselId}`);
    }
    
    console.log(`✅ [PO-NUMBER] Vessel found: ${vessel.code}`);

    // Get 4-letter vessel code (uppercase, pad if needed)
    const vesselCode = vessel.code.toUpperCase().substring(0, 4).padEnd(4, 'X');
    
    // Get current year (2 digits)
    const currentYear = new Date().getFullYear().toString().slice(-2);
    
    // Map requisition type to shorthand
    const typeShorthand: Record<string, string> = {
      'STR': 'STR', // Stores
      'SPR': 'SPR', // Spares
      'GLY': 'GLY', // Galley
      'PNT': 'PNT', // Paint
      'REP': 'REP', // Repairs
      'SER': 'SER', // Services
      'CTM': 'CTM', // CTM
      'PRO': 'PRO', // Provisions
      'BNK': 'BNK', // Bunkering
      'LUB': 'LUB', // Lubricants
      'FCL': 'FCL', // FCL
      'OTR': 'OTR', // Other
    };
    
    const typeCode = typeShorthand[requisitionType] || 'OTR';
    
    // Find the highest PO number for this vessel and year
    // Optimized: Single query to get max PO number directly
    const currentYearFull = new Date().getFullYear();
    const yearStart = new Date(currentYearFull, 0, 1);
    const yearEnd = new Date(currentYearFull + 1, 0, 1);
    
    // PO number format: XXXX.YY.TYPE.0001
    const poNumberPrefix = `${vesselCode}.${currentYear}.${typeCode}.`;
    
    // Optimized: Get all PO numbers matching the prefix in a single query
    // Then find the max number client-side (faster than multiple queries)
    const existingPOs = await prisma.purchaseOrder.findMany({
      where: {
        poNumber: {
          startsWith: poNumberPrefix,
        },
        dateOfIssue: {
          gte: yearStart,
          lt: yearEnd,
        },
      },
      select: {
        poNumber: true,
      },
      // No need to order - we'll find max client-side
      take: 1000, // Increased limit for better accuracy
    });

    let nextNumber = 1;
    
    // Extract PO numbers and find max (more efficient than multiple DB queries)
    if (existingPOs.length > 0) {
      const existingPONumbers = existingPOs
        .map(po => {
          const match = po.poNumber.match(/\.(\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter(num => !isNaN(num) && num > 0);
      
      if (existingPONumbers.length > 0) {
        nextNumber = Math.max(...existingPONumbers) + 1;
      }
    }

    // Generate PO number and verify availability (single check)
    let poNumber = `${vesselCode}.${currentYear}.${typeCode}.${nextNumber.toString().padStart(4, '0')}`;
    let attempts = 0;
    const maxAttempts = 100; // Reduced from 1000 since we already found the max
    
    // Single availability check - if occupied, increment once
    while (attempts < maxAttempts) {
      const existingPO = await prisma.purchaseOrder.findUnique({
        where: { poNumber: poNumber },
        select: { id: true },
      });
      
      if (!existingPO) {
        // PO number is available
        console.log(`✅ [PO-NUMBER] Generated available PO number: ${poNumber} (attempt ${attempts + 1})`);
        return poNumber;
      }
      
      // PO number is occupied, increment and try again
      nextNumber++;
      poNumber = `${vesselCode}.${currentYear}.${typeCode}.${nextNumber.toString().padStart(4, '0')}`;
      attempts++;
    }
    
    // If we've exhausted all attempts, throw an error
    throw new Error(`Failed to generate available PO number after ${maxAttempts} attempts`);
  } catch (error: any) {
    console.error('❌ [PO-NUMBER] Error generating PO number:', error);
    console.error('❌ [PO-NUMBER] Error stack:', error.stack);
    throw new Error(`Failed to generate PO number: ${error.message}`);
  }
}

/**
 * Reserve a PO number to ensure uniqueness
 */
export async function reservePONumber(
  vesselId: string,
  requisitionType: string,
  poNumber: string,
  reservedBy: string
): Promise<void> {
  try {
    // This will be implemented once we have the PurchaseOrderNumberReservation table
    // For now, we'll just log it
    console.log(`📋 PO Number reserved: ${poNumber} for vessel ${vesselId} by ${reservedBy}`);
  } catch (error: any) {
    console.error('Error reserving PO number:', error);
    // Don't throw - reservation failure shouldn't break PO creation
  }
}

