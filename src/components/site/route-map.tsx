import { Bus, Flag, Landmark, MapPin } from "lucide-react";
import type { Tour } from "@/lib/tat-data";

const typeStyles = {
  pickup: { ring: "bg-primary text-primary-foreground", Icon: Flag },
  stop: { ring: "bg-teal text-teal-foreground", Icon: Bus },
  attraction: { ring: "bg-coral text-coral-foreground", Icon: Landmark },
} as const;

export function RouteMap({ tours, activeId }: { tours: Tour[]; activeId?: string }) {
  const active = tours.find((t) => t.id === activeId) ?? tours[0];
  if (!active) return null;
  const points = active.mapPoints;
  const path = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="relative h-full min-h-[420px] overflow-hidden rounded-xl border border-border bg-secondary shadow-soft">
      {/* stylised map canvas */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(0deg, var(--color-border) 1px, transparent 1px), linear-gradient(90deg, var(--color-border) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />
      <div className="absolute -left-16 top-1/3 size-72 rounded-full bg-teal/10 blur-2xl" aria-hidden />
      <div className="absolute -right-10 bottom-0 size-80 rounded-full bg-primary/10 blur-2xl" aria-hidden />

      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden>
        <polyline
          points={path}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="0.9"
          strokeDasharray="3 2"
          strokeLinecap="round"
        />
      </svg>

      {points.map((p) => {
        const { ring, Icon } = typeStyles[p.type];
        return (
          <div
            key={p.label}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <div className="flex items-center gap-2">
              <span className={`grid size-8 place-items-center rounded-full shadow-lift ${ring}`}>
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="hidden whitespace-nowrap rounded-lg bg-card px-2 py-1 text-xs font-medium shadow-soft sm:inline">
                {p.label}
              </span>
            </div>
          </div>
        );
      })}

      <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-border bg-card/95 p-3 shadow-soft backdrop-blur">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <MapPin className="size-4 text-primary" aria-hidden /> {active.title}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {points.length} route points · pickup, stopovers and attraction entries shown live.
        </p>
      </div>
    </div>
  );
}
