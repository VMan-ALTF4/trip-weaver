import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CreditCard,
  ShieldCheck,
  Timer,
  Wallet,
  QrCode,
  Banknote,
} from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPrice } from "@/lib/tat-data";
import { useBookingDraft, priceBreakdown } from "@/lib/booking-store";

export const Route = createFileRoute("/checkout")({
  head: () => ({
    meta: [
      { title: "Checkout — TAT Booking" },
      { name: "description", content: "Review your combo booking and pay with VNPay, Momo, card or bank QR." },
    ],
  }),
  component: CheckoutPage,
});

const paymentMethods = [
  { id: "vnpay", label: "VNPay", Icon: Wallet },
  { id: "momo", label: "Momo", Icon: Wallet },
  { id: "card", label: "Credit / Debit Card", Icon: CreditCard },
  { id: "bankqr", label: "Bank Transfer QR", Icon: QrCode },
];

function CheckoutPage() {
  const draft = useBookingDraft();
  const navigate = useNavigate();
  const breakdown = priceBreakdown(draft);

  const [method, setMethod] = useState("vnpay");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  // 10-minute seat lock countdown
  const LOCK_SECONDS = 600;
  const [remaining, setRemaining] = useState(LOCK_SECONDS);
  useEffect(() => {
    const t = setInterval(() => setRemaining((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const mins = String(Math.floor(remaining / 60)).padStart(2, "0");
  const secs = String(remaining % 60).padStart(2, "0");
  const expired = remaining === 0;

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link to="/tours">
            <ArrowLeft className="size-4" aria-hidden /> Back
          </Link>
        </Button>

        <h1 className="font-display text-2xl font-extrabold sm:text-3xl">Order review & checkout</h1>

        {/* Seat lock banner */}
        <div
          className={`mt-4 flex items-center gap-3 rounded-xl border p-4 text-sm ${
            expired ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-accent/40 bg-accent/10 text-foreground"
          }`}
        >
          <Timer className={`size-5 shrink-0 ${expired ? "text-destructive" : "text-accent"}`} aria-hidden />
          <span className="font-semibold">{expired ? "Seat lock expired" : "Seat held for "}</span>
          {!expired && (
            <span className="font-mono font-bold tabular-nums">
              {mins}:{secs}
            </span>
          )}
          <span className="text-muted-foreground">
            {expired ? "Please go back and reselect your seats." : "Complete checkout before the timer runs out."}
          </span>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left: details + payment */}
          <div className="grid gap-6">
            {/* Passenger details */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-base font-bold">Lead passenger details</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="pax-name" className="text-xs text-muted-foreground">Full name</Label>
                  <Input id="pax-name" value={name} onChange={(e) => setName(e.target.value)} className="h-11 rounded-xl" placeholder="Nguyen Van A" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pax-email" className="text-xs text-muted-foreground">Email</Label>
                  <Input id="pax-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 rounded-xl" placeholder="you@email.com" />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="pax-phone" className="text-xs text-muted-foreground">Phone</Label>
                  <Input id="pax-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 rounded-xl" placeholder="+84 ..." />
                </div>
              </div>
            </section>

            {/* Payment */}
            <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
              <h2 className="font-display text-base font-bold">Payment method</h2>
              <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                {paymentMethods.map((m) => (
                  <label
                    key={m.id}
                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors ${
                      method === m.id ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border hover:border-primary/50"
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment"
                      className="sr-only"
                      checked={method === m.id}
                      onChange={() => setMethod(m.id)}
                    />
                    <span className={`grid size-9 place-items-center rounded-lg ${method === m.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
                      <m.Icon className="size-4" aria-hidden />
                    </span>
                    <span className="text-sm font-medium">{m.label}</span>
                  </label>
                ))}
              </div>
              {method === "bankqr" && (
                <div className="mt-4 grid place-items-center rounded-xl border border-border bg-secondary/40 p-5 text-center">
                  <QrCode className="size-20 text-foreground/80" aria-hidden />
                  <p className="mt-2 text-xs text-muted-foreground">Scan with your banking app to pay {formatPrice(breakdown.total)}</p>
                </div>
              )}
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 text-teal" aria-hidden /> Payments are encrypted and processed securely.
              </p>
            </section>
          </div>

          {/* Right: summary */}
          <aside className="h-fit lg:sticky lg:top-24">
            <div className="rounded-2xl border border-border bg-card p-5 shadow-lift">
              <h2 className="font-display text-base font-bold">Booking summary</h2>
              <p className="mt-1 text-sm font-medium">{draft.tourTitle}</p>
              <p className="text-xs text-muted-foreground">
                {draft.date} · {draft.passengers} pax · Seats {draft.seats.join(", ") || "—"}
              </p>

              <dl className="mt-4 space-y-1.5 text-sm">
                <SummaryRow label={`Vehicle ticket × ${Math.max(draft.seats.length || draft.passengers, 1)}`} value={formatPrice(breakdown.seatTotal)} />
                <SummaryRow label={`Add-ons × ${draft.passengers}`} value={formatPrice(breakdown.addonsTotal)} />
                <SummaryRow label={`Pickup · ${draft.pickupLabel}`} value={breakdown.subtotal === 0 ? "Free" : formatPrice(draft.pickupFee)} />
                <SummaryRow label="Taxes & fees (8%)" value={formatPrice(breakdown.taxes)} />
                <div className="mt-2 flex items-center justify-between border-t border-border pt-2.5">
                  <dt className="font-display font-bold">Total payable</dt>
                  <dd className="font-display text-xl font-extrabold">{formatPrice(breakdown.total)}</dd>
                </div>
              </dl>

              <Button
                variant="cta"
                size="lg"
                className="mt-4 w-full"
                disabled={expired}
                onClick={() => navigate({ to: "/booking/success" })}
              >
                <Banknote className="size-4" aria-hidden /> Pay {formatPrice(breakdown.total)}
              </Button>
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Free cancellation up to 24h before departure.
              </p>
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
