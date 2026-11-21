import { Link } from "@tanstack/react-router";
import { Compass, Mail, Phone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function SiteFooter() {
  const { user, profile, profileLoading } = useAuth();

  return (
    <footer className="mt-20 border-t border-border/80 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="relative grid gap-8 md:min-h-28 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl shadow-soft surface-brand text-primary-foreground">
                <Compass className="size-5" aria-hidden />
              </span>
              <div>
                <p className="font-display text-base font-extrabold">TAT Booking</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Transport + attraction combo e-tickets, one booking.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-2 text-sm">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground">Hotline</p>
              <a
                href="tel:0876944358"
                className="flex w-fit items-center gap-2.5 font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                <Phone className="size-4 shrink-0" aria-hidden />
                <span>0876944358</span>
              </a>
              <a
                href="mailto:doancongnguyen1072006@gmail.com"
                className="flex w-fit items-center gap-2.5 text-muted-foreground transition-colors hover:text-primary"
              >
                <Mail className="size-4 shrink-0" aria-hidden />
                <span className="break-all">doancongnguyen1072006@gmail.com</span>
              </a>
            </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm font-medium text-muted-foreground md:absolute md:left-[57%] md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:flex-nowrap">
            <Link to="/tours" className="transition-colors hover:text-primary">
              Tours
            </Link>
            <Link to="/my-bookings" className="transition-colors hover:text-primary">
              My Bookings
            </Link>
            {!profileLoading && user && profile?.id === user.id && profile.role === "admin" && (
              <Link to="/admin/dashboard" className="transition-colors hover:text-primary">
                Admin
              </Link>
            )}
          </nav>
          <p className="mt-2 text-sm text-muted-foreground md:absolute md:bottom-0 md:right-0 md:mt-0">
            © {new Date().getFullYear()} TAT Booking
          </p>
        </div>
      </div>
    </footer>
  );
}
