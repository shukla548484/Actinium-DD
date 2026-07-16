import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;
import { getLocalDatabaseUrl, isLocalDev } from '@/lib/local-dev';
import { normalizePgUrl, parsePrismaDatabaseUrlEnv, pickDirectPostgresUrl } from '@/lib/db-url';

declare global {
  var __prismaMaster: PrismaClient | undefined;
}

/**
 * Master Database Connection (Prisma Database)
 * 
 * This Prisma client connects to the master database which stores:
 * - Company information
 * - Subdomain mappings
 * - Database connection strings (encrypted)
 * - Multi-tenant configuration
 * 
 * Database Name: Actinium-Master-Database
 */
const buildMasterDatabaseUrl = (): string => {
  // Local dev: single Postgres (synced from server via npm run db:sync-from-server)
  if (isLocalDev()) {
    const localUrl = getLocalDatabaseUrl();
    console.log('✅ LOCAL_DEV: master database → local PostgreSQL');
    return localUrl;
  }

  const prismaEnv = process.env.PRISMA_DATABASE_URL ? parsePrismaDatabaseUrlEnv() : '';
  if (prismaEnv.startsWith('prisma+postgres://')) {
    console.log('✅ Using PRISMA_DATABASE_URL (Prisma Accelerate) for master database');
    return prismaEnv;
  }

  const directUrl = pickDirectPostgresUrl();
  if (directUrl) {
    console.log('✅ Using direct PostgreSQL URL for master database');
    return directUrl;
  }

  // Legacy scripts: MASTER_DATABASE_URL (direct Postgres, not Prisma Cloud)
  if (process.env.MASTER_DATABASE_URL) {
    const dbUrl = process.env.MASTER_DATABASE_URL;
    console.log('✅ Using MASTER_DATABASE_URL for master database');
    return normalizePgUrl(dbUrl);
  }

  // During build time, Next.js might not have PRISMA_DATABASE_URL available
  const isBuildTime = process.env.NEXT_PHASE?.includes('build') || 
                      (process.env.VERCEL === '1' && !process.env.VERCEL_ENV);
  
  if (isBuildTime) {
    return 'postgresql://placeholder:placeholder@localhost:5432/placeholder?schema=public';
  }
  
  // At runtime (not build), throw error
  console.error('❌ No database URL found in environment variables!');
  console.error('   Checked for:');
  console.error('   - PRISMA_DATABASE_URL (Required)');
  console.error('   - POSTGRES_URL / DATABASE_URL (Fallback)');
  throw new Error(
    'PRISMA_DATABASE_URL or POSTGRES_URL must be set. ' +
    'Please configure PRISMA_DATABASE_URL in your environment variables.'
  );
};

const getMasterPrismaClient = (): PrismaClient => {
  if (!globalThis.__prismaMaster) {
    const databaseUrl = buildMasterDatabaseUrl();
    
    // Validate database URL is not a placeholder (only at runtime)
    if (databaseUrl.includes('placeholder') && process.env.NODE_ENV === 'production') {
      throw new Error(
        'PRISMA_DATABASE_URL environment variable is required but not set. ' +
        'Please configure it in Vercel Dashboard → Settings → Environment Variables.'
      );
    }
    
    // Validate it's a Prisma connection (if not placeholder)
    if (!databaseUrl.includes('placeholder') && 
        !databaseUrl.includes('db.prisma.io') && 
        !databaseUrl.startsWith('prisma+postgres://')) {
      console.warn('⚠️  Master database URL does not appear to be Prisma Database. Make sure you\'re using Prisma connection strings.');
    }
    
    const isAccelerate = databaseUrl.startsWith('prisma+postgres://');

    if (isAccelerate) {
      console.log('✅ Using Prisma Accelerate');
      globalThis.__prismaMaster = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        accelerateUrl: databaseUrl,
      });
    } else {
      console.log('✅ Using Prisma Adapter (pg)');
      const pool = new Pool({
        connectionString: databaseUrl,
        max: 6,
        idleTimeoutMillis: 10_000,
        connectionTimeoutMillis: 20_000,
      });
      const adapter = new PrismaPg(pool);
      globalThis.__prismaMaster = new PrismaClient({
        log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
        adapter,
      });
    }
    
    if (!databaseUrl.includes('placeholder')) {
      if (databaseUrl.startsWith('prisma+postgres://')) {
        console.log('✅ Master Prisma Client initialized (Prisma Accelerate)');
      } else {
        console.log('✅ Master Prisma Client initialized (Prisma Database)');
      }
    }
  }
  
  return globalThis.__prismaMaster;
};

// Export prisma instance using a Proxy to ensure true lazy initialization
// This prevents Prisma Client from being created during build time
const prismaProxy = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const prisma = getMasterPrismaClient();
    const value = (prisma as any)[prop];
    if (typeof value === 'function') {
      return value.bind(prisma);
    }
    return value;
  },
});

export const prisma = prismaProxy;
export default prisma;

// Connection test
export const testMasterConnection = async (): Promise<boolean> => {
  try {
    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Master database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Master database connection failed:', error);
    return false;
  }
};

// Graceful shutdown
export const disconnectMaster = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    console.log('Master database disconnected successfully');
  } catch (error) {
    console.error('Error disconnecting from master database:', error);
  }
};















