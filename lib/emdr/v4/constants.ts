/** V4.1 validated upload / RFQ / budget export — controlled vocabularies. */

export const V41_EXPORT_VERSION = "V4.1";

export const V41_VESSEL_TYPES = [
  "Oil/Product/Chemical Tanker",
  "Bulk Carrier",
  "Container Vessel",
  "LNG/LPG Carrier",
  "RO-RO/PCC/PCTC",
  "General Cargo",
  "All Types",
  "Applicable where fitted",
] as const;

export const V41_BUDGET_CATEGORIES = [
  "Docking Cost",
  "Hull Painting Cost",
  "Machinery Repair Cost",
  "Electrical Repair Cost",
  "Service Engineer Cost",
  "Maker Attendance Cost",
  "Class/Survey Cost",
  "Spares Cost",
  "Stores/Consumables Cost",
  "Agency/Port Cost",
  "Miscellaneous",
] as const;

export type V41BudgetCategory = (typeof V41_BUDGET_CATEGORIES)[number];

export const V41_VALIDATION_STATUSES = ["Pass", "Warning", "Blocked"] as const;
export type V41ValidationStatus = (typeof V41_VALIDATION_STATUSES)[number];

export const V41_JOB_ROUTES = ["PMS", "Dry Dock", "Statutory"] as const;
export type V41JobRoute = (typeof V41_JOB_ROUTES)[number];

export const V41_FREQUENCY_TYPES = [
  "Hours",
  "Days",
  "Weeks",
  "Months",
  "Years",
  "Event",
  "Condition",
  "As Required",
] as const;

export const V41_DESCRIPTION_MAX_LENGTH = 2000;
