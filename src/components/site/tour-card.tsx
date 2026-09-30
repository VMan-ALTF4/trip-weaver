import { Link } from "@tanstack/react-router";
import { Bus, Clock, MapPin, Star, Ticket, TrainFront, Car } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice, transportLabels, type Tour } from "@/lib/tat-data";

const transportIcon = { bus: Bus, train: TrainFront, car: Car };

export function TourCard({ tour, layout = "grid" }: { tour: Tour; layout?: "grid" | "row" }) {
  const Icon = transportIcon[tour.transport];

  return (
    <Link
      to="/tours/$id"
      params={{ id: tour.id }}
      className={`group flex overflow-hidden rounded-xl border border-border bg-card shadow-soft transition-all hover:-translate-y-0.5 hover:shadow-lift ${
        layout === "row" ? "flex-col sm:flex-row" : "flex-col"
      }`}
    >
      <div className={`relative shrink-0 overflow-hidden ${layout === "row" ? "sm:w-56" : ""}`}>
        <img
          src={tour.image}
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
            <Star className="size-3.5 fill-accent text-accent" aria-hidden />
            {tour.rating}
            <span className="font-normal text-muted-foreground">({tour.reviews})</span>
          </span>
        </div>

        <h3 className="line-clamp-2 font-display text-base font-bold leading-snug">{tour.title}</h3>
        <p className="line-clamp-2 text-sm text-muted-foreground">{tour.summary}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="gap-1 font-medium">
            <Icon className="size-3.5" aria-hidden /> {transportLabels[tour.transport]}
          </Badge>
          <Badge variant="outline" className="gap-1 font-medium">
            <Clock className="size-3.5" aria-hidden /> {tour.duration}
          </Badge>
          {tour.oldPrice && (
            <span className="ml-auto text-xs line-through">{formatPrice(tour.oldPrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
