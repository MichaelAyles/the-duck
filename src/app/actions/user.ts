'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function deleteUser() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    throw new Error('User not found.');
  }
  
  const { error } = await supabase.auth.admin.deleteUser(user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath('/', 'layout');
} 