import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { Link } from "@tanstack/react-router";
import { Eye, EyeOff, ImagePlus, Loader2, MessageSquareText, Star, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TourCard } from "@/components/site/tour-card";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { getTripReviewErrorMessage, getTripReviewSubmitMessage } from "@/lib/trip-review-errors";
import type { Tour } from "@/lib/tat-data";

const reviewBucket = "trip-review-images";
const ratingLabels = [
  "",
  "Rất không hài lòng",
  "Không hài lòng",
  "Bình thường",
  "Hài lòng",
  "Rất hài lòng",
];
const ratingCriteria = [
  { key: "guide_rating", label: "Hướng dẫn viên" },
  { key: "service_rating", label: "Chất lượng dịch vụ" },
  { key: "transport_rating", label: "Phương tiện di chuyển" },
  { key: "itinerary_rating", label: "Lịch trình chuyến đi" },
  { key: "organization_rating", label: "Tổ chức tour" },
] as const;

export type TripReview = {
  id: string;
  tour_id: string;
  booking_id: string;
  user_id: string;
  overall_rating: number;
  guide_rating: number | null;
  service_rating: number | null;
  transport_rating: number | null;
  itinerary_rating: number | null;
  organization_rating: number | null;
  comment: string | null;
  images: string[];
  customer_name: string | null;
  customer_avatar_url: string | null;
  tour_name: string | null;
  guide_name: string | null;
  is_visible: boolean;
  created_at: string;
};

type PublicTripReview = Pick<
  TripReview,
  | "id"
  | "tour_id"
  | "overall_rating"
  | "comment"
  | "images"
  | "customer_name"
  | "customer_avatar_url"
  | "tour_name"
  | "created_at"
>;

export type ReviewBooking = {
  id: string;
  tour_id: string;
  tour_name: string;
  tour_image: string | null;
  guide_name: string | null;
  travel_date: string | null;
  review: TripReview | null;
};

const client = supabase as unknown as SupabaseClient;

function isRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}

function displayDate(value: string | null): string {
  if (!value) return "Chưa cập nhật";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("vi-VN");
}

function safeImageUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function ReviewStars({
  value,
  onChange,
  label,
  size = "size-6",
}: {
  value: number;
  onChange?: (rating: number) => void;
  label: string;
  size?: string;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role={onChange ? "radiogroup" : "img"}
      aria-label={label}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const rating = index + 1;
        const star = (
          <Star
            className={`${size} transition duration-150 ${
              rating <= value ? "fill-amber-400 text-amber-400" : "text-muted-foreground/35"
            } ${onChange ? "group-hover:scale-110" : ""}`}
            aria-hidden
          />
        );
        return onChange ? (
          <button
            key={rating}
            type="button"
            role="radio"
            aria-checked={value === rating}
            aria-label={`${rating} sao`}
            onClick={() => onChange(rating)}
            className="group rounded-sm p-0.5 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {star}
          </button>
        ) : (
          <span key={rating}>{star}</span>
        );
      })}
    </div>
  );
}

function PhotoList({ images }: { images: string[] }) {
  if (images.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.filter(safeImageUrl).map((image, index) => (
        <a
          key={`${image}-${index}`}
          href={image}
          target="_blank"
          rel="noreferrer"
          className="overflow-hidden rounded-lg border border-border"
        >
          <img
            src={image}
            alt={`Ảnh chuyến đi ${index + 1}`}
            className="size-20 object-cover"
            loading="lazy"
          />
        </a>
      ))}
    </div>
  );
}

export function ReviewBookingAction({
  booking,
  customerName,
  onSubmitted,
}: {
  booking: ReviewBooking;
  customerName: string;
  onSubmitted: (review: TripReview) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant={booking.review ? "outline" : "cta"}
        size="sm"
        className="mt-3"
        onClick={() => setOpen(true)}
      >
        <MessageSquareText className="size-4" aria-hidden />
        {booking.review ? "Xem đánh giá của bạn" : "Đánh giá chuyến đi"}
      </Button>
      <ReviewDialog
        open={open}
        onOpenChange={setOpen}
        booking={booking}
        customerName={customerName}
        onSubmitted={onSubmitted}
      />
    </>
  );
}

function ReviewDialog({
  open,
  onOpenChange,
  booking,
  customerName,
  onSubmitted,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: ReviewBooking;
  customerName: string;
  onSubmitted: (review: TripReview) => void;
}) {
  const existingReview = booking.review;
  const [overall, setOverall] = useState(0);
  const [ratings, setRatings] = useState<Record<(typeof ratingCriteria)[number]["key"], number>>({
    guide_rating: 0,
    service_rating: 0,
    transport_rating: 0,
    itinerary_rating: 0,
    organization_rating: 0,
  });
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const nextPreviews = files.map((file) => URL.createObjectURL(file));
    setPreviews(nextPreviews);
    return () => nextPreviews.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  function selectFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    const accepted = selected.filter(
      (file) =>
        ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(file.type) &&
        file.size <= 5 * 1024 * 1024,
    );
    if (accepted.length !== selected.length) {
      toast.error("Chỉ chấp nhận ảnh JPG, PNG, WebP hoặc AVIF tối đa 5 MB mỗi ảnh.");
    }
    if (files.length + accepted.length > 5) {
      toast.error("Bạn chỉ có thể tải lên tối đa 5 ảnh.");
    }
    setFiles((current) => [...current, ...accepted].slice(0, 5));
    event.target.value = "";
  }

  async function submitReview() {
    if (!isRating(overall)) {
      toast.error("Vui lòng chọn số sao đánh giá tổng thể.");
      return;
    }

    setSaving(true);
    const uploadedPaths: string[] = [];
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!user) throw new Error("Vui lòng đăng nhập để gửi đánh giá.");

      const imageUrls: string[] = [];
      for (const [index, file] of files.entries()) {
        const extension = file.type.split("/")[1];
        const path = `${user.id}/${booking.id}/${crypto.randomUUID()}-${index}.${extension}`;
        const { error: uploadError } = await client.storage.from(reviewBucket).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;
        uploadedPaths.push(path);
        imageUrls.push(client.storage.from(reviewBucket).getPublicUrl(path).data.publicUrl);
      }

      const { data, error: insertError } = await client
        .from("trip_reviews")
        .insert({
          tour_id: booking.tour_id,
          tour_name: booking.tour_name,
          booking_id: booking.id,
          user_id: user.id,
          overall_rating: overall,
          ...Object.fromEntries(
            ratingCriteria.map(({ key }) => [key, isRating(ratings[key]) ? ratings[key] : null]),
          ),
          comment: comment.trim() || null,
          images: imageUrls,
          customer_name: customerName,
          customer_avatar_url: (() => {
            const avatar = user.user_metadata["avatar_url"] ?? user.user_metadata["picture"];
            return typeof avatar === "string" && safeImageUrl(avatar) ? avatar : null;
          })(),
          guide_name: booking.guide_name,
        })
        .select("*")
        .single();

      if (insertError) throw insertError;
      onSubmitted(data as TripReview);
      toast.success("Đánh giá của bạn đã được gửi thành công.");
      onOpenChange(false);
      setOverall(0);
      setRatings({
        guide_rating: 0,
        service_rating: 0,
        transport_rating: 0,
        itinerary_rating: 0,
        organization_rating: 0,
      });
      setComment("");
      setFiles([]);
    } catch (error) {
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await client.storage
          .from(reviewBucket)
          .remove(uploadedPaths);
        if (cleanupError) console.error("Could not clean up uploaded review images.", cleanupError);
      }
      console.error("Unable to submit trip review.", error);
      toast.error(getTripReviewSubmitMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} {...(saving ? {} : { onOpenChange })}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {existingReview ? "Đánh giá chuyến đi của bạn" : "Đánh giá chuyến đi"}
          </DialogTitle>
          <DialogDescription>
            Chia sẻ trải nghiệm thực tế để giúp các du khách khác.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-5">
          <div className="flex gap-4 rounded-xl border border-border bg-muted/30 p-3">
            {booking.tour_image ? (
              <img
                src={booking.tour_image}
                alt=""
                className="size-20 shrink-0 rounded-lg object-cover"
              />
            ) : null}
            <div className="min-w-0">
              <h3 className="font-semibold">{booking.tour_name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Hướng dẫn viên: {booking.guide_name || "Chưa cập nhật"}
              </p>
              <p className="text-sm text-muted-foreground">
                Ngày khởi hành: {displayDate(booking.travel_date)}
              </p>
            </div>
          </div>

          {existingReview ? (
            <div className="space-y-4">
              <div>
                <p className="mb-1 text-sm font-medium">Đánh giá tổng thể</p>
                <div className="flex flex-wrap items-center gap-2">
                  <ReviewStars
                    value={existingReview.overall_rating}
                    label={`${existingReview.overall_rating} sao`}
                  />
                  <span className="text-sm font-semibold">{existingReview.overall_rating}/5</span>
                  <span className="text-sm text-muted-foreground">
                    {ratingLabels[existingReview.overall_rating]}
                  </span>
                </div>
              </div>
              <dl className="grid gap-2 sm:grid-cols-2">
                {ratingCriteria.map(({ key, label }) => (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2"
                  >
                    <dt className="text-sm">{label}</dt>
                    <dd className="flex items-center gap-1 text-sm font-medium">
                      {existingReview[key] ? (
                        <>
                          <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                          {existingReview[key]}/5
                        </>
                      ) : (
                        <span className="text-muted-foreground">Chưa đánh giá</span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
              {existingReview.comment && (
                <p className="whitespace-pre-wrap text-sm">{existingReview.comment}</p>
              )}
              <PhotoList images={existingReview.images ?? []} />
              <p className="text-xs text-muted-foreground">
                Đã gửi ngày {displayDate(existingReview.created_at)}
              </p>
            </div>
          ) : (
            <>
              <section>
                <h3 className="text-sm font-semibold">
                  Đánh giá tổng thể <span className="text-destructive">*</span>
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <ReviewStars
                    value={overall}
                    onChange={setOverall}
                    label="Chọn đánh giá tổng thể từ 1 đến 5 sao"
                    size="size-8"
                  />
                  <span className="text-sm font-semibold">
                    {overall ? `${overall}/5` : "Chưa chọn"}
                  </span>
                  {overall > 0 && (
                    <span className="animate-in fade-in text-sm text-muted-foreground">
                      {ratingLabels[overall]}
                    </span>
                  )}
                </div>
              </section>
              <section className="grid gap-3 sm:grid-cols-2">
                {ratingCriteria.map(({ key, label }) => (
                  <div key={key} className="rounded-xl border border-border p-3">
                    <p className="mb-2 text-sm font-medium">{label} (không bắt buộc)</p>
                    <div className="flex items-center justify-between gap-2">
                      <ReviewStars
                        value={ratings[key]}
                        onChange={(rating) =>
                          setRatings((current) => ({ ...current, [key]: rating }))
                        }
                        label={`Đánh giá ${label} từ 1 đến 5 sao`}
                        size="size-5"
                      />
                      <span className="text-xs text-muted-foreground">
                        {ratings[key] ? `${ratings[key]}/5` : "—"}
                      </span>
                    </div>
                  </div>
                ))}
              </section>
              <div className="grid gap-2">
                <label htmlFor={`review-comment-${booking.id}`} className="text-sm font-semibold">
                  Nhận xét (không bắt buộc)
                </label>
                <Textarea
                  id={`review-comment-${booking.id}`}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  maxLength={3000}
                  placeholder="Chia sẻ điều bạn thích hoặc điều có thể cải thiện..."
                  className="min-h-24"
                />
              </div>
              <section>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">Ảnh chuyến đi (không bắt buộc)</h3>
                    <p className="text-xs text-muted-foreground">
                      Tối đa 5 ảnh, mỗi ảnh không quá 5 MB.
                    </p>
                  </div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                    <ImagePlus className="size-4" aria-hidden />
                    Chọn ảnh
                    <Input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/avif"
                      multiple
                      className="sr-only"
                      onChange={selectFiles}
                    />
                  </label>
                </div>
                {files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {files.map((file, index) => (
                      <div key={`${file.name}-${index}`} className="group relative">
                        <img
                          src={previews[index]}
                          alt={file.name}
                          className="size-20 rounded-lg border border-border object-cover"
                        />
                        <button
                          type="button"
                          aria-label={`Xóa ${file.name}`}
                          onClick={() =>
                            setFiles((current) =>
                              current.filter((_, fileIndex) => fileIndex !== index),
                            )
                          }
                          className="absolute -right-2 -top-2 rounded-full bg-background p-1 shadow"
                        >
                          <X className="size-3.5" aria-hidden />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {existingReview ? "Đóng" : "Hủy"}
          </Button>
          {!existingReview && (
            <Button
              type="button"
              variant="cta"
              disabled={saving}
              onClick={() => void submitReview()}
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
              {saving ? "Đang gửi..." : "Gửi đánh giá"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const homepageReviewPageSize = 6;

type TourReviewTeaser = Pick<
  TripReview,
  "id" | "tour_id" | "overall_rating" | "comment" | "images" | "customer_name" | "created_at"
>;

type TourReviewSummary = {
  count: number;
  totalRating: number;
  latest: TourReviewTeaser;
};

export function TourCardsWithReviews({ tours }: { tours: Tour[] }) {
  const [summaries, setSummaries] = useState<Record<string, TourReviewSummary>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    async function loadSummaries(showLoading: boolean) {
      if (requestInFlight) return;
      requestInFlight = true;
      if (showLoading) {
        setLoading(true);
        setError(false);
      }

      if (!isSupabaseConfigured() || tours.length === 0) {
        if (active && showLoading) setError(!isSupabaseConfigured());
        if (active && showLoading) setLoading(false);
        requestInFlight = false;
        return;
      }

      try {
        const { data, error: queryError } = await client
          .from("trip_reviews")
          .select("id, tour_id, overall_rating, comment, images, customer_name, created_at")
          .eq("is_visible", true)
          .in(
            "tour_id",
            tours.map((tour) => tour.id),
          )
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;

        if (active) {
          const nextSummaries: Record<string, TourReviewSummary> = {};
          for (const review of (data ?? []) as TourReviewTeaser[]) {
            const existing = nextSummaries[review.tour_id];
            nextSummaries[review.tour_id] = {
              count: (existing?.count ?? 0) + 1,
              totalRating: (existing?.totalRating ?? 0) + review.overall_rating,
              latest: existing?.latest ?? review,
            };
          }
          setSummaries(nextSummaries);
          setError(false);
        }
      } catch (loadError) {
        console.error("Unable to load homepage tour review summaries.", loadError);
        if (active && showLoading) setError(true);
      } finally {
        requestInFlight = false;
        if (active && showLoading) setLoading(false);
      }
    }

    void loadSummaries(true);
    const refreshInterval = window.setInterval(() => void loadSummaries(false), 30_000);
    const handleFocus = () => void loadSummaries(false);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [tours]);

  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {tours.map((tour) => {
        const summary = summaries[tour.id];
        const average = summary ? summary.totalRating / summary.count : 0;

        return (
          <TourCard
            key={tour.id}
            tour={tour}
            reviewSummary={{
              status: loading ? "loading" : error ? "error" : summary ? "ready" : "empty",
              ...(summary
                ? {
                    average,
                    count: summary.count,
                    latest: {
                      customerName: summary.latest.customer_name || "Khách hàng",
                      date: displayDate(summary.latest.created_at),
                      comment: summary.latest.comment,
                    },
                  }
                : {}),
            }}
          />
        );
      })}
    </div>
  );
}

export function CustomerReviewsFeed({ tours }: { tours: Pick<Tour, "id" | "title">[] }) {
  const [reviews, setReviews] = useState<PublicTripReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const tourNames = useMemo(() => new Map(tours.map((tour) => [tour.id, tour.title])), [tours]);

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    async function loadReviews(showLoading: boolean) {
      if (requestInFlight) return;
      requestInFlight = true;
      if (showLoading) {
        setLoading(true);
        setError(false);
      }

      if (!isSupabaseConfigured()) {
        if (active && showLoading) setError(true);
        if (active && showLoading) setLoading(false);
        requestInFlight = false;
        return;
      }

      try {
        const { data, error: queryError } = await client
          .from("trip_reviews")
          .select(
            "id, tour_id, tour_name, overall_rating, comment, images, customer_name, customer_avatar_url, created_at",
          )
          .eq("is_visible", true)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(0, homepageReviewPageSize);
        if (queryError) throw queryError;

        if (active) {
          const rows = (data ?? []) as PublicTripReview[];
          const latestRows = rows.slice(0, homepageReviewPageSize);
          setReviews((current) => {
            const latestIds = new Set(latestRows.map((review) => review.id));
            const visibleCount = Math.max(current.length, homepageReviewPageSize);
            return [...latestRows, ...current.filter((review) => !latestIds.has(review.id))].slice(
              0,
              visibleCount,
            );
          });
          setHasMore(rows.length > homepageReviewPageSize);
          if (showLoading) setError(false);
        }
      } catch (loadError) {
        console.error("Unable to load homepage trip reviews.", loadError);
        if (active && showLoading) setError(true);
      } finally {
        requestInFlight = false;
        if (active && showLoading) setLoading(false);
      }
    }

    void loadReviews(true);
    const refreshInterval = window.setInterval(() => void loadReviews(false), 30_000);
    const handleFocus = () => void loadReviews(false);
    window.addEventListener("focus", handleFocus);

    return () => {
      active = false;
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", handleFocus);
    };
  }, [retryAttempt]);

  async function loadMoreReviews() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const { data, error: queryError } = await client
        .from("trip_reviews")
        .select(
          "id, tour_id, tour_name, overall_rating, comment, images, customer_name, customer_avatar_url, created_at",
        )
        .eq("is_visible", true)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .range(reviews.length, reviews.length + homepageReviewPageSize);
      if (queryError) throw queryError;

      const rows = (data ?? []) as PublicTripReview[];
      setReviews((current) => [...current, ...rows.slice(0, homepageReviewPageSize)]);
      setHasMore(rows.length > homepageReviewPageSize);
    } catch (loadError) {
      console.error("Unable to load more homepage trip reviews.", loadError);
      toast.error("Chưa thể tải thêm đánh giá. Vui lòng thử lại.");
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary">
          Trải nghiệm thực tế
        </p>
        <h2 className="mt-2 font-display text-2xl font-extrabold sm:text-3xl">
          Đánh giá từ khách hàng
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Những chia sẻ được gửi bởi khách hàng sau chuyến đi.
        </p>
      </div>

      {loading ? (
        <div
          className="mt-8 flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden /> Đang tải đánh giá...
        </div>
      ) : error ? (
        <div className="mt-8 rounded-xl border border-border bg-card p-5 text-center">
          <p role="alert" className="text-sm text-muted-foreground">
            Hiện chưa thể tải đánh giá. Vui lòng thử lại sau.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setRetryAttempt((attempt) => attempt + 1)}
          >
            Thử tải lại
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        <p className="mt-8 rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
          Chưa có đánh giá nào được gửi.
        </p>
      ) : (
        <>
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review) => {
              const customerName = review.customer_name || "Khách hàng";
              const avatarUrl = review.customer_avatar_url;
              const tourName =
                review.tour_name || tourNames.get(review.tour_id) || "Xem chuyến tour";

              return (
                <li
                  key={review.id}
                  className="flex min-w-0 flex-col rounded-2xl border border-border bg-card p-5 shadow-soft"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary">
                      {avatarUrl && safeImageUrl(avatarUrl) ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="size-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        customerName.slice(0, 1).toLocaleUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{customerName}</p>
                      <time className="text-xs text-muted-foreground" dateTime={review.created_at}>
                        {displayDate(review.created_at)}
                      </time>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <ReviewStars
                      value={review.overall_rating}
                      label={`${review.overall_rating} sao`}
                      size="size-4"
                    />
                    <span className="text-sm font-semibold">{review.overall_rating}/5</span>
                  </div>
                  <Link
                    to="/tours/$id"
                    params={{ id: review.tour_id }}
                    className="mt-3 line-clamp-1 text-sm font-semibold text-primary hover:underline"
                  >
                    {tourName}
                  </Link>
                  {review.comment ? (
                    <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                      {review.comment}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-muted-foreground">
                      Khách hàng không để lại nhận xét.
                    </p>
                  )}
                  <div className="mt-auto">
                    <PhotoList images={review.images ?? []} />
                  </div>
                </li>
              );
            })}
          </ul>
          {hasMore && (
            <div className="mt-8 text-center">
              <Button
                type="button"
                variant="outline"
                disabled={loadingMore}
                onClick={() => void loadMoreReviews()}
              >
                {loadingMore && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {loadingMore ? "Đang tải..." : "Xem thêm đánh giá"}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export function TripReviewsSection({
  tourId,
  onSummaryChange,
}: {
  tourId: string;
  onSummaryChange?: (summary: { average: number | null; count: number | null }) => void;
}) {
  const [reviews, setReviews] = useState<PublicTripReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<"newest" | "highest">("newest");
  const [retryAttempt, setRetryAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    async function loadReviews() {
      try {
        const { data, error: queryError } = await client
          .from("trip_reviews")
          .select(
            "id, tour_id, tour_name, overall_rating, comment, images, customer_name, customer_avatar_url, created_at",
          )
          .eq("tour_id", tourId)
          .eq("is_visible", true)
          .order("created_at", { ascending: false });
        if (queryError) throw queryError;
        if (active) setReviews((data ?? []) as PublicTripReview[]);
      } catch (error) {
        console.error("Unable to load public trip reviews.", error);
        if (active) {
          setError(getTripReviewErrorMessage(error));
          setReviews([]);
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReviews();
    return () => {
      active = false;
    };
  }, [tourId, retryAttempt]);

  const counts = useMemo(
    () =>
      Array.from(
        { length: 5 },
        (_, index) => reviews.filter((review) => review.overall_rating === 5 - index).length,
      ),
    [reviews],
  );
  const average = reviews.length
    ? reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length
    : 0;
  useEffect(() => {
    if (loading) return;
    onSummaryChange?.({
      average: error ? null : average,
      count: error ? null : reviews.length,
    });
  }, [average, error, loading, onSummaryChange, reviews.length]);
  const sortedReviews = [...reviews].sort((a, b) =>
    sort === "newest"
      ? new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      : b.overall_rating - a.overall_rating ||
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  return (
    <section className="mt-8 rounded-2xl border border-border bg-card p-5 shadow-soft sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold">Đánh giá từ khách hàng</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Trải nghiệm được chia sẻ bởi khách đã tham gia tour.
          </p>
        </div>
        {!loading && !error && (
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sắp xếp</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as "newest" | "highest")}
              className="rounded-lg border border-input bg-background px-2 py-1.5"
            >
              <option value="newest">Mới nhất</option>
              <option value="highest">Điểm cao nhất</option>
            </select>
          </label>
        )}
      </div>

      {loading ? (
        <div
          className="mt-6 flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden /> Đang tải đánh giá...
        </div>
      ) : error ? (
        <div className="mt-5 rounded-xl border border-border bg-muted/30 p-4">
          <p role="alert" className="text-sm text-muted-foreground">
            Hiện chưa thể tải đánh giá. Vui lòng thử lại sau.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3"
            onClick={() => setRetryAttempt((attempt) => attempt + 1)}
          >
            Thử tải lại
          </Button>
        </div>
      ) : reviews.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Chưa có đánh giá nào cho chuyến tour này.
        </p>
      ) : (
        <>
          <div className="mt-6 grid gap-6 border-b border-border pb-6 sm:grid-cols-[180px_1fr]">
            <div className="text-center sm:text-left">
              <p className="font-display text-4xl font-extrabold">{average.toFixed(1)}</p>
              <ReviewStars
                value={Math.round(average)}
                label={`Điểm trung bình ${average.toFixed(1)} trên 5`}
              />
              <p className="mt-1 text-sm text-muted-foreground">{reviews.length} lượt đánh giá</p>
            </div>
            <div className="grid gap-1.5">
              {counts.map((count, index) => {
                const rating = 5 - index;
                return (
                  <div
                    key={rating}
                    className="grid grid-cols-[36px_1fr_32px] items-center gap-2 text-xs"
                  >
                    <span>{rating} sao</span>
                    <div className="h-2 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-[width]"
                        style={{ width: `${reviews.length ? (count / reviews.length) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-right text-muted-foreground">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <ul className="divide-y divide-border">
            {sortedReviews.map((review) => (
              <li key={review.id} className="py-5 first:pt-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{review.customer_name || "Khách hàng"}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <ReviewStars
                        value={review.overall_rating}
                        label={`${review.overall_rating} sao`}
                        size="size-4"
                      />
                      <span className="text-xs text-muted-foreground">
                        {review.overall_rating}/5
                      </span>
                    </div>
                  </div>
                  <time className="text-xs text-muted-foreground" dateTime={review.created_at}>
                    {displayDate(review.created_at)}
                  </time>
                </div>
                {review.comment && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6">{review.comment}</p>
                )}
                <PhotoList images={review.images ?? []} />
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

export function AdminReviewsTab() {
  const [reviews, setReviews] = useState<TripReview[]>([]);
  const [tourNames, setTourNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ratingFilter, setRatingFilter] = useState("all");

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      try {
        const [{ data, error }, { data: tours, error: toursError }] = await Promise.all([
          client.from("trip_reviews").select("*").order("created_at", { ascending: false }),
          client.from("Tour").select("tour_id, tour_name"),
        ]);
        if (error) throw error;
        if (toursError) throw toursError;
        if (!active) return;
        setReviews((data ?? []) as TripReview[]);
        setTourNames(
          Object.fromEntries(
            (tours ?? []).map((tour) => [String(tour.tour_id), String(tour.tour_name)]),
          ),
        );
      } catch (error) {
        console.error("Unable to load trip reviews for admin.", error);
        if (active)
          toast.error(error instanceof Error ? error.message : "Không thể tải danh sách đánh giá.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const filteredReviews = reviews.filter((review) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesText =
      !query ||
      (tourNames[review.tour_id] ?? review.tour_id).toLocaleLowerCase().includes(query) ||
      (review.customer_name ?? "").toLocaleLowerCase().includes(query);
    const matchesRating = ratingFilter === "all" || review.overall_rating === Number(ratingFilter);
    return matchesText && matchesRating;
  });

  async function setVisibility(review: TripReview, visible: boolean) {
    const { error } = await client
      .from("trip_reviews")
      .update({ is_visible: visible, updated_at: new Date().toISOString() })
      .eq("id", review.id);
    if (error) {
      console.error("Unable to update trip review visibility.", error);
      toast.error(error.message);
      return;
    }
    setReviews((current) =>
      current.map((item) => (item.id === review.id ? { ...item, is_visible: visible } : item)),
    );
    toast.success(visible ? "Đánh giá đã được hiển thị." : "Đánh giá đã được ẩn.");
  }

  async function deleteReview(review: TripReview) {
    if (!window.confirm("Bạn có chắc muốn xóa vĩnh viễn đánh giá này không?")) return;
    const { error } = await client.from("trip_reviews").delete().eq("id", review.id);
    if (error) {
      console.error("Unable to delete trip review.", error);
      toast.error(error.message);
      return;
    }
    const storagePrefix = `/storage/v1/object/public/${reviewBucket}/`;
    const imagePaths = (review.images ?? []).flatMap((image) => {
      const prefixIndex = image.indexOf(storagePrefix);
      if (prefixIndex < 0) return [];
      const path = image.slice(prefixIndex + storagePrefix.length).split(/[?#]/, 1)[0];
      return path ? [decodeURIComponent(path)] : [];
    });
    let imagesDeleted = true;
    if (imagePaths.length > 0) {
      const { error: imageError } = await client.storage.from(reviewBucket).remove(imagePaths);
      if (imageError) {
        imagesDeleted = false;
        console.error("Review was deleted but its images could not be removed.", imageError);
        toast.error("Đã xóa đánh giá nhưng chưa thể xóa ảnh đính kèm.");
      }
    }
    setReviews((current) => current.filter((item) => item.id !== review.id));
    if (imagesDeleted) {
      toast.success(imagePaths.length ? "Đã xóa đánh giá và ảnh đính kèm." : "Đã xóa đánh giá.");
    }
  }

  return (
    <section>
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Tìm theo tên tour hoặc khách hàng..."
        />
        <select
          value={ratingFilter}
          onChange={(event) => setRatingFilter(event.target.value)}
          aria-label="Lọc theo số sao"
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="all">Tất cả số sao</option>
          {[5, 4, 3, 2, 1].map((rating) => (
            <option key={rating} value={rating}>
              {rating} sao
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Đang tải đánh giá...</p>
      ) : filteredReviews.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          Không tìm thấy đánh giá nào.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4">
          {filteredReviews.map((review) => (
            <li key={review.id} className="rounded-xl border border-border bg-card p-4 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{tourNames[review.tour_id] ?? review.tour_id}</p>
                  <p className="text-sm text-muted-foreground">
                    {review.customer_name || "Khách hàng"} · {displayDate(review.created_at)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <ReviewStars
                      value={review.overall_rating}
                      label={`${review.overall_rating} sao`}
                      size="size-4"
                    />
                    <span className="text-sm font-medium">{review.overall_rating}/5</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${review.is_visible ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {review.is_visible ? "Đang hiển thị" : "Đã ẩn"}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void setVisibility(review, !review.is_visible)}
                  >
                    {review.is_visible ? (
                      <EyeOff className="size-4" aria-hidden />
                    ) : (
                      <Eye className="size-4" aria-hidden />
                    )}
                    {review.is_visible ? "Ẩn" : "Hiện"}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => void deleteReview(review)}>
                    <Trash2 className="size-4" aria-hidden /> Xóa
                  </Button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm">
                {review.comment || "Không có nhận xét."}
              </p>
              <PhotoList images={review.images ?? []} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
