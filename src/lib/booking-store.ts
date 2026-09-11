import { useEffect, useState } from "react";

export type BookingDraft = {
  tourId: string;
  tourTitle: string;
  date: string;
  passengers: number;
  seats: string[];
  seatPrice: number;
  pickupId: string;
  pickupLabel: string;
  pickupTime: string;
  pickupFee: number;
  addons: { id: string; label: string; price: number }[];
  basePrice: number;
};

const KEY = "tat-booking-draft";

export const defaultDraft: BookingDraft = {
  tourId: "emerald-bay-cruise",
  tourTitle: "Emerald Bay Cruise & Cave Discovery",
  date: "2026-10-12",
  passengers: 2,
  seats: ["B3", "B4"],
  seatPrice: 89,
  pickupId: "old-quarter",
  pickupLabel: "Old Quarter Lobby Lounge",
  pickupTime: "06:30",
  pickupFee: 0,
  addons: [
    { id: "cave", label: "Sung Sot Cave entry", price: 0 },
    { id: "kayak", label: "Kayak rental (1h)", price: 8 },
  ],
  basePrice: 89,
};

export function saveDraft(draft: BookingDraft) {
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, JSON.stringify(draft));
}

export function useBookingDraft() {
  const [draft, setDraft] = useState<BookingDraft>(defaultDraft);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setDraft({ ...defaultDraft, ...(JSON.parse(raw) as BookingDraft) });
    } catch {
      /* ignore malformed draft */
    }
  }, []);

  return draft;
}

export function priceBreakdown(draft: BookingDraft) {
  const seatTotal = draft.seatPrice * Math.max(draft.seats.length || draft.passengers, 1);
  const addonsTotal = draft.addons.reduce((s, a) => s + a.price * draft.passengers, 0);
  const subtotal = seatTotal + addonsTotal + draft.pickupFee;
  const taxes = Math.round(subtotal * 0.08 * 100) / 100;
  return { seatTotal, addonsTotal, subtotal, taxes, total: Math.round((subtotal + taxes) * 100) / 100 };
}
