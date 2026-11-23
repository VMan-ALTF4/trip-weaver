import { useEffect, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";

export type TourReviewSummary = {
  status: "loading" | "error" | "empty" | "ready";
  average?: number;
  count?: number;
  latest?: {
    customerName: string;
    date: string;
    comment: string | null;
  };
};

const client = supabase as unknown as SupabaseClient;

export function useTourReviewSummary(tourId: string, enabled = true): TourReviewSummary {
  const [summary, setSummary] = useState<TourReviewSummary>({ status: "loading" });

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setSummary({ status: "loading" });

    async function loadSummary() {
      if (!isSupabaseConfigured()) {
        if (active) setSummary({ status: "error" });
        return;
      }

      try {
        const { data, error } = await client
          .from("trip_reviews")
          .select("overall_rating, comment, customer_name, created_at")
          .eq("tour_id", tourId)
          .eq("is_visible", true)
          .order("created_at", { ascending: false });
        if (error) throw error;

        const reviews = (data ?? []) as Array<{
          overall_rating: number;
          comment: string | null;
          customer_name: string | null;
          created_at: string;
        }>;
        if (!active) return;
        if (reviews.length === 0) {
          setSummary({ status: "empty" });
          return;
        }

        const average = reviews.reduce((sum, review) => sum + review.overall_rating, 0) / reviews.length;
        const latest = reviews[0]!;
        setSummary({
          status: "ready",
          average,
          count: reviews.length,
          latest: {
            customerName: latest.customer_name || "Khách hàng",
            date: new Intl.DateTimeFormat("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(latest.created_at)),
            comment: latest.comment,
          },
        });
      } catch (error) {
        console.error("Unable to load tour review summary.", error);
        if (active) setSummary({ status: "error" });
      }
    }

    void loadSummary();
    const interval = window.setInterval(() => void loadSummary(), 30_000);
    const onFocus = () => void loadSummary();
    window.addEventListener("focus", onFocus);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [enabled, tourId]);

  return summary;
}
