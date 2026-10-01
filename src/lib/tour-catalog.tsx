import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Tour, TransportType } from "@/lib/tat-data";
import { getTourImageUrl } from "@/lib/tour-images";

type TourCatalogValue = {
  activeTours: Tour[];
  loading: boolean;
  error: string | null;
  refreshTours: () => Promise<void>;
  searchTours: (filters: TourSearchFilters) => Promise<Tour[]>;
};

type TourRecord = Record<string, unknown>;
type TourSearchFilters = {
  destination: string;
  transport: TransportType | "any";
  travelDate: string;
  passengers: number;
};

const TourCatalogContext = createContext<TourCatalogValue | null>(null);

function textValue(record: TourRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

function numberValue(value: unknown): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function timelineArray(value: unknown): NonNullable<Tour["timeline"]> {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null) return [];
    const activity = entry as Record<string, unknown>;
    const time = activity["time"];
    const title = activity["title"];
    return typeof time === "string" && typeof title === "string" ? [{ time, title }] : [];
  });
}

function isAvailableTour(record: TourRecord): boolean {
  const status = record["status_tour"] ?? record["status"];
  if (status == null) return true;
  if (typeof status !== "string") return false;

  const normalized = status.trim().toLocaleLowerCase();
  return normalized === "còn bán" || normalized === "đang hoạt động" || normalized === "active";
}

function normalizeTransport(value: string): TransportType {
  const normalized = value.trim().toLocaleLowerCase();
  if (normalized.includes("train")) return "train";
  if (
    normalized.includes("car") ||
    normalized.includes("private") ||
    normalized.includes("xe riêng")
  )
    return "car";
  return "bus";
}

function mapTour(record: TourRecord): Tour | null {
  const id = textValue(record, "tour_id", "id");
  const title = textValue(record, "tour_name", "title");
  if (!id || !title) return null;

  return {
    id,
    title,
    destination: textValue(record, "destination"),
    travelDate: textValue(record, "travel_date").slice(0, 10),
    image: getTourImageUrl(textValue(record, "image_url", "image", "thumbnail_url")),
    price: numberValue(record["price"]),
    ...(numberValue(record["old_price"]) > 0 ? { oldPrice: numberValue(record["old_price"]) } : {}),
    duration: textValue(record, "duration"),
    rating: numberValue(record["rating"]),
    reviews: numberValue(record["review_count"] ?? record["reviews"]),
    transport: normalizeTransport(textValue(record, "transport")),
    combo: record["combo"] === true,
    categories: stringArray(record["categories"]),
    pickupZone: textValue(record, "pickup_zone"),
    summary: textValue(record, "summary", "description"),
    attractions: stringArray(record["attractions"]),
    timeline: timelineArray(record["timeline"]),
    itinerary: [],
    included: stringArray(record["included"]),
    excluded: stringArray(record["excluded"]),
    mapPoints: [],
  };
}

async function searchTourCatalog(filters: TourSearchFilters): Promise<Tour[]> {
  let query = (supabase as unknown as SupabaseClient).from("Tour").select("*");

  if (filters.destination.trim()) {
    query = query.ilike("destination", `%${filters.destination.trim()}%`);
  }
  if (filters.transport !== "any") {
    const transportFilters: Record<TransportType, string> = {
      bus: "transport.ilike.%bus%,transport.ilike.%coach%,transport.ilike.%xe khách%",
      train: "transport.ilike.%train%,transport.ilike.%rail%,transport.ilike.%tàu%",
      car: "transport.ilike.%car%,transport.ilike.%private%,transport.ilike.%xe riêng%",
    };
    query = query.or(transportFilters[filters.transport]);
  }
  if (filters.travelDate) {
    query = query.eq("travel_date", filters.travelDate);
  }
  if (filters.passengers > 0) {
    query = query.gte("available_slot", filters.passengers);
  }

  const { data, error: queryError } = await query;
  if (queryError) throw queryError;

  return ((data ?? []) as TourRecord[])
    .filter(isAvailableTour)
    .map(mapTour)
    .filter((tour): tour is Tour => tour !== null);
}

export function TourCatalogProvider({ children }: { children: ReactNode }) {
  const [activeTours, setActiveTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTours = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: queryError } = await (supabase as unknown as SupabaseClient)
        .from("Tour")
        .select("*");

      if (queryError) {
        setError(queryError.message);
        setActiveTours([]);
      } else {
        setActiveTours(
          ((data ?? []) as TourRecord[])
            .filter(isAvailableTour)
            .map(mapTour)
            .filter((tour): tour is Tour => tour !== null),
        );
      }
    } catch (queryError) {
      setError(queryError instanceof Error ? queryError.message : "Không thể tải danh sách tour.");
      setActiveTours([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTours();
  }, [refreshTours]);

  return (
    <TourCatalogContext.Provider value={{ activeTours, loading, error, refreshTours, searchTours: searchTourCatalog }}>
      {children}
    </TourCatalogContext.Provider>
  );
}

export function useTourCatalog() {
  const context = useContext(TourCatalogContext);
  if (!context) throw new Error("useTourCatalog must be used within TourCatalogProvider");
  return context;
}

export type { TransportType };
