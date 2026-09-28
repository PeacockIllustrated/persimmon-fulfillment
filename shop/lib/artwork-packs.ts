import { supabase } from "@/lib/supabase";

/**
 * Where print packs too big to pass through a Vercel function are kept.
 *
 * Vercel caps a function's request and response bodies at 4.5MB. A pack that
 * lifts library artwork with photographs in it is well past that — OT9A's two
 * waste signs alone are 10MB — so those packs are uploaded straight to this
 * private bucket with a signed URL and downloaded the same way. The function
 * only ever handles the URLs, never the PDF.
 */
export const PACK_BUCKET = "artwork-packs";

/** Supabase's default per-object limit. */
export const MAX_STORED_PACK_BYTES = 50 * 1024 * 1024;

/**
 * Delete a pack object that has been superseded. Logged rather than thrown: a
 * stray object costs a little storage, a failed request costs a publish.
 */
export async function removeStoredPack(path: string | null | undefined): Promise<void> {
  if (!path) return;
  const { error } = await supabase.storage.from(PACK_BUCKET).remove([path]);
  if (error) {
    console.error(`Could not remove superseded pack ${path}:`, error);
  }
}
