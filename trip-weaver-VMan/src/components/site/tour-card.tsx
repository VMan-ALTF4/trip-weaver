import { Link } from "@tanstack/react-router";
import { Bus, CalendarDays, Clock, MapPin, Star, Ticket, TrainFront, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { transportLabels, type Tour } from "@/lib/tat-data";
import { useCurrency } from "@/lib/currency";
import { useTourReviewSummary, type TourReviewSummary } from "@/lib/tour-review-summary";
import fallbackTourImage from "@/assets/hero-coast.jpg";

const transportIcon = { bus: Bus, train: TrainFront, car: Car };

function formatTravelDate(value: string): string {
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function TourCard({
  tour,
  layout = "grid",
  passengers,
  reviewSummary,
}: {
  tour: Tour;
  layout?: "grid" | "row";
  passengers?: number;
  reviewSummary?: TourReviewSummary;
}) {
  const { formatPrice } = useCurrency();
  const Icon = transportIcon[tour.transport];
  const fetchedReviewSummary = useTourReviewSummary(tour.id, !reviewSummary);
  const rating = reviewSummary ?? fetchedReviewSummary;

  return (
    <Link
      to="/tours/$id"
      params={{ id: tour.id }}
      search={{ passengers }}
      className={`group flex overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift ${
        layout === "row" ? "flex-col sm:flex-row" : "flex-col"
      }`}
    >
      <div className={`relative shrink-0 overflow-hidden ${layout === "row" ? "sm:w-56" : ""}`}>
        <img
          src={tour.image || fallbackTourImage}
          alt={`${tour.title} in ${tour.destination}`}
          loading="lazy"
          width={1024}
          height={768}
          className={`w-full object-cover transition-transform duration-500 group-hover:scale-105 ${
            layout === "row" ? "h-40 sm:h-full" : "h-48"
          }`}
        />
        <span className="absolute left-3 top-3 rounded-lg bg-accent px-2.5 py-1 text-xs font-bold text-accent-foreground shadow-soft">
          {formatPrice(tour.price)}
        </span>
        {tour.combo && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-lg bg-teal px-2.5 py-1 text-[11px] font-semibold text-teal-foreground">
            <Ticket className="size-3.5" aria-hidden /> Combo E-Ticket Included
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <MapPin className="size-3.5 shrink-0" aria-hidden />
          <span className="truncate">{tour.destination}</span>
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-foreground">
            {rating.status === "loading" ? (
              <span className="font-normal text-muted-foreground">Đang tải đánh giá...</span>
            ) : rating.status === "error" ? (
              <span className="font-normal text-muted-foreground">Chưa thể tải đánh giá</span>
            ) : rating.status === "empty" ? (
              <span className="font-normal text-muted-foreground">Chưa có đánh giá</span>
            ) : (
              <>
                <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                {rating.average?.toFixed(1)}
                <span className="font-normal text-muted-foreground">({rating.count} đánh giá)</span>
              </>
            )}
          </span>
        </div>

        <h3 className="line-clamp-2 font-display text-base font-bold leading-snug">{tour.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{tour.summary}</p>

        {rating.status === "ready" && rating.latest && (
          <div className="rounded-lg bg-muted/40 p-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold">{rating.latest.customerName}</span>
              <time className="shrink-0 text-muted-foreground">{rating.latest.date}</time>
            </div>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {rating.latest.comment || "Khách hàng đã gửi đánh giá cho chuyến đi."}
            </p>
          </div>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1 font-medium">
            <Icon className="size-3.5" aria-hidden /> {transportLabels[tour.transport]}
          </Badge>
          <Badge variant="outline" className="gap-1 font-medium">
            <Clock className="size-3.5" aria-hidden /> {tour.duration}
          </Badge>
          {tour.travelDate && (
            <Badge variant="outline" className="gap-1 font-medium">
              <CalendarDays className="size-3.5" aria-hidden />
              <time dateTime={tour.travelDate}>{formatTravelDate(tour.travelDate)}</time>
            </Badge>
          )}
          {tour.oldPrice && (
            <span className="ml-auto text-xs line-through">{formatPrice(tour.oldPrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
