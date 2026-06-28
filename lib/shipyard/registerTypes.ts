export const YARD_REGISTER_TYPES = [
  "daily-progress",
  "delays",
  "permits",
  "inspections",
  "clarifications",
  "variations",
  "attachments",
] as const;

export type YardRegisterType = (typeof YARD_REGISTER_TYPES)[number];

export function isYardRegisterType(value: string): value is YardRegisterType {
  return (YARD_REGISTER_TYPES as readonly string[]).includes(value);
}

export type YardProjectOption = {
  projectId: string;
  projectName: string;
  yardWorkProjectId: string;
};

export type YardJobOption = {
  id: string;
  jobCode: string | null;
  jobTitle: string;
  workshopName: string;
};
