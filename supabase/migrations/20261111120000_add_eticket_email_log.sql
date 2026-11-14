CREATE TABLE IF NOT EXISTS public.eticket_email_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL,
  to_email text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'failed')),
  provider_message_id text,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eticket_email_log_order_created_at_idx
  ON public.eticket_email_log (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS eticket_email_log_to_email_idx
  ON public.eticket_email_log (to_email, created_at DESC);

COMMENT ON TABLE public.eticket_email_log IS 'Nhật ký gửi e-ticket qua email theo đơn đặt chỗ; mỗi đơn có thể thử lại nhưng không gửi trùng.';
COMMENT ON COLUMN public.eticket_email_log.order_id IS 'UUID đơn booking; không phụ thuộc vào bảng order riêng vì hiện tại ticket chỉ theo group order_id.';
COMMENT ON COLUMN public.eticket_email_log.status IS 'queued, sent, failed - trạng thái gửi email cho đơn.';
COMMENT ON COLUMN public.eticket_email_log.provider_message_id IS 'ID phản hồi từ nhà cung cấp email (Resend).' ;
COMMENT ON COLUMN public.eticket_email_log.error IS 'Thông báo lỗi rút gọn, không chứa token hoặc nội dung email đầy đủ.';

ALTER TABLE public.eticket_email_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.eticket_email_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.eticket_email_log TO authenticated;
GRANT ALL ON TABLE public.eticket_email_log TO service_role;

DROP POLICY IF EXISTS "Users read own e-ticket email logs" ON public.eticket_email_log;
CREATE POLICY "Users read own e-ticket email logs"
  ON public.eticket_email_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket AS ticket
      WHERE ticket.order_id = eticket_email_log.order_id
        AND ticket.user_id = auth.uid()
    )
  );
