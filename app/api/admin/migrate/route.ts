import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function POST(request: Request) {
  try {
    // Check authentication
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Migrate] Starting database migration...');
    
    // Run Prisma migrate deploy (for production)
    const { stdout, stderr } = await execAsync('npx prisma migrate deploy', {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: process.env.DATABASE_URL,
        DIRECT_URL: process.env.DIRECT_URL,
      },
    });

    console.log('[Migrate] stdout:', stdout);
    if (stderr) {
      console.error('[Migrate] stderr:', stderr);
    }

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully',
      output: stdout,
    });
  } catch (error: any) {
    console.error('[Migrate] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        details: error.stderr || error.stdout,
      },
      { status: 500 }
    );
  }
}
