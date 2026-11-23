CREATE INDEX IF NOT EXISTS ticket_sold_payment_at_idx
  ON public.ticket (payment_at DESC)
  WHERE ticket_status = 'sold';

CREATE OR REPLACE FUNCTION public.get_admin_ticket_stats()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$
  WITH local_clock AS (
    SELECT timezone('Asia/Ho_Chi_Minh', now()) AS local_now
  ),
  date_bounds AS (
    SELECT
      ((local_now - interval '60 days') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS previous_start,
      ((local_now - interval '30 days') AT TIME ZONE 'Asia/Ho_Chi_Minh') AS current_start,
      (local_now AT TIME ZONE 'Asia/Ho_Chi_Minh') AS current_end
    FROM local_clock
  ),
  ticket_metrics AS (
    SELECT
      count(*) FILTER (WHERE ticket.ticket_status = 'sold') AS total_sold_count,
      count(*) FILTER (
        WHERE ticket.ticket_status = 'sold'
          AND ticket.payment_at >= date_bounds.current_start
          AND ticket.payment_at < date_bounds.current_end
      ) AS current_30_day_sold_count,
      count(*) FILTER (
        WHERE ticket.ticket_status = 'sold'
          AND ticket.payment_at >= date_bounds.previous_start
          AND ticket.payment_at < date_bounds.current_start
      ) AS previous_30_day_sold_count,
      coalesce(sum(ticket.price) FILTER (
        WHERE ticket.ticket_status = 'sold'
          AND ticket.payment_at >= date_bounds.current_start
          AND ticket.payment_at < date_bounds.current_end
      ), 0::numeric) AS current_30_day_revenue,
      coalesce(sum(ticket.price) FILTER (
        WHERE ticket.ticket_status = 'sold'
          AND ticket.payment_at >= date_bounds.previous_start
          AND ticket.payment_at < date_bounds.current_start
      ), 0::numeric) AS previous_30_day_revenue
    FROM public.ticket AS ticket
    CROSS JOIN date_bounds
  ),
  recent_bookings AS (
    SELECT
      ticket.id,
      ticket.order_id,
      ticket.price,
      ticket.payment_at,
      ticket.created_at,
      coalesce(
        nullif(btrim(profile.name), ''),
        nullif(btrim(profile.email), ''),
        '—'
      ) AS customer,
      coalesce(tour.tour_name, '—') AS tour_name
    FROM public.ticket AS ticket
    LEFT JOIN public.profiles AS profile ON profile.id = ticket.user_id
    LEFT JOIN public."Tour" AS tour ON tour.tour_id::text = ticket.tour_id::text
    WHERE ticket.ticket_status = 'sold'
    ORDER BY ticket.payment_at DESC NULLS LAST, ticket.created_at DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'totalSoldCount', ticket_metrics.total_sold_count,
    'current30DaySoldCount', ticket_metrics.current_30_day_sold_count,
    'previous30DaySoldCount', ticket_metrics.previous_30_day_sold_count,
    'current30DayRevenue', ticket_metrics.current_30_day_revenue,
    'previous30DayRevenue', ticket_metrics.previous_30_day_revenue,
    'recentBookings', coalesce(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'key', recent_bookings.id,
            'id', left(upper(recent_bookings.order_id::text), 8),
            'customer', recent_bookings.customer,
            'tour', recent_bookings.tour_name,
            'amount', recent_bookings.price,
            'status', 'sold'
          )
          ORDER BY recent_bookings.payment_at DESC NULLS LAST, recent_bookings.created_at DESC
        )
        FROM recent_bookings
      ),
      '[]'::jsonb
    )
  )
  FROM ticket_metrics;
$$;

REVOKE ALL ON FUNCTION public.get_admin_ticket_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_ticket_stats() TO service_role;
