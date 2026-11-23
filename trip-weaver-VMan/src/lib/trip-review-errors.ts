export function getTripReviewErrorMessage(error: unknown): string {
  const result =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const code = typeof result["code"] === "string" ? result["code"] : null;
  const message =
    typeof result["message"] === "string" ? result["message"] : "Lỗi không xác định từ Supabase.";

  if (code === "PGRST205") {
    return `Supabase không tìm thấy public.trip_reviews trong schema cache. Hãy áp dụng migration supabase/migrations/20261123160000_add_trip_reviews.sql. Nếu bảng đã tồn tại và migration đã chạy, hãy chạy NOTIFY pgrst, 'reload schema'; sau đó tải lại trang. Chi tiết: ${message}`;
  }
  if (code === "42501" || message.toLocaleLowerCase().includes("permission denied")) {
    return `Supabase từ chối quyền đọc đánh giá (RLS/GRANT). Kiểm tra policy SELECT công khai trên trip_reviews. Chi tiết: ${message}`;
  }
  if (code === "PGRST200") {
    return `Supabase không tìm thấy quan hệ được yêu cầu trong schema cache. Truy vấn đánh giá công khai không dùng JOIN. Chi tiết: ${message}`;
  }

  const detail = typeof result["details"] === "string" ? ` ${result["details"]}` : "";
  const hint = typeof result["hint"] === "string" ? ` Gợi ý: ${result["hint"]}` : "";
  return `Không thể tải đánh giá từ Supabase${code ? ` (${code})` : ""}: ${message}${detail}${hint}`;
}

export function getTripReviewSubmitMessage(error: unknown): string {
  const result =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : {};
  const code = typeof result["code"] === "string" ? result["code"] : null;
  const message =
    typeof result["message"] === "string" ? result["message"] : "Lỗi không xác định từ Supabase.";

  if (code === "23505") return "Đơn đặt tour này đã được đánh giá.";
  if (code === "PGRST205") {
    return "Chưa thể gửi vì Supabase chưa nhận diện bảng public.trip_reviews. Hãy chạy migration supabase/migrations/20261123160000_add_trip_reviews.sql trong Supabase SQL Editor rồi tải lại trang.";
  }
  if (
    code === "42501" ||
    message.toLocaleLowerCase().includes("row-level security") ||
    message.toLocaleLowerCase().includes("permission denied")
  ) {
    return "Supabase từ chối quyền gửi đánh giá. Hãy kiểm tra vé đã thanh toán, tài khoản đang đăng nhập có phải chủ vé và policy INSERT của trip_reviews.";
  }

  const details = typeof result["details"] === "string" ? ` ${result["details"]}` : "";
  const hint = typeof result["hint"] === "string" ? ` Gợi ý: ${result["hint"]}` : "";
  return `Chưa thể gửi đánh giá${code ? ` (${code})` : ""}: ${message}${details}${hint}`;
}
