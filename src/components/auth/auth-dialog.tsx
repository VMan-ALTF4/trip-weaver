import { Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { AppleIcon, GoogleIcon, MicrosoftIcon } from "@/components/auth/social-icons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth, type OAuthProvider } from "@/hooks/use-auth";

export type AuthMode = "login" | "register";

const providers: { id: OAuthProvider; label: string; Icon: typeof GoogleIcon }[] = [
  { id: "google", label: "Google", Icon: GoogleIcon },
  { id: "apple", label: "Apple", Icon: AppleIcon },
  { id: "microsoft", label: "Microsoft", Icon: MicrosoftIcon },
];

export function AuthDialog({
  open,
  onOpenChange,
  mode,
  onModeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: AuthMode;
  onModeChange: (mode: AuthMode) => void;
}) {
  const { signIn, signUp, signInWithProvider, resetPassword } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [terms, setTerms] = useState(false);

  useEffect(() => {
    setError(null);
    setNotice(null);
  }, [mode, open]);

  const isRegister = mode === "register";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (isRegister) {
      if (password !== confirmPassword) return setError("Passwords do not match.");
      if (password.length < 6) return setError("Password must be at least 6 characters.");
      if (!terms) return setError("Please accept the Terms & Conditions to continue.");

      setBusy("email");
      const { error: err, needsConfirmation } = await signUp(fullName.trim(), email.trim(), password);
      setBusy(null);
      if (err) return setError(err);
      if (needsConfirmation) {
        setNotice(`We sent a confirmation link to ${email.trim()}. Open it to activate your account.`);
        return;
      }
      toast.success("Welcome to TAT Booking!");
      onOpenChange(false);
      return;
    }

    setBusy("email");
    const { error: err } = await signIn(email.trim(), password);
    setBusy(null);
    if (err) return setError(err);
    toast.success("Signed in");
    onOpenChange(false);
  }

  async function handleProvider(provider: OAuthProvider) {
    setError(null);
    setBusy(provider);
    const { error: err } = await signInWithProvider(provider);
    setBusy(null);
    if (err) setError(err);
    else onOpenChange(false);
  }

  async function handleForgot() {
    if (!email.trim()) return setError("Enter your email first, then tap Forgot password.");
    setBusy("reset");
    const { error: err } = await resetPassword(email.trim());
    setBusy(null);
    if (err) return setError(err);
    setNotice(`Password reset link sent to ${email.trim()}.`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto rounded-2xl sm:max-w-md">
        <div className="space-y-1.5">
          <DialogTitle className="font-display text-2xl font-extrabold">
            {isRegister ? "Create your account" : "Welcome back"}
          </DialogTitle>
          <DialogDescription>
            {isRegister
              ? "Book combo e-tickets and keep every trip in one place."
              : "Sign in to manage your bookings and saved tours."}
          </DialogDescription>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {providers.map(({ id, label, Icon }) => (
            <Button
              key={id}
              type="button"
              variant="outline"
              className="h-11 justify-center gap-2"
              disabled={busy !== null}
              onClick={() => handleProvider(id)}
            >
              {busy === id ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Icon />}
              <span className="text-sm">{label}</span>
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3 py-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Or continue with
          </span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4">
          {isRegister && (
            <div className="grid gap-1.5">
              <Label htmlFor="auth-name">Full name</Label>
              <div className="relative">
                <UserIcon
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="auth-name"
                  autoComplete="name"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Alex Nguyen"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>
          )}

          <div className="grid gap-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <div className="relative">
              <Mail
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-11 rounded-xl pl-9"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <div className="relative">
              <Lock
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                id="auth-password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-11 rounded-xl pl-9"
              />
            </div>
          </div>

          {isRegister && (
            <div className="grid gap-1.5">
              <Label htmlFor="auth-confirm">Confirm password</Label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="auth-confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="h-11 rounded-xl pl-9"
                />
              </div>
            </div>
          )}

          {isRegister ? (
            <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <Checkbox
                checked={terms}
                onCheckedChange={(v) => setTerms(v === true)}
                className="mt-0.5"
                aria-label="Accept terms and conditions"
              />
              <span>
                I agree to the <span className="font-medium text-foreground">Terms &amp; Conditions</span> and
                Privacy Policy.
              </span>
            </label>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  checked={remember}
                  onCheckedChange={(v) => setRemember(v === true)}
                  aria-label="Remember me"
                />
                Remember me
              </label>
              <button
                type="button"
                onClick={handleForgot}
                className="text-sm font-medium text-primary hover:underline"
              >
                Forgot password?
              </button>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
          {notice && (
            <p className="rounded-lg bg-teal/10 px-3 py-2 text-sm text-teal">{notice}</p>
          )}

          <Button type="submit" variant="cta" size="lg" disabled={busy !== null} className="w-full">
            {busy === "email" && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {isRegister ? "Create Account" : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {isRegister ? "Already have an account? " : "Don't have an account? "}
          <button
            type="button"
            onClick={() => onModeChange(isRegister ? "login" : "register")}
            className="font-semibold text-primary hover:underline"
          >
            {isRegister ? "Log in" : "Sign up"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
