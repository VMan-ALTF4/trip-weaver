CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  IF to_regclass('public."Tour"') IS NOT NULL THEN
    UPDATE public."Tour"
    SET status_tour = 'tạm đóng'
    WHERE NULLIF(btrim(travel_date::text), '')::date
        < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
      AND (
        status_tour IS NULL
        OR lower(btrim(status_tour::text)) IN ('còn bán', 'đang hoạt động', 'active')
      );

    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'close-expired-tours';

    PERFORM cron.schedule(
      'close-expired-tours',
      '0 * * * *',
      $job$
        UPDATE public."Tour"
        SET status_tour = 'tạm đóng'
        WHERE NULLIF(btrim(travel_date::text), '')::date
            < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
          AND (
            status_tour IS NULL
            OR lower(btrim(status_tour::text)) IN ('còn bán', 'đang hoạt động', 'active')
          );
      $job$
    );
  END IF;
END;
$$;
