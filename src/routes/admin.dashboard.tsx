import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Bus,
  CalendarDays,
  DollarSign,
  LayoutDashboard,
  Pencil,
  Save,
  Settings,
  Ticket,
  TrainFront,
  Users,
  Car,
  Plus,
} from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { tours, transportLabels } from "@/lib/tat-data";
import { useTourCatalog } from "@/lib/tour-catalog";
import { getTourImageUrl } from "@/lib/tour-images";
import { useLanguage } from "@/lib/language";
import fallbackTourImage from "@/assets/hero-coast.jpg";
import { useCurrency } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Admin Dashboard — TAT Booking" },
      { name: "description", content: "Manage tours, transport, bookings and users." },
      { property: "og:title", content: "Admin Dashboard — TAT Booking" },
      { property: "og:description", content: "Manage tours, transport, bookings and users." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

const transportIcon = { bus: Bus, train: TrainFront, car: Car } as const;

const tabs = ["Tours & Catalog", "Transport & Providers", "Bookings & Revenue", "Users & Security"] as const;
type Tab = (typeof tabs)[number];

type TourRecord = {
  tour_id?: string;
  id?: string;
  tour_name: string;
  destination: string;
  price: number;
  duration: string;
  transport: string;
  summary: string;
  rating: number;
  status_tour: string;
  required_vehicles_count: number;
  available_slot: number;
  image_url?: string | null;
};

type TourDraft = Omit<TourRecord, "rating" | "tour_id" | "id" | "image_url"> & {
  image_url: string;
};

type TourOption = { id: string; tour_name: string };

type VehicleRecord = {
  vehicle_id?: string;
  id?: string;
  vehicle_type: string;
  tour_id: string;
  status: string;
  license_id: string;
  slots: number;
  driver_name: string;
  phone_number: string;
  Tour?: { tour_name: string } | { tour_name: string }[] | null;
};

type VehicleStatus = "active" | "inactive";

type VehicleDraft = Omit<VehicleRecord, "vehicle_id" | "id" | "Tour" | "status"> & {
  status: VehicleStatus;
};

const emptyTourDraft: TourDraft = {
  tour_name: "",
  destination: "",
  price: 1,
  duration: "1 day",
  transport: "bus",
  summary: "",
  status_tour: "còn bán",
  required_vehicles_count: 0,
  available_slot: 0,
  image_url: "",
};

const tourTable = (supabase as unknown as SupabaseClient).from("Tour");
const vehicleTable = (supabase as unknown as SupabaseClient).from("Vehicle");

function recordIdentifier(record: { vehicle_id?: string; tour_id?: string; id?: string }, key: "vehicle_id" | "tour_id") {
  const value = record[key] ?? record.id;
  return value ? { column: record[key] ? key : "id", value } : null;
}

function normalizeVehicleType(value: string): "Xe khách" | "Xe riêng" {
  const normalized = value.toLocaleLowerCase();
  return normalized.includes("xe riêng") || normalized.includes("private") || normalized.includes("car")
    ? "Xe riêng"
    : "Xe khách";
}

function normalizeVehicleStatus(value: string | null | undefined): VehicleStatus {
  const normalized = value?.trim().toLocaleLowerCase();
  return normalized === "inactive" || normalized === "đang tạm dừng" ? "inactive" : "active";
}

function vehicleStatusLabel(value: string | null | undefined): string {
  return normalizeVehicleStatus(value) === "active" ? "Đang hoạt động" : "Đang tạm dừng";
}

function normalizeTourTransport(value: string): "bus" | "car" {
  const normalized = value.trim().toLocaleLowerCase();
  return normalized === "car" || normalized.includes("private") || normalized.includes("xe riêng")
    ? "car"
    : "bus";
}

function seatsPerVehicle(transport: string): number {
  return normalizeTourTransport(transport) === "car" ? 6 : 16;
}

const recentBookings = [
  { id: "BK-2041", customer: "Nguyen V. A", tour: tours[0]!.title, amount: 178, status: "Paid" },
  { id: "BK-2040", customer: "S. Tanaka", tour: tours[2]!.title, amount: 264, status: "Paid" },
  { id: "BK-2039", customer: "M. Schmidt", tour: tours[4]!.title, amount: 152, status: "Pending" },
  { id: "BK-2038", customer: "A. Rahman", tour: tours[1]!.title, amount: 108, status: "Paid" },
  { id: "BK-2037", customer: "C. Lopez", tour: tours[5]!.title, amount: 94, status: "Refunded" },
] as const;

function AdminPage() {
  const [tab, setTab] = useState<Tab>("Tours & Catalog");
  const { t: translate } = useLanguage();
  const { formatPrice } = useCurrency();
  const stats = [
    { label: translate("Total bookings"), value: "1,284", delta: "+12.4%", Icon: Ticket },
    { label: translate("Revenue (30d)"), value: formatPrice(86420), delta: "+8.1%", Icon: DollarSign },
    { label: translate("Seat utilization"), value: "87%", delta: "+3.2pts", Icon: Bus },
    { label: translate("Active tours"), value: "6", delta: "+1", Icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">{translate("Admin dashboard")}</h1>
            <p className="text-sm text-muted-foreground">{translate("Tours, transport, bookings and staff in one place.")}</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            <Settings className="size-4" aria-hidden /> {translate("Settings")}
          </Button>
        </div>

        {/* Stats */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-5 shadow-soft">
              <div className="flex items-center justify-between">
                <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <s.Icon className="size-5" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-teal">{s.delta}</span>
              </div>
              <p className="mt-3 font-display text-2xl font-extrabold">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mt-8 flex flex-wrap gap-1.5 border-b border-border">
          {tabs.map((tabLabel) => (
            <button
              key={tabLabel}
              onClick={() => setTab(tabLabel)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === tabLabel ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {translate(tabLabel)}
            </button>
          ))}
        </div>

        <div className="mt-6">
          {tab === "Tours & Catalog" && <ToursTab />}
          {tab === "Transport & Providers" && <TransportTab />}
          {tab === "Bookings & Revenue" && <BookingsTab />}
          {tab === "Users & Security" && <UsersTab />}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function ToursTab() {
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const { refreshTours } = useTourCatalog();
  const [tours, setTours] = useState<TourRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingTour, setEditingTour] = useState<TourRecord | null>(null);
  const [draft, setDraft] = useState<TourDraft>(emptyTourDraft);

  async function loadTours() {
    setLoading(true);
    setError(null);
    const { data, error: queryError } = await tourTable.select("*");
    if (queryError) setError(queryError.message);
    else setTours((data ?? []) as TourRecord[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadTours();
  }, []);

  function openEditor(tour?: TourRecord) {
    setError(null);
    setEditingTour(tour ?? null);
    setDraft(
      tour
        ? {
            tour_name: tour.tour_name,
            destination: tour.destination,
            price: tour.price,
            duration: tour.duration,
            transport: normalizeTourTransport(tour.transport),
            summary: tour.summary,
            status_tour: tour.status_tour,
            required_vehicles_count: tour.required_vehicles_count,
            available_slot: tour.available_slot,
            image_url: tour.image_url ?? "",
          }
        : { ...emptyTourDraft },
    );
    setEditorOpen(true);
  }

  async function saveTour() {
    if (!draft.tour_name.trim() || !draft.destination.trim() || draft.price <= 0) return;
    setSaving(true);
    setError(null);
    const values = {
      tour_name: draft.tour_name.trim(),
      destination: draft.destination.trim(),
      price: draft.price,
      duration: draft.duration,
      transport: draft.transport,
      summary: draft.summary,
      rating: 5.0,
      status_tour: draft.status_tour,
      required_vehicles_count: draft.required_vehicles_count,
      available_slot: draft.available_slot,
      image_url: draft.image_url.trim() || null,
    };

    let saveError: { message: string } | null;
    if (editingTour) {
      const identifier = recordIdentifier(editingTour, "tour_id");
      if (!identifier) {
        setError(t("Unable to find the tour ID to update."));
        setSaving(false);
        return;
      }
      const { error: updateError } = await tourTable.update(values).eq(identifier.column, identifier.value);
      saveError = updateError;
    } else {
      const { error: insertError } = await tourTable.insert(values);
      saveError = insertError;
    }

    if (saveError) {
      setError(saveError.message);
    } else {
      setEditorOpen(false);
      setEditingTour(null);
      await loadTours();
      await refreshTours();
    }
    setSaving(false);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">{t("Tours & Catalog")}</h2>
          <p className="text-sm text-muted-foreground">{t("Add tours and review the current catalog.")}</p>
        </div>
        <Button variant="cta" size="sm" onClick={() => openEditor()}>
          <Plus className="size-4" aria-hidden /> {t("Add tour")}
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-soft">
        <table className="w-full min-w-[980px] text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">{t("Tour")}</th>
              <th className="px-4 py-3 font-medium">{t("Image")}</th>
              <th className="px-4 py-3 font-medium">{t("Destination")}</th>
              <th className="px-4 py-3 font-medium">{t("Price")}</th>
              <th className="px-4 py-3 font-medium">{t("Rating")}</th>
              <th className="px-4 py-3 font-medium">{t("Status")}</th>
              <th className="px-4 py-3 font-medium">{t("Vehicles")}</th>
              <th className="px-4 py-3 font-medium">{t("Available slots")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("Actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? (
              <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={9}>{t("Loading tours...")}</td></tr>
            ) : tours.length === 0 ? (
              <tr><td className="px-4 py-6 text-center text-muted-foreground" colSpan={9}>{t("No tours found.")}</td></tr>
            ) : tours.map((tour, index) => (
              <tr key={tour.tour_id ?? tour.id ?? `${tour.tour_name}-${index}`} className="hover:bg-secondary/30">
                <td className="px-4 py-3 font-medium">{tour.tour_name}</td>
                <td className="px-4 py-3">
                  <img
                    src={getTourImageUrl(tour.image_url) || fallbackTourImage}
                    alt={`${tour.tour_name} ${t("Tour preview")}`}
                    loading="lazy"
                    className="size-12 rounded-md object-cover"
                  />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{tour.destination}</td>
                <td className="px-4 py-3">{formatPrice(tour.price)}</td>
                <td className="px-4 py-3">{tour.rating}★</td>
                <td className="px-4 py-3">
                  <Badge variant="outline">
                    {t(tour.status_tour === "còn bán" ? "For sale" : tour.status_tour === "tạm đóng" ? "Temporarily closed" : tour.status_tour)}
                  </Badge>
                </td>
                <td className="px-4 py-3">{tour.required_vehicles_count}</td>
                <td className="px-4 py-3">{tour.available_slot}</td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => openEditor(tour)}>
                    <Pencil className="size-3.5" aria-hidden /> {t("Edit")}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error && !editorOpen && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTour ? t("Edit tour") : t("Add tour")}</DialogTitle>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tour-title">{t("Tour name")}</Label>
              <Input id="tour-title" value={draft.tour_name} onChange={(event) => setDraft({ ...draft, tour_name: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tour-destination">{t("Destination")}</Label>
              <Input id="tour-destination" value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tour-image-url">{t("Image URL or Storage path")}</Label>
              <Input
                id="tour-image-url"
                type="text"
                placeholder={t("Paste a public image URL or Storage path")}
                value={draft.image_url}
                onChange={(event) => setDraft({ ...draft, image_url: event.target.value })}
              />
              <img
                src={getTourImageUrl(draft.image_url) || fallbackTourImage}
                alt={t("Tour image preview")}
                className="mt-1 h-32 w-full rounded-md object-cover"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tour-price">{t("Price (USD)")}</Label>
                <Input id="tour-price" type="number" min="1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tour-duration">{t("Duration")}</Label>
                <Input id="tour-duration" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tour-transport">{t("Transport")}</Label>
                <select
                  id="tour-transport"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.transport}
                  onChange={(event) => {
                    const transport = event.target.value;
                    setDraft({
                      ...draft,
                      transport,
                      available_slot: draft.required_vehicles_count * seatsPerVehicle(transport),
                    });
                  }}
                >
                  <option value="bus">{t("Coach / Bus")}</option>
                  <option value="car">{t("Private Car")}</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tour-summary">{t("Summary")}</Label>
              <textarea id="tour-summary" className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="tour-status">{t("Tour status")}</Label>
                <select
                  id="tour-status"
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={draft.status_tour}
                  onChange={(event) => setDraft({ ...draft, status_tour: event.target.value })}
                >
                  <option value="còn bán">{t("For sale")}</option>
                  <option value="tạm đóng">{t("Temporarily closed")}</option>
                </select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tour-vehicles">{t("Required vehicles")}</Label>
                <Input
                  id="tour-vehicles"
                  type="number"
                  min="0"
                  value={draft.required_vehicles_count}
                  onChange={(event) => {
                    const requiredVehicles = Number(event.target.value) || 0;
                    setDraft({
                      ...draft,
                      required_vehicles_count: requiredVehicles,
                      available_slot: requiredVehicles * seatsPerVehicle(draft.transport),
                    });
                  }}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tour-slots">{t("Available slots")}</Label>
                <Input id="tour-slots" type="number" min="0" value={draft.available_slot} onChange={(event) => setDraft({ ...draft, available_slot: Number(event.target.value) || 0 })} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>{t("Cancel")}</Button>
            <Button variant="cta" onClick={saveTour} disabled={saving}>
              {saving ? t("Saving...") : editingTour ? t("Save changes") : t("Save tour")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransportTab() {
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [tourOptions, setTourOptions] = useState<TourOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<VehicleRecord | null>(null);
  const [draft, setDraft] = useState<VehicleDraft>({
    vehicle_type: "Xe khách",
    tour_id: "",
    status: "active",
    license_id: "",
    slots: 16,
    driver_name: "",
    phone_number: "",
  });

  async function loadVehicles() {
    setLoading(true);
    setError(null);
    const [vehicleResult, tourResult] = await Promise.all([
      vehicleTable.select("*, Tour(tour_name)"),
      tourTable.select("*"),
    ]);

    if (vehicleResult.error) setError(vehicleResult.error.message);
    else setVehicles((vehicleResult.data ?? []) as VehicleRecord[]);

    if (tourResult.error) {
      setError((currentError) => currentError ?? tourResult.error.message);
    } else {
      const options = (tourResult.data ?? []).flatMap((row) => {
        const tour = row as Record<string, unknown>;
        const identifier = recordIdentifier(tour as { tour_id?: string; id?: string }, "tour_id");
        return identifier && typeof tour["tour_name"] === "string"
          ? [{ id: identifier.value, tour_name: tour["tour_name"] }]
          : [];
      });
      setTourOptions(options);
    }
    setLoading(false);
  }

  useEffect(() => {
    void loadVehicles();
  }, []);

  function openAddForm() {
    setError(null);
    setEditingVehicle(null);
    setDraft({
      vehicle_type: "Xe khách",
      tour_id: "",
      status: "active",
      license_id: "",
      slots: 16,
      driver_name: "",
      phone_number: "",
    });
    setEditorOpen(true);
  }

  function openEditForm(vehicle: VehicleRecord) {
    setError(null);
    setEditingVehicle(vehicle);
    setDraft({
      vehicle_type: normalizeVehicleType(vehicle.vehicle_type ?? "Xe khách"),
      tour_id: vehicle.tour_id ?? "",
      status: normalizeVehicleStatus(vehicle.status),
      license_id: vehicle.license_id ?? "",
      slots: vehicle.slots ?? 1,
      driver_name: vehicle.driver_name ?? "",
      phone_number: vehicle.phone_number ?? "",
    });
    setEditorOpen(true);
  }

  async function saveVehicle() {
    if (!draft.vehicle_type.trim() || !draft.tour_id || !draft.license_id.trim() || draft.slots <= 0) return;
    setSaving(true);
    setError(null);
    const values = {
      vehicle_type: draft.vehicle_type.trim(),
      tour_id: draft.tour_id,
      status: draft.status,
      license_id: draft.license_id.trim(),
      slots: draft.slots,
      driver_name: draft.driver_name.trim(),
      phone_number: draft.phone_number.trim(),
    };

    let saveError: { message: string } | null;
    if (editingVehicle) {
      const identifier = recordIdentifier(editingVehicle, "vehicle_id");
      if (!identifier) {
        setError("Không tìm thấy ID xe để cập nhật.");
        setSaving(false);
        return;
      }
      const { error: updateError } = await vehicleTable.update(values).eq(identifier.column, identifier.value);
      saveError = updateError;
    } else {
      const { error: insertError } = await vehicleTable.insert(values);
      saveError = insertError;
    }

    if (saveError) {
      setError(saveError.message);
    } else {
      setEditorOpen(false);
      setEditingVehicle(null);
      await loadVehicles();
    }
    setSaving(false);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Phương tiện & nhà cung cấp</h2>
          <p className="text-sm text-muted-foreground">Quản lý phương tiện, tài xế và tour được phân công.</p>
        </div>
        <Button variant="cta" size="sm" onClick={openAddForm}>
          <Plus className="size-4" aria-hidden /> Thêm xe
        </Button>
      </div>
      {error && !editorOpen && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      {loading ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Đang tải phương tiện...</p>
      ) : vehicles.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Chưa có phương tiện.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vehicles.map((vehicle, index) => {
            const relation = Array.isArray(vehicle.Tour) ? vehicle.Tour[0] : vehicle.Tour;
            const tourName = relation?.tour_name ?? tourOptions.find((tour) => tour.id === vehicle.tour_id)?.tour_name ?? "Chưa xác định tour";
            const vehicleType = normalizeVehicleType(vehicle.vehicle_type);
            const vehicleIsActive = normalizeVehicleStatus(vehicle.status) === "active";
            const Icon = vehicleType === "Xe khách" ? Bus : Car;
            return (
              <div key={vehicle.vehicle_id ?? vehicle.id ?? `${vehicle.license_id}-${index}`} className="rounded-lg border border-border bg-card p-5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="min-w-0 flex-1 font-display text-sm font-bold">{tourName}</h3>
                  <Button variant="ghost" size="sm" onClick={() => openEditForm(vehicle)}>
                    <Pencil className="size-3.5" aria-hidden /> Sửa
                  </Button>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="size-4" aria-hidden />
                    </span>
                    <p className="text-xs text-muted-foreground">{vehicleType}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={vehicleIsActive ? "shrink-0 border-transparent bg-green-100 text-green-800" : "shrink-0 border-transparent bg-amber-100 text-amber-800"}
                  >
                    {vehicleStatusLabel(vehicle.status)}
                  </Badge>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-muted-foreground">Sức chứa</dt><dd className="text-right font-medium">{vehicle.slots} chỗ</dd>
                  <dt className="text-muted-foreground">Biển số</dt><dd className="text-right font-medium">{vehicle.license_id}</dd>
                  <dt className="text-muted-foreground">Tên tài xế</dt><dd className="text-right font-medium">{vehicle.driver_name || "Chưa cập nhật"}</dd>
                  <dt className="text-muted-foreground">Điện thoại</dt><dd className="text-right font-medium">{vehicle.phone_number || "Chưa cập nhật"}</dd>
                </dl>
              </div>
            );
          })}
        </div>
      )}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingVehicle ? "Chỉnh sửa xe" : "Thêm xe"}</DialogTitle>
          </DialogHeader>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-type">Loại phương tiện</Label>
              <select
                id="vehicle-type"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.vehicle_type}
                onChange={(event) => setDraft({
                  ...draft,
                  vehicle_type: event.target.value,
                  slots: event.target.value === "Xe khách" ? 16 : 6,
                })}
              >
                <option value="Xe khách">Xe khách</option>
                <option value="Xe riêng">Xe riêng</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-tour">Tour</Label>
              <select id="vehicle-tour" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.tour_id} onChange={(event) => setDraft({ ...draft, tour_id: event.target.value })}>
                <option value="">Chọn tour</option>
                {tourOptions.map((tour) => <option key={tour.id} value={tour.id}>{tour.tour_name}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-status">Trạng thái</Label>
              <select
                id="vehicle-status"
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={draft.status}
                onChange={(event) => setDraft({ ...draft, status: event.target.value as VehicleStatus })}
              >
                <option value="active">Đang hoạt động</option>
                <option value="inactive">Đang tạm dừng</option>
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-license">Biển số</Label>
              <Input id="vehicle-license" value={draft.license_id} onChange={(event) => setDraft({ ...draft, license_id: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-slots">Sức chứa (chỗ)</Label>
              <Input id="vehicle-slots" type="number" min="1" value={draft.slots} onChange={(event) => setDraft({ ...draft, slots: Number(event.target.value) || 0 })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="vehicle-driver">Tên tài xế</Label>
              <Input id="vehicle-driver" value={draft.driver_name} onChange={(event) => setDraft({ ...draft, driver_name: event.target.value })} />
            </div>
            <div className="grid gap-1.5 sm:col-span-2">
              <Label htmlFor="vehicle-phone">Số điện thoại</Label>
              <Input id="vehicle-phone" type="tel" value={draft.phone_number} onChange={(event) => setDraft({ ...draft, phone_number: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Hủy</Button>
            <Button variant="cta" onClick={saveVehicle} disabled={saving || tourOptions.length === 0}>
              <Save className="size-4" aria-hidden /> {saving ? "Đang lưu..." : "Lưu xe"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function BookingsTab() {
  const { formatPrice } = useCurrency();

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-bold">Recent bookings</h3>
        <Button variant="outline" size="sm">
          <CalendarDays className="size-4" aria-hidden /> This month
        </Button>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Booking</th>
            <th className="px-4 py-3 font-medium">Customer</th>
            <th className="px-4 py-3 font-medium">Tour</th>
            <th className="px-4 py-3 font-medium">Amount</th>
            <th className="px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {recentBookings.map((b) => (
            <tr key={b.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-mono text-xs">{b.id}</td>
              <td className="px-4 py-3">{b.customer}</td>
              <td className="px-4 py-3 text-muted-foreground">{b.tour}</td>
              <td className="px-4 py-3">{formatPrice(b.amount)}</td>
              <td className="px-4 py-3">
                <Badge
                  variant="outline"
                  className={
                    b.status === "Paid" ? "bg-teal/10 text-teal" : b.status === "Pending" ? "bg-accent/10 text-accent" : "bg-destructive/10 text-destructive"
                  }
                >
                  {b.status}
                </Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsersTab() {
  type ProfileListItem = Pick<Tables<"profiles">, "id" | "name" | "email" | "role" | "status" | "sdt" | "updated_at">;
  type ProfileDraft = Pick<ProfileListItem, "role" | "status" | "sdt">;
  const { user, profile: currentProfile, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const [profiles, setProfiles] = useState<ProfileListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [saving, setSaving] = useState(false);

  const currentUserRole = currentProfile?.role ?? profiles.find((profile) => profile.id === user?.id)?.role;
  const canEditAllFields = currentUserRole === "admin";
  const canEditStatus = canEditAllFields || currentUserRole === "moderator";

  function canEditProfile(profile: ProfileListItem) {
    return canEditStatus || profile.id === user?.id;
  }

  function startEditing(profile: ProfileListItem) {
    setEditingId(profile.id);
    setDraft({ role: profile.role, status: profile.status, sdt: profile.sdt ?? "" });
    setError(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setDraft(null);
  }

  async function saveProfile(profile: ProfileListItem) {
    if (!draft || !user) return;

    const isOwnProfile = profile.id === user.id;
    const changes: Partial<ProfileDraft> = isOwnProfile && !canEditStatus
      ? { sdt: draft.sdt }
      : canEditAllFields
        ? { role: draft.role, status: draft.status, sdt: draft.sdt }
        : { status: draft.status };

    setSaving(true);
    setError(null);
    const { data, error: updateError } = await supabase
      .from("profiles")
      .update(changes)
      .eq("id", profile.id)
      .select("id, name, email, role, status, sdt, updated_at")
      .single();

    if (updateError) {
      setError(updateError.message);
    } else if (data) {
      setProfiles((currentProfiles) => currentProfiles.map((item) => item.id === data.id ? data : item));
      cancelEditing();
    }
    setSaving(false);
  }

  useEffect(() => {
    let active = true;

    if (authLoading) {
      return () => {
        active = false;
      };
    }

    if (!user) {
      setProfiles([]);
      setError(null);
      setLoading(false);
      return () => {
        active = false;
      };
    }
    const authenticatedUser = user;

    async function loadProfiles() {
      setLoading(true);
      setError(null);

      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, name, email, role, status, sdt, updated_at")
        .order("updated_at", { ascending: false });

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
        setProfiles([]);
      } else {
        const authName = (authenticatedUser.user_metadata?.["name"] as string | undefined);
        setProfiles(
          (data ?? []).map((profile) => {
            const email = profile.email ?? (profile.id === authenticatedUser.id ? authenticatedUser.email ?? null : null);
            const metadataName = profile.id === authenticatedUser.id ? authName : null;
            return {
              ...profile,
              name: profile.name ?? metadataName ?? email?.split("@")[0] ?? null,
              email,
            };
          }),
        );
      }
      setLoading(false);
    }

    void loadProfiles();
    return () => {
      active = false;
    };
  }, [authLoading, user]);

  const roleLabels: Record<ProfileListItem["role"], string> = {
    admin: "Quản trị",
    moderator: "Điều phối viên",
    guest: "Nhân viên",
  };

  const statusLabels: Record<string, string> = {
    active: "Hoạt động",
    inactive: "Không hoạt động",
    suspended: "Tạm khóa",
  };

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-bold">Staff & roles</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Email</th>
            <th className="px-4 py-3 font-medium">Phone</th>
            <th className="px-4 py-3 font-medium">Role</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Updated</th>
            <th className="px-4 py-3 text-right font-medium">Thao tác</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {loading && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">Loading users...</td>
            </tr>
          )}
          {!loading && error && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-destructive">Unable to load users: {error}</td>
            </tr>
          )}
          {!authLoading && !user && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t("Sign in to view staff and roles.")}</td>
            </tr>
          )}
          {!loading && user && !error && profiles.length === 0 && (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No users found.</td>
            </tr>
          )}
          {!loading && !error && profiles.map((profile) => (
            <tr key={profile.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium">{profile.name ?? "Chưa cập nhật"}</td>
              <td className="px-4 py-3 text-muted-foreground">{profile.email ?? "Chưa cập nhật"}</td>
              <td className="px-4 py-3 text-muted-foreground">
                {editingId === profile.id ? (
                  <input
                    aria-label={`Số điện thoại của ${profile.name ?? profile.email ?? "nhân viên"}`}
                    className="w-full rounded-md border border-input bg-background px-2 py-1"
                    value={draft?.sdt ?? ""}
                    onChange={(event) => setDraft((currentDraft) => currentDraft ? { ...currentDraft, sdt: event.target.value } : currentDraft)}
                  />
                ) : profile.sdt ?? "Chưa cập nhật"}
              </td>
              <td className="px-4 py-3">
                {editingId === profile.id && canEditAllFields ? (
                  <select
                    aria-label={`Vai trò của ${profile.name ?? profile.email ?? "nhân viên"}`}
                    className="rounded-md border border-input bg-background px-2 py-1"
                    value={draft?.role ?? profile.role}
                    onChange={(event) => setDraft((currentDraft) => currentDraft ? { ...currentDraft, role: event.target.value as ProfileListItem["role"] } : currentDraft)}
                  >
                    <option value="admin">Quản trị</option>
                    <option value="moderator">Điều phối viên</option>
                    <option value="guest">Nhân viên</option>
                  </select>
                ) : (
                  <Badge variant="outline" className="gap-1">
                    <Users className="size-3.5" aria-hidden /> {roleLabels[profile.role] ?? "Chưa cập nhật"}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3">
                {editingId === profile.id && canEditStatus ? (
                  <select
                    aria-label={`Trạng thái của ${profile.name ?? profile.email ?? "nhân viên"}`}
                    className="rounded-md border border-input bg-background px-2 py-1"
                    value={draft?.status ?? profile.status}
                    onChange={(event) => setDraft((currentDraft) => currentDraft ? { ...currentDraft, status: event.target.value } : currentDraft)}
                  >
                    <option value="active">Hoạt động</option>
                    <option value="inactive">Không hoạt động</option>
                    <option value="suspended">Tạm khóa</option>
                  </select>
                ) : (
                  <Badge variant="outline" className={profile.status === "active" ? "bg-teal/10 text-teal" : "bg-destructive/10 text-destructive"}>
                    {statusLabels[profile.status] ?? (profile.status || "Chưa cập nhật")}
                  </Badge>
                )}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
                {new Date(profile.updated_at).toLocaleString("vi-VN")}
              </td>
              <td className="px-4 py-3 text-right">
                {editingId === profile.id ? (
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={cancelEditing}>Hủy</Button>
                    <Button size="sm" disabled={saving} onClick={() => void saveProfile(profile)}>
                      <Save className="size-4" aria-hidden /> Lưu
                    </Button>
                  </div>
                ) : canEditProfile(profile) ? (
                  <Button variant="ghost" size="sm" onClick={() => startEditing(profile)}>
                    <Pencil className="size-4" aria-hidden /> Sửa
                  </Button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}
