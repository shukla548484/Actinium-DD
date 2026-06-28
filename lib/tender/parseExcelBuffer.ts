import { parseExcelBuffer as parseQuoteBuffer } from "@/lib/excel/parseQuote";
import type { ParsedExcelItem } from "@/lib/tender/matchExcelToSpec";

export function parseExcelBuffer(
  buffer: ArrayBuffer,
  fileName: string,
): ParsedExcelItem[] {
  const quote = parseQuoteBuffer(buffer, fileName);
  return quote.items.map((item) => ({
    serviceName: item.serviceName,
    category: item.category,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    sheetName: item.sheetName,
    rowIndex: item.rowIndex,
  }));
}
