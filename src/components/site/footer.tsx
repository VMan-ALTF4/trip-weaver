import { Link } from "@tanstack/react-router";
import { Compass, Mail, Phone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/language";
import { SITE_CONTACT } from "@/lib/site-contact";
import vnpayLogo from "@/assets/payments/vnpay.png";
import momoLogo from "@/assets/payments/momo.png";
import paypalLogo from "@/assets/payments/paypal.png";

const paymentLogos = [
  { label: "VNPay", src: vnpayLogo },
  { label: "Momo", src: momoLogo },
  { label: "PayPal", src: paypalLogo },
] as const;

export function SiteFooter() {
  const { user, profile, profileLoading } = useAuth();
  const { t } = useLanguage();

  return (
    <footer className="mt-20 border-t border-border/80 bg-card">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-3">
          <section className="col-span-2 min-w-0 md:col-span-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Brand")}
            </h2>
            <div className="mt-4 flex min-w-0 items-center gap-2.5">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl shadow-soft surface-brand text-primary-foreground">
                <Compass className="size-5" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="font-display text-base font-extrabold">{t("TAT Booking")}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {t("Transport + attraction combo e-tickets, one booking.")}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2" aria-label={t("Payment methods")}>
              {paymentLogos.map(({ label, src }) => (
                <span
                  key={label}
                  className="flex size-6 shrink-0 items-center justify-center rounded-md border border-border bg-white p-0.5"
                >
                  <img
                    src={src}
                    alt={t(label)}
                    width={24}
                    height={24}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                </span>
              ))}
            </div>
          </section>

          <nav aria-label={t("Explore")}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Explore")}
            </h2>
            <div className="mt-4 flex flex-col items-start gap-3 text-sm">
              <Link to="/tours" className="text-foreground transition-colors hover:text-primary">
                {t("Tours")}
              </Link>
              <Link
                to="/my-bookings"
                className="text-foreground transition-colors hover:text-primary"
              >
                {t("My Bookings")}
              </Link>
              {!profileLoading && user && profile?.id === user.id && profile.role === "admin" && (
                <Link
                  to="/admin/dashboard"
                  className="text-foreground transition-colors hover:text-primary"
                >
                  {t("Admin")}
                </Link>
              )}
            </div>
          </nav>

          <section className="min-w-0">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("Contact")}
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Phone className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("Hotline")}</p>
                  <a
                    href={SITE_CONTACT.hotlineHref}
                    aria-label={t("Call TAT Booking hotline")}
                    className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {SITE_CONTACT.hotlineDisplay}
                  </a>
                </div>
              </div>
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                  <Mail className="size-4" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{t("Email")}</p>
                  <a
                    href={`mailto:${SITE_CONTACT.email}`}
                    aria-label={t("Email TAT Booking")}
                    className="break-all text-sm font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {SITE_CONTACT.email}
                  </a>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
      <div className="border-t border-border/80">
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-xs text-muted-foreground sm:px-6 sm:text-left sm:text-sm">
          © {new Date().getFullYear()} {t("TAT Booking")}
        </div>
      </div>
    </footer>
  );
}
