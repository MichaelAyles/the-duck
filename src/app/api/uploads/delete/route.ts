import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function DELETE(request: NextRequest) {
  try {
    const { uploadIds, userId } = await request.json();

    if (!uploadIds || !Array.isArray(uploadIds) || uploadIds.length === 0) {
      return NextResponse.json(
        { error: 'Upload IDs are required' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Ensure user can only delete their own uploads
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // First, fetch the uploads to get their storage paths
    const { data: uploads, error: fetchError } = await supabase
      .from('file_uploads')
      .select('id, storage_path')
      .eq('user_id', userId)
      .in('id', uploadIds);

    if (fetchError) {
      logger.error('Error fetching uploads for deletion:', fetchError);
      return NextResponse.json(
        { error: 'Failed to fetch uploads for deletion' },
        { status: 500 }
      );
    }

    if (!uploads || uploads.length === 0) {
      return NextResponse.json(
        { error: 'No uploads found or you do not have permission to delete these files' },
        { status: 404 }
      );
    }

    // Delete files from storage
    const storageDeleteResults = await Promise.allSettled(
      uploads.map(async (upload) => {
        if (upload.storage_path) {
          const { error } = await supabase.storage
            .from('chat-uploads')
            .remove([upload.storage_path]);
          
          if (error) {
            logger.error(`Error deleting file from storage: ${upload.storage_path}`, error);
            throw error;
          }
        }
        return upload.id;
      })
    );

    // Delete records from database
    const { error: dbError } = await supabase
      .from('file_uploads')
      .delete()
      .eq('user_id', userId)
      .in('id', uploadIds);

    if (dbError) {
      logger.error('Error deleting upload records:', dbError);
      return NextResponse.json(
        { error: 'Failed to delete upload records' },
        { status: 500 }
      );
    }

    // Count successful deletions
    const successfulStorageDeletions = storageDeleteResults.filter(
      result => result.status === 'fulfilled'
    ).length;

    const failedStorageDeletions = storageDeleteResults.filter(
      result => result.status === 'rejected'
    );

    if (failedStorageDeletions.length > 0) {
      logger.warn(`Failed to delete ${failedStorageDeletions.length} files from storage:`, 
        failedStorageDeletions.map(result => result.status === 'rejected' ? result.reason : null)
      );
    }

    return NextResponse.json({
      success: true,
      deletedCount: uploads.length,
      storageDeletedCount: successfulStorageDeletions,
      message: `Successfully deleted ${uploads.length} file${uploads.length > 1 ? 's' : ''}`
    });

  } catch (error) {
    logger.error('Error in upload deletion API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}