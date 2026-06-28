-- Add new YardInviteStatus enum values
ALTER TYPE "YardInviteStatus" ADD VALUE IF NOT EXISTS 'shortlisted';
ALTER TYPE "YardInviteStatus" ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE "YardInviteStatus" ADD VALUE IF NOT EXISTS 'rejected';
