import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import {
  ArrowRight,
  Car,
  MapPinned,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Sparkles,
  Ticket,
  TrainFront,
  Wallet,
} from "lucide-react";
import heroImage from "@/assets/hero-coast.jpg";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { TourCard } from "@/components/site/tour-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTourCatalog } from "@/lib/tour-catalog";
import { useLanguage } from "@/lib/language";
import type { Tour } from "@/lib/tat-data";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TAT Booking — Tours, Transport & Attraction Combo Tickets" },
      {
        name: "description",
        content:
          "Explore destinations and book transport seats plus attraction entry in one combo e-ticket. Live seat maps, route maps and transparent pricing.",
      },
      { property: "og:title", content: "TAT Booking — One trip, one combo e-ticket" },
      {
        property: "og:description",
        content: "Book tours, seats and attraction tickets together with transparent pricing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { activeTours, loading, error } = useTourCatalog();
  const { t } = useLanguage();
  const [destination, setDestination] = useState("");
  const [searchSubmitted, setSearchSubmitted] = useState(false);
  const destinations = [
    ...new Map(
      activeTours
        .map((tour) => tour.destination.trim())
        .filter(Boolean)
        .map((item) => [item.toLocaleLowerCase(), item]),
    ).values(),
  ];
  const normalizedDestination = normalizeSearchValue(destination);
  const searchResults = useMemo(
    () =>
      activeTours.filter((tour) => {
        if (!normalizedDestination) return true;
        const searchableText = [tour.destination, tour.title, tour.summary, ...tour.attractions]
          .map(normalizeSearchValue)
          .join(" ");
        return searchableText.includes(normalizedDestination);
      }),
    [activeTours, normalizedDestination],
  );

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearchSubmitted(true);
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        {/* Hero */}
        <section className="relative isolate overflow-hidden">
          <img
            src={heroImage}
            alt="Tour coach on a coastal mountain road at sunset"
            width={1920}
            height={1080}
            className="absolute inset-0 size-full object-cover"
          />
          <div
            className="absolute inset-0 bg-gradient-to-br from-foreground/85 via-foreground/65 to-primary-deep/70"
            aria-hidden
          />
          <div className="relative mx-auto max-w-7xl px-4 pb-28 pt-16 sm:px-6 sm:pt-24">
            <span className="inline-flex items-center gap-2 rounded-full bg-card/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground ring-1 ring-card/25 backdrop-blur">
              <Sparkles className="size-3.5" aria-hidden /> Transport + attraction, one QR code
            </span>
            <h1 className="mt-5 max-w-3xl font-display text-4xl font-extrabold leading-[1.08] text-primary-foreground sm:text-5xl lg:text-6xl">
              Explore Destinations, Book Transport &{" "}
              <span className="text-gradient-warm">Attraction Tickets</span> in One Unified Trip
            </h1>
            <p className="mt-4 max-w-xl text-base text-primary-foreground/80">
              Pick your seat, choose a pickup point along the route and get every venue entry bundled into a
              single combo e-ticket.
            </p>
          </div>
        </section>

        {/* Search hub */}
        <section className="relative z-10 mx-auto -mt-20 max-w-6xl px-4 sm:px-6">
          <form
            onSubmit={handleSearch}
            className="rounded-2xl border border-border bg-card p-4 shadow-lift sm:p-6"
            aria-label="Search tours and combos"
          >
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex min-w-0 flex-1 items-center">
                <MapPinned
                  className="pointer-events-none absolute left-4 size-5 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="destination-search"
                  type="search"
                  list="tour-destinations"
                  value={destination}
                  onChange={(event) => setDestination(event.target.value)}
                  placeholder={t("Search a destination or tour")}
                  autoComplete="off"
                  className="h-14 rounded-xl pl-12 text-base"
                  aria-label={t("Search a destination or tour")}
                />
                <datalist id="tour-destinations">
                  {destinations.map((item) => (
                    <option key={item} value={item} />
                  ))}
                </datalist>
              </div>
              <Button type="submit" variant="cta" size="lg" className="h-14 rounded-xl px-7">
                <Search className="size-4" aria-hidden /> {t("Search tours")}
              </Button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              {t("Enter a destination to find available tours on our website.")}
            </p>
          </form>
        </section>

        {searchSubmitted && (
          <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6" aria-live="polite">
            <h2 className="font-display text-2xl font-extrabold">{t("Search results")}</h2>
            {loading ? (
              <p className="mt-4 text-sm text-muted-foreground">{t("Loading tours...")}</p>
            ) : error ? (
              <p role="alert" className="mt-4 text-sm text-destructive">
                {t("Unable to load tours")}: {error}
              </p>
            ) : searchResults.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                {t("No tours found for this destination.")}
              </p>
            ) : (
              <div className="mt-5 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {searchResults.map((tour) => (
                  <TourCard key={tour.id} tour={tour} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Featured tours */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 sm:flex sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Featured tours & popular combos</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Hand-picked routes where transport and venue entry come bundled.
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link to="/tours">
                View all <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading tours...</p>
            ) : error ? (
              <p role="alert" className="text-sm text-destructive">Unable to load tours: {error}</p>
            ) : activeTours.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tours are currently available.</p>
            ) : (
              activeTours.map((tour) => <TourCard key={tour.id} tour={tour} />)
            )}
          </div>
        </section>

        {/* Why choose us */}
        <section className="border-y border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
            <h2 className="font-display text-2xl font-extrabold sm:text-3xl">Why travellers book with TAT</h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  Icon: Ticket,
                  title: "Combo e-tickets",
                  body: "One QR code covers your coach boarding and every attraction entry on the itinerary.",
                },
                {
                  Icon: RouteIcon,
                  title: "Interactive route maps",
                  body: "See pickup points, stopovers and attraction stops before you commit.",
                },
                {
                  Icon: ShieldCheck,
                  title: "Real-time seat locking",
                  body: "Your exact seat is held for 10 minutes while you complete checkout.",
                },
                {
                  Icon: Wallet,
                  title: "100% transparent costs",
                  body: "Itemised pricing with taxes and pickup fees shown before payment.",
                },
              ].map(({ Icon, title, body }) => (
                <div key={title} className="rounded-xl border border-border bg-background p-5 shadow-soft">
                  <span className="grid size-10 place-items-center rounded-xl bg-teal/10 text-teal">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA strip */}
        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-6 rounded-2xl surface-brand p-8 text-primary-foreground sm:p-12 lg:grid-cols-[minmax(0,1fr)_auto]">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-extrabold sm:text-3xl">
                Plan the whole trip in under two minutes
              </h2>
              <p className="mt-2 max-w-xl text-sm text-primary-foreground/80">
                Choose a route, lock your seat, add venue tickets and pay with VNPay, Momo, card or bank QR.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="cta" size="lg">
                <Link to="/tours">
                  <Car className="size-4" aria-hidden /> Browse routes
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link to="/booking/success">
                  <TrainFront className="size-4" aria-hidden /> See a sample e-ticket
                </Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function normalizeSearchValue(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase()
    .trim();
}
