import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bus,
  Clock,
  MapPin,
  Star,
  Ticket,
  TrainFront,
  Car,
  ShieldCheck,
  Users,
  CalendarDays,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AuthDialog } from "@/components/auth/auth-dialog";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { pickupPoints, transportLabels, type TransportType } from "@/lib/tat-data";
import { saveDraft, type BookingDraft } from "@/lib/booking-store";
import { useCurrency } from "@/lib/currency";
import { useTourCatalog } from "@/lib/tour-catalog";
import { useLanguage } from "@/lib/language";
import { useAuth } from "@/hooks/use-auth";
import { isBookingProfileComplete } from "@/lib/booking-profile";
import { supabase } from "@/integrations/supabase/client";
import fallbackTourImage from "@/assets/hero-coast.jpg";

export const Route = createFileRoute("/tours/$id")({
  validateSearch: (search: Record<string, unknown>) => {
    const passengers = Number(search["passengers"]);
    return {
      passengers: Number.isInteger(passengers) && passengers > 0 ? passengers : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Tour Detail & Seat Selection — TAT Booking" },
      {
        name: "description",
        content: "Pick your seat, pickup point and attraction add-ons for this tour.",
      },
      { property: "og:title", content: "Tour Detail & Seat Selection — TAT Booking" },
      {
        property: "og:description",
        content: "Pick your seat, pickup point and attraction add-ons for this tour.",
      },
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

// Coach seat map: eight 2+2 rows and a final 2+3 row, for 37 total.
const seatRows = ["A", "B", "", "C", "D"];
const seatNumbers = Array.from({ length: 9 }, (_, i) => i + 1);
// pre-occupy some seats to simulate real-time availability
const takenSeats = new Set(["A2", "B1", "C5", "D4", "A6", "B8", "C3", "A9", "B5"]);
const PENDING_CHECKOUT_INTENT_KEY = "tat-pending-profile-checkout";

type PendingCheckoutIntent = {
  userId: string;
  tourId: string;
  passengers: number;
  seats: string[];
  pickup: string;
  addons: Record<string, boolean>;
};

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isBooleanRecord(value: unknown): value is Record<string, boolean> {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.values(value).every((selected) => typeof selected === "boolean")
  );
}

function parsePendingCheckoutIntent(value: string): PendingCheckoutIntent | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null) return null;
    const intent = parsed as Record<string, unknown>;
    const userId = intent["userId"];
    const tourId = intent["tourId"];
    const passengers = intent["passengers"];
    const seats = intent["seats"];
    const pickup = intent["pickup"];
    const addons = intent["addons"];
    if (
      typeof userId !== "string" ||
      typeof tourId !== "string" ||
      typeof passengers !== "number" ||
      !Number.isInteger(passengers) ||
      passengers < 1 ||
      !isStringArray(seats) ||
      typeof pickup !== "string" ||
      !isBooleanRecord(addons)
    ) {
      return null;
    }

    return {
      userId,
      tourId,
      passengers,
      seats,
      pickup,
      addons,
    };
  } catch {
    return null;
  }
}

function getBookingErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = error.message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return "Unable to reserve a ticket. Please try again.";
}

function getPickupTimeFromTimeline(value: unknown): string | null {
  if (!Array.isArray(value)) return null;

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;
    const activity = entry as Record<string, unknown>;
    const time = activity["time"];
    const title = activity["title"];
    if (typeof time !== "string" || typeof title !== "string") continue;

    const normalizedTitle = title
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLocaleLowerCase()
      .replace(/đ/g, "d");
    if ((normalizedTitle.includes("don khach") || normalizedTitle.includes("pickup")) && /^\d{1,2}:\d{2}$/.test(time.trim())) {
      return time.trim();
    }
  }

  return null;
}

function TourDetailPage() {
  const { formatPrice } = useCurrency();
  const { t } = useLanguage();
  const { activeTours, loading: toursLoading, error: toursError } = useTourCatalog();
  const { id } = Route.useParams();
  const { passengers: searchPassengers } = Route.useSearch();
  const tour = activeTours.find((item) => item.id === id);
  const tourId = tour?.id;
  const tourTransport = tour?.transport;
  const navigate = useNavigate();
  const {
    loading: authLoading,
    profile,
    profileLoading,
    user,
    openProfileEditor,
    refreshAuthProfile,
  } = useAuth();

  const [step, setStep] = useState(1);
  const [pax, setPax] = useState(searchPassengers ?? 1);
  const [seats, setSeats] = useState<string[]>([]);
  const [pickup, setPickup] = useState("");
  const [pickupError, setPickupError] = useState(false);
  const [addons, setAddons] = useState<Record<string, boolean>>({});
  const [authOpen, setAuthOpen] = useState(false);
  const [booking, setBooking] = useState(false);
  const [checkoutIntentReady, setCheckoutIntentReady] = useState(false);
  const resumeCheckoutAfterProfile = useRef(false);
  const goCheckoutRef = useRef<() => Promise<void>>(async () => {});

  useEffect(() => {
    setPax(searchPassengers ?? 1);
    setSeats([]);
  }, [searchPassengers]);

  useEffect(() => {
    if (tourId && tourTransport) {
      setPickup(tourTransport === "car" ? "" : pickupPoints[0]!.id);
    }
  }, [tourId, tourTransport]);

  useEffect(() => {
    if (!tourId || authLoading) return;
    const rawIntent = window.sessionStorage.getItem(PENDING_CHECKOUT_INTENT_KEY);
    if (rawIntent) {
      const intent = parsePendingCheckoutIntent(rawIntent);
      if (intent && intent.tourId === tourId && !user) {
        setCheckoutIntentReady(true);
        return;
      }
      if (intent && intent.tourId === tourId && intent.userId === user?.id) {
        setPax(intent.passengers);
        setSeats(intent.seats);
        setPickup(intent.pickup);
        setAddons(intent.addons);
        resumeCheckoutAfterProfile.current = true;
      } else {
        window.sessionStorage.removeItem(PENDING_CHECKOUT_INTENT_KEY);
      }
    }
    setCheckoutIntentReady(true);
  }, [authLoading, tourId, user]);

  useEffect(() => {
    if (
      !tourId ||
      !checkoutIntentReady ||
      !resumeCheckoutAfterProfile.current ||
      booking ||
      authLoading ||
      profileLoading ||
      !user
    ) {
      return;
    }

    if (isBookingProfileComplete(profile?.sdt, user.email_confirmed_at, user.new_email)) {
      resumeCheckoutAfterProfile.current = false;
      window.sessionStorage.removeItem(PENDING_CHECKOUT_INTENT_KEY);
      void goCheckoutRef.current();
    }
  }, [
    authLoading,
    booking,
    checkoutIntentReady,
    profile?.sdt,
    profileLoading,
    tourId,
    user,
  ]);

  if (!tour) {
    const message = toursLoading
      ? "Loading tour details..."
      : toursError
        ? `Unable to load tour details: ${toursError}`
        : "This tour is no longer available.";
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <main className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6">
          <p role={toursError ? "alert" : undefined} className="text-sm text-muted-foreground">
            {message}
          </p>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/tours">Back to tours</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const Icon = transportIcon[tour.transport];
  const timeline = tour.timeline?.length ? tour.timeline : tour.itinerary;
  const timelinePickupTime = getPickupTimeFromTimeline(tour.timeline);
  const hasSeatSelection = tour.transport !== "car";
  const isPrivateVehicle = tour.transport === "car";
  const pickupStep = hasSeatSelection ? 3 : 2;
  const addonsStep = hasSeatSelection ? 4 : 3;
  const stepLabels = hasSeatSelection
    ? ["Date", "Seats", "Pickup", "Add-ons"]
    : ["Date", "Pickup", "Add-ons"];

  const toggleSeat = (seat: string) => {
    if (takenSeats.has(seat)) return;
    setSeats((prev) =>
      prev.includes(seat)
        ? prev.filter((s) => s !== seat)
        : prev.length < pax
          ? [...prev, seat]
          : prev,
    );
  };

  const addonList = tour.attractions.map((a, i) => ({
    id: `addon-${i}`,
    label: a,
    price: i === 0 ? 0 : 8 + i * 4,
  }));

  const selectedPickup = isPrivateVehicle
    ? undefined
    : (pickupPoints.find((p) => p.id === pickup) ?? pickupPoints[0]!);
  const addonTotal = addonList.filter((a) => addons[a.id]).reduce((s, a) => s + a.price * pax, 0);
  const seatTotal = tour.price * Math.max(seats.length || pax, 1);
  const pickupFee = selectedPickup
    ? selectedPickup.note === "Free"
      ? 0
      : Number(selectedPickup.note.replace(/[^0-9]/g, "")) || 0
    : 0;
  const subtotal = seatTotal + addonTotal + pickupFee;

  const goCheckout = async () => {
    if (authLoading || booking || !checkoutIntentReady) return;
    const currentTourId = tour.id.trim();
    if (!currentTourId) {
      toast.error("Unable to create a booking because this tour has no ID.");
      return;
    }

    const quantity = Number.isInteger(pax) && pax > 0 ? pax : 1;
    setBooking(true);
    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      if (!session?.access_token) {
        setAuthOpen(true);
        toast.error("Your sign-in session has expired. Please sign in again to book.");
        return;
      }

      const {
        data: { user: authenticatedUser },
        error: authError,
      } = await supabase.auth.getUser(session.access_token);

      if (authError) throw authError;
      if (!authenticatedUser) {
        setAuthOpen(true);
        toast.error("Please sign in before booking a tour.");
        return;
      }

      const { user: refreshedUser, profile: currentProfile } = await refreshAuthProfile();
      if (refreshedUser.id !== authenticatedUser.id) {
        throw new Error("Your sign-in session changed. Please try again.");
      }
      if (
        !isBookingProfileComplete(
          currentProfile?.sdt,
          refreshedUser.email_confirmed_at,
          refreshedUser.new_email,
        )
      ) {
        const intent: PendingCheckoutIntent = {
          userId: refreshedUser.id,
          tourId: currentTourId,
          passengers: quantity,
          seats,
          pickup,
          addons,
        };
        window.sessionStorage.setItem(PENDING_CHECKOUT_INTENT_KEY, JSON.stringify(intent));
        resumeCheckoutAfterProfile.current = true;
        openProfileEditor({ requirePhone: true });
        return;
      }

      window.sessionStorage.removeItem(PENDING_CHECKOUT_INTENT_KEY);

      const client = supabase as unknown as SupabaseClient;
      const { data: currentTour, error: availabilityError } = await client
        .from("Tour")
        .select("tour_id, available_slot, travel_date, timeline")
        .eq("tour_id", currentTourId)
        .maybeSingle();

      if (availabilityError) throw availabilityError;
      if (!currentTour || String(currentTour["tour_id"] ?? "") !== currentTourId) {
        throw new Error("This tour could not be found. Please refresh the page and try again.");
      }
      const availableSlots = Number(currentTour["available_slot"]);
      if (!Number.isFinite(availableSlots) || availableSlots < quantity) {
        toast.error(
          availableSlots > 0
            ? `Only ${availableSlots} ticket${availableSlots === 1 ? "" : "s"} available.`
            : "This tour is sold out. Please choose another tour.",
        );
        return;
      }

      const sourceTravelDate = currentTour["travel_date"];
      if (typeof sourceTravelDate !== "string" || !sourceTravelDate.trim()) {
        throw new Error("This tour does not have a travel date. Please contact support.");
      }
      const travelDate = sourceTravelDate.trim().slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate)) {
        throw new Error("This tour has an invalid travel date. Please contact support.");
      }

      const pickupTime = getPickupTimeFromTimeline(currentTour["timeline"]);
      if (!pickupTime) {
        throw new Error("This tour does not have a valid pickup time in its timeline. Please update the tour timeline.");
      }

      const draft: BookingDraft = {
        tourId: currentTourId,
        tourTitle: tour.title,
        date: travelDate,
        passengers: quantity,
        seats: hasSeatSelection ? (seats.length ? seats : ["B3", "B4"].slice(0, quantity)) : [],
        transport: tour.transport,
        seatPrice: tour.price,
        pickupId: selectedPickup?.id ?? "",
        pickupLabel: selectedPickup ? selectedPickup.label : pickup,
        pickupTime,
        pickupFee,
        addons: addonList.filter((a) => addons[a.id]),
        basePrice: tour.price,
      };
      const currentOrderId = crypto.randomUUID();
      const selectedAddons = addonList.filter((addon) => addons[addon.id]);
      const selectedSeats = draft.seats;
      const ticketRows = Array.from({ length: quantity }, (_, index) => {
        const seat = selectedSeats[index];
        return {
          order_id: currentOrderId,
          tour_id: currentTourId,
          user_id: authenticatedUser.id,
          ticket_status: "pending",
          price: tour.price,
          travel_date: travelDate,
          passengers: 1,
          seat_numbers: seat ? [seat] : [],
          pickup_location: selectedPickup?.label ?? (pickup.trim() || null),
          pickup_time: pickupTime,
          addons: selectedAddons.map(({ id, label }) => ({ id, label })),
        };
      });

      const { data: tickets, error: insertError } = await client
        .from("ticket")
        .insert(ticketRows)
        .select();

      if (insertError) throw insertError;
      if (!tickets || tickets.length !== quantity) {
        throw new Error("Supabase did not return all newly created ticket IDs.");
      }
      const ticketIds = tickets.map((row: { id: string }) => row.id);
      if (ticketIds.some((id: string) => typeof id !== "string" || !id)) {
        throw new Error("Supabase returned an invalid ticket ID.");
      }

      saveDraft(draft);
      await navigate({
        to: "/checkout",
        search: { order_id: currentOrderId },
      });
    } catch (error) {
      const message = getBookingErrorMessage(error);
      console.error("Lỗi tạo vé:", message);
      toast.error(message);
    } finally {
      setBooking(false);
    }
  };

  goCheckoutRef.current = goCheckout;

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
                src={tour.image || fallbackTourImage}
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

            <div className="mt-6">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="cta" className="gap-2">
                    <CalendarDays className="size-4" aria-hidden /> View itinerary timeline
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Itinerary timeline</DialogTitle>
                    <DialogDescription>{tour.title}</DialogDescription>
                  </DialogHeader>
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No itinerary available.</p>
                  ) : (
                    <ol className="space-y-4 border-l border-border pl-5">
                      {timeline.map((item, index) => (
                        <li key={`${item.time}-${index}`} className="relative">
                          <span className="absolute -left-[26px] top-1 grid size-3 place-items-center rounded-full bg-primary ring-4 ring-background" />
                          <p className="text-xs font-semibold text-primary">{item.time}</p>
                          <p className="font-display text-sm font-bold">{item.title}</p>
                          {item.detail && (
                            <p className="text-sm text-muted-foreground">{item.detail}</p>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Right: sticky booking widget */}
          <aside className="h-fit lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-lift">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-2xl font-extrabold">
                  {formatPrice(tour.price)}
                </span>
                {tour.oldPrice && (
                  <span className="text-sm text-muted-foreground line-through">
                    {formatPrice(tour.oldPrice)}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">per person</span>
              </div>

              {/* Step indicators */}
              <div className="mt-5 flex items-start gap-2">
                {stepLabels.map((label, index) => {
                  const stepNumber = index + 1;
                  return (
                    <div key={label} className="min-w-0 flex-1">
                      <div
                        className={`h-1 rounded-full ${stepNumber <= step ? "bg-primary" : "bg-border"}`}
                        aria-hidden
                      />
                      <span
                        className={`mt-1 block text-[11px] ${stepNumber === step ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                      >
                        {stepNumber}. {t(label)}
                      </span>
                    </div>
                  );
                })}
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
                      value={tour.travelDate ?? ""}
                      disabled
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
                    {hasSeatSelection ? "Choose seats" : "Choose pickup point"}{" "}
                    <ArrowRight className="size-4" aria-hidden />
                  </Button>
                </div>
              )}

              {/* Step 2: Seat map */}
              {hasSeatSelection && step === 2 && (
                <div className="mt-5 grid gap-4">
                  <p className="text-xs text-muted-foreground">
                    Pick {pax} seat{pax > 1 ? "s" : ""}. Selected:{" "}
                    <span className="font-semibold text-foreground">{seats.join(", ") || "—"}</span>
                  </p>
                  <div className="rounded-xl border border-border p-3">
                    <div className="mx-auto mb-3 w-2/3 rounded-t-lg bg-primary/10 py-1 text-center text-[11px] font-semibold text-primary">
                      Front of coach
                    </div>
                    <div className="space-y-1.5">
                      {seatNumbers.map((row) => {
                        const rowSeats =
                          row === seatNumbers.length ? ["A", "B", "C", "D", "E"] : seatRows;
                        return (
                          <div key={row} className="flex items-center justify-center gap-1.5">
                            <span className="w-4 text-center text-[10px] text-muted-foreground">
                              {row}
                            </span>
                            {rowSeats.map((col, idx) =>
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
                        );
                      })}
                    </div>
                    <div className="mt-3 flex items-center justify-center gap-4 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded bg-primary" /> Selected
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded bg-muted" /> Taken
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-3 rounded border border-border" /> Free
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button variant="cta" className="flex-1" onClick={() => setStep(3)}>
                      Continue <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Pickup */}
              {step === pickupStep && (
                <div className="mt-5 grid gap-4">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      <MapPin className="mr-1 inline size-3.5" aria-hidden /> Pickup point
                    </Label>
                    {isPrivateVehicle ? (
                      <>
                        <Input
                          type="text"
                          value={pickup}
                          onChange={(event) => {
                            setPickup(event.target.value);
                            if (event.target.value.trim()) setPickupError(false);
                          }}
                          placeholder="Enter pickup address"
                          className={`h-11 rounded-xl ${pickupError ? "border-destructive ring-1 ring-destructive" : ""}`}
                        />
                        {pickupError && (
                          <p className="text-xs font-medium text-destructive">
                            {t("Please enter the pickup address before continuing.")}
                          </p>
                        )}
                      </>
                    ) : (
                      <select
                        value={pickup}
                        onChange={(event) => setPickup(event.target.value)}
                        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                      >
                        {pickupPoints.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.label}{timelinePickupTime ? ` · ${timelinePickupTime}` : ""} ({p.note})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                  <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
                    <ShieldCheck className="mr-1 inline size-3.5 text-teal" aria-hidden />
                    Your seat is held for 10 minutes once you reach checkout.
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(hasSeatSelection ? 2 : 1)}
                    >
                      Back
                    </Button>
                    <Button variant="cta" className="flex-1" onClick={() => {
                        if (isPrivateVehicle && !pickup.trim()) {
                          setPickupError(true);
                          return;
                        }
                        setPickupError(false);
                        setStep(addonsStep);
                      }}>
                      Continue <ArrowRight className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 4: Add-ons */}
              {step === addonsStep && (
                <div className="mt-5 grid gap-4">
                  <p className="text-xs text-muted-foreground">Attraction add-ons (per person)</p>
                  <div className="grid gap-2.5">
                    {addonList.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border p-2.5"
                      >
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
                    <Row
                      label={hasSeatSelection ? "Seats" : "Vehicle"}
                      value={formatPrice(seatTotal)}
                    />
                    <Row label="Add-ons" value={formatPrice(addonTotal)} />
                    <Row
                      label="Pickup fee"
                      value={pickupFee === 0 ? "Free" : formatPrice(pickupFee)}
                    />
                    <div className="mt-1.5 border-t border-border pt-1.5">
                      <Row label="Subtotal" value={formatPrice(subtotal)} bold />
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1"
                      onClick={() => setStep(pickupStep)}
                    >
                      Back
                    </Button>
                    <Button
                      variant="cta"
                      className="flex-1"
                      onClick={() => void goCheckout()}
                      disabled={booking || authLoading || !checkoutIntentReady}
                    >
                      {booking ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <ArrowRight className="size-4" aria-hidden />
                      )}
                      {booking ? "Reserving..." : "Go to checkout"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode="login"
        onModeChange={() => undefined}
      />
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
