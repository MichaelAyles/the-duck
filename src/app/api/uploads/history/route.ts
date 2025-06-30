import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

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

    // Ensure user can only access their own uploads
    if (user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    // Fetch user's upload history
    const { data: uploads, error } = await supabase
      .from('file_uploads')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching upload history:', error);
      return NextResponse.json(
        { error: 'Failed to fetch upload history' },
        { status: 500 }
      );
    }

    // Calculate total storage used
    const totalStorage = uploads?.reduce((total, upload) => total + (upload.file_size || 0), 0) || 0;

    // Generate signed URLs for files
    const uploadsWithUrls = await Promise.all(
      (uploads || []).map(async (upload) => {
        try {
          if (upload.storage_path) {
            const { data: urlData, error: urlError } = await supabase.storage
              .from('chat-uploads')
              .createSignedUrl(upload.storage_path, 3600); // 1 hour expiry

            if (urlError) {
              console.error('Supabase storage error for file:', upload.id, urlError);
              return {
                ...upload,
                url: null
              };
            }

            return {
              ...upload,
              url: urlData?.signedUrl || null
            };
          }
          return upload;
        } catch (urlError) {
          console.error('Error generating signed URL for file:', upload.id, urlError);
          return upload;
        }
      })
    );

    return NextResponse.json({
      uploads: uploadsWithUrls,
      totalStorage,
      count: uploads?.length || 0
    });

  } catch (error) {
    console.error('Error in upload history API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}