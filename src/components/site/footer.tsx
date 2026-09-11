import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-border bg-card">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg surface-brand text-primary-foreground">
            <Compass className="size-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-display text-sm font-bold">TAT Booking</p>
            <p className="truncate text-xs text-muted-foreground">
              Transport + attraction combo e-tickets, one booking.
            </p>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <Link to="/tours" className="hover:text-foreground">
            Tours
          </Link>
          <Link to="/checkout" className="hover:text-foreground">
            Checkout
          </Link>
          <Link to="/booking/success" className="hover:text-foreground">
            My Bookings
          </Link>
          <Link to="/admin/dashboard" className="hover:text-foreground">
            Admin
          </Link>
        </nav>
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} TAT Booking</p>
      </div>
    </footer>
  );
}
