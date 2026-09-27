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
  Eye,
  EyeOff,
  Plus,
} from "lucide-react";
import { SiteHeader } from "@/components/site/header";
import { SiteFooter } from "@/components/site/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { tours, transportLabels } from "@/lib/tat-data";
import { useCurrency } from "@/lib/currency";
import { useTourCatalog, type TourDraft } from "@/lib/tour-catalog";
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

const emptyTourDraft: TourDraft = {
  title: "",
  destination: "",
  price: 1,
  duration: "1 day",
  transport: "bus",
  summary: "",
};

const recentBookings = [
  { id: "BK-2041", customer: "Nguyen V. A", tour: tours[0]!.title, amount: 178, status: "Paid" },
  { id: "BK-2040", customer: "S. Tanaka", tour: tours[2]!.title, amount: 264, status: "Paid" },
  { id: "BK-2039", customer: "M. Schmidt", tour: tours[4]!.title, amount: 152, status: "Pending" },
  { id: "BK-2038", customer: "A. Rahman", tour: tours[1]!.title, amount: 108, status: "Paid" },
  { id: "BK-2037", customer: "C. Lopez", tour: tours[5]!.title, amount: 94, status: "Refunded" },
] as const;

function AdminPage() {
  const [tab, setTab] = useState<Tab>("Tours & Catalog");
  const { formatPrice } = useCurrency();
  const stats = [
    { label: "Total bookings", value: "1,284", delta: "+12.4%", Icon: Ticket },
    { label: "Revenue (30d)", value: formatPrice(86420), delta: "+8.1%", Icon: DollarSign },
    { label: "Seat utilization", value: "87%", delta: "+3.2pts", Icon: Bus },
    { label: "Active tours", value: "6", delta: "+1", Icon: LayoutDashboard },
  ];

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 sm:flex sm:justify-between">
          <div className="min-w-0">
            <h1 className="truncate font-display text-2xl font-extrabold sm:text-3xl">Admin dashboard</h1>
            <p className="text-sm text-muted-foreground">Tours, transport, bookings and staff in one place.</p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0">
            <Settings className="size-4" aria-hidden /> Settings
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
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "border-b-2 border-primary text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
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
  const { formatPrice } = useCurrency();
  const { tours, hiddenIds, addTour, updateTour, toggleTourVisibility } = useTourCatalog();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TourDraft>(emptyTourDraft);

  function openEditor(tour?: (typeof tours)[number]) {
    setEditingId(tour?.id ?? null);
    setDraft(tour ? {
      title: tour.title,
      destination: tour.destination,
      price: tour.price,
      duration: tour.duration,
      transport: tour.transport,
      summary: tour.summary,
    } : emptyTourDraft);
    setEditorOpen(true);
  }

  function saveTour() {
    if (!draft.title.trim() || !draft.destination.trim() || draft.price <= 0) return;
    if (editingId) updateTour(editingId, draft);
    else addTour(draft);
    setEditorOpen(false);
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold">Tours & Catalog</h2>
          <p className="text-sm text-muted-foreground">Add, edit, or hide tours from the public catalog.</p>
        </div>
        <Button variant="cta" size="sm" onClick={() => openEditor()}>
          <Plus className="size-4" aria-hidden /> Add tour
        </Button>
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-soft">
      <table className="w-full text-sm">
        <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-4 py-3 font-medium">Tour</th>
            <th className="px-4 py-3 font-medium">Destination</th>
            <th className="px-4 py-3 font-medium">Price</th>
            <th className="px-4 py-3 font-medium">Rating</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {tours.map((t) => {
            const hidden = hiddenIds.includes(t.id);
            return (
            <tr key={t.id} className="hover:bg-secondary/30">
              <td className="px-4 py-3 font-medium">{t.title}</td>
              <td className="px-4 py-3 text-muted-foreground">{t.destination}</td>
              <td className="px-4 py-3">{formatPrice(t.price)}</td>
              <td className="px-4 py-3">{t.rating}★</td>
              <td className="px-4 py-3">
                <Badge variant="outline" className={hidden ? "bg-secondary text-muted-foreground" : "bg-teal/10 text-teal"}>
                  {hidden ? "Hidden" : "Live"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Button variant="ghost" size="sm" onClick={() => openEditor(t)}>
                  <Pencil className="size-3.5" aria-hidden /> Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => toggleTourVisibility(t.id)}>
                  {hidden ? <Eye className="size-3.5" aria-hidden /> : <EyeOff className="size-3.5" aria-hidden />}
                  {hidden ? "Show" : "Hide"}
                </Button>
              </td>
            </tr>
            );
          })}
        </tbody>
      </table>
      </div>
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit tour" : "Add tour"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="tour-title">Tour name</Label>
              <Input id="tour-title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tour-destination">Destination</Label>
              <Input id="tour-destination" value={draft.destination} onChange={(event) => setDraft({ ...draft, destination: event.target.value })} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-1.5">
                <Label htmlFor="tour-price">Price (USD)</Label>
                <Input id="tour-price" type="number" min="1" value={draft.price} onChange={(event) => setDraft({ ...draft, price: Number(event.target.value) || 0 })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tour-duration">Duration</Label>
                <Input id="tour-duration" value={draft.duration} onChange={(event) => setDraft({ ...draft, duration: event.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="tour-transport">Transport</Label>
                <select id="tour-transport" className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={draft.transport} onChange={(event) => setDraft({ ...draft, transport: event.target.value as TourDraft["transport"] })}>
                  <option value="bus">Coach / Bus</option>
                  <option value="train">Train</option>
                  <option value="car">Private Car</option>
                </select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="tour-summary">Summary</Label>
              <textarea id="tour-summary" className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm" value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button variant="cta" onClick={saveTour}>Save tour</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TransportTab() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tours.map((t) => {
        const Icon = transportIcon[t.transport];
        return (
          <div key={t.id} className="rounded-xl border border-border bg-card p-5 shadow-soft">
            <div className="flex items-center justify-between">
              <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-4" aria-hidden />
              </span>
              <Badge variant="outline">{transportLabels[t.transport]}</Badge>
            </div>
            <h3 className="mt-3 font-display text-sm font-bold">{t.title}</h3>
            <p className="text-xs text-muted-foreground">{t.duration}</p>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Seat capacity</span>
              <span className="font-medium">40 / 40</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Attraction quota</span>
              <span className="font-medium">{t.attractions.length} venues</span>
            </div>
          </div>
        );
      })}
    </div>
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
  const { user, profile: currentProfile } = useAuth();
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

    async function loadProfiles() {
      setLoading(true);
      setError(null);

      const [{ data: authData }, { data, error: queryError }] = await Promise.all([
        supabase.auth.getUser(),
        supabase
          .from("profiles")
          .select("id, name, email, role, status, sdt, updated_at")
          .order("updated_at", { ascending: false }),
      ]);

      if (!active) return;

      if (queryError) {
        setError(queryError.message);
      } else {
        const authName =
          (authData.user?.user_metadata?.["name"] as string | undefined);
        setProfiles(
          (data ?? []).map((profile) => {
            const email = profile.email ?? (profile.id === authData.user?.id ? authData.user?.email ?? null : null);
            const metadataName = profile.id === authData.user?.id ? authName : null;
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
  }, []);

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
          {!loading && !error && profiles.length === 0 && (
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
