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
};

type TourRecord = Record<string, unknown>;

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
    itinerary: [],
    included: stringArray(record["included"]),
    excluded: stringArray(record["excluded"]),
    mapPoints: [],
  };
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
    <TourCatalogContext.Provider value={{ activeTours, loading, error, refreshTours }}>
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
