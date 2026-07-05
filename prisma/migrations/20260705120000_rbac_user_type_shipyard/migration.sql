-- Add shipyard as a distinct RBAC user type (dockyard portal users).
ALTER TYPE "RbacUserType" ADD VALUE IF NOT EXISTS 'shipyard';
