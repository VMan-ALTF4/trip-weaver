import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { SiteFooter } from "@/components/site/footer";
import { SiteHeader } from "@/components/site/header";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/booking/success")({
  validateSearch: (search: Record<string, unknown>) => ({
    order: typeof search["order"] === "string" ? search["order"] : undefined,
  }),
  head: () => ({
    meta: [{ title: "Booking confirmed — TAT Booking" }],
  }),
  component: SuccessPage,
});

function SuccessPage() {
  const navigate = useNavigate();
  const { order } = Route.useSearch();

  useEffect(() => {
    if (!order) {
      void navigate({ to: "/my-bookings", replace: true });
      return;
    }

    void navigate({
      to: "/eticket/$orderId",
      params: { orderId: order },
      replace: true,
    });
  }, [navigate, order]);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-8 text-center sm:px-6">
        <p className="text-sm text-muted-foreground">Redirecting to your e-ticket…</p>
        <Button asChild className="mt-4" variant="outline">
          <Link to="/my-bookings">Open my bookings</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  );
}
