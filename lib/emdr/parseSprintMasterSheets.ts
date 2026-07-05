import { cellStr, ynBool } from "@/lib/mtil/import/excelValues";
import { MASTER_ENTITY_CODES, normalizeMasterId } from "@/lib/mtil/masterCodeStandard";
import type {
  ParsedComponentMasterRow,
  ParsedEquipmentMasterRow,
  ParsedToolMasterRow,
} from "@/lib/emdr/types";

export function parseEquipmentMaster(rows: Array<Record<string, unknown>>): ParsedEquipmentMasterRow[] {
  return rows
    .map((row, index) => {
      const rawCode = cellStr(row["Equipment Code"]);
      if (!rawCode) return null;
      return {
        rowNumber: index + 2,
        equipmentCode: normalizeMasterId(rawCode, MASTER_ENTITY_CODES.EQPM),
        machinery: cellStr(row["Machinery"]),
        system: cellStr(row["System"]),
        equipmentComponent: cellStr(row["Equipment / Component"]),
        department: cellStr(row["Department"]),
        vesselType: cellStr(row["Vessel Type"]),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedEquipmentMasterRow => row !== null);
}

export function parseComponentMaster(rows: Array<Record<string, unknown>>): ParsedComponentMasterRow[] {
  return rows
    .map((row, index) => {
      const rawCode = cellStr(row["Component Code"]);
      if (!rawCode) return null;
      const rawEquip = cellStr(row["Equipment Code"]);
      return {
        rowNumber: index + 2,
        componentCode: normalizeMasterId(rawCode, MASTER_ENTITY_CODES.COMP),
        equipmentCode: rawEquip ? normalizeMasterId(rawEquip, MASTER_ENTITY_CODES.EQPM) : "",
        componentName: cellStr(row["Component Name"]),
        componentType: cellStr(row["Component Type"]),
        activeFlag: ynBool(row["Active"], "Active"),
        system: cellStr(row["System"]),
        owner: cellStr(row["Owner"]) || null,
      };
    })
    .filter((row): row is ParsedComponentMasterRow => row !== null);
}

export function parseToolMaster(rows: Array<Record<string, unknown>>): ParsedToolMasterRow[] {
  return rows
    .map((row, index) => {
      const toolId = cellStr(row["Tool ID"]);
      if (!toolId) return null;
      return {
        rowNumber: index + 2,
        toolId: normalizeMasterId(toolId, MASTER_ENTITY_CODES.TOOL),
        templateId: normalizeMasterId(cellStr(row["Template ID"]), MASTER_ENTITY_CODES.TMPL),
        toolName: cellStr(row["Tool / Instrument"] ?? row["Tool Name"]),
        toolType: cellStr(row["Type"]),
        mandatory: ynBool(row["Mandatory"], "Mandatory"),
        remarks: cellStr(row["Remarks"]) || null,
      };
    })
    .filter((row): row is ParsedToolMasterRow => row !== null);
}
