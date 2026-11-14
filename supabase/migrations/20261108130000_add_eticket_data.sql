CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE TABLE IF NOT EXISTS public.eticket (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE
    REFERENCES public.ticket (id) ON DELETE CASCADE,
  user_id uuid NOT NULL
    REFERENCES auth.users (id) ON DELETE CASCADE,
  ticket_code text NOT NULL UNIQUE
    CHECK (ticket_code ~ '^TAT-[A-HJ-NP-Z2-9]{6}$'),
  status text NOT NULL DEFAULT 'valid'
    CHECK (status IN ('valid', 'cancelled', 'expired')),
  tour_name text NOT NULL,
  travel_date date NOT NULL,
  pickup_location text,
  pickup_time text,
  seat_no text,
  holder_name text,
  expires_at timestamptz NOT NULL,
  qr_jti text,
  qr_issued_at timestamptz,
  qr_key_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eticket_qr_fields_check CHECK (
    (qr_jti IS NULL AND qr_issued_at IS NULL AND qr_key_id IS NULL)
    OR (qr_jti IS NOT NULL AND qr_issued_at IS NOT NULL AND qr_key_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS public.eticket_segment (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eticket_id uuid NOT NULL
    REFERENCES public.eticket (id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('transport', 'attraction')),
  label text,
  position integer NOT NULL CHECK (position >= 0),
  status text NOT NULL DEFAULT 'unused'
    CHECK (status IN ('unused', 'used', 'cancelled')),
  used_at timestamptz,
  scanned_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT eticket_segment_label_position_check CHECK (
    (kind = 'transport' AND label IS NULL AND position = 0)
    OR (kind = 'attraction' AND label IS NOT NULL AND position > 0)
  ),
  CONSTRAINT eticket_segment_used_at_check CHECK (
    status <> 'used' OR used_at IS NOT NULL
  ),
  CONSTRAINT eticket_segment_position_unique UNIQUE (eticket_id, kind, position)
);

CREATE UNIQUE INDEX IF NOT EXISTS eticket_segment_one_transport_idx
  ON public.eticket_segment (eticket_id)
  WHERE kind = 'transport';
CREATE INDEX IF NOT EXISTS eticket_segment_eticket_id_idx
  ON public.eticket_segment (eticket_id);

CREATE TABLE IF NOT EXISTS public.eticket_scan_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  eticket_id uuid REFERENCES public.eticket (id) ON DELETE SET NULL,
  segment_id uuid,
  scanned_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  result text NOT NULL
    CHECK (result IN ('success', 'already_used', 'cancelled', 'expired', 'invalid_segment')),
  scanned_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eticket_user_id_idx
  ON public.eticket (user_id);
CREATE INDEX IF NOT EXISTS eticket_valid_expires_at_idx
  ON public.eticket (expires_at)
  WHERE status = 'valid';
CREATE INDEX IF NOT EXISTS eticket_scan_log_eticket_scanned_at_idx
  ON public.eticket_scan_log (eticket_id, scanned_at DESC);

COMMENT ON TABLE public.eticket IS 'Vé điện tử được phát hành cho một ticket đã thanh toán.';
COMMENT ON COLUMN public.eticket.ticket_id IS 'Ticket nguồn; mỗi ticket chỉ có tối đa một e-ticket.';
COMMENT ON COLUMN public.eticket.ticket_code IS 'Mã hiển thị TAT- cùng sáu ký tự không dễ nhầm lẫn.';
COMMENT ON COLUMN public.eticket.tour_name IS 'Tên tour được chụp lại tại thời điểm phát hành.';
COMMENT ON COLUMN public.eticket.travel_date IS 'Ngày khởi hành được chụp từ ticket.';
COMMENT ON COLUMN public.eticket.pickup_location IS 'Điểm đón được chụp từ ticket.';
COMMENT ON COLUMN public.eticket.pickup_time IS 'Giờ đón nếu có dữ liệu; hiện để NULL khi chưa lưu trong DB.';
COMMENT ON COLUMN public.eticket.seat_no IS 'Ghế riêng của hành khách được chụp từ ticket.seat_numbers.';
COMMENT ON COLUMN public.eticket.holder_name IS 'Tên chủ vé chụp từ profiles.name hoặc email.';
COMMENT ON COLUMN public.eticket.expires_at IS 'Thời điểm hết hạn theo múi giờ Asia/Ho_Chi_Minh.';
COMMENT ON COLUMN public.eticket.qr_jti IS 'Chừa chỗ cho mã định danh QR ở Bước 3; không lưu JWT ở Bước 2.';
COMMENT ON COLUMN public.eticket.qr_issued_at IS 'Thời điểm phát hành QR ở Bước 3.';
COMMENT ON COLUMN public.eticket.qr_key_id IS 'ID khóa ký QR ở Bước 3.';
COMMENT ON TABLE public.eticket_segment IS 'Từng phần vé độc lập: phương tiện hoặc một điểm tham quan.';
COMMENT ON COLUMN public.eticket_segment.kind IS 'Loại phần vé: transport hoặc attraction.';
COMMENT ON COLUMN public.eticket_segment.label IS 'Tên điểm tham quan; NULL cho phần phương tiện.';
COMMENT ON COLUMN public.eticket_segment.position IS 'Thứ tự điểm tham quan; transport dùng vị trí 0.';
COMMENT ON COLUMN public.eticket_segment.status IS 'Trạng thái sử dụng riêng của phần vé.';
COMMENT ON COLUMN public.eticket_segment.scanned_by IS 'Nhân viên hoặc quản trị viên đã quét thành công.';
COMMENT ON TABLE public.eticket_scan_log IS 'Nhật ký lần quét thành công và thất bại; không xóa theo ticket.';
COMMENT ON COLUMN public.eticket_scan_log.segment_id IS 'ID phần vé được yêu cầu quét; giữ lại để audit kể cả khi xóa vé.';
COMMENT ON COLUMN public.eticket_scan_log.result IS 'Kết quả: success, already_used, cancelled, expired hoặc invalid_segment.';

ALTER TABLE public.eticket ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eticket_segment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eticket_scan_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eticket, public.eticket_segment, public.eticket_scan_log
  FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.eticket, public.eticket_segment TO authenticated;
GRANT ALL ON TABLE public.eticket, public.eticket_segment, public.eticket_scan_log
  TO service_role;

DROP POLICY IF EXISTS "Users read own e-tickets" ON public.eticket;
CREATE POLICY "Users read own e-tickets"
  ON public.eticket
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own e-ticket segments" ON public.eticket_segment;
CREATE POLICY "Users read own e-ticket segments"
  ON public.eticket_segment
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.eticket AS ticket
      WHERE ticket.id = eticket_segment.eticket_id
        AND ticket.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.issue_eticket_for_ticket(ticket_id uuid)
RETURNS SETOF public.eticket
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_ticket public.ticket%ROWTYPE;
  source_tour_name text;
  source_attractions jsonb;
  tour_has_attractions boolean;
  source_holder_name text;
  generated_code text;
  code_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  eticket_row public.eticket%ROWTYPE;
  attraction_row record;
  attempt integer;
  character_index integer;
  inserted boolean := false;
BEGIN
  SELECT ticket.*
  INTO source_ticket
  FROM public.ticket AS ticket
  WHERE ticket.id = $1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket % does not exist', $1;
  END IF;

  IF source_ticket.ticket_status <> 'sold' THEN
    RAISE EXCEPTION 'Only sold tickets can receive an e-ticket';
  END IF;

  SELECT existing.*
  INTO eticket_row
  FROM public.eticket AS existing
  WHERE existing.ticket_id = $1;

  IF FOUND THEN
    RETURN NEXT eticket_row;
    RETURN;
  END IF;

  IF source_ticket.travel_date IS NULL THEN
    RAISE EXCEPTION 'A sold ticket must have a travel date before e-ticket issuance';
  END IF;

  SELECT tour.tour_name::text
  INTO source_tour_name
  FROM public."Tour" AS tour
  WHERE tour.tour_id::text = source_ticket.tour_id::text;

  IF NOT FOUND OR source_tour_name IS NULL THEN
    RAISE EXCEPTION 'Tour % is missing or has no name', source_ticket.tour_id;
  END IF;

  source_attractions := '[]'::jsonb;
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Tour'
      AND column_name = 'attractions'
      AND data_type = 'jsonb'
  )
  INTO tour_has_attractions;

  IF tour_has_attractions THEN
    EXECUTE $query$
      SELECT CASE
        WHEN jsonb_typeof(tour.attractions) = 'array' THEN tour.attractions
        ELSE '[]'::jsonb
      END
      FROM public."Tour" AS tour
      WHERE tour.tour_id::text = $1::text
    $query$
    INTO source_attractions
    USING source_ticket.tour_id;
  END IF;

  SELECT COALESCE(
    NULLIF(btrim(profile.name), ''),
    NULLIF(btrim(profile.email), '')
  )
  INTO source_holder_name
  FROM public.profiles AS profile
  WHERE profile.id = source_ticket.user_id;

  FOR attempt IN 1..20 LOOP
    generated_code := 'TAT-';
    FOR character_index IN 1..6 LOOP
      generated_code := generated_code || substr(
        code_alphabet,
        floor(random() * length(code_alphabet))::integer + 1,
        1
      );
    END LOOP;

    INSERT INTO public.eticket (
      ticket_id,
      user_id,
      ticket_code,
      status,
      tour_name,
      travel_date,
      pickup_location,
      pickup_time,
      seat_no,
      holder_name,
      expires_at
    )
    VALUES (
      source_ticket.id,
      source_ticket.user_id,
      generated_code,
      CASE
        WHEN now() >= ((source_ticket.travel_date + 2)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh')
          THEN 'expired'
        ELSE 'valid'
      END,
      source_tour_name,
      source_ticket.travel_date,
      source_ticket.pickup_location,
      NULL,
      source_ticket.seat_numbers[1],
      source_holder_name,
      (source_ticket.travel_date + 2)::timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh'
    )
    ON CONFLICT DO NOTHING
    RETURNING *
    INTO eticket_row;

    IF FOUND THEN
      inserted := true;
      EXIT;
    END IF;

    SELECT existing.*
    INTO eticket_row
    FROM public.eticket AS existing
    WHERE existing.ticket_id = $1;

    IF FOUND THEN
      RETURN NEXT eticket_row;
      RETURN;
    END IF;
  END LOOP;

  IF NOT inserted THEN
    RAISE EXCEPTION 'Could not generate a unique e-ticket code after 20 attempts';
  END IF;

  INSERT INTO public.eticket_segment (eticket_id, kind, label, position)
  VALUES (eticket_row.id, 'transport', NULL, 0)
  ON CONFLICT DO NOTHING;

  FOR attraction_row IN
    SELECT
      NULLIF(btrim(attraction.value #>> '{}'), '') AS label,
      attraction.ordinality::integer AS position
    FROM jsonb_array_elements(source_attractions)
      WITH ORDINALITY AS attraction(value, ordinality)
    WHERE jsonb_typeof(attraction.value) = 'string'
      AND NULLIF(btrim(attraction.value #>> '{}'), '') IS NOT NULL
  LOOP
    INSERT INTO public.eticket_segment (
      eticket_id,
      kind,
      label,
      position
    )
    VALUES (
      eticket_row.id,
      'attraction',
      attraction_row.label,
      attraction_row.position
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN NEXT eticket_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_eticket_staff(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS profile
    WHERE profile.id = $1
      AND profile.role IN ('admin', 'staff')
  );
$$;

REVOKE ALL ON FUNCTION public.is_eticket_staff(uuid)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_eticket_staff(uuid)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_segment_used(
  p_segment_id uuid,
  p_scanned_by uuid
)
RETURNS SETOF public.eticket_segment
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_eticket public.eticket%ROWTYPE;
  segment_row public.eticket_segment%ROWTYPE;
  scan_result text;
BEGIN
  IF p_scanned_by IS NULL
     OR NOT public.is_eticket_staff(p_scanned_by) THEN
    RAISE EXCEPTION 'Only staff or admin users may scan e-ticket segments';
  END IF;

  SELECT segment.*
  INTO segment_row
  FROM public.eticket_segment AS segment
  JOIN public.eticket AS ticket ON ticket.id = segment.eticket_id
  WHERE segment.id = p_segment_id
  FOR UPDATE OF ticket, segment;

  IF NOT FOUND THEN
    INSERT INTO public.eticket_scan_log (segment_id, scanned_by, result)
    VALUES (p_segment_id, p_scanned_by, 'invalid_segment');
    RETURN;
  END IF;

  SELECT ticket.*
  INTO parent_eticket
  FROM public.eticket AS ticket
  WHERE ticket.id = segment_row.eticket_id;

  IF parent_eticket.status = 'cancelled' OR segment_row.status = 'cancelled' THEN
    scan_result := 'cancelled';
  ELSIF parent_eticket.status = 'expired'
     OR now() >= parent_eticket.expires_at THEN
    UPDATE public.eticket
    SET status = 'expired'
    WHERE id = parent_eticket.id
      AND status = 'valid';
    scan_result := 'expired';
  ELSIF segment_row.status = 'used' THEN
    scan_result := 'already_used';
  ELSE
    UPDATE public.eticket_segment AS segment
    SET
      status = 'used',
      used_at = now(),
      scanned_by = p_scanned_by
    WHERE segment.id = p_segment_id
      AND segment.status = 'unused'
    RETURNING segment.*
    INTO segment_row;

    IF FOUND THEN
      INSERT INTO public.eticket_scan_log (
        eticket_id,
        segment_id,
        scanned_by,
        result
      )
      VALUES (
        parent_eticket.id,
        p_segment_id,
        p_scanned_by,
        'success'
      );
      RETURN NEXT segment_row;
      RETURN;
    END IF;

    scan_result := 'already_used';
  END IF;

  INSERT INTO public.eticket_scan_log (
    eticket_id,
    segment_id,
    scanned_by,
    result
  )
  VALUES (
    parent_eticket.id,
    p_segment_id,
    p_scanned_by,
    scan_result
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.cancel_eticket_for_cancelled_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.eticket
  SET status = 'cancelled'
  WHERE ticket_id = NEW.id
    AND status <> 'cancelled';

  UPDATE public.eticket_segment AS segment
  SET status = 'cancelled'
  FROM public.eticket AS ticket
  WHERE ticket.ticket_id = NEW.id
    AND segment.eticket_id = ticket.id
    AND segment.status <> 'cancelled';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ticket_cancel_eticket_after_status_update ON public.ticket;
CREATE TRIGGER ticket_cancel_eticket_after_status_update
  AFTER UPDATE OF ticket_status ON public.ticket
  FOR EACH ROW
  WHEN (OLD.ticket_status IS DISTINCT FROM NEW.ticket_status AND NEW.ticket_status = 'cancelled')
  EXECUTE FUNCTION public.cancel_eticket_for_cancelled_ticket();

REVOKE ALL ON FUNCTION public.issue_eticket_for_ticket(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_eticket_for_ticket(uuid) TO service_role;
REVOKE ALL ON FUNCTION public.mark_segment_used(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_segment_used(uuid, uuid) TO service_role;
REVOKE ALL ON FUNCTION public.cancel_eticket_for_cancelled_ticket()
  FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid)
  FROM cron.job
  WHERE jobname = 'expire-etickets';

  PERFORM cron.schedule(
    'expire-etickets',
    '0 * * * *',
    $job$
      UPDATE public.eticket
      SET status = 'expired'
      WHERE status = 'valid'
        AND expires_at <= now();
    $job$
  );
END;
$$;

DO $$
DECLARE
  sold_ticket record;
BEGIN
  FOR sold_ticket IN
    SELECT ticket.id
    FROM public.ticket AS ticket
    WHERE ticket.ticket_status = 'sold'
    ORDER BY ticket.created_at, ticket.id
  LOOP
    PERFORM public.issue_eticket_for_ticket(sold_ticket.id);
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';

-- Hoàn tác thủ công (theo thứ tự):
-- 1. Gỡ job cron expire-etickets khỏi cron.job.
-- 2. DROP TRIGGER IF EXISTS ticket_cancel_eticket_after_status_update ON public.ticket;
-- 3. DROP FUNCTION IF EXISTS public.cancel_eticket_for_cancelled_ticket();
-- 4. DROP FUNCTION IF EXISTS public.mark_segment_used(uuid, uuid);
-- 5. DROP FUNCTION IF EXISTS public.issue_eticket_for_ticket(uuid);
-- 6. DROP TABLE IF EXISTS public.eticket_scan_log, public.eticket_segment, public.eticket CASCADE;
-- Lưu ý: scan log được giữ khi xóa ticket trong vận hành, nhưng sẽ mất nếu chủ động hoàn tác migration.
