import { Link } from "@tanstack/react-router";
import { Compass, Globe, Menu, Coins, LogIn, LogOut, LayoutDashboard, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AuthDialog, type AuthMode } from "@/components/auth/auth-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const navLinks = [
  { to: "/tours", label: "Tours" },
  { to: "/booking/success", label: "My Bookings" },
] as const;

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const { user, profile, profileLoading, displayName, loading, signOut, updateProfile, requestEmailChange } = useAuth();
  const isAdmin = Boolean(
    user && !profileLoading && profile?.id === user.id && profile.role === "admin",
  );
  const { currency, setCurrency } = useCurrency();
  const { language, setLanguage, t } = useLanguage();
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

  function openProfileEditor() {
    setProfileName(profile?.name ?? displayName);
    setProfilePhone(profile?.sdt ?? "");
    setProfileEmail(user?.email ?? "");
    setProfileError(null);
    setEmailNotice(null);
    setProfileOpen(true);
    setOpen(false);
  }

  async function saveProfile() {
    if (!profileName.trim()) {
      setProfileError(t("Name is required."));
      return;
    }

    setProfileSaving(true);
    setProfileError(null);
    try {
      const { error } = await updateProfile(profileName, profilePhone);
      if (error) setProfileError(error);
      else {
        setProfileOpen(false);
        toast.success(t("Profile updated."));
      }
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t("Unable to update profile."));
    } finally {
      setProfileSaving(false);
    }
  }

  async function sendEmailConfirmation() {
    if (!user || !profileEmail.trim()) return;
    if (profileEmail.trim().toLocaleLowerCase() === user.email?.toLocaleLowerCase()) {
      setProfileError(t("Enter an email address different from your current one."));
      return;
    }

    setEmailSending(true);
    setProfileError(null);
    setEmailNotice(null);
    try {
      const { error } = await requestEmailChange(profileEmail);
      if (error) setProfileError(error);
      else setEmailNotice(t("Supabase sent a confirmation link. Your email changes only after verification."));
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : t("Unable to request an email change."));
    } finally {
      setEmailSending(false);
    }
  }


  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-card/85 backdrop-blur-xl">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 lg:grid-cols-[auto_1fr_auto]">
        <Link to="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl surface-brand text-primary-foreground">
            <Compass className="size-5" aria-hidden />
          </span>
          <span className="truncate font-display text-lg font-extrabold tracking-tight">TAT Booking</span>
        </Link>

        <nav className="hidden items-center justify-center gap-4 lg:flex">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              to={l.to}
              className="flex min-w-36 justify-center rounded-lg px-5 py-3 text-base font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              activeProps={{ className: "text-foreground bg-secondary" }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-1.5">
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
                {isAdmin && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin/dashboard">
                      <LayoutDashboard className="size-4" aria-hidden /> {t("Admin dashboard")}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={openProfileEditor}>
                  <Pencil className="size-4" aria-hidden /> {t("Edit profile")}
                </DropdownMenuItem>
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
              <nav className="flex flex-col gap-2 p-4">
                {navLinks.map((l) => (
                  <Link
                    key={l.label}
                    to={l.to}
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 text-base font-semibold hover:bg-secondary"
                  >
                    {l.label}
                  </Link>
                ))}
                {!loading && user && (
                  <button
                    type="button"
                    onClick={openProfileEditor}
                    className="rounded-lg px-4 py-3 text-left text-base font-semibold hover:bg-secondary"
                  >
                    {t("Edit profile")}
                  </button>
                )}
                {isAdmin && (
                  <Link
                    to="/admin/dashboard"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-4 py-3 text-base font-semibold hover:bg-secondary"
                  >
                    {t("Admin dashboard")}
                  </Link>
                )}
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
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("Edit profile")}</DialogTitle>
            <DialogDescription>{t("Update your personal details and manage your sign-in email.")}</DialogDescription>
          </DialogHeader>

          {profileError && <p role="alert" className="text-sm text-destructive">{profileError}</p>}

          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="profile-name">{t("Full name")}</Label>
              <Input id="profile-name" value={profileName} onChange={(event) => setProfileName(event.target.value)} maxLength={120} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-phone">{t("Phone number")}</Label>
              <Input id="profile-phone" type="tel" value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} maxLength={40} />
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => void saveProfile()} disabled={profileSaving || profileLoading}>
                {profileSaving ? t("Saving...") : t("Save changes")}
              </Button>
            </DialogFooter>
          </div>

          <div className="grid gap-3 border-t border-border pt-4">
            <div>
              <h3 className="text-sm font-semibold">{t("Email")}</h3>
              <p className="text-sm text-muted-foreground">{t("Current email")}: {user?.email}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-new-email">{t("New email")}</Label>
              <Input
                id="profile-new-email"
                type="email"
                autoComplete="email"
                value={profileEmail}
                onChange={(event) => setProfileEmail(event.target.value)}
              />
            </div>
            {emailNotice && <p role="status" className="text-sm text-muted-foreground">{emailNotice}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => void sendEmailConfirmation()} disabled={emailSending || !profileEmail.trim()}>
                {emailSending ? t("Sending...") : t("Send confirmation")}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}
