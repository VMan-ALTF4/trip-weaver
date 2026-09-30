import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { LayoutList, Map as MapIcon, SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { TourCard } from "@/components/site/tour-card";
import { RouteMap } from "@/components/site/route-map";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { transportLabels, type TransportType } from "@/lib/tat-data";
import { useCurrency } from "@/lib/currency";
import { useLanguage } from "@/lib/language";
import { useTourCatalog } from "@/lib/tour-catalog";

export const Route = createFileRoute("/tours/")({
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string | undefined; view?: string | undefined; transport?: string | undefined } => {
    const query = search["q"];
    const view = search["view"];
    const transport = search["transport"];

    return {
      ...(typeof query === "string" ? { q: query } : {}),
      ...(typeof view === "string" ? { view } : {}),
      ...(typeof transport === "string" ? { transport } : {}),
    };
  },
  head: () => ({
    meta: [
      { title: "Browse Tours & Route Maps — TAT Booking" },
      {
        name: "description",
        content:
          "Filter tours by price, transport type, attraction category and pickup point, and follow every route on an interactive map.",
      },
      { property: "og:title", content: "Browse Tours & Route Maps — TAT Booking" },
      {
        property: "og:description",
        content: "Split-screen tour list and interactive route map with pickup points and attraction stops.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ToursPage,
});

const transportOptions: TransportType[] = ["bus", "train", "car"];

function ToursPage() {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { activeTours, loading, error } = useTourCatalog();
  const { q, transport } = Route.useSearch();
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [transports, setTransports] = useState<string[]>([]);
  const [cats, setCats] = useState<string[]>([]);
  const [pickups, setPickups] = useState<string[]>([]);
  const [view, setView] = useState<"split" | "list">("split");
  const [activeId, setActiveId] = useState(activeTours[0]?.id ?? "");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const normalizedQuery = (q ?? "").trim().toLocaleLowerCase();
  const maxPriceLimit = Math.max(20, Math.ceil(Math.max(0, ...activeTours.map((tour) => tour.price)) / 5) * 5);
  const selectedMaxPrice = maxPrice ?? maxPriceLimit;
  const categoryOptions = [...new Set(activeTours.flatMap((tour) => tour.categories))];
  const pickupOptions = [...new Set(activeTours.map((tour) => tour.pickupZone).filter(Boolean))];

  const toggle = (list: string[], set: (v: string[]) => void, value: string) =>
    set(list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  const filtered = useMemo(
    () =>
      activeTours.filter(
        (t) => {
          const matchesQuery =
            !normalizedQuery ||
            [
              t.title,
              t.destination,
              t.summary,
              t.pickupZone,
              ...t.categories,
              ...t.attractions,
            ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));

          return (
            matchesQuery &&
            (!transport || t.transport === transport) &&
            t.price <= selectedMaxPrice &&
            (transports.length === 0 || transports.includes(t.transport)) &&
            (cats.length === 0 || t.categories.some((c) => cats.includes(c))) &&
            (pickups.length === 0 || pickups.includes(t.pickupZone))
          );
        },
      ),
    [activeTours, normalizedQuery, selectedMaxPrice, transports, cats, pickups],
  );

  const sidebar = (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">Price range</h2>
        <Slider
          className="mt-4"
          value={[selectedMaxPrice]}
          min={20}
          max={maxPriceLimit}
          step={5}
          onValueChange={(v) => setMaxPrice(v[0] ?? selectedMaxPrice)}
          aria-label="Maximum price"
        />
        <p className="mt-2 text-sm">
          Up to <span className="font-semibold">{formatPrice(selectedMaxPrice)}</span> per person
        </p>
      </div>
      <Separator />
      <FilterGroup
        title="Transport type"
        options={transportOptions.map((t) => ({ value: t, label: transportLabels[t] }))}
        selected={transports}
        onToggle={(v) => toggle(transports, setTransports, v)}
      />
      {categoryOptions.length > 0 && (
        <>
          <Separator />
          <FilterGroup
            title="Attraction categories"
            options={categoryOptions.map((category) => ({ value: category, label: category }))}
            selected={cats}
            onToggle={(value) => toggle(cats, setCats, value)}
          />
        </>
      )}
      {pickupOptions.length > 0 && (
        <>
          <Separator />
          <FilterGroup
            title="Pickup preference"
            options={pickupOptions.map((pickup) => ({ value: pickup, label: pickup }))}
            selected={pickups}
            onToggle={(value) => toggle(pickups, setPickups, value)}
          />
        </>
      )}
    </div>
  );

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">Tours & route maps</h1>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Loading tours..."
                : error
                  ? "Tours could not be loaded"
                  : normalizedQuery
                    ? t(`${filtered.length} tours match “${q}”`)
                    : t(`${filtered.length} combos match your filters`)}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="outline"
              className="lg:hidden"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
            >
              <SlidersHorizontal className="size-4" aria-hidden /> Filters
            </Button>
            <div className="hidden rounded-lg border border-border bg-card p-1 sm:flex">
              <Button
                size="sm"
                variant={view === "split" ? "default" : "ghost"}
                onClick={() => setView("split")}
              >
                <MapIcon className="size-4" aria-hidden /> Map view
              </Button>
              <Button size="sm" variant={view === "list" ? "default" : "ghost"} onClick={() => setView("list")}>
                <LayoutList className="size-4" aria-hidden /> List
              </Button>
            </div>
          </div>
        </div>

        {filtersOpen && (
          <aside className="mt-6 rounded-xl border border-border bg-card p-5 shadow-soft lg:hidden">{sidebar}</aside>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden h-fit rounded-xl border border-border bg-card p-5 shadow-soft lg:sticky lg:top-24 lg:block">
            {sidebar}
          </aside>

          <div className={view === "split" ? "grid gap-6 xl:grid-cols-2" : ""}>
            <div className="grid gap-4">
              {loading ? (
                <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  Loading tours...
                </p>
              ) : error ? (
                <p role="alert" className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-destructive">
                  Unable to load tours: {error}
                </p>
              ) : filtered.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                  No tours match these filters yet. Try widening the price range.
                </p>
              ) : filtered.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseEnter={() => setActiveId(t.id)}
                  onFocus={() => setActiveId(t.id)}
                  className={`rounded-xl text-left transition-shadow ${
                    activeId === t.id ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : ""
                  }`}
                >
                  <TourCard tour={t} layout="row" />
                </button>
              ))}
            </div>

            {view === "split" && filtered.length > 0 && (
              <div className="hidden xl:sticky xl:top-24 xl:block xl:h-[calc(100vh-8rem)]">
                <RouteMap tours={filtered} activeId={activeId} />
              </div>
            )}
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function FilterGroup({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { value: string; label: string }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div>
      <h2 className="font-display text-sm font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="mt-3 grid gap-2.5">
        {options.map((o) => (
          <div key={o.value} className="flex items-center gap-2.5">
            <Checkbox
              id={`${title}-${o.value}`}
              checked={selected.includes(o.value)}
              onCheckedChange={() => onToggle(o.value)}
            />
            <Label htmlFor={`${title}-${o.value}`} className="text-sm font-normal">
              {o.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
