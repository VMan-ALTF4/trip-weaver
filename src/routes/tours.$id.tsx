import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  Check,
  Clock,
  MapPin,
  Star,
  Ticket,
  TrainFront,
  Car,
  ShieldCheck,
  Users,
  CalendarDays,
} from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatPrice,
  getTour,
  pickupPoints,
  transportLabels,
  tours,
  type TransportType,
} from "@/lib/tat-data";
import { saveDraft, type BookingDraft } from "@/lib/booking-store";

export const Route = createFileRoute("/tours/$id")({
  head: () => ({
    meta: [
      { title: "Tour Detail & Seat Selection — TAT Booking" },
      {
        name: "description",
        content: "Pick your seat, pickup point and attraction add-ons for this tour.",
      },
      { property: "og:title", content: "Tour Detail & Seat Selection — TAT Booking" },
      { property: "og:description", content: "Pick your seat, pickup point and attraction add-ons for this tour." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TourDetailPage,
});

const transportIcon: Record<TransportType, typeof Bus> = {
  bus: Bus,
  train: TrainFront,
  car: Car,
};

// Simple coach seat map: 10 rows, 2+2 layout
const seatRows = ["A", "B", "", "C", "D"];
const seatNumbers = Array.from({ length: 10 }, (_, i) => i + 1);
// pre-occupy some seats to simulate real-time availability
const takenSeats = new Set(["A2", "B1", "C5", "D4", "A6", "B8", "C3", "D9", "A10", "B5"]);

function TourDetailPage() {
  const { id } = Route.useParams();
  const tour = getTour(id) ?? tours[0]!;
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [date, setDate] = useState("");
  const [pax, setPax] = useState(2);
  const [seats, setSeats] = useState<string[]>([]);
  const [pickup, setPickup] = useState(pickupPoints[0]!.id);
  const [addons, setAddons] = useState<Record<string, boolean>>({});

  const Icon = transportIcon[tour.transport];

  const toggleSeat = (seat: string) => {
    if (takenSeats.has(seat)) return;
    setSeats((prev) =>
      prev.includes(seat) ? prev.filter((s) => s !== seat) : prev.length < pax ? [...prev, seat] : prev,
    );
  };

  const addonList = tour.attractions.map((a, i) => ({
    id: `addon-${i}`,
    label: a,
    price: i === 0 ? 0 : 8 + i * 4,
  }));

  const selectedPickup = pickupPoints.find((p) => p.id === pickup) ?? pickupPoints[0]!;
  const addonTotal = addonList
    .filter((a) => addons[a.id])
    .reduce((s, a) => s + a.price * pax, 0);
  const seatTotal = tour.price * Math.max(seats.length || pax, 1);
  const pickupFee = selectedPickup.note === "Free" ? 0 : Number(selectedPickup.note.replace(/[^0-9]/g, "")) || 0;
  const subtotal = seatTotal + addonTotal + pickupFee;

  const goCheckout = () => {
    const draft: BookingDraft = {
      tourId: tour.id,
      tourTitle: tour.title,
      date: date || "2026-10-12",
      passengers: pax,
      seats: seats.length ? seats : ["B3", "B4"].slice(0, pax),
      seatPrice: tour.price,
      pickupId: selectedPickup.id,
      pickupLabel: selectedPickup.label,
      pickupTime: selectedPickup.time,
      pickupFee,
      addons: addonList.filter((a) => addons[a.id]),
      basePrice: tour.price,
    };
    saveDraft(draft);
    navigate({ to: "/checkout" });
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/tours">
            <ArrowLeft className="size-4" aria-hidden /> Back to tours
          </Link>
        </Button>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left: gallery + overview */}
          <div className="min-w-0">
            <div className="overflow-hidden rounded-2xl border border-border shadow-soft">
              <img
                src={tour.image}
                alt={`${tour.title} in ${tour.destination}`}
                width={1024}
                height={576}
                className="h-72 w-full object-cover sm:h-96"
              />
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">{tour.title}</h1>
              <div className="flex items-center gap-1 text-sm font-semibold">
                <Star className="size-4 fill-accent text-accent" aria-hidden /> {tour.rating}
                <span className="font-normal text-muted-foreground">({tour.reviews})</span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge variant="outline" className="gap-1 font-medium">
                <MapPin className="size-3.5" aria-hidden /> {tour.destination}
              </Badge>
              <Badge variant="outline" className="gap-1 font-medium">
                <Icon className="size-3.5" aria-hidden /> {transportLabels[tour.transport]}
              </Badge>
              <Badge variant="outline" className="gap-1 font-medium">
                <Clock className="size-3.5" aria-hidden /> {tour.duration}
              </Badge>
              {tour.combo && (
                <Badge className="gap-1 bg-teal text-teal-foreground">
                  <Ticket className="size-3.5" aria-hidden /> Combo E-Ticket
                </Badge>
              )}
            </div>

            <p className="mt-4 text-sm text-muted-foreground">{tour.summary}</p>

            {/* Itinerary */}
            <section className="mt-8">
              <h2 className="font-display text-lg font-bold">Itinerary timeline</h2>
              <ol className="mt-4 space-y-4 border-l border-border pl-5">
                {tour.itinerary.map((it, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[26px] top-1 grid size-3 place-items-center rounded-full bg-primary ring-4 ring-background" />
                    <p className="text-xs font-semibold text-primary">{it.time}</p>
                    <p className="font-display text-sm font-bold">{it.title}</p>
                    <p className="text-sm text-muted-foreground">{it.detail}</p>
                  </li>
                ))}
              </ol>
            </section>

            {/* Included / excluded */}
            <section className="mt-8 grid gap-6 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-teal">Included</h3>
                <ul className="mt-3 space-y-2 text-sm">
                  {tour.included.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-teal" aria-hidden /> {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 shadow-soft">
                <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Not included
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {tour.excluded.map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/50" aria-hidden /> {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          {/* Right: sticky booking widget */}
          <aside className="h-fit lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-lift">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-extrabold">{formatPrice(tour.price)}</span>
                {tour.oldPrice && (
                  <span className="text-sm text-muted-foreground line-through">{formatPrice(tour.oldPrice)}</span>
                )}
                <span className="text-xs text-muted-foreground">per person</span>
              </div>

              {/* Step indicators */}
              <div className="mt-5 flex items-center gap-2">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className="flex-1">
                    <div
                      className={`h-1 rounded-full ${n <= step ? "bg-primary" : "bg-border"}`}
                      aria-hidden
                    />
                    <span className={`mt-1 block text-[11px] ${n === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                      {n}. {["Date", "Seats", "Pickup", "Add-ons"][n - 1]}
                    </span>
                  </div>
                ))}
              </div>

              {/* Step 1: Date & passengers */}
              {step === 1 && (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-1.5">
                    <Label htmlFor="detail-date" className="text-xs text-muted-foreground">
                      <CalendarDays className="mr-1 inline size-3.5" aria-hidden /> Travel date
                    </Label>
                    <Input
                      id="detail-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="detail-pax" className="text-xs text-muted-foreground">
                      <Users className="mr-1 inline size-3.5" aria-hidden /> Passengers
                    </Label>
                    <Input
                      id="detail-pax"
                      type="number"
                      min={1}
                      max={10}
                      value={pax}
                      onChange={(e) => setPax(Math.max(1, Number(e.target.value) || 1))}
                      className="h-11 rounded-xl"
                    />
                  </div>
                  <Button variant="cta" className="w-full" onClick={() => setStep(2)}>
                    Choose seats <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </div>
              )}

              {/* Step 2: Seat map */}
              {step === 2 && (
                <div className="mt-5 grid gap-4">
                  <p className="text-xs text-muted-foreground">
                    Pick {pax} seat{pax > 1 ? "s" : ""}. Selected: <span className="font-semibold text-foreground">{seats.join(", ") || "—"}</span>
                  </p>
                  <div className="rounded-xl border border-border p-3">
                    <div className="mx-auto mb-3 w-2/3 rounded-t-lg bg-primary/10 py-1 text-center text-[11px] font-semibold text-primary">
                      Front of coach
                    </div>
                    <div className="space-y-1.5">
                      {seatNumbers.map((row) => (
                        <div key={row} className="flex items-center justify-center gap-1.5">
                          <span className="w-4 text-center text-[10px] text-muted-foreground">{row}</span>
                          {seatRows.map((col, idx) =>
                            col === "" ? (
                              <span key={`aisle-${row}-${idx}`} className="w-5" aria-hidden />
                            ) : (
                              <SeatButton
                                key={`${col}${row}`}
                                seat={`${col}${row}`}
                                taken={takenSeats.has(`${col}${row}`)}
                                selected={seats.includes(`${col}${row}`)}
                                onClick={() => toggleSeat(`${col}${row}`)}
                              />
                            ),
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-primary" /> Selected</span>
                      <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-muted" /> Taken</span>
                      <span className="flex items-center gap-1.5"><span className="size-3 rounded border border-border" /> Free</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>Back</Button>
                    <Button variant="cta" className="flex-1" onClick={() => setStep(3)}>
                      Continue <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Pickup */}
              {step === 3 && (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline size-3.5" aria-hidden /> Pickup point
                    </Label>
                    <Select value={pickup} onValueChange={setPickup}>
                      <SelectTrigger className="h-11 rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {pickupPoints.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.label} · {p.time} ({p.note})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                    <ShieldCheck className="mr-1 inline size-3.5 text-teal" aria-hidden />
                    Your seat is held for 10 minutes once you reach checkout.
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>Back</Button>
                    <Button variant="cta" className="flex-1" onClick={() => setStep(4)}>
                      Continue <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Add-ons */}
              {step === 4 && (
                <div className="mt-5 grid gap-4">
                  <p className="text-xs text-muted-foreground">Attraction add-ons (per person)</p>
                  <div className="grid gap-2.5">
                    {addonList.map((a) => (
                      <label key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5">
                        <Checkbox
                          checked={!!addons[a.id]}
                          onCheckedChange={(c) => setAddons((p) => ({ ...p, [a.id]: c === true }))}
                        />
                        <span className="flex-1 text-sm">{a.label}</span>
                        <span className="text-xs text-muted-foreground">
                          {a.price === 0 ? "Included" : formatPrice(a.price)}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="rounded-lg border border-border bg-secondary/50 p-3 text-sm">
                    <Row label="Seats" value={formatPrice(seatTotal)} />
                    <Row label="Add-ons" value={formatPrice(addonTotal)} />
                    <Row label="Pickup fee" value={pickupFee === 0 ? "Free" : formatPrice(pickupFee)} />
                    <div className="mt-1.5 border-t border-border pt-1.5">
                      <Row label="Subtotal" value={formatPrice(subtotal)} bold />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(3)}>Back</Button>
                    <Button variant="cta" className="flex-1" onClick={goCheckout}>
                      Go to checkout <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function SeatButton({
  seat,
  taken,
  selected,
  onClick,
}: {
  seat: string;
  taken: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={taken}
      aria-label={`Seat ${seat}${taken ? " (taken)" : selected ? " (selected)" : ""}`}
      className={`grid size-7 place-items-center rounded-md text-[10px] font-semibold transition-colors ${
        taken
          ? "cursor-not-allowed bg-muted text-muted-foreground"
          : selected
            ? "bg-primary text-primary-foreground"
            : "border border-border bg-card hover:border-primary hover:text-primary"
      }`}
    >
      {seat}
    </button>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className={bold ? "font-semibold" : "text-muted-foreground"}>{label}</span>
      <span className={bold ? "font-bold" : "font-medium"}>{value}</span>
    </div>
  );
}
