import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { createRateLimiter } from '@/lib/redis';
import { isAllowedFileType, MAX_FILE_SIZE } from '@/types/file-upload';

const fileUploadSchema = z.object({
  file_name: z.string().min(1).max(255),
  file_type: z.string().min(1).max(50),
  file_size: z.number().int().positive().max(MAX_FILE_SIZE),
  storage_path: z.string().min(1).max(500),
  mime_type: z.string().refine(isAllowedFileType, {
    message: 'Invalid file type',
  }),
  session_id: z.string().optional(),
  message_id: z.string().optional(),
});

// Lazy rate limiter creation to avoid build-time issues
const getRateLimiter = () => createRateLimiter({
  requests: 50,
  window: '15m',
  prefix: 'rl:files',
});

export async function POST(request: NextRequest) {
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

    // Rate limiting
    const rateLimiter = getRateLimiter();
    const { success, limit, reset, remaining } = await rateLimiter.limit(user.id);
    if (!success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': Math.ceil(reset / 1000).toString(),
          }
        }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validationResult = fileUploadSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request data', details: validationResult.error.errors },
        { status: 400 }
      );
    }

    const fileData = validationResult.data;

    // Insert file metadata into database
    const insertData = {
      user_id: user.id,
      file_name: fileData.file_name,
      file_type: fileData.file_type,
      file_size: fileData.file_size,
      storage_path: fileData.storage_path,
      mime_type: fileData.mime_type,
      ...(fileData.session_id && { session_id: fileData.session_id }),
      ...(fileData.message_id && { message_id: fileData.message_id }),
    };

    const { data: fileUpload, error: dbError } = await supabase
      .from('file_uploads')
      .insert(insertData)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to save file metadata' },
        { status: 500 }
      );
    }

    // Track usage for billing
    await supabase.from('user_usage').insert({
      user_id: user.id,
      endpoint: '/api/files',
      tokens_used: 0,
      cost: 0.001, // $0.001 per file upload
      metadata: {
        file_id: fileUpload.id,
        file_size: fileData.file_size,
        mime_type: fileData.mime_type,
      },
    });

    return NextResponse.json(fileUpload);
  } catch (error) {
    console.error('File upload API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('session_id');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Build query
    let query = supabase
      .from('file_uploads')
      .select('*')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (sessionId) {
      query = query.eq('session_id', sessionId);
    }

    const { data: files, error: dbError } = await query;

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch files' },
        { status: 500 }
      );
    }

    return NextResponse.json(files || []);
  } catch (error) {
    console.error('File list API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}