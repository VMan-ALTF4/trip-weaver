CREATE TABLE IF NOT EXISTS public.trip_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tour_id text NOT NULL,
  booking_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  overall_rating smallint NOT NULL CHECK (overall_rating BETWEEN 1 AND 5),
  guide_rating smallint NOT NULL CHECK (guide_rating BETWEEN 1 AND 5),
  service_rating smallint NOT NULL CHECK (service_rating BETWEEN 1 AND 5),
  transport_rating smallint NOT NULL CHECK (transport_rating BETWEEN 1 AND 5),
  itinerary_rating smallint NOT NULL CHECK (itinerary_rating BETWEEN 1 AND 5),
  organization_rating smallint NOT NULL CHECK (organization_rating BETWEEN 1 AND 5),
  comment text,
  images text[] NOT NULL DEFAULT '{}',
  customer_name text,
  customer_avatar_url text,
  tour_name text,
  guide_name text,
  is_visible boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.trip_reviews
  ADD COLUMN IF NOT EXISTS tour_id text,
  ADD COLUMN IF NOT EXISTS booking_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS overall_rating smallint,
  ADD COLUMN IF NOT EXISTS guide_rating smallint,
  ADD COLUMN IF NOT EXISTS service_rating smallint,
  ADD COLUMN IF NOT EXISTS transport_rating smallint,
  ADD COLUMN IF NOT EXISTS itinerary_rating smallint,
  ADD COLUMN IF NOT EXISTS organization_rating smallint,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS customer_name text,
  ADD COLUMN IF NOT EXISTS customer_avatar_url text,
  ADD COLUMN IF NOT EXISTS tour_name text,
  ADD COLUMN IF NOT EXISTS guide_name text,
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.trip_reviews
  ALTER COLUMN guide_rating DROP NOT NULL,
  ALTER COLUMN service_rating DROP NOT NULL,
  ALTER COLUMN transport_rating DROP NOT NULL,
  ALTER COLUMN itinerary_rating DROP NOT NULL,
  ALTER COLUMN organization_rating DROP NOT NULL;

DO $$
DECLARE
  ticket_id_type oid;
  review_booking_type oid;
  ticket_id_is_unique boolean;
  constraint_exists boolean;
BEGIN
  IF to_regclass('public.ticket') IS NULL THEN
    RAISE EXCEPTION 'Cannot create trip_reviews: expected public.ticket booking table was not found.';
  END IF;

  SELECT attribute.atttypid
  INTO ticket_id_type
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.ticket'::regclass
    AND attribute.attname = 'id'
    AND NOT attribute.attisdropped;

  SELECT attribute.atttypid
  INTO review_booking_type
  FROM pg_attribute AS attribute
  WHERE attribute.attrelid = 'public.trip_reviews'::regclass
    AND attribute.attname = 'booking_id'
    AND NOT attribute.attisdropped;

  IF ticket_id_type IS NULL OR review_booking_type IS DISTINCT FROM ticket_id_type THEN
    RAISE EXCEPTION
      'Cannot link trip_reviews.booking_id to ticket.id: booking ID types do not match.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint AS ticket_constraint
    WHERE ticket_constraint.conrelid = 'public.ticket'::regclass
      AND ticket_constraint.contype IN ('p', 'u')
      AND ticket_constraint.conkey = ARRAY[
        (SELECT attribute.attnum
         FROM pg_attribute AS attribute
         WHERE attribute.attrelid = 'public.ticket'::regclass
           AND attribute.attname = 'id'
           AND NOT attribute.attisdropped)
      ]::smallint[]
  )
  INTO ticket_id_is_unique;

  IF NOT ticket_id_is_unique THEN
    RAISE EXCEPTION 'Cannot link trip_reviews.booking_id: public.ticket.id is not uniquely indexed.';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.trip_reviews'::regclass
      AND conname = 'trip_reviews_booking_id_fkey'
  )
  INTO constraint_exists;

  IF NOT constraint_exists THEN
    ALTER TABLE public.trip_reviews
      ADD CONSTRAINT trip_reviews_booking_id_fkey
      FOREIGN KEY (booking_id) REFERENCES public.ticket (id) ON DELETE CASCADE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.trip_reviews'::regclass
      AND conname = 'trip_reviews_user_id_fkey'
  )
  INTO constraint_exists;

  IF NOT constraint_exists THEN
    ALTER TABLE public.trip_reviews
      ADD CONSTRAINT trip_reviews_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users (id) ON DELETE CASCADE;
  END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS trip_reviews_one_per_booking_idx
  ON public.trip_reviews (booking_id)
  WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS trip_reviews_public_tour_order_idx
  ON public.trip_reviews (tour_id, created_at DESC)
  WHERE is_visible = true;

CREATE OR REPLACE FUNCTION public.validate_trip_review_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  source_ticket public.ticket%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.updated_at := now();
    RETURN NEW;
  END IF;

  IF auth.uid() IS NULL OR NEW.user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'You can only review your own booking.';
  END IF;

  IF NEW.overall_rating IS NULL OR NEW.overall_rating NOT BETWEEN 1 AND 5
     OR (NEW.guide_rating IS NOT NULL AND NEW.guide_rating NOT BETWEEN 1 AND 5)
     OR (NEW.service_rating IS NOT NULL AND NEW.service_rating NOT BETWEEN 1 AND 5)
     OR (NEW.transport_rating IS NOT NULL AND NEW.transport_rating NOT BETWEEN 1 AND 5)
     OR (NEW.itinerary_rating IS NOT NULL AND NEW.itinerary_rating NOT BETWEEN 1 AND 5)
     OR (NEW.organization_rating IS NOT NULL AND NEW.organization_rating NOT BETWEEN 1 AND 5) THEN
    RAISE EXCEPTION 'Overall rating is required; detailed ratings, when provided, must be between 1 and 5.';
  END IF;

  SELECT *
  INTO source_ticket
  FROM public.ticket
  WHERE id = NEW.booking_id
  FOR SHARE;

  IF NOT FOUND
     OR source_ticket.user_id IS DISTINCT FROM auth.uid()
     OR source_ticket.ticket_status <> 'sold'
     OR source_ticket.tour_id::text IS DISTINCT FROM NEW.tour_id::text THEN
    RAISE EXCEPTION 'Only the owner of a paid tour booking can submit a review.';
  END IF;

  NEW.created_at := now();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_trip_review_booking_trigger ON public.trip_reviews;
CREATE TRIGGER validate_trip_review_booking_trigger
  BEFORE INSERT OR UPDATE ON public.trip_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_trip_review_booking();

ALTER TABLE public.trip_reviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.trip_reviews FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.trip_reviews TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON TABLE public.trip_reviews TO authenticated;

DROP POLICY IF EXISTS "Public can read visible trip reviews" ON public.trip_reviews;
CREATE POLICY "Public can read visible trip reviews"
  ON public.trip_reviews FOR SELECT TO anon, authenticated
  USING (
    is_visible = true
    OR user_id = (SELECT auth.uid())
    OR public.has_admin_access((SELECT auth.uid()))
  );

DROP POLICY IF EXISTS "Customers review their completed bookings" ON public.trip_reviews;
DROP POLICY IF EXISTS "Customers review their paid bookings" ON public.trip_reviews;
CREATE POLICY "Customers review their paid bookings"
  ON public.trip_reviews FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND overall_rating BETWEEN 1 AND 5
    AND EXISTS (
      SELECT 1
      FROM public.ticket
      WHERE ticket.id = trip_reviews.booking_id
        AND ticket.user_id = (SELECT auth.uid())
        AND ticket.ticket_status = 'sold'
        AND ticket.tour_id::text = trip_reviews.tour_id::text
    )
  );

DROP POLICY IF EXISTS "Admins manage trip reviews" ON public.trip_reviews;
CREATE POLICY "Admins manage trip reviews"
  ON public.trip_reviews FOR ALL TO authenticated
  USING (public.has_admin_access((SELECT auth.uid())))
  WITH CHECK (public.has_admin_access((SELECT auth.uid())));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trip-review-images',
  'trip-review-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Public can view trip review images" ON storage.objects;
CREATE POLICY "Public can view trip review images"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'trip-review-images');

DROP POLICY IF EXISTS "Customers upload their trip review images" ON storage.objects;
CREATE POLICY "Customers upload their trip review images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trip-review-images'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND EXISTS (
      SELECT 1
      FROM public.ticket
      WHERE ticket.id::text = (storage.foldername(name))[2]
        AND ticket.user_id = (SELECT auth.uid())
        AND ticket.ticket_status = 'sold'
    )
  );

DROP POLICY IF EXISTS "Customers delete their own trip review images" ON storage.objects;
CREATE POLICY "Customers delete their own trip review images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trip-review-images'
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR public.has_admin_access((SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Admins delete trip review images" ON storage.objects;
CREATE POLICY "Admins delete trip review images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'trip-review-images'
    AND public.has_admin_access((SELECT auth.uid()))
  );

NOTIFY pgrst, 'reload schema';
