export type EticketStatus = "valid" | "cancelled" | "expired";

export type EticketSegmentKind = "transport" | "attraction";

export type EticketSegmentStatus = "unused" | "used" | "cancelled";

export type EticketScanResult =
  "success" | "already_used" | "cancelled" | "expired" | "invalid_segment";

export interface Eticket {
  id: string;
  ticket_id: string;
  user_id: string;
  ticket_code: string;
  status: EticketStatus;
  tour_name: string;
  travel_date: string;
  pickup_location: string | null;
  pickup_time: string | null;
  seat_no: string | null;
  holder_name: string | null;
  expires_at: string;
  qr_jti: string | null;
  qr_issued_at: string | null;
  qr_key_id: string | null;
  created_at: string;
}

export interface EticketSegment {
  id: string;
  eticket_id: string;
  kind: EticketSegmentKind;
  label: string | null;
  position: number;
  status: EticketSegmentStatus;
  used_at: string | null;
  scanned_by: string | null;
  created_at: string;
}

export interface EticketScanLog {
  id: string;
  eticket_id: string | null;
  segment_id: string | null;
  scanned_by: string | null;
  result: EticketScanResult;
  scanned_at: string;
}
