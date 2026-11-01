import { createFileRoute, Link } from "@tanstack/react-router";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CalendarDays, Loader2, MapPin, Ticket, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { useCurrency } from "@/lib/currency";

type Booking = {
  id: string;
  tour_id: string;
  ticket_status: "pending" | "sold" | "expired" | "cancelled";
  pickup_location: string | null;
  price: number;
  travel_date: string | null;
  created_at: string;
  payment_method: string | null;
  tour_name: string;
};

type TicketStatus = Booking["ticket_status"];
type BookingFilter = "all" | TicketStatus;

const bookingFilters: { id: BookingFilter; label: string }[] = [
  { id: "all", label: "Tất cả" },
  { id: "pending", label: "Đang chờ" },
  { id: "sold", label: "Đã thanh toán" },
  { id: "expired", label: "Quá hạn" },
  { id: "cancelled", label: "Đã hủy" },
];

const statusLabels: Record<TicketStatus, string> = {
  pending: "Đang chờ thanh toán",
  sold: "Đã thanh toán",
  expired: "Quá hạn",
  cancelled: "Đã hủy",
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
            "id, tour_id, ticket_status, pickup_location, price, travel_date, created_at, payment_method",
          )
          .eq("user_id", currentUser.id)
          .order("created_at", { ascending: false });
        if (error) {
          console.error("Lỗi fetch bookings:", error);
          throw error;
        }

        const rows = (data ?? []) as Omit<Booking, "tour_name">[];
        const tourIds = [...new Set(rows.map((booking) => booking.tour_id))];
        const { data: tours, error: toursError } = tourIds.length
          ? await client.from("Tour").select("tour_id, tour_name").in("tour_id", tourIds)
          : { data: [], error: null };
        if (toursError) {
          console.error("Lỗi fetch bookings:", toursError);
          throw toursError;
        }

        const tourNames = new Map(
          (tours ?? []).map((tour) => [
            String(tour["tour_id"]),
            String(tour["tour_name"] ?? "Tour booking"),
          ]),
        );
        if (active) {
          setBookings(
            rows.map((booking) => ({
              ...booking,
              tour_name: tourNames.get(booking.tour_id) ?? "Tour booking",
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
            <div className="flex flex-wrap gap-2" role="tablist" aria-label="Lọc lịch sử vé">
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
                      <div className="flex flex-wrap items-start justify-between gap-4">
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
                            <BookingDetail Icon={Ticket} value={`Ticket ${booking.id}`} />
                          </dl>
                        </div>
                        <div className="text-right">
                          <p className="font-display text-lg font-extrabold">
                            {formatPrice(Number(booking.price))}
                          </p>
                          <div className="mt-2 flex flex-col items-end gap-1">
                            <Badge
                              variant="outline"
                              className={statusStyles[booking.ticket_status]}
                            >
                              {statusLabels[booking.ticket_status]}
                            </Badge>
                            {booking.ticket_status === "pending" && (
                              <PendingCountdown createdAt={booking.created_at} />
                            )}
                          </div>
                        </div>
                      </div>
                      {booking.ticket_status === "pending" && (
                        <Button asChild variant="cta" size="sm" className="mt-4">
                          <Link to="/checkout" search={{ ticket_id: booking.id }}>
                            Complete payment
                          </Link>
                        </Button>
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
