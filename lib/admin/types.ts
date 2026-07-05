import type { CompanyCategory, CompanyType, EntityStatus } from "@prisma/client";

export type CompanyDto = {
  id: string;
  code: string;
  name: string;
  type: CompanyType;
  category: CompanyCategory;
  status: EntityStatus;
  parentId: string | null;
  parentName?: string | null;
  address: string | null;
  contactPerson: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isShipowner: boolean;
  vesselCount?: number;
  employeeCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type VesselDto = {
  id: string;
  companyId: string;
  companyName?: string;
  companyCode?: string;
  code: string;
  name: string;
  imoNumber: string | null;
  flag: string | null;
  vesselType: string | null;
  callSign: string | null;
  grossTonnage: number | null;
  yearBuilt: number | null;
  status: EntityStatus;
  employeeCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type EmployeeDto = {
  id: string;
  companyId: string;
  companyName?: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  designation: string | null;
  department: string | null;
  status: EntityStatus;
  roleId: string | null;
  roleName?: string | null;
  roleNo?: number | null;
  roleCode?: string | null;
  approvalLevel?: number | null;
  userId?: string | null;
  loginId?: string | null;
  vesselLoginId?: string | null;
  vesselCount?: number;
  vessels?: { id: string; code: string; name: string; isWatchKeeper: boolean }[];
  createdAt: string;
  updatedAt: string;
};

export type ListQuery = {
  page?: number;
  limit?: number;
  search?: string;
  status?: EntityStatus | "all";
  companyId?: string;
  category?: CompanyCategory;
  excludeCategories?: CompanyCategory[];
  userType?: import("@prisma/client").RbacUserType;
};
