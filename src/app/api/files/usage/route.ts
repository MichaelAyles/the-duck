import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    // Check authentication
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get storage usage using the SQL function
    const { data: usage, error: dbError } = await supabase
      .rpc('get_user_storage_usage', { user_uuid: user.id })
      .single() as { data: { total_size: number; file_count: number; deleted_size: number; deleted_count: number } | null; error: Error | null };

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to get storage usage' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      total_size: usage?.total_size || 0,
      file_count: usage?.file_count || 0,
      deleted_size: usage?.deleted_size || 0,
      deleted_count: usage?.deleted_count || 0,
    });
  } catch (error) {
    console.error('Storage usage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}