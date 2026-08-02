/**
 * Supabase Storage helpers for the documents bucket.
 * ----------------------------------------------------------------------------
 * Document files live in a private Supabase Storage bucket called
 * "documents". We never expose the raw path; instead we generate short-
 * lived signed URLs on demand.
 *
 * The bucket must be created in the Supabase dashboard (Storage -> New
 * bucket -> name: "documents", Public: OFF). This is a one-time manual
 * step; the app will throw a clear error if it's missing.
 *
 * Usage:
 *   import { getSignedDocumentUrl } from '@/lib/supabase/storage';
 *   const url = await getSignedDocumentUrl('constitution-2025.pdf', 600);
 */

import { createClient } from './server';

const DOCUMENTS_BUCKET = 'documents';
const DEFAULT_EXPIRY_SECONDS = 60 * 60; // 1 hour

/**
 * Generate a signed URL for a file in the documents bucket.
 * Throws if the file does not exist or the user is not authorized
 * (the RLS policy on storage.objects handles the auth check).
 */
export async function getSignedDocumentUrl(
  path: string,
  expiresIn: number = DEFAULT_EXPIRY_SECONDS
): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error || !data) {
    throw new Error(
      `Failed to sign URL for "${path}": ${error?.message ?? 'unknown error'}`
    );
  }
  return data.signedUrl;
}

/**
 * Upload a file to the documents bucket. Caller must have already
 * authorized the user via the application layer (e.g. canManageDocuments).
 * Returns the storage path (NOT a public URL).
 */
export async function uploadDocument(
  path: string,
  file: File | Blob,
  contentType?: string
): Promise<string> {
  const supabase = createClient();
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, {
      contentType: contentType ?? (file instanceof File ? file.type : undefined),
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload "${path}": ${error.message}`);
  }
  return path;
}
