import { createFileRoute, Link } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, ExternalLink, Loader2, MapPin, QrCode, Ticket, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/lib/currency";
import { useLanguage } from "@/lib/language";
import { getOrderEtickets } from "@/lib/eticket-view.server";

type Booking = {
  id: string;
  order_id: string;
  tour_id: string;
  ticket_status: "pending" | "sold" | "expired" | "cancelled";
  pickup_location: string | null;
  price: number;
  passengers: number;
  seat_numbers: string[];
  travel_date: string | null;
  created_at: string;
  payment_method: string | null;
  payment_at: string | null;
  ticket_issue_status: "pending_issue" | "issued" | null;
  tour_name: string;
  ticket_code: string | null;
};

type TicketStatus = Booking["ticket_status"];
type BookingFilter = "all" | TicketStatus;

const bookingFilters: { id: BookingFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending" },
  { id: "sold", label: "Paid" },
  { id: "expired", label: "Expired" },
  { id: "cancelled", label: "Cancelled" },
];

const statusLabels: Record<TicketStatus, string> = {
  pending: "Pending payment",
  sold: "Paid",
  expired: "Expired",
  cancelled: "Cancelled",
};

const statusStyles: Record<TicketStatus, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-900",
  sold: "border-green-300 bg-green-100 text-green-800",
  expired: "border-transparent bg-muted text-muted-foreground",
  cancelled: "border-destructive/30 bg-destructive/10 text-destructive",
};

export const Route = createFileRoute("/my-bookings")({
  head: () => ({
    meta: [
      { title: "My Bookings — TAT Booking" },
      { name: "description", content: "View your tour bookings and payment status." },
    ],
  }),
  component: MyBookingsPage,
});

function MyBookingsPage() {
  const { t, language } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { formatPrice } = useCurrency();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<BookingFilter>("all");
  const client = supabase as unknown as SupabaseClient;

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    async function loadBookings() {
      setLoading(true);
      try {
        const {
          data: { user: currentUser },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!currentUser) {
          if (active) setBookings([]);
          return;
        }

        const { data, error } = await client
          .from("ticket")
          .select(
            "id, order_id, tour_id, ticket_status, pickup_location, price, passengers, seat_numbers, travel_date, created_at, payment_method, payment_at, ticket_issue_status",
          )
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });
        if (error) {
          console.error("Lỗi fetch bookings:", error);
          throw error;
        }

        const rows = (data ?? []) as Omit<Booking, "tour_name" | "ticket_code">[];
        const tourIds = [...new Set(rows.map((booking) => booking.tour_id))];
        const { data: tours, error: toursError } = tourIds.length
          ? await client.from("Tour").select("tour_id, tour_name").in("tour_id", tourIds)
          : { data: [], error: null };
        if (toursError) {
          console.error("Lỗi fetch bookings:", toursError);
          throw toursError;
        }

        const soldTicketIds = rows
          .filter((booking) => booking.ticket_status === "sold")
          .map((booking) => booking.id);
        const { data: etickets, error: eticketsError } = soldTicketIds.length
          ? await client.from("eticket").select("ticket_id, ticket_code").in("ticket_id", soldTicketIds)
          : { data: [], error: null };
        if (eticketsError) {
          console.error("Lỗi fetch mã vé điện tử:", eticketsError);
          throw eticketsError;
        }

        const tourNames = new Map(
          (tours ?? []).map((tour) => [
            String(tour["tour_id"]),
            String(tour["tour_name"] ?? "Tour booking"),
          ]),
        );
        const ticketCodes = new Map(
          (etickets ?? []).map((eticket) => [
            String(eticket["ticket_id"]),
            String(eticket["ticket_code"]),
          ]),
        );
        if (active) {
          setBookings(
            rows.map((booking) => ({
              ...booking,
              tour_name: tourNames.get(booking.tour_id) ?? "Tour booking",
              ticket_code: ticketCodes.get(booking.id) ?? null,
            })),
          );
        }
      } catch (error) {
        console.error("Lỗi fetch bookings:", error);
        if (active)
          toast.error(error instanceof Error ? error.message : "Unable to load your bookings.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadBookings();
    return () => {
      active = false;
    };
  }, [authLoading, client]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">My bookings</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your ticket reservations and payment status.
        </p>

        {authLoading || loading ? (
          <div className="grid min-h-56 place-items-center" role="status">
            <Loader2 className="size-8 animate-spin text-primary" aria-label="Loading bookings" />
          </div>
        ) : !user ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground">Sign in to view your bookings.</p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/tours">Explore tours</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-6">
            <div
              className="flex flex-wrap gap-2"
              role="tablist"
              aria-label="Ticket history filters"
            >
              {bookingFilters.map((item) => {
                const count =
                  item.id === "all"
                    ? bookings.length
                    : bookings.filter((booking) => booking.ticket_status === item.id).length;
                const selected = filter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setFilter(item.id)}
                    className={`rounded-full border px-3.5 py-2 text-sm font-medium transition-colors ${
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-card text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {item.label} <span className="ml-1 tabular-nums">{count}</span>
                  </button>
                );
              })}
            </div>

            {bookings.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-border bg-card p-6 text-center">
                <p className="text-muted-foreground">You don’t have any bookings yet.</p>
                <Button asChild variant="cta" className="mt-4">
                  <Link to="/tours">Find a tour</Link>
                </Button>
              </div>
            ) : bookings.filter((booking) => filter === "all" || booking.ticket_status === filter)
                .length === 0 ? (
              <p className="mt-6 rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Không có vé nào trong trạng thái này.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4" role="tabpanel">
                {bookings
                  .filter((booking) => filter === "all" || booking.ticket_status === filter)
                  .map((booking) => (
                    <li
                      key={booking.id}
                      className="rounded-2xl border border-border bg-card p-5 shadow-soft"
                    >
                      <div className="grid grid-cols-[1fr_auto] items-start gap-4">
                        <div className="min-w-0">
                          <h2 className="font-display text-lg font-bold">{booking.tour_name}</h2>
                          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                            <BookingDetail
                              Icon={CalendarDays}
                              value={booking.travel_date ?? "Date not specified"}
                            />
                            <BookingDetail
                              Icon={MapPin}
                              value={booking.pickup_location ?? "Pickup not specified"}
                            />
                            {booking.ticket_status === "sold" && (
                              booking.ticket_code ? (
                                <BookingDetail Icon={Ticket} value={booking.ticket_code} />
                              ) : null
                            )}
                            {booking.ticket_status !== "sold" && (
                              <BookingDetail
                                Icon={Ticket}
                                value={`#${booking.order_id.slice(0, 8).toUpperCase()}`}
                              />
                            )}
                            {(booking.ticket_status === "expired" ||
                              booking.ticket_status === "cancelled") && (
                              <>
                                <BookingDetail
                                  Icon={Ticket}
                                  value={`${booking.passengers} ${t(
                                    booking.passengers === 1 ? "passenger" : "passengers",
                                  )}`}
                                />
                                {booking.seat_numbers.length > 0 && (
                                  <BookingDetail
                                    Icon={Ticket}
                                    value={`${t("Seats")}: ${booking.seat_numbers.join(", ")}`}
                                  />
                                )}
                              </>
                            )}
                          </dl>
                          {booking.ticket_status === "expired" && (
                            <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                              <p className="font-medium text-foreground">
                                {t("Seat hold expired")}
                              </p>
                              <p>
                                {t("Booked at")}:{" "}
                                {formatVietnamTime(booking.created_at, language)}
                              </p>
                              <p>
                                {t("Expired at")}:{" "}
                                {formatVietnamTime(
                                  new Date(
                                    new Date(booking.created_at).getTime() + 10 * 60 * 1000,
                                  ).toISOString(),
                                  language,
                                )}
                              </p>
                            </div>
                          )}
                          {booking.ticket_status === "cancelled" && (
                            <div className="mt-3 space-y-1 text-sm">
                              {(
                                Boolean(booking.payment_method) ||
                                Boolean(booking.payment_at) ||
                                booking.ticket_issue_status === "pending_issue" ||
                                booking.ticket_issue_status === "issued"
                              ) && (
                                <p className="text-muted-foreground">
                                  {t(
                                    "Need refund support? Please contact support.",
                                  )}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          {booking.ticket_status === "sold" ? (
                            <BookingQrThumbnail
                              ticketId={booking.id}
                              orderId={booking.order_id}
                              tourName={booking.tour_name}
                              travelDate={booking.travel_date}
                              pickupLocation={booking.pickup_location}
                            />
                          ) : (
                            <>
                              <p className="font-display text-lg font-extrabold">
                                {formatPrice(Number(booking.price))}
                              </p>
                              <div className="flex flex-col items-end gap-1">
                                <Badge
                                  variant="outline"
                                  className={statusStyles[booking.ticket_status]}
                                >
                                  {t(statusLabels[booking.ticket_status])}
                                </Badge>
                                {booking.ticket_status === "pending" && (
                                  <PendingCountdown createdAt={booking.created_at} />
                                )}
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                      {booking.ticket_status === "pending" && (
                        <Button asChild variant="cta" size="sm" className="mt-4">
                          <Link to="/checkout" search={{ order_id: booking.order_id }}>
                            {t("Complete payment")}
                          </Link>
                        </Button>
                      )}
                      {booking.ticket_status === "sold" && (
                        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                          <Button asChild variant="outline" size="sm" className="gap-1.5">
                            <Link to="/eticket/$orderId" params={{ orderId: booking.order_id }}>
                              <ExternalLink className="size-4" aria-hidden />
                              {t("View e-ticket")}
                            </Link>
                          </Button>
                          <div className="flex flex-col items-end gap-1">
                            <p className="font-display text-lg font-extrabold">
                              {formatPrice(Number(booking.price))}
                            </p>
                            <Badge
                              variant="outline"
                              className={statusStyles[booking.ticket_status]}
                            >
                              {t(statusLabels[booking.ticket_status])}
                            </Badge>
                          </div>
                        </div>
                      )}
                      {(booking.ticket_status === "expired" ||
                        booking.ticket_status === "cancelled") && (
                        <div className="mt-4 border-t border-border pt-3">
                          <Button asChild variant="cta" size="sm">
                            <Link
                              to="/tours/$id"
                              params={{ id: booking.tour_id }}
                              search={{ passengers: booking.passengers }}
                            >
                              {t("Rebook this tour")}
                            </Link>
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
              </ul>
            )}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}

function PendingCountdown({ createdAt }: { createdAt: string }) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, Math.ceil((new Date(createdAt).getTime() + 10 * 60 * 1000 - Date.now()) / 1000)),
  );

  useEffect(() => {
    const updateRemaining = () => {
      setRemaining(
        Math.max(
          0,
          Math.ceil((new Date(createdAt).getTime() + 10 * 60 * 1000 - Date.now()) / 1000),
        ),
      );
    };
    updateRemaining();
    const timerId = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timerId);
  }, [createdAt]);

  if (remaining === 0) return null;
  const time = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(
    remaining % 60,
  ).padStart(2, "0")}`;

  return (
    <span className="flex items-center gap-1 text-xs text-amber-800">
      <Timer className="size-3" aria-hidden />
      {time}
    </span>
  );
}

function BookingDetail({ Icon, value }: { Icon: typeof CalendarDays; value: string }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{value}</span>
    </div>
  );
}

function formatVietnamTime(value: string, language: "en" | "vi") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(language === "vi" ? "vi-VN" : "en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function BookingQrThumbnail({
  ticketId,
  orderId,
  tourName,
  travelDate,
  pickupLocation,
}: {
  ticketId: string;
  orderId: string;
  tourName: string;
  travelDate: string | null;
  pickupLocation: string | null;
}) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [ticketCode, setTicketCode] = useState<string | null>(null);
  const [seatNo, setSeatNo] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadQr() {
      try {
        const result = await getOrderEtickets({ data: { orderId } });
        if (!active) return;
        const currentTicket =
          result.tickets.find((item) => item.id === ticketId) ?? result.tickets[0];
        if (currentTicket?.eticket?.qrSvg) {
          setQrSvg(currentTicket.eticket.qrSvg);
          setTicketCode(currentTicket.eticket.ticket_code);
          setSeatNo(
            currentTicket.eticket.seat_no ??
              (currentTicket.seat_numbers?.length ? currentTicket.seat_numbers.join(", ") : null),
          );
        }
      } catch (err) {
        console.error("Unable to load e-ticket QR for booking:", err);
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadQr();
    return () => {
      active = false;
    };
  }, [orderId, ticketId]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* Thumbnail trigger — appears top-right of card */}
      <DialogTrigger asChild>
        <button
          type="button"
          className="group flex cursor-pointer items-center gap-2 rounded-xl border border-border bg-secondary/30 p-1.5 transition-all hover:border-primary hover:bg-secondary/60 hover:shadow-sm"
          title={t("Click to enlarge QR code")}
        >
          <div className="flex size-14 items-center justify-center rounded-lg border border-border/80 bg-white p-1 shadow-xs transition-transform group-hover:scale-105">
            {loading ? (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            ) : qrSvg ? (
              <div className="size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <QrCode className="size-6 text-muted-foreground" />
            )}
          </div>
          <div className="text-left text-xs">
            <p className="flex items-center gap-1 font-semibold text-foreground transition-colors group-hover:text-primary">
              <QrCode className="size-3.5 text-primary" /> {t("Ticket QR code")}
            </p>
            <p className="text-[11px] text-muted-foreground">{t("Click to enlarge")}</p>
          </div>
        </button>
      </DialogTrigger>

      {/* Enlarged QR dialog */}
      <DialogContent className="max-w-sm text-center sm:rounded-2xl">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="font-display text-lg font-bold">{tourName}</DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("Use this e-ticket QR code to board your vehicle and enter attractions.")}
          </DialogDescription>
        </DialogHeader>

        <div className="my-2 flex flex-col items-center">
          <div className="flex size-56 items-center justify-center rounded-2xl border-2 border-primary/20 bg-white p-3 shadow-md">
            {loading ? (
              <Loader2 className="size-8 animate-spin text-primary" />
            ) : qrSvg ? (
              <div className="size-full" dangerouslySetInnerHTML={{ __html: qrSvg }} />
            ) : (
              <QrCode className="size-20 text-muted-foreground" />
            )}
          </div>
          {ticketCode && (
            <p className="mt-3 font-mono text-xs font-semibold text-foreground">
              {t("Ticket code")}: <span className="text-primary">{ticketCode}</span>
            </p>
          )}
          <dl className="mt-3 grid w-full grid-cols-2 gap-2 text-left text-xs">
            {travelDate && (
              <div className="rounded-lg bg-secondary/50 p-2">
                <dt className="text-muted-foreground">{t("Travel date")}</dt>
                <dd className="mt-0.5 font-semibold text-foreground">{travelDate}</dd>
              </div>
            )}
            {seatNo && (
              <div className="rounded-lg bg-secondary/50 p-2">
                <dt className="text-muted-foreground">{t("Seat")}</dt>
                <dd className="mt-0.5 font-semibold text-foreground">{seatNo}</dd>
              </div>
            )}
            {pickupLocation && (
              <div className="col-span-2 rounded-lg bg-secondary/50 p-2">
                <dt className="text-muted-foreground">{t("Pickup point")}</dt>
                <dd className="mt-0.5 font-semibold text-foreground">{pickupLocation}</dd>
              </div>
            )}
          </dl>
        </div>

        <Button asChild variant="cta" size="sm" className="mt-1 w-full gap-1.5">
          <Link to="/eticket/$orderId" params={{ orderId }} onClick={() => setOpen(false)}>
            <ExternalLink className="size-4" aria-hidden />
            {t("E-ticket details")}
          </Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
