import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Currency = "USD" | "VND" | "EUR" | "SGD";

const STORAGE_KEY = "tat-currency";
const rates: Record<Currency, number> = {
  USD: 1,
  VND: 25_000,
  EUR: 0.92,
  SGD: 1.34,
};
const locales: Record<Currency, string> = {
  USD: "en-US",
  VND: "vi-VN",
  EUR: "de-DE",
  SGD: "en-SG",
};

export const currencies: Currency[] = ["USD", "VND", "EUR", "SGD"];

export function formatPrice(value: number, currency: Currency = "USD") {
  return new Intl.NumberFormat(locales[currency], {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "VND" ? 0 : 2,
  }).format(value * rates[currency]);
}

type CurrencyContextValue = {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  formatPrice: (value: number) => string;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD");

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && currencies.includes(saved as Currency)) setCurrencyState(saved as Currency);
  }, []);

  const value = useMemo(
    () => ({
      currency,
      setCurrency: (next: Currency) => {
        window.localStorage.setItem(STORAGE_KEY, next);
        setCurrencyState(next);
      },
      formatPrice: (value: number) => formatPrice(value, currency),
    }),
    [currency],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error("useCurrency must be used within CurrencyProvider");
  return context;
}
