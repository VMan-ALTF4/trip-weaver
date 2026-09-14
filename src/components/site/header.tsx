import { Link } from "@tanstack/react-router";
import { Compass, Globe, Menu, Coins, LogIn, LogOut, Ticket, User as UserIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDialog, type AuthMode } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import { currencies, languages } from "@/lib/tat-data";

const navLinks = [
  { to: "/tours", label: "Tours" },
  { to: "/tours", label: "Destinations", search: { view: "map" } as const },
  { to: "/tours", label: "Attractions" },
  { to: "/admin/dashboard", label: "Admin" },
] as const;

export function SiteHeader() {
  const [lang, setLang] = useState(languages[0]);
  const [currency, setCurrency] = useState(currencies[0]);
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto]">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl surface-brand text-primary-foreground">
            <Compass className="size-5" aria-hidden />
          </span>
          <span className="truncate font-display text-lg font-extrabold tracking-tight">TAT Booking</span>
        </Link>

        <nav className="hidden items-center justify-center gap-1 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {l.label}
            </Link>
          ))}
          <Link
            to="/booking/success"
            className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            My Bookings
          </Link>
        </nav>

        <div className="flex items-center justify-end gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
                <Globe className="size-4" aria-hidden /> {lang}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {languages.map((l) => (
                <DropdownMenuItem key={l} onSelect={() => setLang(l)}>
                  {l}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
                <Coins className="size-4" aria-hidden /> {currency}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {currencies.map((c) => (
                <DropdownMenuItem key={c} onSelect={() => setCurrency(c)}>
                  {c}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="outline" size="sm" className="hidden md:inline-flex">
            <LogIn className="size-4" aria-hidden /> Log in
          </Button>
          <Button size="sm" variant="cta" className="hidden md:inline-flex">
            Register
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
              <nav className="flex flex-col gap-1 p-4">
                {[...navLinks, { to: "/booking/success", label: "My Bookings" }].map((l) => (
                  <Link
                    key={l.label}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-secondary"
                  >
                    {l.label}
                  </Link>
                ))}
                <div className="mt-4 grid gap-2">
                  <Button variant="outline">Log in with Google</Button>
                  <Button variant="cta">Register with Email</Button>
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
