import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: fileId } = await params;

    // Get file details first
    const { data: file, error: fetchError } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Soft delete the file record
    const { error: updateError } = await supabase
      .from('file_uploads')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', fileId)
      .eq('user_id', user.id);

    if (updateError) {
      logger.error('Database error:', updateError);
      return NextResponse.json(
        { error: 'Failed to delete file' },
        { status: 500 }
      );
    }

    // Delete from storage (optional - you might want to keep files for a period)
    const { error: storageError } = await supabase.storage
      .from('chat-uploads')
      .remove([file.storage_path]);

    if (storageError) {
      logger.error('Storage deletion error:', storageError);
      // Don't fail the request if storage deletion fails
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('File deletion API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: fileId } = await params;

    // Get file details
    const { data: file, error: fetchError } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .single();

    if (fetchError || !file) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Generate signed URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('chat-uploads')
      .createSignedUrl(file.storage_path, 3600); // 1 hour expiry

    if (urlError || !urlData) {
      return NextResponse.json(
        { error: 'Failed to generate file URL' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ...file,
      url: urlData.signedUrl,
    });
  } catch (error) {
    logger.error('File get API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}