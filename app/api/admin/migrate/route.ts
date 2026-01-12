import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getPrisma } from '@/lib/db';

export async function POST(_request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // console.log('[Migrate] Starting database migration...');
    
    const prisma = getPrisma();
    
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    // console.log('[Migrate] Database connection successful');
    
    // Run the migration SQL directly
    const migrations = [
      // Check if tables already exist
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    ];
    
    const existingTables = await prisma.$queryRawUnsafe(migrations[0]);
    // console.log('[Migrate] Existing tables:', existingTables);
    
    // If tables don't exist, we need to run migrations manually
    // For now, let's just report the status
    const tableCount = Array.isArray(existingTables) ? existingTables.length : 0;
    
    if (tableCount === 0) {
      return NextResponse.json({
        success: false,
        message: 'No tables found. Please run migrations using Prisma CLI locally or via a build script.',
        details: 'Vercel serverless functions cannot run Prisma CLI commands due to file system restrictions.',
        suggestion: 'Add "postinstall": "prisma generate && prisma migrate deploy" to package.json scripts',
      });
    }

    return NextResponse.json({
      success: true,
      message: `Database is set up with ${tableCount} tables`,
      tables: existingTables,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    // console.error('[Migrate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: message,
        details: String(error),
      },
      { status: 500 }
    );
  }
}
