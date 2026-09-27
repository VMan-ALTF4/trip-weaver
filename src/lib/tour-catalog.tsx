import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { tours as seedTours, type Tour, type TransportType } from "@/lib/tat-data";

const STORAGE_KEY = "tat-tour-catalog";
const HIDDEN_KEY = "tat-hidden-tours";

export type TourDraft = Pick<Tour, "title" | "destination" | "price" | "duration" | "transport" | "summary">;

type TourCatalogValue = {
  tours: Tour[];
  activeTours: Tour[];
  hiddenIds: string[];
  addTour: (draft: TourDraft) => void;
  updateTour: (id: string, draft: TourDraft) => void;
  toggleTourVisibility: (id: string) => void;
};

const TourCatalogContext = createContext<TourCatalogValue | null>(null);

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function makeTour(draft: TourDraft, id: string): Tour {
  const template = seedTours[0]!;
  return {
    ...template,
    ...draft,
    id,
    oldPrice: undefined,
    rating: 0,
    reviews: 0,
    combo: true,
    categories: ["Nature"],
    pickupZone: "City Center",
    attractions: [],
    itinerary: [],
    included: [],
    excluded: [],
    mapPoints: [],
  };
}

export function TourCatalogProvider({ children }: { children: ReactNode }) {
  const [tours, setTours] = useState<Tour[]>(seedTours);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  useEffect(() => {
    try {
      const savedTours = window.localStorage.getItem(STORAGE_KEY);
      const savedHidden = window.localStorage.getItem(HIDDEN_KEY);
      if (savedTours) setTours(JSON.parse(savedTours) as Tour[]);
      if (savedHidden) setHiddenIds(JSON.parse(savedHidden) as string[]);
    } catch {
      // Keep the seed catalog when saved data is invalid.
    }
  }, []);

  const persistTours = (next: Tour[]) => {
    setTours(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  const value = useMemo<TourCatalogValue>(() => ({
    tours,
    activeTours: tours.filter((tour) => !hiddenIds.includes(tour.id)),
    hiddenIds,
    addTour: (draft) => {
      const baseId = slugify(draft.title) || `tour-${Date.now()}`;
      const id = tours.some((tour) => tour.id === baseId) ? `${baseId}-${Date.now()}` : baseId;
      persistTours([...tours, makeTour(draft, id)]);
    },
    updateTour: (id, draft) => {
      persistTours(tours.map((tour) => (tour.id === id ? { ...tour, ...draft } : tour)));
    },
    toggleTourVisibility: (id) => {
      const next = hiddenIds.includes(id) ? hiddenIds.filter((hiddenId) => hiddenId !== id) : [...hiddenIds, id];
      setHiddenIds(next);
      window.localStorage.setItem(HIDDEN_KEY, JSON.stringify(next));
    },
  }), [hiddenIds, tours]);

  return <TourCatalogContext.Provider value={value}>{children}</TourCatalogContext.Provider>;
}

export function useTourCatalog() {
  const context = useContext(TourCatalogContext);
  if (!context) throw new Error("useTourCatalog must be used within TourCatalogProvider");
  return context;
}

export type { TransportType };
