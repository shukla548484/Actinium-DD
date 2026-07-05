export type ParsedEquipmentMasterRow = {
  rowNumber: number;
  equipmentCode: string;
  machinery: string;
  system: string;
  equipmentComponent: string;
  department: string;
  vesselType: string;
  remarks: string | null;
};

export type ParsedComponentMasterRow = {
  rowNumber: number;
  componentCode: string;
  equipmentCode: string;
  componentName: string;
  componentType: string;
  activeFlag: boolean;
  system: string;
  owner: string | null;
};

export type ParsedToolMasterRow = {
  rowNumber: number;
  toolId: string;
  templateId: string;
  toolName: string;
  toolType: string;
  mandatory: boolean;
  remarks: string | null;
};

export type EmdrSprintMasterData = {
  equipmentMaster: ParsedEquipmentMasterRow[];
  componentMaster: ParsedComponentMasterRow[];
  tools: ParsedToolMasterRow[];
};
