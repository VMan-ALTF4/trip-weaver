import { Link, useNavigate } from "@tanstack/react-router";
import { Compass, Globe, Menu, Coins, LogIn, LogOut, Ticket, User as UserIcon, Search, X } from "lucide-react";
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
import { currencies, useCurrency } from "@/lib/currency";
import { useLanguage, type Language } from "@/lib/language";
import { useTourCatalog } from "@/lib/tour-catalog";

const navLinks = [
  { to: "/tours", label: "Tours" },
  { to: "/tours", label: "Destinations", search: { view: "map" } as const },
  { to: "/tours", label: "Attractions" },
  { to: "/admin/dashboard", label: "Admin" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const { user, displayName, loading, signOut } = useAuth();
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage, t } = useLanguage();
  const { activeTours } = useTourCatalog();
  const navigate = useNavigate();
  const languageOptions: { value: Language; label: string }[] = [
    { value: "en", label: "English" },
    { value: "vi", label: "Tiếng Việt" },
  ];

  function openAuth(mode: AuthMode) {
    setAuthMode(mode);
    setAuthOpen(true);
    setOpen(false);
  }

  async function handleSignOut() {
    await signOut();
    setOpen(false);
    toast.success(t("Signed out"));
  }

  const normalizedSearch = searchQuery.trim().toLocaleLowerCase();
  const searchResults = normalizedSearch
    ? activeTours
        .filter((tour) =>
          [
            tour.title,
            tour.destination,
            tour.summary,
            tour.pickupZone,
            ...tour.categories,
            ...tour.attractions,
          ].some((value) => value.toLocaleLowerCase().includes(normalizedSearch)),
        )
        .slice(0, 5)
    : [];

  function submitSearch(value = searchQuery) {
    const query = value.trim();
    setSearchFocused(false);
    if (!query) {
      navigate({ to: "/tours", search: { q: undefined, view: undefined, transport: undefined } });
      return;
    }
    navigate({ to: "/tours", search: { q: query, view: undefined, transport: undefined } });
  }


  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 backdrop-blur-xl">
      <div className="relative mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto]">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl surface-brand text-primary-foreground">
            <Compass className="size-5" aria-hidden />
          </span>
          <span className="truncate font-display text-lg font-extrabold tracking-tight">TAT Booking</span>
        </Link>

  <div className="relative hidden min-w-0 w-full max-w-2xl lg:flex lg:justify-self-center xl:absolute xl:left-1/2 xl:top-1/2 xl:w-[min(35vw,31rem)] xl:max-w-none xl:-translate-x-1/2 xl:-translate-y-1/2">
            <form
            className="relative w-full"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <Search
              className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setSearchFocused(false);
                }
              }}
              placeholder="Search tours, destinations, attractions..."
              aria-label="Search tours, destinations and attractions"
              className="h-11 w-full rounded-xl border border-border bg-background pl-11 pr-11 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" aria-hidden />
              </button>
            )}
          </form>

          {searchFocused && normalizedSearch && (
            <div className="absolute left-0 right-0 top-12 z-50 overflow-hidden rounded-xl border border-border bg-card p-1.5 shadow-xl">
              {searchResults.length > 0 ? (
                searchResults.map((tour) => (
                  <button
                    key={tour.id}
                    type="button"
                    onMouseDown={() => {
                      setSearchQuery(tour.title);
                      submitSearch(tour.title);
                    }}
                    className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-secondary"
                  >
                    <Search className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold">{tour.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">{tour.destination}</span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-3 text-sm text-muted-foreground">
                  No matching tours found. Press Enter to search all tours.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-1.5 lg:col-start-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="hidden gap-1.5 sm:inline-flex">
                 <Globe className="size-4" aria-hidden /> {language === "en" ? "English" : "Tiếng Việt"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
               {languageOptions.map((l) => (
                 <DropdownMenuItem key={l.value} onSelect={() => setLanguage(l.value)}>
                   {l.label}
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

          {!loading && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="hidden gap-2 md:inline-flex">
                  <span className="grid size-5 place-items-center rounded-full surface-brand text-[10px] font-bold text-primary-foreground">
                    {displayName.charAt(0).toUpperCase()}
                  </span>
                  <span className="max-w-28 truncate">{displayName}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/booking/success">
                    <Ticket className="size-4" aria-hidden /> My bookings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/dashboard">
                    <UserIcon className="size-4" aria-hidden /> Admin dashboard
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={handleSignOut}>
                  <LogOut className="size-4" aria-hidden /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => openAuth("login")}
              >
                <LogIn className="size-4" aria-hidden /> Log in
              </Button>
              <Button
                size="sm"
                variant="cta"
                className="hidden md:inline-flex"
                onClick={() => openAuth("register")}
              >
                Register
              </Button>
            </>
          )}


          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <SheetTitle className="px-4 pt-4">Menu</SheetTitle>
              <form
                className="px-4 pt-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitSearch();
                  setOpen(false);
                }}
              >
                <div className="relative">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search tours..."
                    aria-label="Search tours"
                    className="h-10 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                </div>
              </form>
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
                  <div className="grid grid-cols-2 gap-2 pb-2">
                    {languageOptions.map((option) => (
                      <Button
                        key={option.value}
                        type="button"
                        variant={language === option.value ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLanguage(option.value)}
                      >
                        <Globe className="size-4" aria-hidden /> {option.label}
                      </Button>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-2 pb-2">
                    {currencies.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={currency === option ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrency(option)}
                      >
                        <Coins className="size-4" aria-hidden /> {option}
                      </Button>
                    ))}
                  </div>
                  {!loading && user ? (
                    <>
                      <p className="px-1 text-sm text-muted-foreground">
                        Signed in as <span className="font-medium text-foreground">{displayName}</span>
                      </p>
                      <Button variant="outline" onClick={handleSignOut}>
                        <LogOut className="size-4" aria-hidden /> Sign out
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button variant="outline" onClick={() => openAuth("login")}>
                        Log in
                      </Button>
                      <Button variant="cta" onClick={() => openAuth("register")}>
                        Register with Email
                      </Button>
                    </>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <AuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </header>
  );
}
