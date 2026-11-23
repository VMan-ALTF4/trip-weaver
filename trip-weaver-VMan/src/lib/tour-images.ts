import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const TOUR_IMAGE_BUCKET = "tour-images";

export function getTourImageUrl(value: string | null | undefined): string {
  const imagePath = value?.trim();
  if (!imagePath) return "";
  if (/^https?:\/\//i.test(imagePath)) return imagePath;

  let objectPath = imagePath.replace(/^\/+/, "");
  const publicObjectPrefix = `storage/v1/object/public/${TOUR_IMAGE_BUCKET}/`;
  const publicObjectIndex = objectPath.indexOf(publicObjectPrefix);
  if (publicObjectIndex >= 0) {
    objectPath = objectPath.slice(publicObjectIndex + publicObjectPrefix.length);
  } else if (objectPath.startsWith(`${TOUR_IMAGE_BUCKET}/`)) {
    objectPath = objectPath.slice(TOUR_IMAGE_BUCKET.length + 1);
  }

  return (supabase as unknown as SupabaseClient)
    .storage.from(TOUR_IMAGE_BUCKET)
    .getPublicUrl(objectPath).data.publicUrl;
}