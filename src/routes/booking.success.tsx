import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  CalendarDays,
  Check,
  Clock,
  Download,
  Mail,
  MapPin,
  QrCode,
  Smartphone,
  Ticket,
  Users,
} from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { useBookingDraft, priceBreakdown } from "@/lib/booking-store";
import { formatPrice } from "@/lib/tat-data";

export const Route = createFileRoute("/booking/success")({
  head: () => ({
    meta: [
      { title: "Combo E-Ticket Confirmed — TAT Booking" },
      {
        name: "description",
        content: "Your unified combo QR e-ticket for transport boarding and attraction entry.",
      },
      { property: "og:title", content: "Combo E-Ticket Confirmed — TAT Booking" },
      { property: "og:description", content: "Your unified combo QR e-ticket for transport boarding and attraction entry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const draft = useBookingDraft();
  const breakdown = priceBreakdown(draft);
  const [code, setCode] = useState("TAT-BOOKED");
  const [downloaded, setDownloaded] = useState(false);

  // re-hydrate after mount so SSR doesn't mismatch
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    setCode(`TAT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  }, []);
  const d = mounted ? draft : { ...draft, seats: [], addons: [] };

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {/* Success banner */}
        <div className="rounded-2xl surface-brand p-6 text-primary-foreground sm:p-8">
          <div className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-foreground/15 ring-1 ring-primary-foreground/25">
              <Check className="size-5" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Booking confirmed!</h1>
              <p className="text-sm text-primary-foreground/80">Your combo e-ticket is ready. Reference {code}.</p>
            </div>
          </div>
        </div>

        {/* E-ticket card */}
        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-lift">
          <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-5 py-3">
            <span className="inline-flex items-center gap-1.5 font-display text-sm font-bold">
              <Ticket className="size-4 text-teal" aria-hidden /> Combo E-Ticket
            </span>
            <span className="text-xs text-muted-foreground">Transport + Attraction</span>
          </div>

          <div className="grid gap-6 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6">
            {/* QR */}
            <div className="grid place-items-center">
              <div className="grid size-40 place-items-center rounded-xl border-2 border-foreground bg-background p-3">
                <QrCode className="size-full text-foreground" aria-hidden />
              </div>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">One QR · boarding + entry</p>
            </div>

            {/* Trip details */}
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold">{d.tourTitle}</h2>
              <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <Detail Icon={CalendarDays} label="Date" value={d.date} />
                <Detail Icon={Users} label="Passengers" value={`${d.passengers}`} />
                <Detail Icon={Ticket} label="Seats" value={d.seats.join(", ") || "—"} />
                <Detail Icon={Clock} label="Pickup time" value={d.pickupTime} />
                <Detail Icon={MapPin} label="Pickup point" value={d.pickupLabel} />
                <Detail Icon={Ticket} label="Add-ons" value={d.addons.length ? `${d.addons.length} selected` : "None"} />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-5 py-3 sm:px-6">
            <span className="text-sm text-muted-foreground">Amount paid</span>
            <span className="font-display text-lg font-extrabold">{formatPrice(breakdown.total)}</span>
          </div>
        </div>

        {/* Itinerary snippet */}
        <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-soft">
          <h3 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">Trip recap</h3>
          <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <li className="flex items-center gap-2">
              <MapPin className="size-4 text-primary" aria-hidden /> {d.pickupLabel} · {d.pickupTime}
            </li>
            <li className="flex items-center gap-2">
              <CalendarDays className="size-4 text-primary" aria-hidden /> {d.date}
            </li>
            <li className="flex items-center gap-2">
              <Ticket className="size-4 text-primary" aria-hidden /> Seats {d.seats.join(", ") || "—"}
            </li>
            <li className="flex items-center gap-2">
              <Clock className="size-4 text-primary" aria-hidden /> Offline access enabled
            </li>
          </ul>
        </div>

        {/* Actions */}
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Button variant="cta" className="sm:col-span-2" onClick={() => setDownloaded(true)}>
            <Download className="size-4" aria-hidden /> {downloaded ? "Downloaded" : "Download PDF"}
          </Button>
          <Button variant="outline">
            <Smartphone className="size-4" aria-hidden /> Add to Wallet
          </Button>
          <Button variant="outline">
            <Mail className="size-4" aria-hidden /> Email / SMS
          </Button>
        </div>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link to="/tours">Book another tour</Link>
          </Button>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Detail({ Icon, label, value }: { Icon: typeof CalendarDays; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
      <span className="min-w-0">
        <span className="block text-[11px] uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="font-medium">{value}</span>
      </span>
    </div>
  );
}
