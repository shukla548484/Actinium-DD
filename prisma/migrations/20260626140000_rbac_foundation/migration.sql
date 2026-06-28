-- RBAC foundation: organizations, roles (31 system roles), permissions, users

-- CreateEnum
CREATE TYPE "RbacUserType" AS ENUM ('system', 'office', 'vessel', 'external');
CREATE TYPE "UserStatus" AS ENUM ('active', 'invited', 'disabled');
CREATE TYPE "RbacScopeType" AS ENUM ('system', 'organization', 'fleet', 'vessel', 'project', 'yard_invite');
CREATE TYPE "AppSurface" AS ENUM ('office', 'desktop', 'yard', 'vessel', 'platform');

-- CreateTable organizations
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE INDEX "organizations_deleted_at_idx" ON "organizations"("deleted_at");
CREATE INDEX "organizations_office_changed_at_idx" ON "organizations"("office_changed_at");

-- CreateTable roles
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "role_no" INTEGER,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "user_type" "RbacUserType" NOT NULL,
    "hierarchy_level" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "designation" TEXT,
    "department" TEXT,
    "description" TEXT,
    "is_system" BOOLEAN NOT NULL DEFAULT true,
    "organization_id" TEXT,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "roles_role_no_key" ON "roles"("role_no");
CREATE UNIQUE INDEX "roles_organization_id_code_key" ON "roles"("organization_id", "code");
CREATE INDEX "roles_user_type_hierarchy_level_idx" ON "roles"("user_type", "hierarchy_level");
CREATE INDEX "roles_deleted_at_idx" ON "roles"("deleted_at");
CREATE INDEX "roles_office_changed_at_idx" ON "roles"("office_changed_at");

ALTER TABLE "roles" ADD CONSTRAINT "roles_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable permissions
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "resource" TEXT,
    "app_surface" "AppSurface",
    "description" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");
CREATE INDEX "permissions_module_idx" ON "permissions"("module");

-- CreateTable role_permissions
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "role_permissions_role_id_permission_id_key" ON "role_permissions"("role_id", "permission_id");

ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable users
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "display_name" TEXT NOT NULL,
    "status" "UserStatus" NOT NULL DEFAULT 'invited',
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "users_organization_id_email_key" ON "users"("organization_id", "email");
CREATE INDEX "users_organization_id_idx" ON "users"("organization_id");
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");
CREATE INDEX "users_office_changed_at_idx" ON "users"("office_changed_at");

ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable user_roles
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "role_id" TEXT NOT NULL,
    "scope_type" "RbacScopeType" NOT NULL DEFAULT 'organization',
    "scope_id" TEXT,
    "origin_node" "SyncOriginNode" NOT NULL DEFAULT 'office',
    "office_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "relay_changed_at" TIMESTAMP(3),
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_roles_user_id_role_id_scope_type_scope_id_key"
    ON "user_roles"("user_id", "role_id", "scope_type", "scope_id");
CREATE INDEX "user_roles_user_id_idx" ON "user_roles"("user_id");
CREATE INDEX "user_roles_role_id_idx" ON "user_roles"("role_id");
CREATE INDEX "user_roles_scope_type_scope_id_idx" ON "user_roles"("scope_type", "scope_id");
CREATE INDEX "user_roles_deleted_at_idx" ON "user_roles"("deleted_at");

ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_fkey"
    FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable user_permission_overrides
CREATE TABLE "user_permission_overrides" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "permission_id" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL DEFAULT true,
    "conditions" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "user_permission_overrides_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_permission_overrides_user_id_permission_id_key"
    ON "user_permission_overrides"("user_id", "permission_id");

ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_permission_overrides" ADD CONSTRAINT "user_permission_overrides_permission_id_fkey"
    FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Link projects to organizations (nullable for existing rows)
ALTER TABLE "projects" ADD COLUMN "organization_id" TEXT;
CREATE INDEX "projects_organization_id_idx" ON "projects"("organization_id");
ALTER TABLE "projects" ADD CONSTRAINT "projects_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
